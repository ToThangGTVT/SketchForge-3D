import type { CadModifierEdge } from "@/lib/cadModifierTypes";

export const CAD_MODIFIER_RUNTIME_BASE = "/occt";
export const CAD_MODIFIER_REQUEST_TIMEOUT_MS = 30_000;
export const CAD_MODIFIER_MAX_PREPARE_TIMEOUT_MS = 180_000;
export const CAD_MODIFIER_MAX_SHARP_ANGLE = 90;

export type CadModifierRequestPhase = "prepare" | "preview";

export function cadTransformRequiresGeneralTransform(transform: number[]) {
  if (transform.length !== 12 || !transform.every(Number.isFinite)) {
    return false;
  }

  const x = [transform[0], transform[4], transform[8]];
  const y = [transform[1], transform[5], transform[9]];
  const z = [transform[2], transform[6], transform[10]];
  const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const xLengthSquared = dot(x, x);
  const yLengthSquared = dot(y, y);
  const zLengthSquared = dot(z, z);
  const scaleSquared = Math.max(xLengthSquared, yLengthSquared, zLengthSquared);
  if (scaleSquared <= 1e-18) {
    return true;
  }

  const tolerance = scaleSquared * 1e-9;
  return (
    Math.abs(dot(x, y)) > tolerance ||
    Math.abs(dot(x, z)) > tolerance ||
    Math.abs(dot(y, z)) > tolerance ||
    Math.abs(xLengthSquared - yLengthSquared) > tolerance ||
    Math.abs(xLengthSquared - zLengthSquared) > tolerance ||
    Math.abs(yLengthSquared - zLengthSquared) > tolerance
  );
}

export function isCadModifierWasmMemoryFault(message: string, errorName = "") {
  return (
    /memory access out of bounds|out of bounds memory access|\babort(?:ed)?\b/i.test(message) ||
    /^(?:WebAssembly\.)?RuntimeError$/i.test(errorName)
  );
}

export function defaultCadModifierTangentChain(appliedFeatureCount: number) {
  return appliedFeatureCount === 0;
}

export function cadModifierTopologyEdgeIsSelectable(
  edge: Pick<CadModifierEdge, "manifold" | "boundary" | "points">,
) {
  return edge.manifold && !edge.boundary && edge.points.length >= 6;
}

export function selectableCadModifierEdge(
  edge: Pick<CadModifierEdge, "display" | "selectable" | "manifold" | "boundary" | "angle">,
  sharpAngle: number,
) {
  return edge.selectable && edge.manifold && !edge.boundary && edge.angle + 1e-3 >= sharpAngle;
}

export function edgeModifierSelectionStatus(prepared: boolean, selectedCount: number, availableCount: number) {
  return prepared ? `${selectedCount} of ${availableCount} sharp edges selected` : "Preparing edges\u2026";
}

export function faceModifierSelectionStatus(prepared: boolean, selectedCount: number, availableCount: number) {
  return prepared ? `${selectedCount} of ${availableCount} faces selected` : "Preparing faces\u2026";
}

/**
 * Turn the kernel's `[indexStart, indexCount, faceHash]` triples into an
 * `[indexStart, indexCount]` pair per face id.
 *
 * The units are index offsets, not triangles \u2014 the kernel names the fields as
 * though they were triangle spans, and reading them that way silently maps
 * every click to the wrong face. `faceHashes[id]` gives the hash of face `id`;
 * a face the tessellator produced no triangles for gets a zero-length range and
 * is filtered out of the selectable set by the caller.
 */
export function cadFaceRangesFromGroups(groups: ArrayLike<number> | undefined, faceHashes: ArrayLike<number>) {
  const spanByHash = new Map<number, { start: number; end: number }>();
  if (groups) {
    for (let index = 0; index + 2 < groups.length; index += 3) {
      const start = groups[index];
      const count = groups[index + 1];
      const hash = groups[index + 2];
      if (!(count > 0)) continue;
      const existing = spanByHash.get(hash);
      if (!existing) {
        spanByHash.set(hash, { start, end: start + count });
        continue;
      }
      // The kernel emits one contiguous group per face; span the whole run if
      // it ever splits one rather than dropping the extra triangles.
      existing.start = Math.min(existing.start, start);
      existing.end = Math.max(existing.end, start + count);
    }
  }
  const ranges = new Int32Array(faceHashes.length * 2);
  for (let id = 0; id < faceHashes.length; id += 1) {
    const span = spanByHash.get(faceHashes[id]);
    ranges[id * 2] = span?.start ?? 0;
    ranges[id * 2 + 1] = span ? span.end - span.start : 0;
  }
  return ranges;
}

/**
 * The slice of the shared index buffer that draws face `id`, or `null` when the
 * tessellator produced no triangles for it.
 *
 * Both the viewport highlight and hit-testing build their per-face geometry
 * from this, so a face can never be drawn with one span and picked with another.
 */
export function cadFaceIndexSlice(faceRanges: ArrayLike<number>, indices: Uint32Array, id: number) {
  if (!Number.isInteger(id) || id < 0 || id * 2 + 1 >= faceRanges.length) return null;
  const start = faceRanges[id * 2];
  const count = faceRanges[id * 2 + 1];
  if (count < 3 || start < 0 || start + count > indices.length) return null;
  return indices.subarray(start, start + count);
}

/** Largest push/pull distance offered for a body of this size. */
export function faceModifierMaxDistance(width: number, depth: number, height: number) {
  const largest = Math.max(
    Number.isFinite(width) ? Math.abs(width) : 0,
    Number.isFinite(depth) ? Math.abs(depth) : 0,
    Number.isFinite(height) ? Math.abs(height) : 0,
  );
  return Math.max(1, largest * 2);
}

export function faceModifierTimeoutMessage(phase: CadModifierRequestPhase) {
  if (phase === "preview") {
    return "The face preview timed out. Cancel the tool and try again.";
  }
  return "Face preparation timed out. This mesh needs more CAD processing than the interactive limit allows. Try a repaired or lower-detail STL.";
}

export function cadModifierPrepareTimeoutMs(meshTriangleCount: number) {
  if (!Number.isFinite(meshTriangleCount) || meshTriangleCount <= 0) {
    return CAD_MODIFIER_REQUEST_TIMEOUT_MS;
  }
  const normalizedTriangleCount = Math.max(0, Math.floor(meshTriangleCount));
  const meshPreparationBudget = 45_000 + normalizedTriangleCount * 0.75;
  return Math.min(
    CAD_MODIFIER_MAX_PREPARE_TIMEOUT_MS,
    Math.max(60_000, Math.ceil(meshPreparationBudget)),
  );
}

export function cadModifierTimeoutMessage(phase: CadModifierRequestPhase) {
  if (phase === "preview") {
    return "The edge preview timed out. Cancel the tool and try again.";
  }
  return "Edge preparation timed out. This mesh needs more CAD processing than the interactive limit allows. Try a repaired or lower-detail STL.";
}

/**
 * Shown when the exact B-Rep could not be restored and the tool fell back to the
 * tessellation. The operation still works, but curved surfaces come back
 * faceted, so the user needs to know before they commit to the result.
 */
export function cadModifierDegradedMessage(degradedParts: number) {
  if (!(degradedParts > 0)) return null;
  return degradedParts === 1
    ? "This object's exact CAD shape could not be restored, so the tool is using its mesh instead. Curved surfaces will come back faceted."
    : `${degradedParts} parts of this object could not be restored as exact CAD shapes, so the tool is using their meshes instead. Curved surfaces will come back faceted.`;
}

export function cadModifierWorkerFailureMessage() {
  return "The CAD worker could not start. Update to Firefox 121+, Chrome/Brave 114+, or Safari 17.2+, then try again.";
}
