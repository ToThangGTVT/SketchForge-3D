import type { GameAssetSettings, WorkplaneShape } from "@/types/sketchforge";

export type MeshValidation = {
  triangleCount: number;
  degenerateTriangles: number;
  boundaryEdges: number;
  nonManifoldEdges: number;
  valid: boolean;
};

export type TriangleMesh = {
  vertices: readonly (readonly [number, number, number])[];
  faces: readonly (readonly [number, number, number])[];
};

export function gameAssetForShape(shape: Pick<WorkplaneShape, "gameAsset">): Required<GameAssetSettings> {
  return {
    collider: shape.gameAsset?.collider ?? "none",
    lodCount: Math.max(0, Math.min(3, Math.round(shape.gameAsset?.lodCount ?? 0))),
  };
}

export function canonicalGameAsset(value: GameAssetSettings | undefined): GameAssetSettings | undefined {
  if (!value) return undefined;
  const normalized = gameAssetForShape({ gameAsset: value });
  return normalized.collider === "none" && normalized.lodCount === 0 ? undefined : normalized;
}

export function validateTriangleMesh(mesh: TriangleMesh): MeshValidation {
  const edges = new Map<string, number>();
  let degenerateTriangles = 0;
  mesh.faces.forEach(([a, b, c]) => {
    const av = mesh.vertices[a]; const bv = mesh.vertices[b]; const cv = mesh.vertices[c];
    if (!av || !bv || !cv || a === b || b === c || c === a) { degenerateTriangles += 1; return; }
    const ux = bv[0] - av[0]; const uy = bv[1] - av[1]; const uz = bv[2] - av[2];
    const vx = cv[0] - av[0]; const vy = cv[1] - av[1]; const vz = cv[2] - av[2];
    if (Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) < 1e-8) degenerateTriangles += 1;
    [[a, b], [b, c], [c, a]].forEach(([from, to]) => {
      const key = from < to ? `${from}:${to}` : `${to}:${from}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    });
  });
  const counts = [...edges.values()];
  const boundaryEdges = counts.filter((count) => count === 1).length;
  const nonManifoldEdges = counts.filter((count) => count > 2).length;
  return { triangleCount: mesh.faces.length, degenerateTriangles, boundaryEdges, nonManifoldEdges, valid: degenerateTriangles === 0 && nonManifoldEdges === 0 };
}
