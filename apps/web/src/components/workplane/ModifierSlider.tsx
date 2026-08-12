"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { displayStepFromMillimeters, displayToMillimeters, formatMeasurementNumber, lengthDisplayUnit, millimetersToDisplay, parseMeasurementInput } from "@/lib/measurementUnits";
import type { WorkplaneWorkspaceSettings } from "@/types/sketchforge";

// Slider-plus-typed-value control shared by the edge and face modifier panels.

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function formatSliderValue(value: number, accuracy: WorkplaneWorkspaceSettings["accuracy"], step: number) {
  if (step >= 1) return String(Math.round(value));
  return formatMeasurementNumber(value, accuracy, step);
}

export function ModifierSlider({
  label,
  value,
  min,
  max,
  step,
  unit,
  workspace,
  length = false,
  disabled = false,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  workspace: WorkplaneWorkspaceSettings;
  /** Treat the value as a length so it follows the workspace's display units. */
  length?: boolean;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  const safeMin = Number.isFinite(min) ? min : 0;
  const safeMax = Math.max(safeMin, Number.isFinite(max) ? max : safeMin);
  const actualValue = Number.isFinite(value) ? value : safeMin;
  const controlValue = length ? millimetersToDisplay(actualValue, workspace) : actualValue;
  const controlMin = length ? millimetersToDisplay(safeMin, workspace) : safeMin;
  const controlMax = length ? millimetersToDisplay(safeMax, workspace) : safeMax;
  const controlStep = length ? displayStepFromMillimeters(step, workspace) : step;
  const sliderValue = clamp(controlValue, controlMin, controlMax);
  const position = ((sliderValue - controlMin) / Math.max(Number.EPSILON, controlMax - controlMin)) * 100;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(formatSliderValue(controlValue, workspace.accuracy, controlStep));
  const unitLabel = length ? lengthDisplayUnit(workspace).label : unit;

  useEffect(() => {
    if (!editing) {
      setDraft(formatSliderValue(controlValue, workspace.accuracy, controlStep));
    }
  }, [controlStep, controlValue, editing, workspace.accuracy]);

  const toModelValue = (nextValue: number) => length ? displayToMillimeters(nextValue, workspace) : nextValue;

  const commitDraft = () => {
    const next = parseMeasurementInput(draft);
    const finiteNext = Number.isFinite(next) ? next : controlValue;
    onChange(clamp(toModelValue(finiteNext), safeMin, safeMax));
    setEditing(false);
  };

  const handleSliderChange = (nextValue: number) => {
    const next = clamp(Number.isFinite(nextValue) ? nextValue : controlMin, controlMin, controlMax);
    onChange(clamp(toModelValue(next), safeMin, safeMax));
    setDraft(formatSliderValue(next, workspace.accuracy, controlStep));
  };

  return (
    <label className="edge-modifier-field edge-modifier-slider range-property" style={{ "--slider-pos": `${position}%` } as CSSProperties}>
      <span className="range-property-header">
        <span className="range-property-name">{label}</span>
        <span className="range-value-control">
          <input
            type="text"
            value={editing ? draft : formatSliderValue(controlValue, workspace.accuracy, controlStep)}
            inputMode="decimal"
            disabled={disabled}
            onFocus={() => {
              setDraft(formatSliderValue(controlValue, workspace.accuracy, controlStep));
              setEditing(true);
            }}
            onChange={(event) => setDraft(event.currentTarget.value)}
            onBlur={commitDraft}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.stopPropagation();
                event.currentTarget.blur();
              } else if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                setDraft(formatSliderValue(controlValue, workspace.accuracy, controlStep));
                setEditing(false);
              }
            }}
          />
          {unitLabel ? <span className="range-value-unit">{unitLabel}</span> : null}
        </span>
      </span>
      <div className="range-control">
        <input
          type="range"
          min={controlMin}
          max={controlMax}
          step={controlStep}
          value={sliderValue}
          disabled={disabled}
          onChange={(event) => handleSliderChange(Number(event.currentTarget.value))}
        />
      </div>
    </label>
  );
}
