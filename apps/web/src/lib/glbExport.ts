import { gameMaterialForShape } from "@/lib/gameMaterial";
import type { WorkplaneShape } from "@/types/sketchforge";

export type GlbExportMesh = {
  name: string;
  vertices: readonly (readonly [number, number, number])[];
  faces: readonly (readonly [number, number, number])[];
  shape: Pick<WorkplaneShape, "color" | "material">;
};

type Accessor = {
  bufferView: number;
  componentType: 5123 | 5125 | 5126;
  count: number;
  type: "SCALAR" | "VEC2" | "VEC3";
  min?: number[];
  max?: number[];
};

function align4(value: number) {
  return (value + 3) & ~3;
}

function hexToRgb(value: string): [number, number, number] {
  const normalized = /^#[0-9a-f]{6}$/i.test(value) ? value.slice(1) : "ffffff";
  return [0, 2, 4].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16) / 255) as [number, number, number];
}

function normalFor(a: readonly number[], b: readonly number[], c: readonly number[]) {
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const uz = b[2] - a[2];
  const vx = c[0] - a[0];
  const vy = c[1] - a[1];
  const vz = c[2] - a[2];
  const x = uy * vz - uz * vy;
  const y = uz * vx - ux * vz;
  const z = ux * vy - uy * vx;
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length] as const;
}

function uvFor(point: readonly number[], normal: readonly number[], scale: readonly number[]) {
  const x = (point[0] - scale[0]) / scale[3];
  const y = (point[1] - scale[1]) / scale[4];
  const z = (point[2] - scale[2]) / scale[5];
  const ax = Math.abs(normal[0]);
  const ay = Math.abs(normal[1]);
  const az = Math.abs(normal[2]);
  if (ay >= ax && ay >= az) return [x, z] as const;
  if (ax >= az) return [z, y] as const;
  return [x, y] as const;
}

function meshAttributes(mesh: GlbExportMesh) {
  const validFaces = mesh.faces.filter(([a, b, c]) => mesh.vertices[a] && mesh.vertices[b] && mesh.vertices[c] && a !== b && b !== c && c !== a);
  const bounds = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  mesh.vertices.forEach(([x, y, z]) => {
    bounds[0] = Math.min(bounds[0], x); bounds[1] = Math.min(bounds[1], y); bounds[2] = Math.min(bounds[2], z);
    bounds[3] = Math.max(bounds[3], x); bounds[4] = Math.max(bounds[4], y); bounds[5] = Math.max(bounds[5], z);
  });
  const scale = [bounds[0], bounds[1], bounds[2], Math.max(0.000001, bounds[3] - bounds[0]), Math.max(0.000001, bounds[4] - bounds[1]), Math.max(0.000001, bounds[5] - bounds[2])];
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  // Duplicate vertices at face boundaries. This keeps the automatic planar UV
  // seams correct and makes every exported model valid even if the source mesh
  // had no UV attribute.
  validFaces.forEach(([ai, bi, ci]) => {
    const face = [mesh.vertices[ai], mesh.vertices[bi], mesh.vertices[ci]];
    const normal = normalFor(face[0], face[1], face[2]);
    face.forEach((vertex) => {
      positions.push(vertex[0] * 0.001, vertex[1] * 0.001, vertex[2] * 0.001);
      normals.push(...normal);
      uvs.push(...uvFor(vertex, normal, scale));
      indices.push(indices.length);
    });
  });
  return { positions, normals, uvs, indices };
}

function typedBytes(values: number[], componentType: 5123 | 5125 | 5126) {
  if (componentType === 5126) return new Uint8Array(new Float32Array(values).buffer);
  if (componentType === 5123) return new Uint8Array(new Uint16Array(values).buffer);
  return new Uint8Array(new Uint32Array(values).buffer);
}

function appendChunk(chunks: Uint8Array[], bytes: Uint8Array) {
  const offset = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  chunks.push(bytes);
  const padding = align4(bytes.byteLength) - bytes.byteLength;
  if (padding) chunks.push(new Uint8Array(padding));
  return offset;
}

/** Builds a self-contained GLB 2.0 asset in metres, with generated UVs and PBR materials. */
export function exportMeshesToGlb(meshes: readonly GlbExportMesh[]): Blob {
  const binaryChunks: Uint8Array[] = [];
  const bufferViews: Array<{ buffer: 0; byteOffset: number; byteLength: number; target: 34962 | 34963 }> = [];
  const accessors: Accessor[] = [];
  const materials: Array<Record<string, unknown>> = [];
  const materialByKey = new Map<string, number>();
  const gltfMeshes: Array<Record<string, unknown>> = [];
  const nodes: Array<Record<string, unknown>> = [];

  const addAccessor = (values: number[], componentType: 5123 | 5125 | 5126, type: Accessor["type"], target: 34962 | 34963, min?: number[], max?: number[]) => {
    const bytes = typedBytes(values, componentType);
    const byteOffset = appendChunk(binaryChunks, bytes);
    const bufferView = bufferViews.push({ buffer: 0, byteOffset, byteLength: bytes.byteLength, target }) - 1;
    return accessors.push({ bufferView, componentType, count: values.length / (type === "SCALAR" ? 1 : type === "VEC2" ? 2 : 3), type, ...(min ? { min } : {}), ...(max ? { max } : {}) }) - 1;
  };

  meshes.forEach((source) => {
    const data = meshAttributes(source);
    if (!data.indices.length) return;
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let offset = 0; offset < data.positions.length; offset += 3) {
      for (let axis = 0; axis < 3; axis += 1) {
        min[axis] = Math.min(min[axis], data.positions[offset + axis]);
        max[axis] = Math.max(max[axis], data.positions[offset + axis]);
      }
    }
    const indexType: 5123 | 5125 = data.indices.length <= 65535 ? 5123 : 5125;
    const position = addAccessor(data.positions, 5126, "VEC3", 34962, min, max);
    const normal = addAccessor(data.normals, 5126, "VEC3", 34962);
    const texcoord = addAccessor(data.uvs, 5126, "VEC2", 34962);
    const indices = addAccessor(data.indices, indexType, "SCALAR", 34963);
    const gameMaterial = gameMaterialForShape(source.shape);
    const key = JSON.stringify([source.shape.color, gameMaterial]);
    let material = materialByKey.get(key);
    if (material === undefined) {
      const base = hexToRgb(source.shape.color);
      const emissive = hexToRgb(gameMaterial.emissive);
      material = materials.push({
        name: `${source.name} material`,
        pbrMetallicRoughness: { baseColorFactor: [...base, gameMaterial.opacity], metallicFactor: gameMaterial.metallic, roughnessFactor: gameMaterial.roughness },
        emissiveFactor: emissive,
        alphaMode: gameMaterial.opacity < 1 ? "BLEND" : "OPAQUE",
        doubleSided: gameMaterial.doubleSided,
      }) - 1;
      materialByKey.set(key, material);
    }
    const mesh = gltfMeshes.push({ name: source.name, primitives: [{ attributes: { POSITION: position, NORMAL: normal, TEXCOORD_0: texcoord }, indices, material }] }) - 1;
    nodes.push({ name: source.name, mesh });
  });

  const binaryLength = binaryChunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  const binary = new Uint8Array(binaryLength);
  let binaryOffset = 0;
  binaryChunks.forEach((chunk) => { binary.set(chunk, binaryOffset); binaryOffset += chunk.byteLength; });
  const json = JSON.stringify({ asset: { version: "2.0", generator: "SketchForge" }, scene: 0, scenes: [{ nodes: nodes.map((_, index) => index) }], nodes, meshes: gltfMeshes, materials, buffers: [{ byteLength: binaryLength }], bufferViews, accessors });
  const jsonBytes = new TextEncoder().encode(json);
  const jsonLength = align4(jsonBytes.byteLength);
  const totalLength = 12 + 8 + jsonLength + 8 + binaryLength;
  const output = new Uint8Array(totalLength);
  const view = new DataView(output.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, totalLength, true);
  view.setUint32(12, jsonLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  output.set(jsonBytes, 20);
  output.fill(0x20, 20 + jsonBytes.byteLength, 20 + jsonLength);
  const binaryHeader = 20 + jsonLength;
  view.setUint32(binaryHeader, binaryLength, true);
  view.setUint32(binaryHeader + 4, 0x004e4942, true);
  output.set(binary, binaryHeader + 8);
  return new Blob([output], { type: "model/gltf-binary" });
}
