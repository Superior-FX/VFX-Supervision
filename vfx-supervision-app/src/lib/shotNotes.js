import { DECISIONS } from "./reviewFeedback.js";
import { formatVersion } from "./fsAccess.js";
import { versionNotes } from "./versionNotes.js";

// Per-shot rollups for the Post Reports spreadsheet and its .xlsx export:
// each task's latest submitted version, the client's notes on it, and our
// own (supe) notes on it. Only the latest version counts, since notes on
// older versions have already been acted on.

// [{ task, version: "v003" }] for every task that has been submitted.
export function submittedVersions(shot) {
  return shot.tasks.filter((t) => t.version != null).map((task) => ({ task, version: formatVersion(task.version) }));
}

// Client feedback rows (review_feedback) on each task's latest version.
// [{ task, version, reviewer, decision, comment, drawings }]
export function clientNotes(shot, feedback) {
  if (!feedback?.length) return [];
  const out = [];
  for (const task of shot.tasks) {
    if (task.version == null) continue;
    for (const f of feedback) {
      if (f.shot_code !== shot.shotCode || f.task_type !== task.type || String(f.version) !== String(task.version))
        continue;
      out.push({
        task,
        version: formatVersion(task.version),
        reviewer: f.reviewer_name || "Client",
        decision: DECISIONS[f.decision] ?? null,
        comment: f.comment?.trim() ?? "",
        drawings: f.annotations?.length ?? 0,
      });
    }
  }
  return out;
}

// A task's supe note on its current version ("" if none).
export const taskSupNote = (task) =>
  (versionNotes(task, task.version ?? null).supNote ?? task.supNote ?? "").trim();

// The supervisor's note on each task's latest version.
// [{ task, version, note }]
export function internalNotes(shot) {
  return shot.tasks
    .map((task) => ({
      task,
      version: task.version != null ? formatVersion(task.version) : "",
      note: taskSupNote(task),
    }))
    .filter((n) => n.note);
}

// Plain-text versions for the spreadsheet export.
export const submittedVersionsText = (shot) =>
  submittedVersions(shot)
    .map((v) => `${v.task.type}: ${v.version}`)
    .join("; ");

export const clientNotesText = (shot, feedback) =>
  clientNotes(shot, feedback)
    .map((n) =>
      [
        `${n.task.type} ${n.version}, ${n.reviewer}:`,
        n.decision?.label,
        n.comment,
        n.drawings ? `(${n.drawings} drawing${n.drawings === 1 ? "" : "s"})` : "",
      ]
        .filter(Boolean)
        .join(" ")
    )
    .join("\n");

export const internalNotesText = (shot) =>
  internalNotes(shot)
    .map((n) => `${n.task.type}${n.version ? ` ${n.version}` : ""}: ${n.note}`)
    .join("\n");
