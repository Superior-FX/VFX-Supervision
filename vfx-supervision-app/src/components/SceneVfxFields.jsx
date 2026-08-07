import { useState } from "react";
import { ALL_VFX_EFFECTS, COMPLEXITY_LEVELS, VFX_EFFECT_GROUPS, effectColorKey } from "../data/vfxEffects.js";
import "../pages/ScriptBreakdown.css";

export function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M4 12l5 5L20 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path d="M4 20l1-4L16 5l3 3L8 19l-4 1z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

export function ComplexityDots({ value, onChange, readOnly = false, levels = COMPLEXITY_LEVELS }) {
  return (
    <div className="complexity-dots">
      <div className="complexity-dots-track">
        {levels.map((level, i) => (
          <div
            key={level}
            className={`complexity-dot${i < value ? " filled" : ""}${readOnly ? "" : " editable"}`}
            title={level}
            onClick={readOnly ? undefined : () => onChange(i + 1)}
          />
        ))}
      </div>
      <span className="complexity-label">{levels[value - 1]}</span>
    </div>
  );
}

export function BudgetControl({ scene, onChange, readOnly = false }) {
  const [editing, setEditing] = useState(false);

  if (readOnly) {
    return scene.budgeted ? (
      <span className="budget-summary-range mono">
        ${scene.budgetLow.toLocaleString()}–${scene.budgetHigh.toLocaleString()}
      </span>
    ) : (
      <span className="budget-unset mono">Not budgeted</span>
    );
  }

  if (!scene.budgeted && !editing) {
    return (
      <span className="pill budget-set-btn" onClick={() => setEditing(true)}>
        $ Set budget
      </span>
    );
  }

  if (!editing) {
    return (
      <div className="budget-summary">
        <span className="budget-summary-range mono">
          ${scene.budgetLow.toLocaleString()}–${scene.budgetHigh.toLocaleString()}
        </span>
        <span className="budget-edit-icon" onClick={() => setEditing(true)}>
          <PencilIcon />
        </span>
      </div>
    );
  }

  return (
    <div className="budget-row">
      <div className="budget-input-group">
        <span>$</span>
        <input
          className="budget-input"
          type="number"
          value={scene.budgetLow}
          onChange={(e) => onChange({ budgetLow: Number(e.target.value) })}
        />
      </div>
      <span className="label">to</span>
      <div className="budget-input-group">
        <span>$</span>
        <input
          className="budget-input"
          type="number"
          value={scene.budgetHigh}
          onChange={(e) => onChange({ budgetHigh: Number(e.target.value) })}
        />
      </div>
      <span
        className="budget-confirm"
        onClick={() => {
          onChange({ budgeted: true });
          setEditing(false);
        }}
      >
        <CheckIcon />
      </span>

      {scene.aiLow > 0 && (
        <div className="budget-ai">
          <span className="budget-ai-value mono">
            AI estimate: ${scene.aiLow.toLocaleString()}–${scene.aiHigh.toLocaleString()}
          </span>
          <span
            className="pill pill-accent budget-ai-use"
            onClick={() => onChange({ budgetLow: scene.aiLow, budgetHigh: scene.aiHigh })}
          >
            Use AI estimate
          </span>
        </div>
      )}
    </div>
  );
}

export function EffectPicker({ scene, onChange, readOnly = false }) {
  const [addValue, setAddValue] = useState("");

  if (readOnly) {
    return (
      <div className="effect-badges-row">
        {scene.primaryEffect ? (
          <span className={`effect-badge tone-${effectColorKey(scene.primaryEffect)}`}>{scene.primaryEffect}</span>
        ) : (
          <span className="effect-none mono">No VFX tagged</span>
        )}
        {scene.additionalEffects.map((effect) => (
          <span className={`effect-badge tone-${effectColorKey(effect)}`} key={effect}>
            {effect}
          </span>
        ))}
      </div>
    );
  }

  const addEffect = (effect) => {
    if (!effect || scene.additionalEffects.includes(effect) || effect === scene.primaryEffect) return;
    onChange({ additionalEffects: [...scene.additionalEffects, effect] });
  };

  const removeEffect = (effect) => {
    onChange({ additionalEffects: scene.additionalEffects.filter((e) => e !== effect) });
  };

  const primaryTone = scene.primaryEffect ? effectColorKey(scene.primaryEffect) : "ghost";

  return (
    <div className="effect-badges-row">
      <select
        className={`effect-primary-select tone-${primaryTone}`}
        value={scene.primaryEffect ?? ""}
        onChange={(e) => onChange({ primaryEffect: e.target.value || null })}
      >
        <option value="">+ Tag VFX</option>
        {VFX_EFFECT_GROUPS.map((g) => (
          <optgroup label={g.group} key={g.group}>
            {g.effects.map((effect) => (
              <option value={effect} key={effect}>
                {effect}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      {scene.primaryEffect &&
        scene.additionalEffects.map((effect) => (
          <span className={`effect-badge tone-${effectColorKey(effect)}`} key={effect}>
            {effect}
            <span className="effect-badge-remove" onClick={() => removeEffect(effect)}>
              ×
            </span>
          </span>
        ))}

      {scene.primaryEffect && (
        <select
          className="effect-add-select"
          value={addValue}
          onChange={(e) => {
            addEffect(e.target.value);
            setAddValue("");
          }}
        >
          <option value="">+ add</option>
          {ALL_VFX_EFFECTS.filter(
            (effect) => effect !== scene.primaryEffect && !scene.additionalEffects.includes(effect)
          ).map((effect) => (
            <option value={effect} key={effect}>
              {effect}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
