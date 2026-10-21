import { useState } from "react";
import { useRole } from "../lib/role.js";
import "./DeleteRequestsBanner.css";

const KIND_LABELS = { project: "Project", scene: "Scene", shot: "Shot", task: "Assignment" };

// Pending delete requests. Admins approve (onApprove does the actual
// delete, then records it) or decline; the person who asked can cancel.
// kinds limits which requests show — Post Reports handles scene/shot/task,
// Home handles whole projects.
export default function DeleteRequestsBanner({ deleteRequests, onApprove, kinds = ["scene", "shot", "task"], compact }) {
  const { profile } = useRole();
  const { isAdmin, requests, error, decide, cancel } = deleteRequests;
  const shown = requests.filter((r) => kinds.includes(r.kind));
  if (shown.length === 0 && !error) return null;

  return (
    <div className={`card delete-requests${compact ? " delete-requests-compact" : ""}`}>
      <span className="label delete-requests-title">
        {isAdmin ? "Delete requests — waiting for you" : "Delete requests — waiting for an Admin"} · {shown.length}
      </span>
      {error && <span className="delete-requests-error">{error}</span>}
      {shown.map((req) => (
        <RequestRow
          key={req.id}
          req={req}
          isAdmin={isAdmin}
          isMine={req.requested_by === profile?.id}
          onApprove={() => onApprove(req)}
          onDecline={() => decide(req.id, "declined")}
          onCancel={() => cancel(req.id)}
        />
      ))}
    </div>
  );
}

function RequestRow({ req, isAdmin, isMine, onApprove, onDecline, onCancel }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const approve = async () => {
    setBusy(true);
    await onApprove();
    setBusy(false);
    setConfirming(false);
  };

  return (
    <div className="delete-request-row">
      <span className="pill">{KIND_LABELS[req.kind] ?? req.kind}</span>
      <span className="delete-request-label mono">{req.label}</span>
      <span className="delete-request-meta">
        asked by {req.requested_by_name || "someone"} ·{" "}
        {new Date(req.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
      </span>
      <span className="delete-request-actions">
        {isAdmin &&
          (confirming ? (
            <>
              <span className="delete-request-warn">Delete it for good?</span>
              <span className={`btn btn-danger delete-request-btn${busy ? " btn-disabled" : ""}`} onClick={busy ? undefined : approve}>
                {busy ? "Deleting…" : "Yes, delete"}
              </span>
              <span className="btn btn-secondary delete-request-btn" onClick={() => setConfirming(false)}>
                Back
              </span>
            </>
          ) : (
            <>
              <span className="btn btn-danger delete-request-btn" onClick={() => setConfirming(true)}>
                Approve
              </span>
              <span className="btn btn-secondary delete-request-btn" onClick={onDecline}>
                Decline
              </span>
            </>
          ))}
        {!isAdmin && isMine && (
          <span className="btn btn-secondary delete-request-btn" onClick={onCancel}>
            Cancel request
          </span>
        )}
      </span>
    </div>
  );
}
