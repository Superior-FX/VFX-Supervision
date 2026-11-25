import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { STORY_IMPORTANCE_LEVELS } from "../../data/importance.js";
import { isInReview, taskStatusInfo } from "../../data/taskStatus.js";
import { COMPLEXITY_LEVELS } from "../../data/vfxEffects.js";
import { computeImportance } from "../../lib/importance.js";
import { clientNotes, internalNotes, submittedVersions, taskSupNote } from "../../lib/shotNotes.js";
import { formatVersion } from "../../lib/fsAccess.js";
import { assigneesLabel, getAssignees } from "../../lib/taskAssignees.js";
import "./ShotSpreadsheet.css";

// Post Reports' default view: every shot as one spreadsheet row, editable
// in place. The Shots tab (scene groups + shot cards) is still where
// scenes, folders, tasks, plates and pushes are handled — this edits the
// shot's own fields only.

const PIPELINES = [
  { value: "traditional", label: "Traditional" },
  { value: "ai_assist", label: "AI-assist" },
  { value: "hybrid", label: "Hybrid" },
];

const PRIORITY_TONE = { danger: "pill-danger", warning: "pill-warning" };

function TextCell({ value, onChange, readOnly, placeholder, mono, wide }) {
  if (readOnly) return <span className={`sheet-static${mono ? " mono" : ""}`}>{value || "—"}</span>;
  return (
    <input
      className={`sheet-input${mono ? " mono" : ""}${wide ? " sheet-input-wide" : ""}`}
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function LevelCell({ value, levels, onChange, readOnly }) {
  if (readOnly) return <span className="sheet-static">{levels[value - 1] ?? "—"}</span>;
  return (
    <select className="sheet-input" value={value || 1} onChange={(e) => onChange(Number(e.target.value))}>
      {levels.map((label, i) => (
        <option key={label} value={i + 1}>
          {label}
        </option>
      ))}
    </select>
  );
}

// One task's supe note, editable. Typed into a local draft and saved when
// the box loses focus (saving trims, which would eat spaces mid-typing).
// Saved the same way as Review & Dailies' Supe notes, on the task's current
// version, so it shows for the artist in Shot Viewer and back in Review.
function SupNoteEditor({ task, onSave }) {
  const saved = taskSupNote(task);
  const [draft, setDraft] = useState(saved);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setDraft(saved);
  }, [saved, focused]);
  return (
    <div className="sheet-note">
      <span className="sheet-note-head">
        {task.type} {task.version != null && <span className="mono">{formatVersion(task.version)}</span>}
      </span>
      <textarea
        className="sheet-input sheet-note-input"
        rows={2}
        placeholder="Supe note…"
        value={draft}
        onFocus={() => setFocused(true)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setFocused(false);
          if (draft.trim() !== saved) onSave(draft);
        }}
      />
    </div>
  );
}

export default function ShotSpreadsheet({ shots, feedback, onPatch, onSaveSupNote, canEdit, canViewCosts }) {
  const navigate = useNavigate();
  const [sceneFilter, setSceneFilter] = useState("");

  const sceneOptions = useMemo(() => [...new Set(shots.map((s) => s.scene).filter(Boolean))], [shots]);
  const visible = sceneFilter ? shots.filter((s) => s.scene === sceneFilter) : shots;
  const readOnly = !canEdit;

  if (shots.length === 0) {
    return (
      <div className="card post-reports-empty">
        No shots yet. Add scenes and shots in the Shots tab, or import a spreadsheet when creating a project.
      </div>
    );
  }

  return (
    <div className="card sheet-card">
      <div className="sheet-toolbar">
        <select className="sheet-input sheet-filter" value={sceneFilter} onChange={(e) => setSceneFilter(e.target.value)}>
          <option value="">All scenes</option>
          {sceneOptions.map((sc) => (
            <option key={sc} value={sc}>
              SC{sc}
            </option>
          ))}
        </select>
        <span className="label">
          {visible.length} shot{visible.length === 1 ? "" : "s"}
          {readOnly ? " · view only" : ""}
        </span>
      </div>
      <div className="sheet-wrap">
        <table className="sheet-table">
          <thead>
            <tr>
              <th className="sheet-thumb-col"></th>
              <th>Scene</th>
              <th className="sheet-sticky-col">Shot code</th>
              <th>Script description</th>
              <th>Internal description</th>
              <th>Artists</th>
              <th>Submitted version</th>
              <th>Client notes</th>
              <th>Internal notes</th>
              <th>Tasks</th>
              <th>Due date</th>
              <th>Priority</th>
              <th>TC in</th>
              <th>TC out</th>
              <th>Pipeline</th>
              <th>Complexity</th>
              <th>Pushed</th>
              <th>Folder</th>
              <th>Story importance</th>
              {canViewCosts && <th>Bid cost</th>}
            </tr>
          </thead>
          <tbody>
            {visible.map((shot) => {
              const importance = computeImportance(shot);
              const patch = (p) => onPatch(shot.id, p);
              return (
                <tr key={shot.id} className={importance.colorKey ? `sheet-row-${importance.colorKey}` : ""}>
                  <td className="sheet-thumb-col">
                    {shot.thumbnail ? (
                      <img
                        className="sheet-thumb"
                        src={shot.thumbnail}
                        alt=""
                        title="Open in shot viewer"
                        onClick={() => shot.shotCode && navigate(`/shot/${encodeURIComponent(shot.shotCode)}`)}
                      />
                    ) : (
                      <div className="sheet-thumb sheet-thumb-empty" />
                    )}
                  </td>
                  <td className="mono sheet-nowrap">SC{shot.scene}</td>
                  <td className="sheet-sticky-col">
                    <TextCell
                      mono
                      value={shot.shotCode}
                      placeholder="NEW_SHOT"
                      readOnly={readOnly}
                      onChange={(v) => patch({ shotCode: v })}
                    />
                  </td>
                  <td>
                    <TextCell
                      wide
                      value={shot.scriptDescription}
                      readOnly={readOnly}
                      onChange={(v) => patch({ scriptDescription: v })}
                    />
                  </td>
                  <td>
                    <TextCell
                      wide
                      value={shot.internalDescription}
                      readOnly={readOnly}
                      onChange={(v) => patch({ internalDescription: v })}
                    />
                  </td>
                  <td>
                    {/* Everyone working on the shot, once each, names only. */}
                    <span className="sheet-static sheet-artists">
                      {[...new Set(shot.tasks.flatMap(getAssignees))].join(", ") || "—"}
                    </span>
                  </td>
                  <td>
                    <div className="sheet-notes sheet-versions">
                      {submittedVersions(shot).map((v) => (
                        <span key={v.task.id} className="sheet-nowrap">
                          {v.task.type} <span className="mono">{v.version}</span>
                        </span>
                      ))}
                      {submittedVersions(shot).length === 0 && <span className="sheet-static">—</span>}
                    </div>
                  </td>
                  <td className={clientNotes(shot, feedback).length ? "sheet-client-cell" : ""}>
                    {/* The client's notes on each task's latest version come first. */}
                    <div className="sheet-notes">
                      {clientNotes(shot, feedback).map((n, i) => (
                        <div key={i} className="sheet-note">
                          <span className="sheet-note-head">
                            {n.task.type} <span className="mono">{n.version}</span> · {n.reviewer}
                            {n.decision && (
                              <span className={`pill pill-${n.decision.tone} sheet-note-pill`}>{n.decision.label}</span>
                            )}
                          </span>
                          {n.comment && <span>{n.comment}</span>}
                          {n.drawings > 0 && (
                            <span className="sheet-note-sub">
                              {n.drawings} drawing{n.drawings === 1 ? "" : "s"} (see Review &amp; Dailies)
                            </span>
                          )}
                        </div>
                      ))}
                      {clientNotes(shot, feedback).length === 0 && <span className="sheet-static">—</span>}
                    </div>
                  </td>
                  <td>
                    {canEdit && shot.tasks.length > 0 ? (
                      <div className="sheet-notes sheet-notes-editing">
                        {shot.tasks.map((task) => (
                          <SupNoteEditor key={task.id} task={task} onSave={(text) => onSaveSupNote(shot.id, task.id, text)} />
                        ))}
                      </div>
                    ) : (
                    <div className="sheet-notes">
                      {internalNotes(shot).map((n) => (
                        <div key={n.task.id} className="sheet-note">
                          <span className="sheet-note-head">
                            {n.task.type} {n.version && <span className="mono">{n.version}</span>}
                          </span>
                          <span>{n.note}</span>
                        </div>
                      ))}
                      {internalNotes(shot).length === 0 && <span className="sheet-static">—</span>}
                    </div>
                    )}
                  </td>
                  <td>
                    <div className="sheet-tasks">
                      {shot.tasks.length === 0 && <span className="sheet-static">—</span>}
                      {shot.tasks.map((task) => {
                        const status = taskStatusInfo(task.status);
                        const reviewable = isInReview(task.status);
                        return (
                          <span
                            key={task.id}
                            className={`pill${status.tone ? ` pill-${status.tone}` : ""}${reviewable ? " sheet-task-link" : ""}`}
                            title={`${task.type}: ${status.label} · ${assigneesLabel(task)}${reviewable ? " · click to review" : ""}`}
                            onClick={reviewable ? () => navigate(`/review?task=${task.id}`) : undefined}
                          >
                            {task.type} · {status.label}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td>
                    {readOnly ? (
                      <span className="sheet-static mono">{shot.dueDate || "—"}</span>
                    ) : (
                      <input
                        className="sheet-input mono"
                        type="date"
                        value={shot.dueDate || ""}
                        onChange={(e) => patch({ dueDate: e.target.value })}
                      />
                    )}
                  </td>
                  <td>
                    <span className={`pill ${PRIORITY_TONE[importance.colorKey] ?? ""}`}>{importance.tier}</span>
                  </td>
                  <td>
                    <TextCell
                      mono
                      value={shot.timecodeIn}
                      placeholder="00:00:00:00"
                      readOnly={readOnly}
                      onChange={(v) => patch({ timecodeIn: v })}
                    />
                  </td>
                  <td>
                    <TextCell
                      mono
                      value={shot.timecodeOut}
                      placeholder="00:00:00:00"
                      readOnly={readOnly}
                      onChange={(v) => patch({ timecodeOut: v })}
                    />
                  </td>
                  <td>
                    {readOnly ? (
                      <span className="sheet-static">
                        {PIPELINES.find((p) => p.value === shot.pipeline)?.label ?? shot.pipeline}
                      </span>
                    ) : (
                      <select
                        className="sheet-input"
                        value={shot.pipeline || "traditional"}
                        onChange={(e) => patch({ pipeline: e.target.value })}
                      >
                        {PIPELINES.map((p) => (
                          <option key={p.value} value={p.value}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td>
                    <LevelCell
                      value={shot.complexity}
                      levels={COMPLEXITY_LEVELS}
                      readOnly={readOnly}
                      onChange={(v) => patch({ complexity: v })}
                    />
                  </td>
                  <td className="sheet-nowrap">{shot.dispatched ? "Yes" : "No"}</td>
                  <td className="sheet-nowrap">{shot.foldersCreatedAt ? "Yes" : "No"}</td>
                  <td>
                    <LevelCell
                      value={shot.storyImportance}
                      levels={STORY_IMPORTANCE_LEVELS}
                      readOnly={readOnly}
                      onChange={(v) => patch({ storyImportance: v })}
                    />
                  </td>
                  {canViewCosts && (
                    <td>
                      {readOnly ? (
                        <span className="sheet-static mono">
                          {shot.bidCost != null ? `$${shot.bidCost.toLocaleString()}` : "—"}
                        </span>
                      ) : (
                        <input
                          className="sheet-input mono sheet-input-cost"
                          type="number"
                          min={0}
                          value={shot.bidCost ?? ""}
                          onChange={(e) => patch({ bidCost: e.target.value === "" ? null : Number(e.target.value) })}
                        />
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
