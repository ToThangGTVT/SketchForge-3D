import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { importedShapeFromTriangleSoup } from "@/lib/stlImport";
import type { WorkplaneShape } from "@/types/sketchforge";

const loader = new GLTFLoader();

export async function importedShapeFromGlb(fileName: string, buffer: ArrayBuffer): Promise<WorkplaneShape> {
  const gltf = await new Promise<Awaited<ReturnType<GLTFLoader["parseAsync"]>>>((resolve, reject) => loader.parse(buffer, "", resolve, reject));
  gltf.scene.updateMatrixWorld(true);
  const positions: number[] = [];
  const normals: number[] = [];
  gltf.scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || !(object.geometry instanceof THREE.BufferGeometry)) return;
    const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry;
    const position = geometry.getAttribute("position");
    const normal = geometry.getAttribute("normal");
    const vertex = new THREE.Vector3();
    const normalVector = new THREE.Vector3();
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(object.matrixWorld);
    for (let index = 0; index < position.count; index += 1) {
      vertex.fromBufferAttribute(position, index).applyMatrix4(object.matrixWorld).multiplyScalar(1000);
      positions.push(vertex.x, vertex.y, vertex.z);
      if (normal) {
        normalVector.fromBufferAttribute(normal, index).applyMatrix3(normalMatrix).normalize();
        normals.push(normalVector.x, normalVector.y, normalVector.z);
      }
    }
    if (geometry !== object.geometry) geometry.dispose();
  });
  if (positions.length < 9) throw new Error("GLB file has no readable triangle geometry");
  return importedShapeFromTriangleSoup(fileName, positions, normals.length === positions.length ? normals : undefined, "glb");
}
