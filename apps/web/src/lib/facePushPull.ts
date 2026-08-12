import type { OcctKernel, ShapeHandle, Vec3 } from "occt-wasm";

/**
 * Face push/pull: grow or carve a solid by moving one or more of its faces
 * along their own outward normals — the "extrude face" gesture from Blender and
 * "press pull" from Fusion.
 *
 * Three kernel routes are needed because no single OCCT operation covers every
 * face. Which one applies is decided by {@link facePushPullRoute}:
 *
 * - `offsetBody` — the face IS the solid's whole boundary (a bare sphere or
 *   torus has exactly one face). Booleans cannot merge a closed shell with the
 *   body it wraps: `fuse` leaves two touching solids in a compound instead of
 *   one solid. Offsetting the body is the same operation and yields a solid.
 * - `prism` — a planar face. A straight prism along the normal is exact.
 * - `thicken` — any other curved face (cylinder wall, cone, fillet surface).
 *   The offset surface follows the curvature, which a prism cannot do.
 *
 * All routes are verified against the real kernel in tests/e2e/facePushPull.e2e.ts.
 */

/** OCCT precision for offset/thicken reconstruction; matches the brepjs default. */
const PUSH_PULL_TOLERANCE = 1e-6;
/** Coarser retry: survives inputs that the precise tolerance rejects. */
const PUSH_PULL_FALLBACK_TOLERANCE = 1e-3;

export type FacePushPullRoute = "offsetBody" | "prism" | "thicken";

export class FacePushPullError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FacePushPullError";
  }
}

function normalize(vector: Vec3): Vec3 {
  const length = Math.hypot(vector.x, vector.y, vector.z);
  if (!Number.isFinite(length) || length < 1e-12) {
    throw new FacePushPullError("This face has no usable surface direction");
  }
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
}

/**
 * The face normal that points *away* from the material.
 *
 * OCCT's `shapeOrientation` flag is not a reliable guide here: on a plain box
 * three of the six faces report `reversed` while their raw surface normal
 * already points outward, so flipping on that flag gets only 3 of 6 right.
 * Instead we step a short way along the raw normal and ask the solid whether
 * that point is inside — a test that cannot disagree with the actual geometry.
 */
export function outwardFaceNormal(cad: OcctKernel, solid: ShapeHandle, face: ShapeHandle): Vec3 {
  const center = cad.getSurfaceCenterOfMass(face);
  const uv = cad.uvFromPoint(face, center);
  const raw = normalize(cad.surfaceNormal(face, uv.u, uv.v));
  const box = cad.getBoundingBox(solid, false);
  const diagonal = Math.hypot(box.xmax - box.xmin, box.ymax - box.ymin, box.zmax - box.zmin);
  const step = Math.max(1e-4, diagonal * 1e-3);
  const probe = { x: center.x + raw.x * step, y: center.y + raw.y * step, z: center.z + raw.z * step };
  let inside = false;
  try {
    inside = cad.containsPoint(solid, probe, 1e-7);
  } catch {
    // A point-in-solid test can fail on damaged topology; keep the raw normal.
    return raw;
  }
  return inside ? { x: -raw.x, y: -raw.y, z: -raw.z } : raw;
}

/** Which kernel route {@link facePushPullTool} will take for this face. */
export function facePushPullRoute(cad: OcctKernel, solid: ShapeHandle, face: ShapeHandle): FacePushPullRoute {
  if (cad.getSubShapes(solid, "face").length === 1) return "offsetBody";
  let surface = "unknown";
  try {
    surface = cad.surfaceType(face);
  } catch {
    surface = "unknown";
  }
  return surface === "plane" ? "prism" : "thicken";
}

function withToleranceRetry<T>(run: (tolerance: number) => T): T {
  try {
    return run(PUSH_PULL_TOLERANCE);
  } catch {
    return run(PUSH_PULL_FALLBACK_TOLERANCE);
  }
}

/**
 * The tool solid that gets fused onto (or cut out of) the body for one face.
 *
 * Returns `null` for the `offsetBody` route, which reshapes the body directly
 * and has no separate tool — see {@link pushPullFaces}.
 */
export function facePushPullTool(cad: OcctKernel, solid: ShapeHandle, face: ShapeHandle, distance: number): ShapeHandle | null {
  const route = facePushPullRoute(cad, solid, face);
  if (route === "offsetBody") return null;
  const magnitude = Math.abs(distance);
  if (route === "prism") {
    const normal = outwardFaceNormal(cad, solid, face);
    // Always build the prism on the side we are about to fuse or cut, so the
    // sign lives in the direction rather than in the boolean's arguments.
    const sign = distance >= 0 ? 1 : -1;
    return cad.extrude(face, normal.x * magnitude * sign, normal.y * magnitude * sign, normal.z * magnitude * sign);
  }
  return withToleranceRetry((tolerance) => cad.thicken(face, distance, tolerance));
}

/** Reduce a boolean result to the single solid it should contain. */
function singleSolid(cad: OcctKernel, shape: ShapeHandle): ShapeHandle {
  if (cad.isSolid(shape)) return shape;
  const solids = cad.getSubShapes(shape, "solid");
  if (solids.length === 1) return solids[0];
  if (solids.length === 0) {
    throw new FacePushPullError("That distance removes the whole body. Use a smaller distance.");
  }
  throw new FacePushPullError(`That distance splits the body into ${solids.length} separate pieces. Use a smaller distance.`);
}

/**
 * Push or pull `faces` of `solid` by `distance` (positive grows, negative carves).
 *
 * Every tool is built from the *original* solid before any boolean runs, so the
 * caller's face handles all stay valid; the booleans are then applied in one
 * pass. Selecting faces that overlap once moved is the caller's problem — the
 * result is validated and a bad combination surfaces as a thrown error rather
 * than a silently broken solid.
 */
export function pushPullFaces(cad: OcctKernel, solid: ShapeHandle, faces: ShapeHandle[], distance: number): ShapeHandle {
  if (faces.length === 0) {
    throw new FacePushPullError("Select at least one face");
  }
  if (!Number.isFinite(distance) || Math.abs(distance) < 1e-9) {
    // The kernel throws a raw WebAssembly.Exception on a zero-length prism.
    throw new FacePushPullError("Set a distance other than zero");
  }

  if (faces.length === 1 && facePushPullRoute(cad, solid, faces[0]) === "offsetBody") {
    const offsetBody = withToleranceRetry((tolerance) => cad.offset(solid, distance, tolerance));
    return validated(cad, singleSolid(cad, offsetBody));
  }

  const tools = faces
    .map((face) => facePushPullTool(cad, solid, face, distance))
    .filter((tool): tool is ShapeHandle => tool !== null);
  if (tools.length === 0) {
    throw new FacePushPullError("These faces cannot be pushed or pulled together");
  }

  // Fold the tools in one at a time. `fuseAll`/`cutAll` look like the right
  // call but leave the operands as separate solids inside a compound instead of
  // merging them, so the body would come back in pieces.
  let result = solid;
  for (const tool of tools) {
    result = distance >= 0 ? cad.fuse(result, tool) : cad.cut(result, tool);
    result = cad.unifySameDomain(cad.simplify(result));
  }
  return validated(cad, singleSolid(cad, result));
}

function validated(cad: OcctKernel, solid: ShapeHandle): ShapeHandle {
  let valid = false;
  try {
    valid = cad.isValid(solid);
  } catch {
    valid = false;
  }
  if (!valid) {
    throw new FacePushPullError("This distance produces invalid geometry. Use a smaller distance or fewer faces.");
  }
  let volume = 0;
  try {
    volume = cad.getVolume(solid);
  } catch {
    volume = 0;
  }
  if (!(volume > 1e-9)) {
    throw new FacePushPullError("That distance leaves nothing behind. Use a smaller distance.");
  }
  return solid;
}
