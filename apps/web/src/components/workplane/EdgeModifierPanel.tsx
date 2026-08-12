"use client";

import { useState } from "react";
import { Check, LoaderCircle, Minus, Plus, RotateCcw, X } from "lucide-react";
import { ModifierSlider } from "./ModifierSlider";
import type { CadModifierKind, CadModifierQuality } from "@/lib/cadModifierTypes";
import { CAD_MODIFIER_MAX_SHARP_ANGLE, edgeModifierSelectionStatus } from "@/lib/cadModifierRuntime";
import type { WorkplaneWorkspaceSettings } from "@/types/sketchforge";

const MIN_EDGE_MODIFIER_AMOUNT = 0.001;
const EDGE_MODIFIER_AMOUNT_STEP = 0.001;

type EdgeHistoryOption = {
  id: string;
  label: string;
  targetName: string;
  removesNewerCount: number;
};

export function EdgeModifierPanel({
  kind,
  amount,
  maxAmount,
  chamferAngle,
  quality,
  sharpAngle,
  workspace,
  tangentChain,
  preserveEdgeSize,
  targetName,
  groupedCount,
  appliedFeatureCount,
  reversibleFeatureCount,
  historyOptions,
  selectedCount,
  availableCount,
  busy,
  prepared,
  error,
  onAmountChange,
  onChamferAngleChange,
  onQualityChange,
  onSharpAngleChange,
  onTangentChainChange,
  onPreserveEdgeSizeChange,
  onSelectAll,
  onClear,
  onRemoveFeature,
  onApply,
  onCancel,
}: {
  kind: CadModifierKind;
  amount: number;
  maxAmount: number;
  chamferAngle: number;
  quality: CadModifierQuality;
  sharpAngle: number;
  workspace: WorkplaneWorkspaceSettings;
  tangentChain: boolean;
  preserveEdgeSize: boolean;
  targetName: string;
  groupedCount: number;
  appliedFeatureCount: number;
  reversibleFeatureCount: number;
  historyOptions: EdgeHistoryOption[];
  selectedCount: number;
  availableCount: number;
  busy: boolean;
  prepared: boolean;
  error: string | null;
  onAmountChange: (value: number) => void;
  onChamferAngleChange: (value: number) => void;
  onQualityChange: (value: CadModifierQuality) => void;
  onSharpAngleChange: (value: number) => void;
  onTangentChainChange: (value: boolean) => void;
  onPreserveEdgeSizeChange: (value: boolean) => void;
  onSelectAll: () => void;
  onClear: () => void;
  onRemoveFeature: (id: string) => void;
  onApply: () => void;
  onCancel: () => void;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const title = kind === "fillet" ? "Fillet edges" : "Chamfer edges";
  const amountMin = Math.min(MIN_EDGE_MODIFIER_AMOUNT, Math.max(Number.EPSILON, maxAmount));
  const amountMax = Math.max(amountMin, maxAmount);
  return (
    <aside className="edge-modifier-panel" aria-label={title}>
      <div className="edge-modifier-header">
        <div>
          <strong>{title}</strong>
          <span>{edgeModifierSelectionStatus(prepared, selectedCount, availableCount)}</span>
        </div>
        <button type="button" aria-label={`Cancel ${kind}`} onClick={onCancel}><X size={20} /></button>
      </div>

      <div className={`edge-modifier-target ${groupedCount > 0 ? "grouped" : ""}`}>
        <strong>{targetName}</strong>
        <span>{groupedCount > 0 ? `${groupedCount} grouped objects` : "Single object"}{appliedFeatureCount > 0 ? ` · ${appliedFeatureCount} existing edge feature${appliedFeatureCount === 1 ? "" : "s"}` : ""}</span>
      </div>

      <div className="edge-modifier-selection-help">
        {prepared ? "Click highlighted model edges to toggle them. Hold Shift to add or remove a single edge." : "Loading CAD edge data from the local browser worker."}
      </div>

      <div className="edge-modifier-quick-actions">
        <button type="button" disabled={!prepared || busy} onClick={onSelectAll}>All sharp edges</button>
        <button type="button" disabled={!prepared || busy} onClick={onClear}>Clear</button>
      </div>

      {appliedFeatureCount > 0 ? (
        <div className="edge-modifier-history-actions">
          <button
            className="edge-modifier-history-toggle"
            type="button"
            aria-expanded={historyOpen}
            disabled={reversibleFeatureCount === 0}
            onClick={() => setHistoryOpen((open) => !open)}
          >
            {historyOpen ? <Minus size={15} /> : <Plus size={15} />}
            <span>Edge feature history</span>
          </button>
          {reversibleFeatureCount === 0 ? <span>Older edge features do not have stored undo history.</span> : null}
          {historyOpen && historyOptions.length > 0 ? (
            <div className="edge-modifier-history-list">
              {historyOptions.map((option) => (
                <button className="edge-modifier-history-item" type="button" key={option.id} onClick={() => onRemoveFeature(option.id)}>
                  <RotateCcw size={14} />
                  <span>
                    <strong>{option.label}</strong>
                    <small>
                      {option.targetName}
                      {option.removesNewerCount > 0 ? ` · also removes ${option.removesNewerCount} newer` : ""}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <ModifierSlider
        label={kind === "fillet" ? "Radius" : "Distance"}
        value={amount}
        min={amountMin}
        max={amountMax}
        step={EDGE_MODIFIER_AMOUNT_STEP}
        workspace={workspace}
        length
        disabled={!prepared || busy}
        onChange={onAmountChange}
      />

      {kind === "chamfer" ? <ModifierSlider label="Angle" value={chamferAngle} min={5} max={85} step={1} unit="deg" workspace={workspace} disabled={!prepared || busy} onChange={onChamferAngleChange} /> : null}

      <ModifierSlider label="Sharp-edge threshold" value={sharpAngle} min={1} max={CAD_MODIFIER_MAX_SHARP_ANGLE} step={1} unit="deg" workspace={workspace} disabled={!prepared || busy} onChange={onSharpAngleChange} />

      <label className="edge-modifier-check">
        <input type="checkbox" checked={tangentChain} disabled={!prepared || busy} onChange={(event) => onTangentChainChange(event.currentTarget.checked)} />
        <span>Select tangent chains</span>
      </label>

      <label className="edge-modifier-check">
        <input type="checkbox" checked={preserveEdgeSize} disabled={!prepared || busy} onChange={(event) => onPreserveEdgeSizeChange(event.currentTarget.checked)} />
        <span>Keep edge size when resizing</span>
      </label>

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
        <button type="button" className="primary" disabled={!prepared || busy || selectedCount === 0 || Boolean(error)} onClick={onApply}>
          {busy ? <LoaderCircle className="edge-modifier-spinner" size={17} /> : <Check size={17} />}
          Apply
        </button>
      </div>
    </aside>
  );
}
