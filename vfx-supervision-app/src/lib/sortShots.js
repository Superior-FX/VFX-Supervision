// Shared shot-ordering rules:
// - Shot Tracking, Artist Report, and Shot Board: due date (soonest first)
//   -> complexity (highest first) -> shot code, as a tiebreak chain.
// - Post Reports: shot code alone — more of a filing/lookup view than a
//   priority one, so it stays plain alphanumeric.
// Each is a tiebreak chain ending in shot code so the order is always
// fully deterministic, never dependent on array insertion order.

// Natural, code-aware comparison (e.g. "057A" before "057B", "9" before
// "10") — mirrors the numeric-aware scene sort already used in Post Reports.
function compareShotCode(a, b) {
  return (a.shotCode ?? "").localeCompare(b.shotCode ?? "", undefined, { numeric: true });
}

// Ascending — soonest due date first. A shot with no due date has nothing
// to be "sooner" than one that does, so it sorts after every dated shot.
function compareDueDate(a, b) {
  if (!a.dueDate && !b.dueDate) return 0;
  if (!a.dueDate) return 1;
  if (!b.dueDate) return -1;
  return a.dueDate.localeCompare(b.dueDate);
}

// Descending — the more complex shot surfaces higher.
function compareComplexityDesc(a, b) {
  return (b.complexity ?? 1) - (a.complexity ?? 1);
}

export function sortByDueComplexityName(shots) {
  return [...shots].sort((a, b) => compareDueDate(a, b) || compareComplexityDesc(a, b) || compareShotCode(a, b));
}

export function sortByShotCode(shots) {
  return [...shots].sort(compareShotCode);
}
