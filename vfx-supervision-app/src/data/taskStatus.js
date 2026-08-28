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
