import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import walkthrough from "../../../support/walkthrough.json";
import { useRole } from "../../lib/role.js";
import "./HelpSupport.css";

// Which steps a module/step is meant for. "studio" = everything outside the
// Artist Portal; "admin" = Team & Access. Artist-only accounts don't see
// studio/admin material, since those pages would just bounce them.
function visibleTo(audience, { can, isArtistOnly }) {
  if (!audience || audience === "all" || audience === "artist") return true;
  if (isArtistOnly) return false;
  if (audience === "admin") return can("manage_users");
  return true;
}

const STORAGE_KEY = "vfx-supe-walkthrough-state";

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export default function HelpSupport() {
  const navigate = useNavigate();
  const role = useRole();
  const modules = walkthrough.modules
    .filter((m) => visibleTo(m.audience, role))
    .map((m) => ({ ...m, steps: m.steps.filter((s) => visibleTo(s.audience, role)) }))
    .filter((m) => m.steps.length > 0);

  // Artists land on their own module first; everyone else starts at the top.
  const defaultModule = (role.isArtistOnly && modules.find((m) => m.audience === "artist")) || modules[0];
  const [moduleId, setModuleId] = useState(defaultModule.id);
  const [stepIndex, setStepIndex] = useState(0);
  const [done, setDone] = useState(loadState);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(done));
    } catch {
      // Progress is a convenience — fine to lose it.
    }
  }, [done]);

  const active = modules.find((m) => m.id === moduleId) ?? modules[0];
  const step = active.steps[Math.min(stepIndex, active.steps.length - 1)];
  const stepKey = (m, s) => `${m.id}/${s.id}`;
  const moduleDoneCount = (m) => m.steps.filter((s) => done[stepKey(m, s)]).length;
  const totalSteps = modules.reduce((n, m) => n + m.steps.length, 0);
  const totalDone = modules.reduce((n, m) => n + moduleDoneCount(m), 0);

  const openModule = (id) => {
    setModuleId(id);
    setStepIndex(0);
  };

  const markDone = (value = true) => setDone((prev) => ({ ...prev, [stepKey(active, step)]: value }));

  const isLastStep = stepIndex >= active.steps.length - 1;
  const nextModule = modules[modules.indexOf(active) + 1];

  const next = () => {
    markDone();
    if (!isLastStep) setStepIndex(stepIndex + 1);
    else if (nextModule) openModule(nextModule.id);
  };

  const stepDone = Boolean(done[stepKey(active, step)]);

  return (
    <div className="support">
      <aside className="support-modules">
        <div className="support-overall">
          <span className="label">{walkthrough.title}</span>
          <span className="support-overall-count mono">
            {totalDone} / {totalSteps} steps
          </span>
          <div className="support-bar">
            <div className="support-bar-fill" style={{ width: `${(totalDone / totalSteps) * 100}%` }} />
          </div>
        </div>
        {modules.map((m, i) => {
          const count = moduleDoneCount(m);
          const complete = count === m.steps.length;
          return (
            <div
              key={m.id}
              className={`support-module${m.id === active.id ? " active" : ""}${complete ? " complete" : ""}`}
              onClick={() => openModule(m.id)}
            >
              <span className="support-module-num mono">{complete ? "✓" : i + 1}</span>
              <div className="support-module-text">
                <span className="support-module-title">{m.title}</span>
                <span className="support-module-count mono">
                  {count}/{m.steps.length}
                </span>
              </div>
            </div>
          );
        })}
        {totalDone > 0 && (
          <span className="support-reset" onClick={() => setDone({})}>
            Reset progress
          </span>
        )}
      </aside>

      <div className="support-scroll">
        <div className="card support-step">
          <div className="support-step-head">
            <span className="label">{active.title}</span>
            <span className="support-step-summary">{active.summary}</span>
          </div>

          <div className="support-dots">
            {active.steps.map((s, i) => (
              <span
                key={s.id}
                className={`support-dot${i === stepIndex ? " current" : ""}${done[stepKey(active, s)] ? " done" : ""}`}
                onClick={() => setStepIndex(i)}
                title={s.title}
              >
                {i + 1}
              </span>
            ))}
          </div>

          <div className="support-step-title">
            <span className="mono support-step-of">
              Step {stepIndex + 1} of {active.steps.length}
            </span>
            <h2>{step.title}</h2>
          </div>

          <div className="support-step-body md">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{step.body}</ReactMarkdown>
          </div>

          <div className="support-step-actions">
            <span
              className={`btn btn-secondary${stepIndex === 0 ? " btn-disabled" : ""}`}
              onClick={stepIndex === 0 ? undefined : () => setStepIndex(stepIndex - 1)}
            >
              ← Back
            </span>
            {step.route && (
              <span className="btn btn-secondary" onClick={() => navigate(step.route)}>
                {step.routeLabel || "Go there"} ↗
              </span>
            )}
            <span className="support-step-spacer" />
            <label className="support-step-check">
              <input type="checkbox" checked={stepDone} onChange={(e) => markDone(e.target.checked)} />
              Done
            </label>
            {(!isLastStep || nextModule) && (
              <span className="btn btn-primary" onClick={next}>
                {isLastStep ? `Next: ${nextModule.title} →` : "Next →"}
              </span>
            )}
            {isLastStep && !nextModule && !stepDone && (
              <span className="btn btn-primary" onClick={() => markDone()}>
                Finish
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
