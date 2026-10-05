import { statusSince } from "../data/taskStatus.js";
import { scopedKey } from "./projects.js";
import { getAssignees } from "./taskAssignees.js";

// Read-only rollups for the Dashboard. Everything is derived live from the
// shots/tasks the other pages edit — nothing here is ever written back.

const DAY_MS = 86400000;

// Today as YYYY-MM-DD in local time, so a shot due today isn't "overdue"
// until the day is actually over (new Date("2026-10-05") is UTC midnight,
// which in US time zones is the evening before).
export function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function daysUntilDate(date) {
  if (!date) return null;
  const [y, m, d] = date.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / DAY_MS);
}

// "3d", "5h", "12m" — compact age since an ISO timestamp.
export function formatAge(iso) {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (ms >= DAY_MS) return `${Math.floor(ms / DAY_MS)}d`;
  if (ms >= 3600000) return `${Math.floor(ms / 3600000)}h`;
  return `${Math.max(1, Math.floor(ms / 60000))}m`;
}

export function isShotFinal(shot) {
  return shot.tasks.length > 0 && shot.tasks.every((t) => t.status === "final");
}

export function isShotOverdue(shot) {
  return Boolean(shot.dueDate) && shot.dueDate < localToday() && !isShotFinal(shot);
}

// Every project's shots, read straight from storage — the overview needs all
// of them at once, not just the active project's.
export function loadProjectShots(projectId) {
  try {
    return JSON.parse(localStorage.getItem(scopedKey("vfx-supe-post-reports", projectId))) ?? [];
  } catch {
    return [];
  }
}

export function computeProjectStats(shots) {
  const tasks = shots.flatMap((shot) => shot.tasks.map((task) => ({ shot, task })));
  const byStatus = { assigned: 0, wip: 0, pending: 0, needs_revision: 0, final: 0 };
  for (const { task } of tasks) byStatus[task.status in byStatus ? task.status : "assigned"]++;

  const weekAgo = Date.now() - 7 * DAY_MS;
  const finaledThisWeek = tasks.filter(({ task }) => {
    if (task.status !== "final") return false;
    const at = statusSince(task);
    return at && new Date(at).getTime() >= weekAgo;
  }).length;

  const upcoming = shots
    .filter((s) => s.dueDate && !isShotFinal(s) && s.dueDate >= localToday())
    .map((s) => s.dueDate)
    .sort();

  return {
    shotCount: shots.length,
    taskCount: tasks.length,
    byStatus,
    finalPct: tasks.length ? Math.round((byStatus.final / tasks.length) * 100) : 0,
    shotsFinal: shots.filter(isShotFinal).length,
    overdueShots: shots.filter(isShotOverdue).length,
    unassigned: tasks.filter(({ task }) => getAssignees(task).length === 0).length,
    nextDue: upcoming[0] ?? null,
    finaledThisWeek,
  };
}

// Status -> bar/tile color, matching the pill tones used everywhere else.
export const STATUS_COLORS = {
  assigned: "var(--text-tertiary)",
  wip: "var(--warning)",
  pending: "var(--accent)",
  needs_revision: "var(--danger)",
  final: "var(--success)",
};

export const STATUS_ORDER = ["final", "pending", "wip", "needs_revision", "assigned"];
