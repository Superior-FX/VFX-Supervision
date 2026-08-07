import { useState } from "react";
import { CheckIcon, ComplexityDots, PencilIcon } from "../components/SceneVfxFields.jsx";
import { STORY_IMPORTANCE_LEVELS } from "../data/importance.js";
import { POST_TASK_TYPES } from "../data/postTasks.js";
import { computeImportance } from "../lib/importance.js";
import { moveItem, useLocalStorageState } from "../lib/useLocalStorageState.js";
import "./PostReports.css";

function ImageIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="9" cy="10" r="1.6" fill="currentColor" />
      <path d="M4 17l5-5 4 4 3-3 4 4" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function blankShot() {
  return {
    id: crypto.randomUUID(),
    shotCode: "NEW_SHOT",
    description: "",
    thumbnail: null,
    tasks: [],
    dispatched: false,
    boardStatus: "bidding",
    complexity: 1,
    storyImportance: 1,
    dueDate: "",
    submittedAt: new Date().toISOString(),
  };
}

function TaskRow({ task, readOnly, onChange, onRemove }) {
  if (readOnly) {
    return (
      <div className="post-task-row">
        <span className="post-task-type">{task.type}</span>
        <span className={`pill${task.source === "inhouse" ? " pill-accent" : ""}`}>
          {task.source === "vendor" ? "Outsourced" : "In-house"}
        </span>
        {task.status === "in_progress" && <span className="pill pill-warning">In Progress</span>}
        <span className="post-task-assignee mono">{task.assignee?.trim() || "Unassigned"}</span>
      </div>
    );
  }

  return (
    <div className="post-task-row post-task-row-editing">
      <span className="post-task-type">{task.type}</span>
      <div className="post-task-source-toggle">
        <span
          className={`pill post-source-pill${task.source !== "vendor" ? " pill-accent" : ""}`}
          onClick={() => onChange({ source: "inhouse" })}
        >
          In-house
        </span>
        <span
          className={`pill post-source-pill${task.source === "vendor" ? " pill-accent" : ""}`}
          onClick={() => onChange({ source: "vendor" })}
        >
          Outsourced
        </span>
      </div>
      {task.status === "in_progress" && <span className="pill pill-warning">In Progress</span>}
      <input
        className="report-edit-input mono post-task-assignee-input"
        placeholder={task.source === "vendor" ? "Vendor name" : "Artist name"}
        value={task.assignee}
        onChange={(e) => onChange({ assignee: e.target.value })}
      />
      <span className="post-task-remove" onClick={onRemove} title="Remove task">
        ×
      </span>
    </div>
  );
}

function ShotCard({ shot, index, isFirst, isLast, isEditing, onToggleEdit, onMove, onChange }) {
  const [addTaskType, setAddTaskType] = useState("");
  const update = (patch) => onChange({ ...shot, ...patch });

  const addTask = (type) => {
    if (!type) return;
    update({ tasks: [...shot.tasks, { id: crypto.randomUUID(), type, source: "inhouse", assignee: "", status: null }] });
  };

  const updateTask = (taskId, patch) => {
    update({ tasks: shot.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)) });
  };

  const removeTask = (taskId) => {
    update({ tasks: shot.tasks.filter((t) => t.id !== taskId) });
  };

  const assignedCount = shot.tasks.filter((t) => t.assignee?.trim()).length;
  const totalTasks = shot.tasks.length;
  const fullyAssigned = totalTasks > 0 && assignedCount === totalTasks;
  const availableTaskTypes = POST_TASK_TYPES.filter((t) => !shot.tasks.some((task) => task.type === t));
  const importance = computeImportance(shot);

  return (
    <div className={`card post-shot-card${importance.colorKey ? ` importance-${importance.colorKey}` : ""}`}>
      <div className="post-shot-header">
        {shot.thumbnail ? (
          <img className="post-shot-thumb" src={shot.thumbnail} alt={`${shot.shotCode} thumbnail`} />
        ) : (
          <div className="post-shot-thumb-placeholder">
            <ImageIcon />
          </div>
        )}
        <div className="post-shot-header-main">
          {isEditing ? (
            <input
              className="report-edit-input mono"
              value={shot.shotCode}
              onChange={(e) => update({ shotCode: e.target.value })}
            />
          ) : (
            <span className="report-shot-code">{shot.shotCode}</span>
          )}
          {isEditing ? (
            <input
              className="report-edit-input"
              placeholder="Shot description / needs…"
              value={shot.description}
              onChange={(e) => update({ description: e.target.value })}
            />
          ) : (
            <span className="post-shot-description">{shot.description || "—"}</span>
          )}
        </div>
        <div className="post-shot-header-actions">
          {shot.dispatched && <span className="pill pill-success">Pushed</span>}
          {isEditing && (
            <>
              <span
                className={`report-edit-btn report-move-btn${isFirst ? " disabled" : ""}`}
                onClick={isFirst ? undefined : () => onMove(index, -1)}
                title="Move up"
              >
                ▲
              </span>
              <span
                className={`report-edit-btn report-move-btn${isLast ? " disabled" : ""}`}
                onClick={isLast ? undefined : () => onMove(index, 1)}
                title="Move down"
              >
                ▼
              </span>
            </>
          )}
          <span className="report-edit-btn" onClick={onToggleEdit} title={isEditing ? "Done" : "Edit"}>
            {isEditing ? <CheckIcon /> : <PencilIcon />}
          </span>
        </div>
      </div>

      {isEditing ? (
        <div className="post-shot-meta post-shot-meta-editing">
          <div className="post-shot-meta-field">
            <span className="label">Complexity</span>
            <ComplexityDots value={shot.complexity} onChange={(v) => update({ complexity: v })} />
          </div>
          <div className="post-shot-meta-field">
            <span className="label">Story importance</span>
            <ComplexityDots
              value={shot.storyImportance}
              onChange={(v) => update({ storyImportance: v })}
              levels={STORY_IMPORTANCE_LEVELS}
            />
          </div>
          <div className="post-shot-meta-field">
            <span className="label">Due date</span>
            <input
              className="report-edit-input mono post-due-input"
              type="date"
              value={shot.dueDate || ""}
              onChange={(e) => update({ dueDate: e.target.value })}
            />
          </div>
        </div>
      ) : (
        <div className="post-shot-meta">
          <span className="pill mono">C: {shot.complexity}/5</span>
          <span className="pill mono">Story: {shot.storyImportance}/5</span>
          {shot.dueDate && <span className="pill mono">Due {shot.dueDate}</span>}
        </div>
      )}

      <div className="post-shot-tasks">
        {shot.tasks.length === 0 && <span className="post-tasks-empty">No tasks added yet.</span>}
        {shot.tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            readOnly={!isEditing}
            onChange={(patch) => updateTask(task.id, patch)}
            onRemove={() => removeTask(task.id)}
          />
        ))}
      </div>

      {isEditing && availableTaskTypes.length > 0 && (
        <select
          className="effect-add-select post-add-task-select"
          value={addTaskType}
          onChange={(e) => {
            addTask(e.target.value);
            setAddTaskType("");
          }}
        >
          <option value="">+ add task</option>
          {availableTaskTypes.map((t) => (
            <option value={t} key={t}>
              {t}
            </option>
          ))}
        </select>
      )}

      <div className="post-shot-footer">
        <span className="post-shot-progress mono">
          {assignedCount}/{totalTasks} task{totalTasks === 1 ? "" : "s"} assigned
        </span>
        <span
          className={`btn btn-primary${fullyAssigned ? "" : " btn-disabled"}`}
          onClick={fullyAssigned ? () => update({ dispatched: true }) : undefined}
        >
          {shot.dispatched ? "Re-push Assignment" : "Push Assignment"}
        </span>
      </div>
    </div>
  );
}

export default function PostReports() {
  const [shots, setShots] = useLocalStorageState("vfx-supe-post-reports", []);
  const [editingIds, setEditingIds] = useState([]);

  const toggleEditing = (id) => {
    setEditingIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const updateShot = (updated) => {
    setShots((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  const addRow = () => {
    const row = blankShot();
    setShots((prev) => [...prev, row]);
    setEditingIds((prev) => [...prev, row.id]);
  };

  const move = (index, direction) => {
    setShots((prev) => moveItem(prev, index, direction));
  };

  return (
    <div className="post-reports">
      <div className="post-reports-header">
        <span className="post-reports-title">POST REPORTS</span>
        <div className="post-reports-header-actions">
          <span className="pill">{shots.length} shots</span>
          <span className="btn btn-secondary report-add-btn" onClick={addRow}>
            + Add Shot
          </span>
        </div>
      </div>

      {shots.length === 0 ? (
        <div className="card post-reports-empty">
          No shots yet — submit shots in Capture Reports, then Push to Post to see them here.
        </div>
      ) : (
        <div className="post-shot-list">
          {shots.map((shot, i) => (
            <ShotCard
              key={shot.id}
              shot={shot}
              index={i}
              isFirst={i === 0}
              isLast={i === shots.length - 1}
              isEditing={editingIds.includes(shot.id)}
              onToggleEdit={() => toggleEditing(shot.id)}
              onMove={move}
              onChange={updateShot}
            />
          ))}
        </div>
      )}
    </div>
  );
}
