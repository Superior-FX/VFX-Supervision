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
