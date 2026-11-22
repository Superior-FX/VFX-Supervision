import { useEffect, useState } from "react";
import { POST_TASK_TYPES } from "../data/postTasks.js";
import { applyTaskPatch, withStatus } from "../data/taskStatus.js";
import { padScene } from "../lib/folderPath.js";
import { addTaskFolder, ensurePermission } from "../lib/fsAccess.js";
import { getAssignees } from "../lib/taskAssignees.js";
import TaskRow from "./TaskRow.jsx";
import "./ShotTasksDialog.css";

// Add / remove / assign a shot's tasks without leaving the Dashboard. Edits
// stay in a draft until Save or Push Assignment, which write them back and
// close the dialog; Cancel (or Esc) drops them. Push works like Post
// Reports': marks the shot dispatched and creates any missing task folders.
// Needs a DeleteRequestsProvider above it (TaskRow files delete requests).
export default function ShotTasksDialog({ shot, artists, rootHandle, onSave, onClose }) {
  const [tasks, setTasks] = useState(shot.tasks);
  const [addType, setAddType] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const available = POST_TASK_TYPES.filter((type) => !tasks.some((t) => t.type === type));
  const assignedCount = tasks.filter((t) => getAssignees(t).length > 0).length;
  const fullyAssigned = tasks.length > 0 && assignedCount === tasks.length;

  const addTask = (type) => {
    if (!type) return;
    setTasks((prev) => [
      ...prev,
      withStatus({ id: crypto.randomUUID(), type, source: "inhouse", assignees: [""] }, "assigned"),
    ]);
  };

  const save = () => {
    onSave({ tasks });
    onClose();
  };

  const push = async () => {
    if (!fullyAssigned || busy) return;
    onSave({ tasks, dispatched: true });
    if (shot.foldersCreatedAt && rootHandle) {
      setBusy(true);
      setError("");
      try {
        if (!(await ensurePermission(rootHandle))) throw new Error("Project folder access was denied.");
        for (const type of new Set(tasks.map((t) => t.type))) {
          await addTaskFolder(rootHandle, { scene: padScene(shot.scene), shotCode: shot.shotCode, taskType: type });
        }
      } catch (err) {
        console.error("Couldn't create task folders on push:", err);
        setError(`Assignment saved, but the task folders couldn't be created: ${err?.message || err}`);
        setBusy(false);
        return;
      }
      setBusy(false);
    }
    onClose();
  };

  return (
    <div className="stasks-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="stasks-dialog card" role="dialog" aria-label={`Tasks for ${shot.shotCode}`}>
        <div className="stasks-head">
          {shot.thumbnail && <img className="stasks-thumb" src={shot.thumbnail} alt="" />}
          <div className="stasks-title">
            <span className="label">Add / remove tasks</span>
            <span className="mono stasks-code">{shot.shotCode}</span>
          </div>
          {shot.dispatched && <span className="pill pill-success">Pushed</span>}
        </div>

        <div className="post-shot-tasks stasks-list">
          {tasks.length === 0 && <span className="post-tasks-empty">No tasks added yet.</span>}
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              shot={shot}
              readOnly={false}
              onChange={(patch) => setTasks((prev) => prev.map((t) => (t.id === task.id ? applyTaskPatch(t, patch) : t)))}
              onRemove={() => setTasks((prev) => prev.filter((t) => t.id !== task.id))}
              artists={artists}
            />
          ))}
        </div>

        {available.length > 0 && (
          <select
            className="effect-add-select post-add-task-select"
            value={addType}
            onChange={(e) => {
              addTask(e.target.value);
              setAddType("");
            }}
          >
            <option value="">+ add task</option>
            {available.map((type) => (
              <option value={type} key={type}>
                {type}
              </option>
            ))}
          </select>
        )}

        {error && <span className="project-create-error">{error}</span>}

        <div className="stasks-foot">
          <span className="mono stasks-progress">
            {assignedCount}/{tasks.length} task{tasks.length === 1 ? "" : "s"} assigned
          </span>
          <span className={`btn btn-secondary${busy ? " btn-disabled" : ""}`} onClick={busy ? undefined : onClose}>
            {error ? "Close" : "Cancel"}
          </span>
          <span className={`btn btn-secondary${busy ? " btn-disabled" : ""}`} onClick={busy ? undefined : save}>
            Save
          </span>
          <span
            className={`btn btn-primary${fullyAssigned && !busy ? "" : " btn-disabled"}`}
            onClick={fullyAssigned && !busy ? push : undefined}
            title={fullyAssigned ? undefined : "Every task needs an assignee before pushing"}
          >
            {busy ? "Pushing…" : shot.dispatched ? "Re-push Assignment" : "Push Assignment"}
          </span>
        </div>
      </div>
    </div>
  );
}
