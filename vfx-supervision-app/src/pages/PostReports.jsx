import { useEffect, useMemo, useState } from "react";
import { CheckIcon, ComplexityDots, PencilIcon } from "../components/SceneVfxFields.jsx";
import { STORY_IMPORTANCE_LEVELS } from "../data/importance.js";
import { POST_TASK_TYPES } from "../data/postTasks.js";
import { taskStatusInfo } from "../data/taskStatus.js";
import { COMPLEXITY_LEVELS } from "../data/vfxEffects.js";
import { downloadCsv } from "../lib/csv.js";
import { buildFolderPath, buildSceneFolderPath, padScene } from "../lib/folderPath.js";
import {
  addTaskFolder,
  createSceneFolder,
  createShotFolders,
  ensurePermission,
  isFsAccessSupported,
  loadRootHandle,
  moveSceneFolderToDeleted,
  moveShotFolderToDeleted,
  pickProjectRootFolder,
} from "../lib/fsAccess.js";
import { computeImportance } from "../lib/importance.js";
import { scopedKey, useActiveProject, useProjects } from "../lib/projects.js";
import { CURRENT_ROLE } from "../lib/role.js";
import { sortByShotCode } from "../lib/sortShots.js";
import { assigneeRows, assigneesLabel, getAssignees, renameAssigneeOnTask } from "../lib/taskAssignees.js";
import { useEnterKey } from "../lib/useEnterKey.js";
import { useLocalStorageState } from "../lib/useLocalStorageState.js";
import ArtistDirectory, { artistDepartments } from "./postReports/ArtistDirectory.jsx";
import "./PostReports.css";

const TABS = ["Shots", "Artists"];

// Shots with no matching scene (e.g. pushed from Capture Reports before
// scenes existed) are grouped under this synthetic bucket.
const UNGROUPED = "__ungrouped__";

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

function blankScene(scene) {
  return {
    id: crypto.randomUUID(),
    scene,
    folderCreatedAt: null,
    createdAt: new Date().toISOString(),
  };
}

function blankShot(sceneId, sceneNumber) {
  return {
    id: crypto.randomUUID(),
    sceneId,
    // Denormalized copy of the parent scene's number — kept in sync at
    // creation time so Shot Board / Shot Detail (which read shot.scene
    // directly and aren't part of this pass) keep working unchanged.
    scene: sceneNumber,
    shotCode: "NEW_SHOT",
    pipeline: "traditional",
    scriptDescription: "",
    internalDescription: "",
    thumbnail: null,
    tasks: [],
    dispatched: false,
    boardStatus: "bidding",
    complexity: 1,
    storyImportance: 1,
    dueDate: "",
    foldersCreatedAt: null,
    // The shotCode that was actually on disk the last time folders were
    // created — compared against the live shotCode so the UI can tell when
    // they've drifted apart instead of silently pointing at a stale folder.
    foldersCreatedForCode: null,
    submittedAt: new Date().toISOString(),
  };
}

// Task assignees are stored as name snapshots, not live artist references —
// vendor assignments are free text with no artist behind them at all, so
// only in-house tasks are rewritten here. Matching is case-insensitive/trim
// to mirror how "my tasks" filtering elsewhere compares names.
function renameAssigneeInShots(shotList, oldName, newName) {
  return shotList.map((s) => ({
    ...s,
    tasks: s.tasks.map((t) => (t.source === "vendor" ? t : renameAssigneeOnTask(t, oldName, newName))),
  }));
}

function TaskRow({ task, readOnly, onChange, onRemove, artists }) {
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const status = taskStatusInfo(task.status);
  const deleteMatches = confirmText.trim().toUpperCase() === "DELETE";
  useEnterKey(() => {
    if (confirming && deleteMatches) onRemove();
  });

  const setAssigneeAt = (index, value) => {
    const rows = [...assigneeRows(task)];
    rows[index] = value;
    onChange({ assignees: rows, assignee: undefined });
  };

  const addAssigneeRow = () => {
    onChange({ assignees: [...assigneeRows(task), ""], assignee: undefined });
  };

  const removeAssigneeAt = (index) => {
    const rows = assigneeRows(task).filter((_, i) => i !== index);
    onChange({ assignees: rows.length ? rows : [""], assignee: undefined });
  };

  if (readOnly) {
    return (
      <div className="post-task-row">
        <span className="post-task-type">{task.type}</span>
        <span className={`pill${task.source === "inhouse" ? " pill-accent" : ""}`}>
          {task.source === "vendor" ? "Outsourced" : "In-house"}
        </span>
        <span className={`pill${status.tone ? ` pill-${status.tone}` : ""}`}>{status.label}</span>
        <span className="post-task-assignee mono">{assigneesLabel(task)}</span>
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
      <div className="post-task-assignee-list">
        {assigneeRows(task).map((value, i) => (
          <div className="post-task-assignee-row" key={i}>
            {task.source === "vendor" ? (
              <input
                className="report-edit-input mono post-task-assignee-input"
                placeholder="Vendor name"
                value={value}
                onChange={(e) => setAssigneeAt(i, e.target.value)}
              />
            ) : (
              <select
                className="report-edit-input mono post-task-assignee-input"
                value={value}
                onChange={(e) => setAssigneeAt(i, e.target.value)}
              >
                <option value="">Unassigned</option>
                {artists.map((a) => (
                  <option value={a.name} key={a.id}>
                    {a.name} — {artistDepartments(a).join(" / ")}
                  </option>
                ))}
              </select>
            )}
            {assigneeRows(task).length > 1 && (
              <span
                className="post-task-remove-assignee"
                onClick={() => removeAssigneeAt(i)}
                title={task.source === "vendor" ? "Remove vendor" : "Remove artist"}
              >
                ×
              </span>
            )}
          </div>
        ))}
        <span
          className="post-task-add-assignee"
          onClick={addAssigneeRow}
          title={task.source === "vendor" ? "Add another vendor" : "Add another artist"}
        >
          +
        </span>
      </div>
      <span className="post-task-remove" onClick={() => setConfirming(true)} title="Remove assignment">
        <TrashIcon />
      </span>
    </div>
  );
}

function buildShotMeta(project, sceneNumber, shot) {
  return {
    show: project.showCode,
    scene: padScene(sceneNumber),
    shot: shot.shotCode,
    scriptDescription: shot.scriptDescription || "",
    internalDescription: shot.internalDescription || "",
    pipeline: shot.pipeline || "traditional",
    status: shot.dispatched ? "in_progress" : "not_shot",
    notes: "",
  };
}

function ShotCard({
  shot,
  isEditing,
  onToggleEdit,
  isExpanded,
  onToggleExpand,
  onChange,
  onDelete,
  project,
  sceneNumber,
  rootHandle,
  artists,
  isAdmin,
}) {
  const [addTaskType, setAddTaskType] = useState("");
  const [folderStatus, setFolderStatus] = useState(null); // "creating" | "error" | null
  const [pushStatus, setPushStatus] = useState(null); // "error" | null
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const deleteMatches = deleteConfirmText.trim().toUpperCase() === "DELETE";
  useEnterKey(() => {
    if (confirmingDelete && deleteMatches) onDelete();
  });
  const update = (patch) => onChange({ ...shot, ...patch });

  const addTask = (type) => {
    if (!type) return;
    update({ tasks: [...shot.tasks, { id: crypto.randomUUID(), type, source: "inhouse", assignees: [""], status: "assigned" }] });
    // No on-disk folder yet — a task only gets its 02_tasks/ subfolder once
    // the shot is actually pushed (see pushAssignment below), not the
    // moment it's added.
  };

  const updateTask = (taskId, patch) => {
    update({ tasks: shot.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)) });
  };

  const removeTask = (taskId) => {
    update({ tasks: shot.tasks.filter((t) => t.id !== taskId) });
  };

  const assignedCount = shot.tasks.filter((t) => getAssignees(t).length > 0).length;
  const totalTasks = shot.tasks.length;
  const fullyAssigned = totalTasks > 0 && assignedCount === totalTasks;
  const availableTaskTypes = POST_TASK_TYPES.filter((t) => !shot.tasks.some((task) => task.type === t));
  const importance = computeImportance(shot);
  const folderPath = buildFolderPath({
    show: project?.showCode,
    scene: sceneNumber,
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
        scene: padScene(sceneNumber),
        shotCode: shot.shotCode,
        meta: buildShotMeta(project, sceneNumber, shot),
      });
      update({ foldersCreatedAt: new Date().toISOString(), foldersCreatedForCode: shot.shotCode });
      setFolderStatus(null);
    } catch (err) {
      console.error("Folder creation failed:", err);
      setFolderStatus("error");
    }
  };

  // A task only gets its own 02_tasks/ subfolder once the shot is actually
  // pushed to artists — not the moment it's assigned — so an in-progress
  // shot's growing task list doesn't scatter empty folders before there's
  // real work ready to start. Re-pushing picks up any task types added
  // since the last push (ensureTaskFolder/getDirectoryHandle are
  // idempotent, so this never duplicates or disturbs an existing one).
  const pushAssignment = async () => {
    if (!fullyAssigned) return;
    update({ dispatched: true });

    if (shot.foldersCreatedAt && rootHandle) {
      try {
        const ok = await ensurePermission(rootHandle);
        if (!ok) {
          setPushStatus("error");
          return;
        }
        for (const type of new Set(shot.tasks.map((t) => t.type))) {
          await addTaskFolder(rootHandle, { scene: padScene(sceneNumber), shotCode: shot.shotCode, taskType: type });
        }
        setPushStatus(null);
      } catch (err) {
        console.error("Couldn't create task folders on push:", err);
        setPushStatus("error");
      }
    }
  };

  // Folders are only ever created by an explicit click below — never as a
  // side effect of leaving edit mode. Auto-creating on the first "Done"
  // used to lock in whatever shotCode happened to be set at that moment
  // (often still the "NEW_SHOT" placeholder), and since foldersCreatedAt
  // then blocked any retry, a later rename never reached the folder on disk.
  const codeChangedSinceCreate = Boolean(shot.foldersCreatedAt) && shot.foldersCreatedForCode !== shot.shotCode;

  // Editing always shows the full card — collapsing mid-edit would hide the
  // very fields being edited — so the collapse toggle only matters at rest.
  const showExpanded = isEditing || isExpanded;

  if (confirmingDelete) {
    return (
      <div className="card post-shot-card post-shot-card-confirm">
        <span className="post-shot-confirm-label">
          Type DELETE to permanently remove {shot.shotCode} and all of its assignments
          {shot.foldersCreatedAt ? " — its folder will be moved into this scene's zzz_DELETED/ folder" : ""}
        </span>
        <input
          className="report-edit-input mono post-task-confirm-input"
          value={deleteConfirmText}
          onChange={(e) => setDeleteConfirmText(e.target.value)}
          placeholder="DELETE"
          autoFocus
        />
        <div className="post-shot-confirm-actions">
          <span className={`btn btn-danger${deleteMatches ? "" : " btn-disabled"}`} onClick={deleteMatches ? onDelete : undefined}>
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
        <span
          className="post-shot-expand"
          onClick={onToggleExpand}
          title={showExpanded ? "Collapse" : "Expand"}
        >
          {showExpanded ? "▼" : "▶"}
        </span>
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
            <div className="post-shot-description-fields">
              <div className="post-shot-description-field">
                <span className="label">Script / client description</span>
                <textarea
                  placeholder="What the script or the client describes for this shot…"
                  value={shot.scriptDescription}
                  onChange={(e) => update({ scriptDescription: e.target.value })}
                />
              </div>
              <div className="post-shot-description-field">
                <span className="label">Internal description</span>
                <textarea
                  placeholder="What this shot actually needs…"
                  value={shot.internalDescription}
                  onChange={(e) => update({ internalDescription: e.target.value })}
                />
              </div>
            </div>
          ) : (
            <div className="post-shot-description-display">
              <span className="post-shot-description">{shot.internalDescription || "—"}</span>
              {shot.scriptDescription && (
                <span className="post-shot-description post-shot-description-script">
                  Script: {shot.scriptDescription}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="post-shot-header-actions">
          {shot.dispatched && <span className="pill pill-success">Pushed</span>}
          <span className="report-edit-btn" onClick={onToggleEdit} title={isEditing ? "Done" : "Edit"}>
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

      {showExpanded && (
        <>
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
              {folderStatus === "creating" ? (
                <span className="pill pill-warning">Creating…</span>
              ) : codeChangedSinceCreate ? (
                <>
                  <span
                    className="pill pill-warning"
                    title={`On-disk folder is still named for "${shot.foldersCreatedForCode}"`}
                  >
                    Shot code changed since folders were created
                  </span>
                  {rootHandle && (
                    <span className="btn btn-secondary post-create-folders-btn" onClick={createFolders}>
                      Create folder for new code
                    </span>
                  )}
                </>
              ) : shot.foldersCreatedAt ? (
                <span className="pill pill-success">Folders created</span>
              ) : rootHandle ? (
                <span className="btn btn-secondary post-create-folders-btn" onClick={createFolders}>
                  Create folders
                </span>
              ) : (
                <span className="label post-shot-folder-hint">Set a project folder to create these on disk</span>
              )}
              {folderStatus === "error" && (
                <span className="project-create-error">Couldn't write to the project folder.</span>
              )}
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

          {isEditing &&
            (isAdmin ? (
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
            {pushStatus === "error" && (
              <span className="project-create-error">Couldn't create this shot's task folders on disk.</span>
            )}
            <span
              className={`btn btn-primary${fullyAssigned ? "" : " btn-disabled"}`}
              onClick={fullyAssigned ? pushAssignment : undefined}
            >
              {shot.dispatched ? "Re-push Assignment" : "Push Assignment"}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function NewSceneForm({ project, rootHandle, onCreate, onCancel }) {
  const [scene, setScene] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const canCreate = scene.trim().length > 0 && !creating;

  const create = async () => {
    if (!canCreate) return;
    const sceneNumber = padScene(scene);
    const record = blankScene(sceneNumber);
    if (rootHandle) {
      setCreating(true);
      try {
        const ok = await ensurePermission(rootHandle);
        if (!ok) throw new Error("permission denied");
        await createSceneFolder(rootHandle, { scene: sceneNumber });
        record.folderCreatedAt = new Date().toISOString();
      } catch (err) {
        console.error("Scene folder creation failed:", err);
        setCreating(false);
        setError("Couldn't create the scene folder — try again.");
        return;
      }
      setCreating(false);
    }
    onCreate(record);
  };
  useEnterKey(create);

  return (
    <div className="card post-scene-form">
      <span className="label">New scene</span>
      <input
        className="report-edit-input mono post-scene-form-input"
        placeholder="Scene number, e.g. 009"
        value={scene}
        onChange={(e) => setScene(e.target.value)}
        autoFocus
      />
      {error && <span className="project-create-error">{error}</span>}
      {!rootHandle && (
        <span className="label post-shot-folder-hint">
          Set a project folder to create this scene's folder on disk now — you can still add the scene and create
          the folder later.
        </span>
      )}
      <div className="post-scene-form-actions">
        <span className={`btn btn-primary${canCreate ? "" : " btn-disabled"}`} onClick={canCreate ? create : undefined}>
          {creating ? "Creating…" : "Create Scene"}
        </span>
        <span className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </span>
      </div>
    </div>
  );
}

function SceneGroup({
  scene,
  shots,
  isExpanded,
  onToggleExpand,
  onUpdateScene,
  onDeleteScene,
  onAddShot,
  editingIds,
  toggleEditing,
  expandedShotIds,
  toggleShotExpanded,
  updateShot,
  removeShot,
  project,
  rootHandle,
  artists,
  isAdmin,
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [folderStatus, setFolderStatus] = useState(null);
  const deleteMatches = deleteConfirmText.trim().toUpperCase() === "DELETE";
  const folderPath = buildSceneFolderPath({ show: project?.showCode, scene: scene.scene });
  const readyForFolder = Boolean(folderPath && rootHandle);

  useEnterKey(() => {
    if (confirmingDelete && deleteMatches) onDeleteScene();
  });

  const createFolder = async () => {
    if (!readyForFolder) return;
    setFolderStatus("creating");
    try {
      const ok = await ensurePermission(rootHandle);
      if (!ok) {
        setFolderStatus("error");
        return;
      }
      await createSceneFolder(rootHandle, { scene: scene.scene });
      onUpdateScene({ folderCreatedAt: new Date().toISOString() });
      setFolderStatus(null);
    } catch (err) {
      console.error("Scene folder creation failed:", err);
      setFolderStatus("error");
    }
  };

  return (
    <div className="card post-scene-group">
      <div className="post-scene-header" onClick={onToggleExpand}>
        <span className="post-scene-expand">{isExpanded ? "▼" : "▶"}</span>
        <span className="post-scene-label mono">SC{scene.scene}</span>
        <span className="pill mono">
          {shots.length} shot{shots.length === 1 ? "" : "s"}
        </span>
        {scene.folderCreatedAt && <span className="pill pill-success">Folder created</span>}
        {!confirmingDelete && (
          <span
            className="report-edit-btn post-shot-delete-btn post-scene-delete-btn"
            onClick={(e) => {
              e.stopPropagation();
              setConfirmingDelete(true);
            }}
            title="Delete scene"
          >
            <TrashIcon />
          </span>
        )}
      </div>

      {confirmingDelete && (
        <div className="post-scene-confirm" onClick={(e) => e.stopPropagation()}>
          <span className="post-shot-confirm-label">
            Type DELETE to permanently remove SC{scene.scene}
            {shots.length > 0
              ? ` and its ${shots.length} shot${shots.length === 1 ? "" : "s"} — its folder will be moved into this project's zzz_DELETED_SCENES/ folder`
              : " — nothing on disk is deleted, it has no shots"}
            .
          </span>
          <input
            className="report-edit-input mono post-task-confirm-input"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder="DELETE"
            autoFocus
          />
          <div className="post-shot-confirm-actions">
            <span className={`btn btn-danger${deleteMatches ? "" : " btn-disabled"}`} onClick={deleteMatches ? onDeleteScene : undefined}>
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
      )}

      {isExpanded && !confirmingDelete && (
        <div className="post-scene-body">
          {folderPath && (
            <div className="post-shot-folder-row">
              <span className="post-shot-folder-path mono">{folderPath}</span>
              {scene.folderCreatedAt ? (
                <span className="pill pill-success">Folder created</span>
              ) : folderStatus === "creating" ? (
                <span className="pill pill-warning">Creating…</span>
              ) : rootHandle ? (
                <span className="btn btn-secondary post-create-folders-btn" onClick={createFolder}>
                  Create folder
                </span>
              ) : (
                <span className="label post-shot-folder-hint">Set a project folder to create this on disk</span>
              )}
              {folderStatus === "error" && <span className="project-create-error">Couldn't write to the project folder.</span>}
            </div>
          )}

          <span className="btn btn-secondary post-scene-add-shot-btn" onClick={onAddShot}>
            + Add Shot
          </span>

          {shots.length === 0 ? (
            <span className="post-tasks-empty">No shots in this scene yet.</span>
          ) : (
            <div className="post-shot-list">
              {shots.map((shot) => (
                <ShotCard
                  key={shot.id}
                  shot={shot}
                  isEditing={editingIds.includes(shot.id)}
                  onToggleEdit={() => toggleEditing(shot.id)}
                  isExpanded={expandedShotIds.includes(shot.id)}
                  onToggleExpand={() => toggleShotExpanded(shot.id)}
                  onChange={updateShot}
                  onDelete={() => removeShot(shot.id)}
                  project={project}
                  sceneNumber={scene.scene}
                  rootHandle={rootHandle}
                  artists={artists}
                  isAdmin={isAdmin}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PostReports() {
  const project = useActiveProject();
  const [projects] = useProjects();
  const [shots, setShots] = useLocalStorageState(scopedKey("vfx-supe-post-reports", project?.id), []);
  const [scenes, setScenes] = useLocalStorageState(scopedKey("vfx-supe-scenes", project?.id), []);
  const [artists] = useLocalStorageState("vfx-supe-artists", []);
  const [editingIds, setEditingIds] = useState([]);
  const [expandedSceneIds, setExpandedSceneIds] = useState([]);
  const [expandedShotIds, setExpandedShotIds] = useState([]);
  const [addingScene, setAddingScene] = useState(false);
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

  const toggleSceneExpanded = (id) => {
    setExpandedSceneIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleShotExpanded = (id) => {
    setExpandedShotIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  // Artists are a single roster shared across every project, but each
  // project keeps its own shots — so a rename has to reach every project's
  // task assignments, not just the one currently open. The active project
  // goes through React state (it's already loaded here); every other
  // project is patched straight in localStorage since nothing has it loaded
  // right now to race with.
  const renameArtistEverywhere = (oldName, newName) => {
    if (!oldName.trim() || oldName.trim() === newName.trim()) return;

    setShots((prev) => renameAssigneeInShots(prev, oldName, newName));

    for (const p of projects) {
      if (p.id === project?.id) continue;
      const key = scopedKey("vfx-supe-post-reports", p.id);
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) continue;
        localStorage.setItem(key, JSON.stringify(renameAssigneeInShots(parsed, oldName, newName)));
      } catch (err) {
        console.error(`Couldn't cascade artist rename into project ${p.id}:`, err);
      }
    }
  };

  const updateShot = (updated) => {
    setShots((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  const removeShot = async (id) => {
    const shot = shots.find((s) => s.id === id);
    setShots((prev) => prev.filter((s) => s.id !== id));
    setEditingIds((prev) => prev.filter((x) => x !== id));
    setExpandedShotIds((prev) => prev.filter((x) => x !== id));

    // Best-effort: if this shot's folder was ever created on disk, move it
    // into that scene's zzz_DELETED/ folder rather than leaving it — or losing
    // track of it — under its old name. Never blocks removing the tracker
    // entry itself if the on-disk move fails (permission revoked, handle
    // stale, etc.) — but surfaces as a visible banner rather than only a
    // console log, so a real failure isn't mistaken for success. This
    // includes the project folder not being connected this session — that
    // used to fail silently (no banner), which looked identical to success.
    if (shot?.foldersCreatedAt) {
      if (!rootHandle) {
        setFolderError(
          `${shot.shotCode} was removed from tracking, but its folder is still on disk — reconnect the project folder to move it into zzz_DELETED/.`
        );
        return;
      }
      try {
        const ok = await ensurePermission(rootHandle);
        if (!ok) {
          setFolderError(`Couldn't get permission to remove ${shot.shotCode}'s folder — it may still be on disk.`);
          return;
        }
        const result = await moveShotFolderToDeleted(rootHandle, {
          scene: padScene(shot.scene),
          shotCode: shot.foldersCreatedForCode,
        });
        if (result.moved) setFolderError("");
      } catch (err) {
        console.error("Couldn't move deleted shot's folder into zzz_DELETED/:", err);
        setFolderError(
          `${shot.shotCode} was removed from tracking, but its folder couldn't be fully removed from disk — check it manually.`
        );
      }
    }
  };

  const addShotToScene = (scene) => {
    const row = blankShot(scene.id, scene.scene);
    setShots((prev) => [...prev, row]);
    setEditingIds((prev) => [...prev, row.id]);
    setExpandedShotIds((prev) => [...prev, row.id]);
    setExpandedSceneIds((prev) => (prev.includes(scene.id) ? prev : [...prev, scene.id]));
  };

  const addScene = (record) => {
    setScenes((prev) => [...prev, record]);
    setExpandedSceneIds((prev) => [...prev, record.id]);
    setAddingScene(false);
  };

  const updateScene = (id, patch) => {
    setScenes((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const removeScene = async (scene) => {
    // A scene's folder can exist on disk even when scene.folderCreatedAt was
    // never set — creating a shot's folders creates its parent scene folder
    // as a side effect (see createShotFolders), independent of whether the
    // scene's own "Create folder" button was ever clicked. Check both so a
    // real on-disk folder isn't missed just because that button wasn't used.
    const hasOnDiskFolder = Boolean(
      scene.folderCreatedAt || shots.some((s) => s.sceneId === scene.id && s.foldersCreatedAt)
    );
    setScenes((prev) => prev.filter((s) => s.id !== scene.id));
    setExpandedSceneIds((prev) => prev.filter((x) => x !== scene.id));
    setShots((prev) => prev.filter((s) => s.sceneId !== scene.id));

    // Best-effort, same pattern as shot deletion: move the whole scene
    // folder (every shot inside it, untouched) into zzz_DELETED_SCENES/
    // rather than leaving it behind under a now-untracked scene number.
    // Never blocks removing the tracker entries if the on-disk move fails
    // — but unlike a purely-logged failure, this surfaces as a visible
    // banner so a real failure (vs. e.g. a stale Explorer view) is obvious.
    // This includes the project folder not being connected this session —
    // that used to fail silently (no banner), which looked identical to
    // success (the scene just disappeared from the tracker either way).
    if (hasOnDiskFolder) {
      if (!rootHandle) {
        setFolderError(
          `SC${scene.scene} was removed from tracking, but its folder is still on disk — reconnect the project folder to move it into zzz_DELETED_SCENES/.`
        );
        return;
      }
      try {
        const ok = await ensurePermission(rootHandle);
        if (!ok) {
          setFolderError(`Couldn't get permission to remove SC${scene.scene}'s folder — it may still be on disk.`);
          return;
        }
        const result = await moveSceneFolderToDeleted(rootHandle, { scene: padScene(scene.scene) });
        if (result.moved) setFolderError("");
      } catch (err) {
        console.error("Couldn't move deleted scene's folder into zzz_DELETED_SCENES/:", err);
        setFolderError(
          `SC${scene.scene} was removed from tracking, but its folder couldn't be fully removed from disk — check it manually.`
        );
      }
    }
  };

  const scenesById = useMemo(() => Object.fromEntries(scenes.map((sc) => [sc.id, sc])), [scenes]);

  const shotsByScene = useMemo(() => {
    const map = new Map();
    for (const shot of shots) {
      const key = shot.sceneId && scenesById[shot.sceneId] ? shot.sceneId : UNGROUPED;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(shot);
    }
    for (const [key, list] of map) map.set(key, sortByShotCode(list));
    return map;
  }, [shots, scenesById]);

  const orderedScenes = useMemo(
    () => [...scenes].sort((a, b) => padScene(a.scene).localeCompare(padScene(b.scene), undefined, { numeric: true })),
    [scenes]
  );

  const ungroupedShots = shotsByScene.get(UNGROUPED) ?? [];

  // True once this project has any folder actually on disk (a scene or a
  // shot). If the project's root handle isn't connected in that case, every
  // folder-writing action (create, delete-and-move) silently no-ops instead
  // of reaching disk — so this needs to be obvious the moment the page
  // loads, not discovered later when a delete "doesn't seem to have worked."
  const expectsFolder = scenes.some((s) => s.folderCreatedAt) || shots.some((s) => s.foldersCreatedAt);
  const folderDisconnected = supported && expectsFolder && !rootHandle;

  // One row per shot, in the same scene/shot order shown on screen. A CSV
  // (not an .xlsx) so it opens with no library or backend involved — Google
  // Sheets opens/imports it natively, same as Excel or Numbers.
  const exportShotListCsv = () => {
    const header = [
      "Scene",
      "Shot Code",
      "Priority",
      "Story Importance",
      "Complexity",
      "Pipeline",
      "Pushed to Post",
      "Due Date",
      "Script Description",
      "Internal Description",
      "Folder Created",
      "Tasks",
    ];

    const shotToRow = (shot) => {
      const priority = computeImportance({
        complexity: shot.complexity,
        storyImportance: shot.storyImportance,
        dueDate: shot.dueDate,
      }).tier;
      const tasksSummary = shot.tasks
        .map((t) => `${t.type}: ${taskStatusInfo(t.status).label} (${assigneesLabel(t)})`)
        .join("; ");
      return [
        `SC${shot.scene}`,
        shot.shotCode,
        priority,
        STORY_IMPORTANCE_LEVELS[shot.storyImportance - 1] ?? "",
        COMPLEXITY_LEVELS[shot.complexity - 1] ?? "",
        shot.pipeline,
        shot.dispatched ? "Yes" : "No",
        shot.dueDate,
        shot.scriptDescription,
        shot.internalDescription,
        shot.foldersCreatedAt ? "Yes" : "No",
        tasksSummary,
      ];
    };

    const rows = [header];
    for (const scene of orderedScenes) {
      for (const shot of shotsByScene.get(scene.id) ?? []) rows.push(shotToRow(shot));
    }
    for (const shot of ungroupedShots) rows.push(shotToRow(shot));

    // Plain CSV can't carry cell colors itself — the color coding lives in
    // conditional-formatting rules set up once directly in Sheets (on the
    // Story Importance/Complexity/Due Date columns), which keep applying
    // across future re-imports. This legend just documents those thresholds
    // so anyone opening the sheet knows what the colors mean without having
    // to go find the rules. Written into column N+ (leaving M as a blank
    // gutter) alongside the header/first few rows, so it never lands inside
    // the A–L data range those conditional-format rules watch.
    const legendLines = [
      "Legend — conditional formatting thresholds (set up once in Sheets):",
      "Red = Story Importance/Complexity is High/Hero or Pivotal/Critical, or Due Date is ≤3 days away",
      "Orange = Medium, or Due Date is 4–7 days away",
      "No fill = Low/Minimal/Minor/Supporting, or no near-term due date",
    ];
    // A fixed number, not re-read from header.length inside the loop below —
    // rows[0] IS the header array (same reference, not a copy), so comparing
    // against header.length while padding/pushing onto rows[0] would grow
    // both sides together and loop forever.
    const legendColumn = header.length + 1;
    legendLines.forEach((text, i) => {
      if (!rows[i]) rows[i] = [];
      while (rows[i].length < legendColumn) rows[i].push("");
      rows[i].push(text);
    });

    const showCode = project?.showCode || "vfx-supe";
    downloadCsv(`${showCode}_shot-list_${new Date().toISOString().slice(0, 10)}.csv`, rows);
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
            {tab === "Shots" && (
              <span className="pill">
                {scenes.length} scene{scenes.length === 1 ? "" : "s"} · {shots.length} shot{shots.length === 1 ? "" : "s"}
              </span>
            )}
            {tab === "Shots" && (scenes.length > 0 || shots.length > 0) && (
              <span className="btn btn-secondary post-export-csv-btn" onClick={exportShotListCsv} title="Downloads a .csv — open it directly in Google Sheets">
                Export to Spreadsheet…
              </span>
            )}
            {tab === "Shots" && !addingScene && (
              <span className="btn btn-secondary report-add-btn" onClick={() => setAddingScene(true)}>
                + Add Scene
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

      {folderDisconnected && (
        <div className="card post-reports-folder-disconnected">
          <span>
            Project folder isn't connected this session — folders already on disk won't be created, updated, or
            moved into zzz_DELETED until you reconnect it.
          </span>
          <span className="btn btn-secondary" onClick={pickFolder}>
            Reconnect Folder…
          </span>
        </div>
      )}

      {tab === "Artists" ? (
        <ArtistDirectory isAdmin={isAdmin} onRenameArtist={renameArtistEverywhere} />
      ) : (
        <>
          {folderError && <span className="project-create-error">{folderError}</span>}
          {!supported && !rootHandle && (
            <div className="card post-reports-no-fs-hint">
              Automatic folder creation needs Chrome or Edge — you can still track scenes/shots and copy folder
              paths manually.
            </div>
          )}

          {addingScene && (
            <NewSceneForm
              project={project}
              rootHandle={rootHandle}
              onCreate={addScene}
              onCancel={() => setAddingScene(false)}
            />
          )}

          {scenes.length === 0 && ungroupedShots.length === 0 && !addingScene ? (
            <div className="card post-reports-empty">
              No scenes yet — click + Add Scene to start tracking shots for this project.
            </div>
          ) : (
            <div className="post-shot-list">
              {orderedScenes.map((scene) => (
                <SceneGroup
                  key={scene.id}
                  scene={scene}
                  shots={shotsByScene.get(scene.id) ?? []}
                  isExpanded={expandedSceneIds.includes(scene.id)}
                  onToggleExpand={() => toggleSceneExpanded(scene.id)}
                  onUpdateScene={(patch) => updateScene(scene.id, patch)}
                  onDeleteScene={() => removeScene(scene)}
                  onAddShot={() => addShotToScene(scene)}
                  editingIds={editingIds}
                  toggleEditing={toggleEditing}
                  expandedShotIds={expandedShotIds}
                  toggleShotExpanded={toggleShotExpanded}
                  updateShot={updateShot}
                  removeShot={removeShot}
                  project={project}
                  rootHandle={rootHandle}
                  artists={artists}
                  isAdmin={isAdmin}
                />
              ))}

              {ungroupedShots.length > 0 && (
                <div className="card post-scene-group">
                  <div className="post-scene-header post-scene-header-static">
                    <span className="post-scene-label mono">Ungrouped</span>
                    <span className="pill mono">
                      {ungroupedShots.length} shot{ungroupedShots.length === 1 ? "" : "s"}
                    </span>
                    <span className="label post-shot-folder-hint">From Capture Reports, before scenes existed</span>
                  </div>
                  <div className="post-scene-body">
                    <div className="post-shot-list">
                      {ungroupedShots.map((shot) => (
                        <ShotCard
                          key={shot.id}
                          shot={shot}
                          isEditing={editingIds.includes(shot.id)}
                          onToggleEdit={() => toggleEditing(shot.id)}
                          isExpanded={expandedShotIds.includes(shot.id)}
                          onToggleExpand={() => toggleShotExpanded(shot.id)}
                          onChange={updateShot}
                          onDelete={() => removeShot(shot.id)}
                          project={project}
                          sceneNumber={shot.scene}
                          rootHandle={rootHandle}
                          artists={artists}
                          isAdmin={isAdmin}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
