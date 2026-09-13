// Export/import for everything the app keeps in localStorage — projects,
// their shots/scenes/capture-reports/script-reports, the shared artist
// roster, and which project is active. This is the recovery path when
// browser storage itself is the risk (a cleared cache, a switched browser,
// a new machine) — see the app's port-pinning fix in vite.config.js for the
// other common way projects "disappear" (a dev server landing on a
// different port, which is a different localStorage origin entirely).
//
// Deliberately NOT included: project folder handles (IndexedDB, tied to
// this browser's own permission grants — they can't travel in a JSON file
// and can't be re-created from one; re-grant with "Choose Destination
// Folder" after importing, same as setting one up fresh).
import { writeJsonFile } from "./fsAccess.js";
import { SCOPED_DATA_BASES } from "./projects.js";

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

// Every id a project-scoped key might exist under: every real project, plus
// "unscoped" — the bucket data lands in when no project was active yet (see
// scopedKey in projects.js).
function allScopeIds(projects) {
  return [...new Set([...projects.map((p) => p.id), "unscoped"])];
}

export function exportAllData() {
  const projects = readJson("vfx-supe-projects", []);
  const activeProjectId = readJson("vfx-supe-active-project-id", "");
  const artists = readJson("vfx-supe-artists", []);

  const projectData = {};
  for (const id of allScopeIds(projects)) {
    const entry = {};
    for (const base of SCOPED_DATA_BASES) {
      const value = readJson(`${base}:${id}`, undefined);
      if (value !== undefined) entry[base] = value;
    }
    if (Object.keys(entry).length > 0) projectData[id] = entry;
  }

  return {
    app: EXPORT_APP_ID,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    projects,
    activeProjectId,
    artists,
    projectData,
  };
}

export function downloadExport() {
  const data = exportAllData();
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

// Replaces every key this app keeps in localStorage with what's in data —
// a full restore, not a merge, so re-importing an older backup rolls things
// back cleanly rather than leaving newer data mixed in underneath it. The
// caller is responsible for confirming with the user first, since this
// overwrites whatever is currently there.
export function importAllData(data) {
  localStorage.setItem("vfx-supe-projects", JSON.stringify(data.projects ?? []));
  localStorage.setItem("vfx-supe-active-project-id", JSON.stringify(data.activeProjectId ?? ""));
  localStorage.setItem("vfx-supe-artists", JSON.stringify(data.artists ?? []));

  const incomingIds = new Set([...(data.projects ?? []).map((p) => p.id), "unscoped"]);

  // Clear scoped data for any id that's in current storage but not part of
  // the incoming backup, so a restore doesn't leave orphaned data behind
  // from projects that don't exist in the file being imported. Reverse
  // iteration keeps removal-while-iterating safe.
  for (const base of SCOPED_DATA_BASES) {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`${base}:`) && !incomingIds.has(key.slice(base.length + 1))) {
        localStorage.removeItem(key);
      }
    }
  }

  for (const [id, entry] of Object.entries(data.projectData ?? {})) {
    for (const base of SCOPED_DATA_BASES) {
      if (entry[base] !== undefined) {
        localStorage.setItem(`${base}:${id}`, JSON.stringify(entry[base]));
      }
    }
  }
}
