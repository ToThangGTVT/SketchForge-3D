import type { GameMaterial, WorkplaneShape } from "@/types/sketchforge";

export const DEFAULT_GAME_MATERIAL: Required<Omit<GameMaterial, "emissive">> & Pick<GameMaterial, "emissive"> = {
  metallic: 0.02,
  roughness: 0.57,
  emissive: "#000000",
  opacity: 1,
  doubleSided: false,
};

function clamp(value: unknown, fallback: number) {
  const number = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(1, Math.max(0, number));
}

function hexColor(value: unknown, fallback: string) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback;
}

export function gameMaterialForShape(shape: Pick<WorkplaneShape, "material">): Required<GameMaterial> {
  const material = shape.material;
  return {
    metallic: clamp(material?.metallic, DEFAULT_GAME_MATERIAL.metallic),
    roughness: clamp(material?.roughness, DEFAULT_GAME_MATERIAL.roughness),
    emissive: hexColor(material?.emissive, DEFAULT_GAME_MATERIAL.emissive ?? "#000000"),
    opacity: clamp(material?.opacity, DEFAULT_GAME_MATERIAL.opacity),
    doubleSided: Boolean(material?.doubleSided),
  };
}

export function canonicalGameMaterial(value: GameMaterial | undefined): GameMaterial | undefined {
  if (!value) return undefined;
  const normalized = gameMaterialForShape({ material: value });
  const defaults = DEFAULT_GAME_MATERIAL;
  if (
    normalized.metallic === defaults.metallic &&
    normalized.roughness === defaults.roughness &&
    normalized.emissive === defaults.emissive &&
    normalized.opacity === defaults.opacity &&
    normalized.doubleSided === defaults.doubleSided
  ) {
    return undefined;
  }
  return normalized;
}
