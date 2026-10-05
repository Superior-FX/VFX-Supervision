// Task status lifecycle:
// assigned -> wip (artist clicks Start, or Resume after a revision request)
//   -> pending (artist clicks Submit in Upload Shot)
//   -> needs_revision (supervisor clicks Revise) -> back to wip via Resume
//   -> final (supervisor clicks Final)
export const TASK_STATUSES = {
  assigned: { label: "Assigned", tone: null },
  wip: { label: "WIP", tone: "warning" },
  pending: { label: "Pending", tone: "accent" },
  needs_revision: { label: "Needs Revision", tone: "danger" },
  final: { label: "Final", tone: "success" },
};

export function taskStatusInfo(status) {
  return TASK_STATUSES[status] ?? TASK_STATUSES.assigned;
}

// Every status change goes through here so it's timestamped in
// task.statusHistory ([{ status, at }], oldest first) — the Dashboard reads
// it for review/revision wait times and "finaled this week". Tasks from
// before this existed simply have no history. Setting the same status
// again (e.g. a resubmit while already pending) still logs, since it's a
// real event.
export function withStatus(task, status) {
  return {
    ...task,
    status,
    statusHistory: [...(task.statusHistory ?? []), { status, at: new Date().toISOString() }],
  };
}

// Merges a generic field patch into a task, routing a status change in it
// through withStatus — for editors (Post Reports, Review) whose patches
// usually touch other fields (notes, assignees) and only sometimes status.
export function applyTaskPatch(task, patch) {
  const { status, ...rest } = patch;
  const merged = { ...task, ...rest };
  return status !== undefined && status !== task.status ? withStatus(merged, status) : merged;
}

// When a task last entered its current status, or null if unrecorded.
export function statusSince(task) {
  const history = task.statusHistory ?? [];
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].status === task.status) return history[i].at;
  }
  return null;
}

// The single most "urgent"/active status across a list of tasks, in
// priority order — used wherever a group of tasks (a shot's, or one
// artist's on that shot) needs to collapse down to one status badge.
export function aggregateTaskStatus(tasks) {
  const statuses = tasks.map((t) => t.status || "assigned");
  if (statuses.includes("needs_revision")) return taskStatusInfo("needs_revision");
  if (statuses.includes("wip")) return taskStatusInfo("wip");
  if (statuses.includes("pending")) return taskStatusInfo("pending");
  if (statuses.length > 0 && statuses.every((s) => s === "final")) return taskStatusInfo("final");
  return taskStatusInfo("assigned");
}

// Which Shot Board column a task's real status places it in — the board
// is driven live by this, not a separately-tracked field, so a task always
// sits where its actual progress says it should. needs_revision sits with
// wip in "progress" (the artist needs to keep working on it either way);
// its box gets an extra highlight in Shot Board rather than its own column.
export function boardColumnForStatus(status) {
  if (status === "wip" || status === "needs_revision") return "progress";
  if (status === "pending") return "review";
  if (status === "final") return "final";
  return "bidding";
}

// The board column a whole shot would show under, from its most urgent
// task (same priority order as aggregateTaskStatus) — Shot Board itself
// works per-task via boardColumnForStatus, but Dashboard's shot-level
// board-count pulse and "needs attention" list need one column per shot.
export function shotBoardColumn(tasks) {
  const statuses = tasks.map((t) => t.status || "assigned");
  if (statuses.length === 0) return "bidding";
  if (statuses.includes("needs_revision") || statuses.includes("wip")) return "progress";
  if (statuses.includes("pending")) return "review";
  if (statuses.every((s) => s === "final")) return "final";
  return "bidding";
}
