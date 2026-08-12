export type CadModifierKind = "chamfer" | "fillet";

/**
 * One selectable face of the prepared solid. The triangles that draw it live in
 * {@link CadModifierFacePicking} rather than here, so a whole model's face data
 * travels as three buffers instead of two per face.
 */
export type CadModifierFace = {
  id: number;
  owner: number;
  centroid: [number, number, number];
  /** Outward normal — the direction a positive distance moves the face. */
  normal: [number, number, number];
  area: number;
  surfaceType: string;
  selectable: boolean;
};

/**
 * Shared tessellation used to highlight and hit-test faces.
 *
 * `faceRanges` holds an `[indexStart, indexCount]` pair per face id, indexing
 * into `indices`. Note these are *index* offsets, not triangle offsets — the
 * kernel's own `faceGroups` field uses the same units despite its name.
 */
export type CadModifierFacePicking = {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  faceRanges: Int32Array;
};

export type CadModifierEdge = {
  id: number;
  owner?: number;
  points: number[];
  display: boolean;
  selectable: boolean;
  angle: number;
  boundary: boolean;
  manifold: boolean;
};

export type CadModifierQuality = "draft" | "standard" | "fine";

export type CadModifierDisplayEdge = {
  points: number[];
};

export type CadModifierPrimitivePart = {
  kind: "box";
  width: number;
  depth: number;
  height: number;
  transform?: number[];
};

export type CadModifierMeshPart = {
  positions?: Float32Array;
  indices?: Uint32Array;
  brep?: string;
  brepTransform?: number[];
  primitive?: CadModifierPrimitivePart;
  hole: boolean;
};

export type CadModifierComponentMesh = {
  owner: number;
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  triangleCount: number;
  brep: string;
  displayEdges: CadModifierDisplayEdge[];
};

export type CadModifierWorkerRequest =
  | { type: "prepare"; requestId: number; parts: CadModifierMeshPart[]; sharpAngle: number; suppressTreatmentDetailEdges?: boolean; includeFaces?: boolean }
  | {
      type: "preview";
      requestId: number;
      kind: CadModifierKind;
      edgeIds: number[];
      amount: number;
      quality: CadModifierQuality;
      chamferAngle: number;
    }
  | {
      type: "facePreview";
      requestId: number;
      faceIds: number[];
      /** Positive pulls the faces outward, negative carves inward. */
      distance: number;
      quality: CadModifierQuality;
    }
  | { type: "dispose"; requestId: number };

export type CadModifierWorkerResponse =
  | {
      type: "ready";
      requestId: number;
      edges: CadModifierEdge[];
      selectableEdgeIds: number[];
      sourceType: string;
      /** Parts whose exact B-Rep failed to restore and fell back to their mesh. */
      degradedParts?: number;
      faces?: CadModifierFace[];
      facePicking?: CadModifierFacePicking;
    }
  | {
      type: "preview";
      requestId: number;
      positions: Float32Array;
      normals: Float32Array;
      indices: Uint32Array;
      triangleCount: number;
      brep: string;
      displayEdges: CadModifierDisplayEdge[];
      components?: CadModifierComponentMesh[];
    }
  | { type: "disposed"; requestId: number }
  | { type: "error"; requestId: number; message: string; resetSession?: boolean };
