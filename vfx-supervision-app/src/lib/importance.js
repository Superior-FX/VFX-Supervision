function daysUntil(dueDate) {
  if (!dueDate) return null;
  const ms = new Date(dueDate).getTime() - Date.now();
  return ms / 86400000;
}

// Importance is the max signal across complexity, story importance, and due-date
// urgency — not a weighted average, so any single strong factor (e.g. a shot due
// tomorrow) is enough to flag a shot even if the others are low.
export function computeImportance({ complexity = 1, storyImportance = 1, dueDate = null }) {
  const due = daysUntil(dueDate);
  const isUrgent = (days) => due !== null && due <= days;

  if (complexity >= 4 || storyImportance >= 4 || isUrgent(3)) {
    return { tier: "high", colorKey: "danger" };
  }
  if (complexity >= 3 || storyImportance >= 3 || isUrgent(7)) {
    return { tier: "medium", colorKey: "warning" };
  }
  return { tier: "low", colorKey: null };
}
