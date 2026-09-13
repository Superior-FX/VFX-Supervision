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
