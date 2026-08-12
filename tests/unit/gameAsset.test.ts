import { describe, expect, it } from "vitest";
import { gameAssetForShape, validateTriangleMesh } from "@/lib/gameAsset";

describe("game asset settings", () => {
  it("normalizes optional collider and LOD settings", () => {
    expect(gameAssetForShape({ gameAsset: { collider: "box", lodCount: 7 } })).toEqual({ collider: "box", lodCount: 3 });
  });

  it("reports degenerate, boundary and non-manifold topology", () => {
    const result = validateTriangleMesh({
      vertices: [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]],
      faces: [[0, 1, 2], [0, 1, 3], [0, 1, 2], [0, 0, 1]],
    });
    expect(result.degenerateTriangles).toBe(1);
    expect(result.nonManifoldEdges).toBeGreaterThan(0);
    expect(result.boundaryEdges).toBeGreaterThan(0);
    expect(result.valid).toBe(false);
  });
});
