import { beforeAll, describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { OcctKernel, ShapeHandle } from "occt-wasm";
import { facePushPullRoute, outwardFaceNormal, pushPullFaces } from "@/lib/facePushPull";
import { cadFaceIndexSlice, cadFaceRangesFromGroups } from "@/lib/cadModifierRuntime";

// Face push/pull is entirely kernel behaviour, so it is pinned against the real
// OCCT build rather than a stub. Every expectation below was first observed on
// the kernel; the assertions encode what it actually does, not what it ought to.

let cad: OcctKernel;

beforeAll(async () => {
  const { OcctKernel: Kernel } = await import("occt-wasm");
  const wasm = join(dirname(fileURLToPath(import.meta.resolve("occt-wasm"))), "occt-wasm.wasm");
  cad = await Kernel.init({ wasm });
}, 120_000);

function box(): ShapeHandle {
  return cad.makeBoxFromCorners({ x: -10, y: 0, z: -10 }, { x: 10, y: 20, z: 10 });
}

function facesOf(solid: ShapeHandle) {
  return cad.getSubShapes(solid, "face");
}

function faceAtCenter(solid: ShapeHandle, x: number, y: number, z: number) {
  const face = facesOf(solid).find((candidate) => {
    const center = cad.getSurfaceCenterOfMass(candidate);
    return Math.abs(center.x - x) < 1e-6 && Math.abs(center.y - y) < 1e-6 && Math.abs(center.z - z) < 1e-6;
  });
  if (!face) throw new Error(`no face centered at (${x}, ${y}, ${z})`);
  return face;
}

describe("outwardFaceNormal", () => {
  it("points away from the material on every face of a box", () => {
    const solid = box();
    const expected: Array<[number, number, number, number, number, number]> = [
      [-10, 10, 0, -1, 0, 0],
      [10, 10, 0, 1, 0, 0],
      [0, 0, 0, 0, -1, 0],
      [0, 20, 0, 0, 1, 0],
      [0, 10, -10, 0, 0, -1],
      [0, 10, 10, 0, 0, 1],
    ];
    for (const [cx, cy, cz, nx, ny, nz] of expected) {
      const normal = outwardFaceNormal(cad, solid, faceAtCenter(solid, cx, cy, cz));
      expect(normal.x * nx + normal.y * ny + normal.z * nz).toBeGreaterThan(0.99);
    }
  });

  it("disagrees with the raw shapeOrientation flag, which is why we probe the solid", () => {
    // Documents the trap: three box faces report "reversed" while their raw
    // surface normal already points outward. Flipping on that flag would send
    // the prism into the body instead of out of it.
    const solid = box();
    const flagged = facesOf(solid).filter((face) => cad.shapeOrientation(face) === "reversed");
    expect(flagged.length).toBe(3);
    for (const face of flagged) {
      const center = cad.getSurfaceCenterOfMass(face);
      const uv = cad.uvFromPoint(face, center);
      const raw = cad.surfaceNormal(face, uv.u, uv.v);
      const outward = outwardFaceNormal(cad, solid, face);
      // The probe keeps the raw direction; the orientation flag would invert it.
      expect(raw.x * outward.x + raw.y * outward.y + raw.z * outward.z).toBeGreaterThan(0);
    }
  });
});

describe("facePushPullRoute", () => {
  it("uses a prism for planar faces", () => {
    const solid = box();
    expect(facePushPullRoute(cad, solid, faceAtCenter(solid, 0, 20, 0))).toBe("prism");
  });

  it("uses thicken for a curved face that is part of a larger body", () => {
    const solid = cad.makeCylinder(10, 20);
    const lateral = facesOf(solid).find((face) => cad.surfaceType(face) === "cylinder");
    expect(lateral).toBeDefined();
    expect(facePushPullRoute(cad, solid, lateral as ShapeHandle)).toBe("thicken");
  });

  it("offsets the body when the face is the entire boundary", () => {
    for (const solid of [cad.makeSphere(10), cad.makeTorus(20, 5)]) {
      expect(facesOf(solid).length).toBe(1);
      expect(facePushPullRoute(cad, solid, facesOf(solid)[0])).toBe("offsetBody");
    }
  });
});

describe("pushPullFaces — planar", () => {
  it("grows and carves every face of a box by the swept volume", () => {
    for (const direction of [1, -1]) {
      const solid = box();
      const before = cad.getVolume(solid);
      for (const face of facesOf(solid)) {
        const result = pushPullFaces(cad, solid, [face], 5 * direction);
        // Each box face is 400 mm²; moving it 5 mm sweeps 2000 mm³.
        expect(cad.getVolume(result)).toBeCloseTo(before + direction * 2000, 1);
        expect(cad.isSolid(result)).toBe(true);
        expect(cad.isValid(result)).toBe(true);
      }
    }
  });

  it("moves only the selected face of a stepped body, and survives repeat use", () => {
    let solid = cad.getSubShapes(
      cad.unifySameDomain(cad.simplify(cad.fuse(box(), cad.makeBoxFromCorners({ x: -3, y: 20, z: -3 }, { x: 3, y: 22, z: 3 })))),
      "solid",
    )[0];
    expect(cad.getVolume(solid)).toBeCloseTo(8000 + 6 * 6 * 2, 1);

    // Re-finding the small top face each round proves the result stays a
    // well-formed solid that can be pushed again, like a real editing session.
    for (let round = 0; round < 3; round += 1) {
      const before = cad.getVolume(solid);
      const studTop = facesOf(solid)
        .map((face) => ({ face, area: cad.getSurfaceArea(face), normal: outwardFaceNormal(cad, solid, face) }))
        .filter((entry) => entry.normal.y > 0.99)
        .sort((a, b) => a.area - b.area)[0];
      expect(studTop.area).toBeCloseTo(36, 1);
      solid = pushPullFaces(cad, solid, [studTop.face], 4);
      expect(cad.getVolume(solid)).toBeCloseTo(before + 36 * 4, 1);
      expect(cad.isSolid(solid)).toBe(true);
    }
  });

  it("moves several faces at once", () => {
    const solid = box();
    const opposite = [faceAtCenter(solid, 0, 20, 0), faceAtCenter(solid, 10, 10, 0)];
    const result = pushPullFaces(cad, solid, opposite, 5);
    // The two prisms meet along the y=20 plane without overlapping, so the
    // swept volumes simply add: 400 mm² x 5 mm each.
    expect(cad.getVolume(result)).toBeCloseTo(8000 + 2000 + 2000, 1);
    expect(cad.isSolid(result)).toBe(true);
    expect(cad.isValid(result)).toBe(true);
  });
});

describe("pushPullFaces — curved", () => {
  it("resizes a cylinder wall in both directions", () => {
    for (const distance of [3, -3]) {
      const solid = cad.makeCylinder(10, 20);
      const lateral = facesOf(solid).find((face) => cad.surfaceType(face) === "cylinder") as ShapeHandle;
      const result = pushPullFaces(cad, solid, [lateral], distance);
      expect(cad.getVolume(result)).toBeCloseTo(Math.PI * (10 + distance) ** 2 * 20, 0);
      expect(cad.isSolid(result)).toBe(true);
      expect(cad.isValid(result)).toBe(true);
    }
  });

  it("resizes a hole drilled through a block", () => {
    const block = cad.makeBoxFromCorners({ x: -20, y: 0, z: -20 }, { x: 20, y: 10, z: 20 });
    const drill = cad.translate(
      cad.rotate(cad.makeCylinder(5, 40), { point: { x: 0, y: 0, z: 0 }, direction: { x: 1, y: 0, z: 0 } }, -Math.PI / 2),
      0, -5, 0,
    );
    const body = cad.getSubShapes(cad.cut(block, drill), "solid")[0];
    const wall = facesOf(body).find((face) => cad.surfaceType(face) === "cylinder") as ShapeHandle;
    for (const distance of [2, -2]) {
      const result = pushPullFaces(cad, body, [wall], distance);
      expect(cad.isSolid(result)).toBe(true);
      expect(cad.isValid(result)).toBe(true);
    }
  });

  it("resizes a fillet surface sitting among planar faces", () => {
    const source = box();
    const filleted = cad.fillet(source, [cad.getSubShapes(source, "edge")[0]], 3);
    const body = cad.isSolid(filleted) ? filleted : cad.getSubShapes(filleted, "solid")[0];
    const rounded = facesOf(body).find((face) => cad.surfaceType(face) === "cylinder") as ShapeHandle;
    for (const distance of [1.5, -1.5]) {
      const result = pushPullFaces(cad, body, [rounded], distance);
      expect(cad.isSolid(result)).toBe(true);
      expect(cad.isValid(result)).toBe(true);
    }
  });

  it("resizes a cone wall", () => {
    for (const distance of [2, -2]) {
      const solid = cad.makeCone(10, 5, 20);
      const lateral = facesOf(solid).find((face) => cad.surfaceType(face) === "cone") as ShapeHandle;
      const result = pushPullFaces(cad, solid, [lateral], distance);
      expect(cad.isSolid(result)).toBe(true);
      expect(cad.isValid(result)).toBe(true);
    }
  });

  it("offsets whole-boundary bodies, which booleans cannot merge", () => {
    for (const distance of [2, -2]) {
      const sphere = pushPullFaces(cad, cad.makeSphere(10), facesOf(cad.makeSphere(10)), distance);
      expect(cad.getVolume(sphere)).toBeCloseTo((4 / 3) * Math.PI * (10 + distance) ** 3, 0);
      expect(cad.isSolid(sphere)).toBe(true);

      const source = cad.makeTorus(20, 5);
      const torus = pushPullFaces(cad, source, facesOf(source), distance);
      expect(cad.getVolume(torus)).toBeCloseTo(2 * Math.PI ** 2 * 20 * (5 + distance) ** 2, 0);
      expect(cad.isSolid(torus)).toBe(true);
    }
  });
});

describe("pushPullFaces — rejected input", () => {
  it("rejects a zero distance instead of letting the kernel trap", () => {
    const solid = box();
    expect(() => pushPullFaces(cad, solid, [faceAtCenter(solid, 0, 20, 0)], 0)).toThrow(/distance other than zero/i);
  });

  it("rejects an empty selection", () => {
    expect(() => pushPullFaces(cad, box(), [], 5)).toThrow(/at least one face/i);
  });

  it("reports carving away the whole body rather than returning an empty shape", () => {
    const solid = box();
    expect(() => pushPullFaces(cad, solid, [faceAtCenter(solid, 0, 20, 0)], -25)).toThrow(/removes the whole body|leaves nothing/i);
  });
});

describe("meshShape face groups", () => {
  it("indexes faceGroups by index offset, not by triangle", () => {
    // The field names read like triangle counts; they are index counts. Picking
    // code that treats them as triangles reads the wrong face for every hit.
    const mesh = cad.meshShape(box(), { linearDeflection: 0.1, angularDeflection: 0.3 });
    expect(mesh.faceCount).toBe(6);
    const groups = mesh.faceGroups as Int32Array;
    expect(groups.length).toBe(18);
    let total = 0;
    for (let index = 0; index + 2 < groups.length; index += 3) total += groups[index + 1];
    expect(total).toBe(mesh.indices.length);
    expect(total).not.toBe(mesh.triangleCount);
  });

  it("draws each face from a slice whose vertices all lie on that face", () => {
    // The exact path production takes: mesh -> ranges -> per-face index slice.
    // A unit mismatch here would draw and pick one face using another's
    // triangles, so it is checked against real geometry.
    const solid = box();
    const handles = facesOf(solid);
    const mesh = cad.meshShape(solid, { linearDeflection: 0.05, angularDeflection: 0.25 });
    const ranges = cadFaceRangesFromGroups(mesh.faceGroups, handles.map((face) => cad.hashCode(face, 2_147_483_647)));

    let covered = 0;
    handles.forEach((face, id) => {
      const slice = cadFaceIndexSlice(ranges, mesh.indices, id);
      expect(slice).not.toBeNull();
      covered += (slice as Uint32Array).length;
      const normal = outwardFaceNormal(cad, solid, face);
      const center = cad.getSurfaceCenterOfMass(face);
      for (const vertex of slice as Uint32Array) {
        const offset = {
          x: mesh.positions[vertex * 3] - center.x,
          y: mesh.positions[vertex * 3 + 1] - center.y,
          z: mesh.positions[vertex * 3 + 2] - center.z,
        };
        expect(Math.abs(offset.x * normal.x + offset.y * normal.y + offset.z * normal.z)).toBeLessThan(1e-4);
      }
    });
    expect(covered).toBe(mesh.indices.length);
  });

  it("labels every group with a hash that maps back to a real face", () => {
    const solid = box();
    const mesh = cad.meshShape(solid, { linearDeflection: 0.1, angularDeflection: 0.3 });
    const hashes = new Set(facesOf(solid).map((face) => cad.hashCode(face, 2_147_483_647)));
    const groups = mesh.faceGroups as Int32Array;
    for (let index = 0; index + 2 < groups.length; index += 3) {
      expect(hashes.has(groups[index + 2])).toBe(true);
    }
  });
});
