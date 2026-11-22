import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { isInReview, taskStatusInfo } from "../data/taskStatus.js";
import { useDeleteRequestsContext } from "../lib/deleteRequests.jsx";
import { useRole } from "../lib/role.js";
import { assigneeRows, assigneesLabel } from "../lib/taskAssignees.js";
import { useEnterKey } from "../lib/useEnterKey.js";
import { artistDepartments } from "../pages/postReports/ArtistDirectory.jsx";

// One task (assignment) row, shared by Post Reports' shot cards and the
// Dashboard's add/remove tasks dialog. Needs a DeleteRequestsProvider above it.

export function TrashIcon() {
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

export default function TaskRow({ task, shot, readOnly, onChange, onRemove, artists }) {
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const status = taskStatusInfo(task.status);
  const { can, canFinal, finalStatus } = useRole();
  const deleteMatches = confirmText.trim().toUpperCase() === "DELETE";
  const deleteRequests = useDeleteRequestsContext();
  const deletePending = deleteRequests.pendingFor("task", task.id);
  const confirmRemove = deleteRequests.isAdmin
    ? onRemove
    : async () => {
        const ok = await deleteRequests.request({
          kind: "task",
          targetId: task.id,
          parentId: shot.id,
          label: `${shot.shotCode} — ${task.type}`,
        });
        if (ok) {
          setConfirming(false);
          setConfirmText("");
        }
      };
  useEnterKey(() => {
    if (confirming && deleteMatches) confirmRemove();
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
        {deletePending && <span className="pill pill-danger">Delete requested</span>}
        <span className="post-task-assignee mono">{assigneesLabel(task)}</span>
        {isInReview(task.status) && (
          <div className="post-task-review-actions">
            <span className="post-task-review-link" onClick={() => navigate(`/review?task=${task.id}`)}>
              Review →
            </span>
            {can("review_decide") && (
              <span className="btn btn-danger post-task-review-btn" onClick={() => onChange({ status: "needs_revision" })}>
                Revise
              </span>
            )}
            {canFinal(task.status) && (
              <span className="btn btn-primary post-task-review-btn" onClick={() => onChange({ status: finalStatus })}>
                {finalStatus === "comp_approved" ? "Comp Approve" : "Final"}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  if (confirming) {
    const matches = deleteMatches;
    return (
      <div className="post-task-row post-task-row-confirm">
        <span className="post-task-confirm-label">
          {deleteRequests.isAdmin
            ? "Type DELETE to remove this assignment"
            : "Type DELETE to ask an Admin to remove this assignment"}
        </span>
        <input
          className="report-edit-input mono post-task-confirm-input"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="DELETE"
          autoFocus
        />
        <span className={`btn btn-danger${matches ? "" : " btn-disabled"}`} onClick={matches ? confirmRemove : undefined}>
          {deleteRequests.isAdmin ? "Confirm delete" : "Request delete"}
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
                {/* Only artists approved for this task type (set in the Artists tab) can be picked. */}
                {artists
                  .filter((a) => artistDepartments(a).includes(task.type))
                  .map((a) => (
                    <option value={a.name} key={a.id}>
                      {a.name}
                    </option>
                  ))}
                {/* Keep an existing assignee visible even if they've since lost approval, so it isn't silently shown as Unassigned. */}
                {value && !artists.some((a) => a.name === value && artistDepartments(a).includes(task.type)) && (
                  <option value={value}>{value} (not approved for {task.type})</option>
                )}
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
      {deletePending ? (
        <span className="pill pill-danger">Delete requested</span>
      ) : (
        <span className="post-task-remove" onClick={() => setConfirming(true)} title="Remove assignment">
          <TrashIcon />
        </span>
      )}
    </div>
  );
}
