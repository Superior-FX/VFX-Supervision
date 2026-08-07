import { Fragment, useRef, useState } from "react";
import { CheckIcon, PencilIcon } from "../components/SceneVfxFields.jsx";
import { generateThumbnail } from "../lib/ffmpeg.js";
import { moveItem, upsertById, useLocalStorageState } from "../lib/useLocalStorageState.js";
import "../styles/reportsTable.css";
import "./Capture.css";
import "./CaptureReports.css";

function ImageIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="9" cy="10" r="1.6" fill="currentColor" />
      <path d="M4 17l5-5 4 4 3-3 4 4" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ChecklistEditor({ row, onChange }) {
  const toggle = (id) => {
    const next = row.checklist.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item));
    onChange({ checklist: next });
  };

  return (
    <div className="capture-report-checklist-editor">
      {row.checklist.map((item) => (
        <div className="checklist-item" key={item.id} onClick={() => toggle(item.id)}>
          <div className={`checklist-box${item.checked ? " checked" : ""}`}>
            {item.checked && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 12l5 5L20 6"
                  stroke="#0e0f13"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
          <span className="checklist-label">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function blankRow() {
  return {
    id: crypto.randomUUID(),
    shotCode: "NEW_SHOT",
    description: "",
    lens: "",
    camera: "",
    checklist: [],
    thumbnail: null,
    submittedAt: new Date().toISOString(),
  };
}

export default function CaptureReports() {
  const [reports, setReports] = useLocalStorageState("vfx-supe-capture-reports", []);
  const [postReports, setPostReports] = useLocalStorageState("vfx-supe-post-reports", []);
  const [editingIds, setEditingIds] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [thumbStatus, setThumbStatus] = useState({});
  const [confirmation, setConfirmation] = useState(null);
  const fileInputRefs = useRef({});

  const toggleEditing = (id) => {
    setEditingIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    if (expandedId === id) setExpandedId(null);
  };

  const updateRow = (id, patch) => {
    setReports((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const addRow = () => {
    const row = blankRow();
    setReports((prev) => [...prev, row]);
    setEditingIds((prev) => [...prev, row.id]);
  };

  const move = (index, direction) => {
    setReports((prev) => moveItem(prev, index, direction));
  };

  const pushToPost = () => {
    setPostReports((prev) => {
      let next = prev;
      for (const row of reports) {
        const existing = prev.find((p) => p.id === row.id);
        next = upsertById(next, {
          id: row.id,
          shotCode: row.shotCode,
          description: row.description,
          thumbnail: row.thumbnail,
          tasks: existing?.tasks ?? [],
          dispatched: existing?.dispatched ?? false,
          boardStatus: existing?.boardStatus ?? "bidding",
          complexity: existing?.complexity ?? 1,
          storyImportance: existing?.storyImportance ?? 1,
          dueDate: existing?.dueDate ?? "",
          submittedAt: new Date().toISOString(),
        });
      }
      return next;
    });
    setConfirmation(`${reports.length} shot${reports.length === 1 ? "" : "s"} pushed to Post Reports`);
    setTimeout(() => setConfirmation(null), 3000);
  };

  const handleThumbFile = async (rowId, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setThumbStatus((s) => ({ ...s, [rowId]: "Processing…" }));
    try {
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("timed out")), 30000));
      const dataUrl = await Promise.race([
        generateThumbnail(file, { onProgress: (msg) => setThumbStatus((s) => ({ ...s, [rowId]: msg })) }),
        timeout,
      ]);
      updateRow(rowId, { thumbnail: dataUrl });
    } catch (err) {
      console.error("Thumbnail generation failed:", err);
    } finally {
      setThumbStatus((s) => {
        const next = { ...s };
        delete next[rowId];
        return next;
      });
    }
  };

  return (
    <div className="capture-reports">
      <div className="capture-reports-header">
        <span className="capture-reports-title">CAPTURE REPORTS</span>
        <div className="capture-reports-header-actions">
          <span className="pill">{reports.length} shots submitted</span>
          <span className="btn btn-secondary report-add-btn" onClick={addRow}>
            + Add Shot
          </span>
          <span
            className={`btn btn-primary${reports.length === 0 ? " btn-disabled" : ""}`}
            onClick={reports.length === 0 ? undefined : pushToPost}
          >
            Push to Post
          </span>
        </div>
      </div>
      {confirmation && <div className="capture-reports-confirmation">{confirmation}</div>}

      {reports.length === 0 ? (
        <div className="card capture-reports-empty">
          No shots submitted yet — submit a capture from On-Set Capture to see it here.
        </div>
      ) : (
        <div className="card report-table-wrap">
          <table className="report-table">
            <thead>
              <tr>
                <th></th>
                <th></th>
                <th>Shot</th>
                <th>Description</th>
                <th>Lens</th>
                <th>Camera</th>
                <th>Checklist</th>
                <th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((row, i) => {
                const done = row.checklist?.filter((c) => c.checked).length ?? 0;
                const total = row.checklist?.length ?? 0;
                const isEditing = editingIds.includes(row.id);
                const isExpanded = expandedId === row.id;
                const status = thumbStatus[row.id];

                return (
                  <Fragment key={row.id}>
                    <tr>
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
                          <span
                            className="report-edit-btn"
                            onClick={() => toggleEditing(row.id)}
                            title={isEditing ? "Done" : "Edit"}
                          >
                            {isEditing ? <CheckIcon /> : <PencilIcon />}
                          </span>
                        </div>
                      </td>
                      <td className="report-thumb-cell">
                        {isEditing ? (
                          <div
                            className="report-thumb-edit"
                            onClick={() => fileInputRefs.current[row.id]?.click()}
                            title="Replace thumbnail (video/photo, via ffmpeg)"
                          >
                            {status ? (
                              <div className="report-thumb-placeholder report-thumb-status">…</div>
                            ) : row.thumbnail ? (
                              <img className="report-thumb" src={row.thumbnail} alt={`${row.shotCode} thumbnail`} />
                            ) : (
                              <div className="report-thumb-placeholder">
                                <ImageIcon />
                              </div>
                            )}
                            <span className="report-thumb-edit-icon">
                              <PencilIcon />
                            </span>
                          </div>
                        ) : row.thumbnail ? (
                          <img className="report-thumb" src={row.thumbnail} alt={`${row.shotCode} thumbnail`} />
                        ) : (
                          <div className="report-thumb-placeholder">
                            <ImageIcon />
                          </div>
                        )}
                        <input
                          type="file"
                          accept="video/*,image/*"
                          style={{ display: "none" }}
                          ref={(el) => (fileInputRefs.current[row.id] = el)}
                          onChange={(e) => handleThumbFile(row.id, e)}
                        />
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            className="report-edit-input mono"
                            value={row.shotCode}
                            onChange={(e) => updateRow(row.id, { shotCode: e.target.value })}
                          />
                        ) : (
                          <span className="report-shot-code">{row.shotCode}</span>
                        )}
                      </td>
                      <td className="report-description">
                        {isEditing ? (
                          <input
                            className="report-edit-input"
                            value={row.description}
                            onChange={(e) => updateRow(row.id, { description: e.target.value })}
                          />
                        ) : (
                          <span className="report-static-text">{row.description || "—"}</span>
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            className="report-edit-input mono"
                            value={row.lens}
                            onChange={(e) => updateRow(row.id, { lens: e.target.value })}
                          />
                        ) : (
                          <span className="report-mono">{row.lens}</span>
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            className="report-edit-input mono"
                            value={row.camera}
                            onChange={(e) => updateRow(row.id, { camera: e.target.value })}
                          />
                        ) : (
                          <span className="report-mono">{row.camera}</span>
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <span
                            className={`report-checklist-count clickable${done === total && total > 0 ? " complete" : ""}`}
                            onClick={() => setExpandedId(isExpanded ? null : row.id)}
                          >
                            {done}/{total} {isExpanded ? "▲" : "▼"}
                          </span>
                        ) : (
                          <span className={`report-checklist-count${done === total && total > 0 ? " complete" : ""}`}>
                            {done}/{total}
                          </span>
                        )}
                      </td>
                      <td className="report-timestamp">{formatTime(row.submittedAt)}</td>
                    </tr>
                    {isEditing && isExpanded && (
                      <tr className="report-expanded-row">
                        <td colSpan={2}></td>
                        <td colSpan={6}>
                          <ChecklistEditor row={row} onChange={(patch) => updateRow(row.id, patch)} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
