import { describe, expect, it } from "vitest";
import { canonicalGameMaterial, gameMaterialForShape } from "@/lib/gameMaterial";

describe("game material", () => {
  it("keeps old shapes on the established viewport defaults", () => {
    expect(gameMaterialForShape({})).toEqual({ metallic: 0.02, roughness: 0.57, emissive: "#000000", opacity: 1, doubleSided: false });
  });

  it("clamps optional PBR values and removes an unchanged default block", () => {
    expect(gameMaterialForShape({ material: { metallic: 4, roughness: -2, opacity: 0.4, emissive: "#FF4400" } })).toEqual({
      metallic: 1,
      roughness: 0,
      emissive: "#ff4400",
      opacity: 0.4,
      doubleSided: false,
    });
    expect(canonicalGameMaterial({ metallic: 0.02, roughness: 0.57, emissive: "#000000", opacity: 1, doubleSided: false })).toBeUndefined();
  });
});
