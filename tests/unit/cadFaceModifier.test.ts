import { describe, expect, it } from "vitest";
import {
  cadModifierDegradedMessage,
  cadFaceIndexSlice,
  cadFaceRangesFromGroups,
  faceModifierMaxDistance,
  faceModifierSelectionStatus,
} from "@/lib/cadModifierRuntime";

describe("cadFaceRangesFromGroups", () => {
  it("keeps the kernel's index units instead of converting to triangles", () => {
    // Observed from meshShape() on a box: 6 faces, 2 triangles each, so the
    // groups step by 6 indices. If these were triangle spans the last group
    // would end at 36 triangles for a 12-triangle mesh.
    const groups = [0, 6, 101, 6, 6, 102, 12, 6, 103, 18, 6, 104, 24, 6, 105, 30, 6, 106];
    const ranges = cadFaceRangesFromGroups(groups, [101, 102, 103, 104, 105, 106]);
    expect(Array.from(ranges)).toEqual([0, 6, 6, 6, 12, 6, 18, 6, 24, 6, 30, 6]);
    let total = 0;
    for (let index = 1; index < ranges.length; index += 2) total += ranges[index];
    expect(total).toBe(36);
  });

  it("orders ranges by face id, not by the order groups arrive in", () => {
    const groups = [12, 3, 300, 0, 6, 100, 6, 6, 200];
    const ranges = cadFaceRangesFromGroups(groups, [100, 200, 300]);
    expect(Array.from(ranges)).toEqual([0, 6, 6, 6, 12, 3]);
  });

  it("gives a face the tessellator skipped a zero-length range", () => {
    const ranges = cadFaceRangesFromGroups([0, 6, 100], [100, 999]);
    expect(Array.from(ranges)).toEqual([0, 6, 0, 0]);
  });

  it("spans the whole run when one face arrives as several groups", () => {
    const ranges = cadFaceRangesFromGroups([0, 3, 100, 9, 3, 100], [100]);
    expect(Array.from(ranges)).toEqual([0, 12]);
  });

  it("ignores empty groups and missing group data", () => {
    expect(Array.from(cadFaceRangesFromGroups([0, 0, 100], [100]))).toEqual([0, 0]);
    expect(Array.from(cadFaceRangesFromGroups(undefined, [100, 200]))).toEqual([0, 0, 0, 0]);
  });
});

describe("cadFaceIndexSlice", () => {
  const ranges = cadFaceRangesFromGroups(
    [0, 6, 101, 6, 6, 102, 12, 6, 103, 18, 6, 104, 24, 6, 105, 30, 6, 106],
    [101, 102, 103, 104, 105, 106],
  );
  const indices = new Uint32Array(Array.from({ length: 36 }, (_unused, index) => index));

  it("returns exactly the index span that draws each face", () => {
    expect(Array.from(cadFaceIndexSlice(ranges, indices, 0) as Uint32Array)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(Array.from(cadFaceIndexSlice(ranges, indices, 5) as Uint32Array)).toEqual([30, 31, 32, 33, 34, 35]);
  });

  it("views the shared buffer rather than copying it", () => {
    const slice = cadFaceIndexSlice(ranges, indices, 1) as Uint32Array;
    expect(slice.buffer).toBe(indices.buffer);
  });

  it("returns null for ids outside the face list", () => {
    expect(cadFaceIndexSlice(ranges, indices, 6)).toBeNull();
    expect(cadFaceIndexSlice(ranges, indices, -1)).toBeNull();
    expect(cadFaceIndexSlice(ranges, indices, 1.5)).toBeNull();
  });

  it("returns null for a face the tessellator produced no triangles for", () => {
    const sparse = cadFaceRangesFromGroups([0, 3, 100, 3, 3, 300], [100, 200, 300]);
    expect(cadFaceIndexSlice(sparse, indices, 1)).toBeNull();
  });

  it("returns null instead of reading past the buffer", () => {
    const overrun = cadFaceRangesFromGroups([0, 60, 100], [100]);
    expect(cadFaceIndexSlice(overrun, indices, 0)).toBeNull();
  });
});

describe("faceModifierMaxDistance", () => {
  it("scales the slider to the body's longest side", () => {
    expect(faceModifierMaxDistance(20, 40, 10)).toBe(80);
  });

  it("stays usable for degenerate or missing dimensions", () => {
    expect(faceModifierMaxDistance(0, 0, 0)).toBe(1);
    expect(faceModifierMaxDistance(Number.NaN, 0.1, Number.POSITIVE_INFINITY)).toBe(1);
  });
});

describe("faceModifierSelectionStatus", () => {
  it("reports progress once prepared", () => {
    expect(faceModifierSelectionStatus(true, 2, 9)).toBe("2 of 9 faces selected");
  });

  it("shows the loading state while the worker is still preparing", () => {
    expect(faceModifierSelectionStatus(false, 0, 0)).toBe("Preparing faces…");
  });
});

describe("cadModifierDegradedMessage", () => {
  it("stays silent when every part restored exactly", () => {
    expect(cadModifierDegradedMessage(0)).toBeNull();
    expect(cadModifierDegradedMessage(-1)).toBeNull();
    expect(cadModifierDegradedMessage(Number.NaN)).toBeNull();
  });

  it("warns that curved surfaces come back faceted", () => {
    expect(cadModifierDegradedMessage(1)).toMatch(/mesh instead.*faceted/i);
    expect(cadModifierDegradedMessage(3)).toMatch(/^3 parts/);
  });
});
