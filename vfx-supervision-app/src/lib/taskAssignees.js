// A task used to carry a single `assignee` string. It now carries an
// `assignees` list so more than one artist (or vendor) can be put on the
// same task. These helpers normalize both shapes so every page that reads
// assignees — Post Reports, Dashboard, Shot Board, and the whole Artist
// Portal — treats old and new records the same way. Nothing does a bulk
// rewrite of existing data; a task is upgraded to the array shape the next
// time it's actually edited (see updateAssignees below), so this stays the
// single source of truth for reading either shape in the meantime.

// Real (non-blank) assignees only — for counts, labels, and "is this artist
// on this task" checks. Filters out empty slots left by an in-progress pick.
export function getAssignees(task) {
  const raw = Array.isArray(task.assignees) ? task.assignees : task.assignee ? [task.assignee] : [];
  return raw.map((a) => a?.trim()).filter(Boolean);
}

export function assigneesLabel(task) {
  const names = getAssignees(task);
  return names.length ? names.join(", ") : "Unassigned";
}

export function hasAssignee(task, name) {
  if (!name?.trim()) return false;
  const trimmed = name.trim().toLowerCase();
  return getAssignees(task).some((a) => a.toLowerCase() === trimmed);
}

// The raw, unfiltered rows to render while editing — includes a blank slot
// for an artist that's been added but not picked yet, and always has at
// least one row so there's something to show/select.
export function assigneeRows(task) {
  const raw = Array.isArray(task.assignees) ? task.assignees : task.assignee ? [task.assignee] : [];
  return raw.length ? raw : [""];
}

// Renames every occurrence of oldName to newName across a task's assignees,
// upgrading a legacy single `assignee` task to the array shape in the same
// pass. Returns the task unchanged if oldName isn't actually on it.
export function renameAssigneeOnTask(task, oldName, newName) {
  const oldTrim = oldName.trim().toLowerCase();
  const current = assigneeRows(task);
  if (!current.some((a) => a?.trim().toLowerCase() === oldTrim)) return task;
  const updated = current.map((a) => (a?.trim().toLowerCase() === oldTrim ? newName : a));
  const { assignee, ...rest } = task;
  return { ...rest, assignees: updated };
}
