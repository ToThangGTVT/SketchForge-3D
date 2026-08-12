"use client";

import { Check, LoaderCircle, X } from "lucide-react";
import { ModifierSlider } from "./ModifierSlider";
import type { CadModifierQuality } from "@/lib/cadModifierTypes";
import { faceModifierSelectionStatus } from "@/lib/cadModifierRuntime";
import type { WorkplaneWorkspaceSettings } from "@/types/sketchforge";

const FACE_MODIFIER_DISTANCE_STEP = 0.1;

export function FaceModifierPanel({
  distance,
  maxDistance,
  quality,
  workspace,
  targetName,
  selectedCount,
  availableCount,
  busy,
  prepared,
  error,
  onDistanceChange,
  onClear,
  onQualityChange,
  onApply,
  onCancel,
}: {
  distance: number;
  maxDistance: number;
  quality: CadModifierQuality;
  workspace: WorkplaneWorkspaceSettings;
  targetName: string;
  selectedCount: number;
  availableCount: number;
  busy: boolean;
  prepared: boolean;
  error: string | null;
  onDistanceChange: (value: number) => void;
  onClear: () => void;
  onQualityChange: (value: CadModifierQuality) => void;
  onApply: () => void;
  onCancel: () => void;
}) {
  const direction = distance > 0 ? "Pulling out" : distance < 0 ? "Pushing in" : "No movement";
  return (
    <aside className="edge-modifier-panel face-modifier-panel" aria-label="Push or pull faces">
      <div className="edge-modifier-header">
        <div>
          <strong>Push / pull faces</strong>
          <span>{faceModifierSelectionStatus(prepared, selectedCount, availableCount)}</span>
        </div>
        <button type="button" aria-label="Cancel push pull" onClick={onCancel}><X size={20} /></button>
      </div>

      <div className="edge-modifier-target">
        <strong>{targetName}</strong>
        <span>{direction}</span>
      </div>

      <div className="edge-modifier-selection-help">
        {prepared
          ? "Click a highlighted face to select it. Hold Shift to add or remove one face."
          : "Loading CAD face data from the local browser worker."}
      </div>

      <div className="edge-modifier-quick-actions">
        <button type="button" disabled={!prepared || busy || selectedCount === 0} onClick={onClear}>Clear</button>
      </div>

      <ModifierSlider
        label="Distance"
        value={distance}
        // A symmetric range keeps one control for both directions: drag left of
        // centre to carve inward, right to grow outward.
        min={-maxDistance}
        max={maxDistance}
        step={FACE_MODIFIER_DISTANCE_STEP}
        workspace={workspace}
        length
        disabled={!prepared || busy}
        onChange={onDistanceChange}
      />

      <label className="edge-modifier-field">
        <span>Preview quality</span>
        <select value={quality} disabled={!prepared || busy} onChange={(event) => onQualityChange(event.currentTarget.value as CadModifierQuality)}>
          <option value="draft">Draft</option>
          <option value="standard">Standard</option>
          <option value="fine">Fine</option>
        </select>
      </label>

      {error ? <div className="edge-modifier-error" role="alert">{error}</div> : null}
      <div className="edge-modifier-footer">
        <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
        <button type="button" className="primary" disabled={!prepared || busy || selectedCount === 0 || distance === 0 || Boolean(error)} onClick={onApply}>
          {busy ? <LoaderCircle className="edge-modifier-spinner" size={17} /> : <Check size={17} />}
          Apply
        </button>
      </div>
    </aside>
  );
}
