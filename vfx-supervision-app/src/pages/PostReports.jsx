import { useEffect, useState } from "react";
import { CheckIcon, ComplexityDots, PencilIcon } from "../components/SceneVfxFields.jsx";
import { STORY_IMPORTANCE_LEVELS } from "../data/importance.js";
import { POST_TASK_TYPES } from "../data/postTasks.js";
import { taskStatusInfo } from "../data/taskStatus.js";
import { buildFolderPath, padScene } from "../lib/folderPath.js";
import { createShotFolders, ensurePermission, isFsAccessSupported, loadRootHandle, pickProjectRootFolder } from "../lib/fsAccess.js";
import { computeImportance } from "../lib/importance.js";
import { scopedKey, useActiveProject } from "../lib/projects.js";
import { CURRENT_ROLE } from "../lib/role.js";
import { useEnterKey } from "../lib/useEnterKey.js";
import { moveItem, useLocalStorageState } from "../lib/useLocalStorageState.js";
import ArtistDirectory, { artistDepartments } from "./postReports/ArtistDirectory.jsx";
import "./PostReports.css";

const TABS = ["Shots", "Artists"];

const PIPELINES = [
  { value: "traditional", label: "Traditional" },
  { value: "ai_assist", label: "AI-assist" },
  { value: "hybrid", label: "Hybrid" },
];

function ImageIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="9" cy="10" r="1.6" fill="currentColor" />
      <path d="M4 17l5-5 4 4 3-3 4 4" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function blankShot() {
  return {
    id: crypto.randomUUID(),
    shotCode: "NEW_SHOT",
    sequence: "",
    scene: "",
    pipeline: "traditional",
    description: "",
    thumbnail: null,
    tasks: [],
    dispatched: false,
    boardStatus: "bidding",
    complexity: 1,
    storyImportance: 1,
    dueDate: "",
    foldersCreatedAt: null,
    submittedAt: new Date().toISOString(),
  };
}

function TaskRow({ task, readOnly, onChange, onRemove, artists }) {
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const status = taskStatusInfo(task.status);
  const deleteMatches = confirmText.trim().toUpperCase() === "DELETE";
  useEnterKey(() => {
    if (confirming && deleteMatches) onRemove();
  });

  if (readOnly) {
    return (
      <div className="post-task-row">
        <span className="post-task-type">{task.type}</span>
        <span className={`pill${task.source === "inhouse" ? " pill-accent" : ""}`}>
          {task.source === "vendor" ? "Outsourced" : "In-house"}
        </span>
        <span className={`pill${status.tone ? ` pill-${status.tone}` : ""}`}>{status.label}</span>
        <span className="post-task-assignee mono">{task.assignee?.trim() || "Unassigned"}</span>
        {task.status === "pending" && (
          <div className="post-task-review-actions">
            <span className="btn btn-danger post-task-review-btn" onClick={() => onChange({ status: "needs_revision" })}>
              Revise
            </span>
            <span className="btn btn-primary post-task-review-btn" onClick={() => onChange({ status: "final" })}>
              Final
            </span>
          </div>
        )}
      </div>
    );
  }

  if (confirming) {
    const matches = deleteMatches;
    return (
      <div className="post-task-row post-task-row-confirm">
        <span className="post-task-confirm-label">Type DELETE to remove this assignment</span>
        <input
          className="report-edit-input mono post-task-confirm-input"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="DELETE"
          autoFocus
        />
        <span className={`btn btn-danger${matches ? "" : " btn-disabled"}`} onClick={matches ? onRemove : undefined}>
          Confirm delete
        </span>
        <span
          className="btn btn-secondary"
          onClick={() => {
            setConfirming(false);
            setConfirmText("");
          }}
        >
          Cancel
        </span>
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
      <span className={`pill${status.tone ? ` pill-${status.tone}` : ""}`}>{status.label}</span>
      {task.source === "vendor" ? (
        <input
          className="report-edit-input mono post-task-assignee-input"
          placeholder="Vendor name"
          value={task.assignee}
          onChange={(e) => onChange({ assignee: e.target.value })}
        />
      ) : (
        <select
          className="report-edit-input mono post-task-assignee-input"
          value={task.assignee}
          onChange={(e) => onChange({ assignee: e.target.value })}
        >
          <option value="">Unassigned</option>
          {artists.map((a) => (
            <option value={a.name} key={a.id}>
              {a.name} — {artistDepartments(a).join(" / ")}
            </option>
          ))}
        </select>
      )}
      <span className="post-task-remove" onClick={() => setConfirming(true)} title="Remove assignment">
        <TrashIcon />
      </span>
    </div>
  );
}

function buildShotMeta(project, shot) {
  return {
    show: project.showCode,
    sequence: shot.sequence,
    scene: padScene(shot.scene),
    shot: shot.shotCode,
    description: shot.description || "",
    pipeline: shot.pipeline || "traditional",
    status: shot.dispatched ? "in_progress" : "not_shot",
    notes: "",
  };
}

function ShotCard({ shot, index, isFirst, isLast, isEditing, onToggleEdit, onMove, onChange, onDelete, project, rootHandle, artists, isAdmin }) {
  const [addTaskType, setAddTaskType] = useState("");
  const [folderStatus, setFolderStatus] = useState(null); // "creating" | "error" | null
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const update = (patch) => onChange({ ...shot, ...patch });

  const addTask = (type) => {
    if (!type) return;
    update({ tasks: [...shot.tasks, { id: crypto.randomUUID(), type, source: "inhouse", assignee: "", status: "assigned" }] });
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
  const folderPath = buildFolderPath({
    show: project?.showCode,
    sequence: shot.sequence,
    scene: shot.scene,
    shotCode: shot.shotCode,
  });
  const readyForFolders = Boolean(folderPath && rootHandle);

  const createFolders = async () => {
    if (!readyForFolders) return;
    setFolderStatus("creating");
    try {
      const ok = await ensurePermission(rootHandle);
      if (!ok) {
        setFolderStatus("error");
        return;
      }
      await createShotFolders(rootHandle, {
        show: project.showCode,
        sequence: shot.sequence,
        scene: padScene(shot.scene),
        shotCode: shot.shotCode,
        pipeline: shot.pipeline,
        meta: buildShotMeta(project, shot),
      });
      update({ foldersCreatedAt: new Date().toISOString() });
      setFolderStatus(null);
    } catch (err) {
      console.error("Folder creation failed:", err);
      setFolderStatus("error");
    }
  };

  const handleEditToggle = async () => {
    if (isEditing && readyForFolders && !shot.foldersCreatedAt) {
      await createFolders();
    }
    onToggleEdit();
  };

  if (confirmingDelete) {
    const matches = deleteConfirmText.trim().toUpperCase() === "DELETE";
    return (
      <div
        className="card post-shot-card post-shot-card-confirm"
        onKeyDown={(e) => {
          if (e.key === "Enter" && matches) onDelete();
        }}
      >
        <span className="post-shot-confirm-label">
          Type DELETE to permanently remove {shot.shotCode} and all of its assignments
        </span>
        <input
          className="report-edit-input mono post-task-confirm-input"
          value={deleteConfirmText}
          onChange={(e) => setDeleteConfirmText(e.target.value)}
          placeholder="DELETE"
          autoFocus
        />
        <div className="post-shot-confirm-actions">
          <span className={`btn btn-danger${matches ? "" : " btn-disabled"}`} onClick={matches ? onDelete : undefined}>
            Confirm delete
          </span>
          <span
            className="btn btn-secondary"
            onClick={() => {
              setConfirmingDelete(false);
              setDeleteConfirmText("");
            }}
          >
            Cancel
          </span>
        </div>
      </div>
    );
  }

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
          <span className="report-edit-btn" onClick={handleEditToggle} title={isEditing ? "Done" : "Edit"}>
            {isEditing ? <CheckIcon /> : <PencilIcon />}
          </span>
          <span
            className="report-edit-btn post-shot-delete-btn"
            onClick={() => setConfirmingDelete(true)}
            title="Delete shot"
          >
            <TrashIcon />
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
          <div className="post-shot-meta-field">
            <span className="label">Sequence</span>
            <input
              className="report-edit-input mono post-due-input"
              placeholder="Sequence"
              value={shot.sequence ?? ""}
              onChange={(e) => update({ sequence: e.target.value })}
            />
          </div>
          <div className="post-shot-meta-field">
            <span className="label">Scene</span>
            <input
              className="report-edit-input mono post-due-input"
              placeholder="Scene"
              value={shot.scene ?? ""}
              onChange={(e) => update({ scene: e.target.value })}
            />
          </div>
          <div className="post-shot-meta-field">
            <span className="label">Pipeline</span>
            <select
              className="report-edit-input mono post-due-input"
              value={shot.pipeline ?? "traditional"}
              onChange={(e) => update({ pipeline: e.target.value })}
            >
              {PIPELINES.map((p) => (
                <option value={p.value} key={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        <div className="post-shot-meta">
          <span className="pill mono">C: {shot.complexity}/5</span>
          <span className="pill mono">Story: {shot.storyImportance}/5</span>
          {shot.dueDate && <span className="pill mono">Due {shot.dueDate}</span>}
        </div>
      )}

      {folderPath && (
        <div className="post-shot-folder-row">
          <span className="post-shot-folder-path mono">{folderPath}</span>
          {shot.foldersCreatedAt ? (
            <span className="pill pill-success">Folders created</span>
          ) : folderStatus === "creating" ? (
            <span className="pill pill-warning">Creating…</span>
          ) : rootHandle ? (
            <span className="btn btn-secondary post-create-folders-btn" onClick={createFolders}>
              Create folders
            </span>
          ) : (
            <span className="label post-shot-folder-hint">Set a project folder to create these on disk</span>
          )}
          {folderStatus === "error" && <span className="project-create-error">Couldn't write to the project folder.</span>}
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
            artists={artists}
          />
        ))}
      </div>

      {isEditing && (isAdmin ? (
        availableTaskTypes.length > 0 && (
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
        )
      ) : (
        <span className="label post-add-task-hint">Only Admins can add assignments</span>
      ))}

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
  const project = useActiveProject();
  const [shots, setShots] = useLocalStorageState(scopedKey("vfx-supe-post-reports", project?.id), []);
  const [artists] = useLocalStorageState("vfx-supe-artists", []);
  const [editingIds, setEditingIds] = useState([]);
  const [rootHandle, setRootHandle] = useState(null);
  const [folderError, setFolderError] = useState("");
  const [tab, setTab] = useState(TABS[0]);
  const supported = isFsAccessSupported();
  const isAdmin = CURRENT_ROLE === "Admin";

  useEffect(() => {
    if (!project) return;
    loadRootHandle(project.id)
      .then(setRootHandle)
      .catch(() => {});
  }, [project]);

  const pickFolder = async () => {
    try {
      const handle = await pickProjectRootFolder(project.id, project.showCode);
      setRootHandle(handle);
      setFolderError("");
    } catch (err) {
      if (err?.name !== "AbortError") setFolderError("Couldn't get folder access — try again.");
    }
  };

  const toggleEditing = (id) => {
    setEditingIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const updateShot = (updated) => {
    setShots((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  const removeShot = (id) => {
    setShots((prev) => prev.filter((s) => s.id !== id));
    setEditingIds((prev) => prev.filter((x) => x !== id));
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
        <div className="post-reports-header-top">
          <span className="post-reports-title">POST REPORTS</span>
          <div className="post-reports-header-actions">
            {tab === "Shots" && supported && !rootHandle && (
              <span className="btn btn-secondary" onClick={pickFolder}>
                Choose Destination Folder…
              </span>
            )}
            {tab === "Shots" && <span className="pill">{shots.length} shots</span>}
            {tab === "Shots" && (
              <span className="btn btn-secondary report-add-btn" onClick={addRow}>
                + Add Shot
              </span>
            )}
          </div>
        </div>
        <div className="post-reports-tabs">
          {TABS.map((t) => (
            <span
              key={t}
              className={`post-reports-tab${tab === t ? " active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      {tab === "Artists" ? (
        <ArtistDirectory isAdmin={isAdmin} />
      ) : (
        <>
          {folderError && <span className="project-create-error">{folderError}</span>}
          {!supported && !rootHandle && (
            <div className="card post-reports-no-fs-hint">
              Automatic folder creation needs Chrome or Edge — you can still track shots and copy folder paths
              manually.
            </div>
          )}

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
                  onDelete={() => removeShot(shot.id)}
                  project={project}
                  rootHandle={rootHandle}
                  artists={artists}
                  isAdmin={isAdmin}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
