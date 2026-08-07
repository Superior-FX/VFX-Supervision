import { useState } from "react";
import { BudgetControl, CheckIcon, ComplexityDots, EffectPicker, PencilIcon } from "../components/SceneVfxFields.jsx";
import { moveItem, useLocalStorageState } from "../lib/useLocalStorageState.js";
import "../styles/reportsTable.css";
import "./ScriptBreakdown.css";
import "./ScriptReports.css";

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function blankScene() {
  return {
    id: crypto.randomUUID(),
    number: 0,
    heading: "NEW SCENE",
    primaryEffect: null,
    additionalEffects: [],
    complexity: 1,
    budgeted: false,
    budgetLow: 0,
    budgetHigh: 0,
    aiLow: 0,
    aiHigh: 0,
    submittedAt: new Date().toISOString(),
  };
}

export default function ScriptReports() {
  const [reports, setReports] = useLocalStorageState("vfx-supe-script-reports", []);
  const [editingIds, setEditingIds] = useState([]);

  const toggleEditing = (id) => {
    setEditingIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const updateScene = (updated) => {
    setReports((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  const addRow = () => {
    const row = blankScene();
    setReports((prev) => [...prev, row]);
    setEditingIds((prev) => [...prev, row.id]);
  };

  const move = (index, direction) => {
    setReports((prev) => moveItem(prev, index, direction));
  };

  return (
    <div className="script-reports">
      <div className="script-reports-header">
        <span className="script-reports-title">SCRIPT REPORTS</span>
        <div className="script-reports-header-actions">
          <span className="pill">{reports.length} VFX scenes submitted</span>
          <span className="btn btn-secondary report-add-btn" onClick={addRow}>
            + Add Scene
          </span>
        </div>
      </div>

      {reports.length === 0 ? (
        <div className="card script-reports-empty">
          No scenes submitted yet — tag scenes with VFX in Script Breakdown, then Submit Breakdown to see them here.
        </div>
      ) : (
        <div className="card report-table-wrap">
          <table className="report-table">
            <thead>
              <tr>
                <th></th>
                <th>Scene</th>
                <th>Heading</th>
                <th>Effects</th>
                <th>Complexity</th>
                <th>Budget</th>
                <th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((scene, i) => {
                const update = (patch) => updateScene({ ...scene, ...patch });
                const isEditing = editingIds.includes(scene.id);
                return (
                  <tr key={scene.id}>
                    <td className="report-edit-cell">
                      <div className="report-row-actions">
                        {isEditing && (
                          <>
                            <span
                              className={`report-edit-btn report-move-btn${i === 0 ? " disabled" : ""}`}
                              onClick={i === 0 ? undefined : () => move(i, -1)}
                              title="Move up"
                            >
                              ▲
                            </span>
                            <span
                              className={`report-edit-btn report-move-btn${i === reports.length - 1 ? " disabled" : ""}`}
                              onClick={i === reports.length - 1 ? undefined : () => move(i, 1)}
                              title="Move down"
                            >
                              ▼
                            </span>
                          </>
                        )}
                        <span className="report-edit-btn" onClick={() => toggleEditing(scene.id)} title={isEditing ? "Done" : "Edit"}>
                          {isEditing ? <CheckIcon /> : <PencilIcon />}
                        </span>
                      </div>
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          className="report-edit-input mono report-number-input"
                          type="number"
                          value={scene.number}
                          onChange={(e) => update({ number: Number(e.target.value) })}
                        />
                      ) : (
                        <span className="report-shot-code">SC {scene.number}</span>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          className="script-report-heading-input mono"
                          value={scene.heading}
                          onChange={(e) => update({ heading: e.target.value })}
                        />
                      ) : (
                        <span className="script-report-heading-static mono">{scene.heading}</span>
                      )}
                    </td>
                    <td>
                      <EffectPicker scene={scene} onChange={update} readOnly={!isEditing} />
                    </td>
                    <td>
                      <ComplexityDots value={scene.complexity} onChange={(v) => update({ complexity: v })} readOnly={!isEditing} />
                    </td>
                    <td>
                      <BudgetControl scene={scene} onChange={update} readOnly={!isEditing} />
                    </td>
                    <td className="report-timestamp">{formatTime(scene.submittedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
