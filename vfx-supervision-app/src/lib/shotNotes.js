import { aggregateTaskStatus } from "../data/taskStatus.js";
import { DECISIONS } from "./reviewFeedback.js";
import { formatVersion } from "./fsAccess.js";
import { versionNotes } from "./versionNotes.js";

// Per-shot rollups for the Post Reports spreadsheet and its .xlsx export:
// each task's latest submitted version, the client's notes, and our own
// (supe) notes on it. Client notes stay up until the client leaves notes on
// a newer version; anything older is kept for looking back (olderClientNotes).

// [{ task, version: "v003" }] for every task that has been submitted.
export function submittedVersions(shot) {
  return shot.tasks.filter((t) => t.version != null).map((task) => ({ task, version: formatVersion(task.version) }));
}

// The most urgent status among the submitted tasks — what the Submitted
// version cell is tinted by (same priority order as the shot's badge).
export function submittedStatus(shot) {
  const tasks = shot.tasks.filter((t) => t.version != null);
  return tasks.length ? aggregateTaskStatus(tasks) : null;
}

// Light cell fills for the .xlsx export, one per status tone — the same
// hues as the app's status pills, lightened so text stays readable.
export const STATUS_FILLS = {
  accent: { hex: "E0E7FF", label: "Pending (waiting on a supervisor)" },
  info: { hex: "F3E8FF", label: "Comp Approved" },
  client: { hex: "CFFAFE", label: "Pending Client Review" },
  warning: { hex: "FEF3C7", label: "WIP" },
  danger: { hex: "FDE2E1", label: "Needs Revision" },
  success: { hex: "D1FAE5", label: "Final" },
};

// One note row for the spreadsheet.
const noteRow = (task, versionNum, f) => ({
  task,
  versionNum,
  version: formatVersion(versionNum),
  // True when it's on an earlier version than the one currently submitted.
  previous: versionNum !== Number(task.version),
  reviewer: f.reviewer_name || "Client",
  decision: DECISIONS[f.decision] ?? null,
  comment: f.comment?.trim() ?? "",
  drawings: f.annotations?.length ?? 0,
});

// A task's client feedback grouped by version, newest version first:
// [{ versionNum, rows: [feedback] }]. Ignores versions above the submitted one.
function feedbackByVersion(shot, task, feedback) {
  const groups = new Map();
  for (const f of feedback) {
    if (f.shot_code !== shot.shotCode || f.task_type !== task.type) continue;
    const v = Number(f.version);
    if (!Number.isFinite(v) || v > Number(task.version)) continue;
    if (!groups.has(v)) groups.set(v, []);
    groups.get(v).push(f);
  }
  return [...groups.entries()].sort((a, b) => b[0] - a[0]).map(([versionNum, rows]) => ({ versionNum, rows }));
}

// The client's notes that are still current: per task, the newest version
// the client left notes on. A new submission doesn't clear them — they stay
// until the client leaves notes on the new version.
// [{ task, versionNum, version, previous, reviewer, decision, comment, drawings }]
export function clientNotes(shot, feedback) {
  if (!feedback?.length) return [];
  const out = [];
  for (const task of shot.tasks) {
    if (task.version == null) continue;
    const [latest] = feedbackByVersion(shot, task, feedback);
    if (latest) for (const f of latest.rows) out.push(noteRow(task, latest.versionNum, f));
  }
  return out;
}

// Everything the client said on earlier revisions (older than what
// clientNotes shows), per task, newest version first.
export function olderClientNotes(shot, feedback) {
  if (!feedback?.length) return [];
  const out = [];
  for (const task of shot.tasks) {
    if (task.version == null) continue;
    for (const { versionNum, rows } of feedbackByVersion(shot, task, feedback).slice(1)) {
      for (const f of rows) out.push(noteRow(task, versionNum, f));
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
