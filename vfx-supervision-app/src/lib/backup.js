// Export/import of the team's shared data — projects, their
// shots/scenes/capture-reports/script-reports, and the artist roster — as
// one JSON file. Since Step 2 that data lives in Supabase (sharedStore.js);
// the file format hasn't changed, so backups from before still import.
//
// Also reads what's left in this browser's own localStorage from before the
// move to the cloud (exportBrowserData), for the one-time upload on Home.
//
// Deliberately NOT included: project folder handles (IndexedDB, tied to
// this browser's own permission grants — they can't travel in a JSON file
// and can't be re-created from one; re-grant with "Choose Destination
// Folder" after importing, same as setting one up fresh).
import { writeJsonFile } from "./fsAccess.js";
import { SCOPED_DATA_BASES, scopedKey } from "./projects.js";
import * as sharedStore from "./sharedStore.js";

const EXPORT_APP_ID = "vfx-supervision-app";
const EXPORT_VERSION = 1;

// Full timestamp, not just the date, so writing straight into a folder
// (exportToFolder) can't silently overwrite an earlier backup from the same
// day the way a browser download's OS-level "(1)" renaming would avoid.
function backupFileName() {
  return `vfx-supe-backup_${new Date().toISOString().replace(/:/g, "-")}.json`;
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

// Every id project-scoped data might exist under: every real project, plus
// "unscoped" — the bucket data lands in when no project was active yet (see
// scopedKey in projects.js).
function allScopeIds(projects) {
  return [...new Set([...projects.map((p) => p.id), "unscoped"])];
}

function buildExport(read, activeProjectId) {
  const projects = read("vfx-supe-projects") ?? [];
  const projectData = {};
  for (const id of allScopeIds(projects)) {
    const entry = {};
    for (const base of SCOPED_DATA_BASES) {
      const value = read(scopedKey(base, id));
      if (value !== undefined && !(Array.isArray(value) && value.length === 0)) entry[base] = value;
    }
    if (Object.keys(entry).length > 0) projectData[id] = entry;
  }
  return {
    app: EXPORT_APP_ID,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    projects,
    activeProjectId,
    artists: read("vfx-supe-artists") ?? [],
    projectData,
  };
}

// The shared (cloud) data, as everyone on the team currently sees it.
export function exportAllData() {
  return buildExport((key) => sharedStore.read(key), readJson("vfx-supe-active-project-id", ""));
}

// What this browser kept locally before the move to the cloud — untouched
// since, so it's still there to upload once.
export function exportBrowserData() {
  return buildExport((key) => readJson(key, undefined), readJson("vfx-supe-active-project-id", ""));
}

export function downloadExport(data = exportAllData()) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = backupFileName();
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return data;
}

// Writes a fresh export straight into a folder the user has already
// granted access to (see pickBackupFolder in fsAccess.js) — no Save-As
// dialog, since the handle already lives in IndexedDB from that one-time
// setup.
export async function exportToFolder(dirHandle) {
  const data = exportAllData();
  const name = backupFileName();
  await writeJsonFile(dirHandle, name, data);
  return { data, name };
}

// Checks the parsed JSON actually looks like one of our own export files,
// not just any JSON someone picked, before an import can overwrite anything.
export function isValidExport(data) {
  return Boolean(data && typeof data === "object" && data.app === EXPORT_APP_ID && Array.isArray(data.projects));
}

// Replaces ALL of the team's shared data with what's in data — a full
// restore, not a merge, so re-importing an older backup rolls things back
// cleanly rather than leaving newer data mixed in underneath it. This
// changes it for everyone; the caller confirms with the user first.
// Resolves to the number of items written.
export async function importAllData(data) {
  const count = await sharedStore.replaceAll(data);
  if (data.activeProjectId) localStorage.setItem("vfx-supe-active-project-id", JSON.stringify(data.activeProjectId));
  return count;
}
