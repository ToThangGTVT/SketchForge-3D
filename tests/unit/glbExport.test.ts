import { describe, expect, it } from "vitest";
import { exportMeshesToGlb } from "@/lib/glbExport";

describe("GLB export", () => {
  it("writes a self-contained glTF 2.0 asset with PBR, normals and generated UVs", async () => {
    const blob = exportMeshesToGlb([{
      name: "Game cube",
      vertices: [[0, 0, 0], [1000, 0, 0], [0, 1000, 0]],
      faces: [[0, 1, 2]],
      shape: { color: "#d41721", material: { metallic: 0.7, roughness: 0.25 } },
    }]);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect(view.getUint32(0, true)).toBe(0x46546c67);
    expect(view.getUint32(4, true)).toBe(2);
    const jsonLength = view.getUint32(12, true);
    const json = JSON.parse(new TextDecoder().decode(bytes.slice(20, 20 + jsonLength)));
    expect(json.asset.version).toBe("2.0");
    expect(json.meshes).toHaveLength(1);
    expect(json.accessors.some((accessor: { type: string }) => accessor.type === "VEC2")).toBe(true);
    expect(json.meshes[0].primitives[0].attributes).toMatchObject({ POSITION: expect.any(Number), NORMAL: expect.any(Number), TEXCOORD_0: expect.any(Number) });
    expect(json.materials[0].pbrMetallicRoughness).toMatchObject({ metallicFactor: 0.7, roughnessFactor: 0.25 });
  });

  it("carries collider metadata and creates requested game LODs", async () => {
    const blob = exportMeshesToGlb([{
      name: "LOD mesh",
      vertices: [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]],
      faces: [[0, 1, 2], [1, 3, 2]],
      shape: { color: "#ffffff", gameAsset: { collider: "box", lodCount: 1 } },
    }]);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const jsonLength = new DataView(bytes.buffer).getUint32(12, true);
    const json = JSON.parse(new TextDecoder().decode(bytes.slice(20, 20 + jsonLength)));
    expect(json.extensionsUsed).toContain("MSFT_lod");
    expect(json.nodes.find((node: { name: string }) => node.name === "LOD mesh").extras.sketchforge.collider).toBe("box");
  });

  it("exports brush paint as a separate child layer without tinting the base mesh", async () => {
    const blob = exportMeshesToGlb([{
      name: "Painted wall",
      vertices: [[0, 0, 0], [20, 0, 0], [0, 20, 0]],
      faces: [[0, 1, 2]],
      shape: {
        color: "#d41721",
        x: 0,
        z: 0,
        elevation: 0,
        height: 20,
        rotation: 0,
        paintStrokes: [{
          x: 5,
          y: 0,
          z: 0,
          normalX: 0,
          normalY: 0,
          normalZ: 1,
          color: "#1268d8",
          size: 8,
        }],
      },
    }]);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const jsonLength = new DataView(bytes.buffer).getUint32(12, true);
    const json = JSON.parse(new TextDecoder().decode(bytes.slice(20, 20 + jsonLength)));
    const baseNode = json.nodes.find((node: { name: string }) => node.name === "Painted wall");
    const paintNode = json.nodes.find((node: { extras?: { sketchforge?: { paintLayer?: boolean } } }) => node.extras?.sketchforge?.paintLayer);

    expect(json.meshes).toHaveLength(2);
    expect(json.meshes[0].primitives[0].attributes).not.toHaveProperty("COLOR_0");
    expect(baseNode.children).toEqual([json.nodes.indexOf(paintNode)]);
    expect(paintNode.name).toBe("Painted wall paint 1");
    expect(json.materials.map((material: { pbrMetallicRoughness: { baseColorFactor: number[] } }) => material.pbrMetallicRoughness.baseColorFactor.slice(0, 3))).toContainEqual([
      0x12 / 255,
      0x68 / 255,
      0xd8 / 255,
    ]);
  });
});
