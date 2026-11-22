import { formatFrame } from "./AnnotatedPlayer.jsx";
import { formatVersion } from "../lib/fsAccess.js";
import { DECISIONS, formatFeedbackDate } from "../lib/reviewFeedback.js";
import "./ClientFeedback.css";

// One client's feedback on one shot: their call, overall comment and frame
// notes. Read-only — it's for the team to act on, it changes nothing.
// `showShot` adds the shot/task/version (for lists that span shots);
// `marksShown` + `onToggleMarks` add a button to put their drawings on the
// player (Review & Dailies).
export default function ClientFeedbackEntry({ feedback: f, showShot = false, marksShown = false, onToggleMarks }) {
  const decision = f.decision ? DECISIONS[f.decision] : null;
  const frames = [...(f.annotations ?? [])].sort((a, b) => a.frame - b.frame);
  const drawn = frames.filter((a) => a.strokes?.length).length;

  return (
    <div className="cfb-entry">
      <div className="cfb-head">
        {showShot && (
          <span className="mono cfb-shot">
            {f.shot_code} {f.task_type} {formatVersion(f.version)}
          </span>
        )}
        <span className="cfb-who">{f.reviewer_name}</span>
        {decision && <span className={`pill pill-${decision.tone}`}>{decision.label}</span>}
        <span className="cfb-when">{formatFeedbackDate(f.updated_at)}</span>
        {onToggleMarks && drawn > 0 && (
          <button type="button" className="aplayer-btn cfb-marks" onClick={onToggleMarks}>
            {marksShown ? "Hide their marks" : `Show their marks (${drawn})`}
          </button>
        )}
      </div>
      {f.comment?.trim() && <div className="cfb-comment">{f.comment}</div>}
      {frames.length > 0 && (
        <ul className="cfb-frames">
          {frames.map((a) => (
            <li key={a.id}>
              <span className="mono">F {formatFrame(a.frame)}</span>
              <span>{a.note?.trim() || <em>{a.strokes?.length ? "Drawing, no note" : "Empty note"}</em>}</span>
              {a.note?.trim() && a.strokes?.length > 0 && <span className="cfb-drawn">+ drawing</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
