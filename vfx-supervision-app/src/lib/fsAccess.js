// Wraps the File System Access API so Post Reports can create the real
// on-disk folder tree described in references/vfx-shot-folder-structure.md.
// FileSystemDirectoryHandle isn't JSON-serializable, so it's persisted to
// IndexedDB separately from the rest of the app's localStorage state, one
// handle per project (keyed by project id).
import { taskFolderSlug } from "../data/postTasks.js";

const DB_NAME = "vfx-supe-fs";
const STORE_NAME = "handles";
// Pre-multi-project handle lived under this fixed key — kept only so a
// migration can pick it up and re-key it under a real project id.
const LEGACY_ROOT_HANDLE_KEY = "project-root";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveRootHandle(projectId, handle) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(handle, projectId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadRootHandle(projectId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(projectId);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

// One-time migration hook: copies the old single fixed-key handle over to a
// real project id. No-op if nothing was ever stored under the legacy key.
export async function migrateLegacyRootHandle(newProjectId) {
  const handle = await loadRootHandle(LEGACY_ROOT_HANDLE_KEY);
  if (handle) await saveRootHandle(newProjectId, handle);
  return handle;
}

export async function deleteRootHandle(projectId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(projectId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function isFsAccessSupported() {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

// The user picks a destination directory (e.g. a shows drive/folder) —
// nothing is created yet, just granted.
export async function pickDestinationFolder() {
  return window.showDirectoryPicker({ mode: "readwrite" });
}

// The actual project root is a subfolder created inside that destination,
// named after the show code, so shots never land loose in a shared folder.
export async function createProjectRootFolder(projectId, destinationHandle, folderName) {
  const rootHandle = await subdir(destinationHandle, folderName);
  await saveRootHandle(projectId, rootHandle);
  return rootHandle;
}

// Combined pick+create+save for call sites with no separate "create" step
// to defer to (e.g. granting a folder to an already-existing project).
export async function pickProjectRootFolder(projectId, folderName) {
  const destinationHandle = await pickDestinationFolder();
  return createProjectRootFolder(projectId, destinationHandle, folderName);
}

export async function ensurePermission(handle) {
  if (!handle) return false;
  const opts = { mode: "readwrite" };
  if ((await handle.queryPermission(opts)) === "granted") return true;
  return (await handle.requestPermission(opts)) === "granted";
}

async function subdir(parent, name) {
  return parent.getDirectoryHandle(name, { create: true });
}

// One shared backup folder for the whole app (not per-project) — same
// handle store as project roots, just under a fixed key instead of a
// project id. Picked once; after that, export/import use the saved handle
// directly with no folder-picker dialog.
const BACKUP_FOLDER_KEY = "backup-folder";

export async function pickBackupFolder() {
  const handle = await pickDestinationFolder();
  await saveRootHandle(BACKUP_FOLDER_KEY, handle);
  return handle;
}

export async function loadBackupFolderHandle() {
  return loadRootHandle(BACKUP_FOLDER_KEY);
}

// Lists .json files directly inside a directory handle. Backup filenames
// are timestamped (vfx-supe-backup_2026-09-13T...), so a plain reverse
// alphabetical sort already puts the most recent export first.
export async function listJsonFiles(dirHandle) {
  const names = [];
  for await (const [name, handle] of dirHandle.entries()) {
    if (handle.kind === "file" && name.toLowerCase().endsWith(".json")) {
      names.push(name);
    }
  }
  return names.sort().reverse();
}

export async function readJsonFile(dirHandle, name) {
  const fileHandle = await dirHandle.getFileHandle(name);
  const file = await fileHandle.getFile();
  return JSON.parse(await file.text());
}

export async function writeJsonFile(dirHandle, name, data) {
  const fileHandle = await dirHandle.getFileHandle(name, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}

// Creates just SC[SCENE]/ under the project root — the group folder a scene
// gets as soon as it's created, before any of its shots exist.
export async function createSceneFolder(rootHandle, { scene }) {
  const sceneName = `SC${scene}`;
  await subdir(rootHandle, sceneName);
  return { path: sceneName };
}

// Creates (or reuses) the folder for one task type under a shot's
// 02_tasks/ — every task type gets a project/ (source files) and render/
// (submitted output) split. Compositing's project/ further splits into
// nuke/ and AE/, since comp work happens in either app; every other task
// type's project/ stays flat. Returns null (no-op) for a task type with no
// folder slug defined (see TASK_FOLDER_SLUGS).
export async function ensureTaskFolder(tasksDir, taskType) {
  const slug = taskFolderSlug(taskType);
  if (!slug) return null;
  const taskDir = await subdir(tasksDir, slug);
  const projectDir = await subdir(taskDir, "project");
  await subdir(taskDir, "render");
  if (taskType === "Compositing") {
    await subdir(projectDir, "nuke");
    await subdir(projectDir, "AE");
  }
  return taskDir;
}

// Builds SC[SCENE]/[SHOT]/ with its numbered subfolders, plus the per-shot
// metadata JSON, under rootHandle. The shot folder is named for just the
// shot code — SC[SCENE]/ already establishes the show/scene context, so
// repeating it on every shot folder underneath would be redundant.
//
// 02_tasks/ is created empty here — a task only gets its own subfolder
// once the shot is actually pushed (see addTaskFolder / pushAssignment in
// PostReports.jsx), not just because it was assigned.
export async function createShotFolders(rootHandle, { scene, shotCode, meta }) {
  const sceneName = `SC${scene}`;
  const shotName = shotCode;

  const sceneDir = await subdir(rootHandle, sceneName);
  const shotDir = await subdir(sceneDir, shotName);

  await subdir(shotDir, "00_plates");
  await subdir(shotDir, "01_reference");
  await subdir(shotDir, "02_tasks");
  await subdir(shotDir, "03_review");

  const fileHandle = await shotDir.getFileHandle(`${shotName}_shot.json`, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(meta, null, 2));
  await writable.close();

  return { path: `${sceneName}/${shotName}` };
}

// Adds one task type's folder to an already-existing shot — called when a
// new task is assigned to a shot whose folders were already created, so
// 02_tasks/ picks up new subfolders over the shot's life instead of only
// ever reflecting whatever tasks existed the moment folders were made.
// A no-op (not an error) if the shot's folders don't exist on disk yet.
export async function addTaskFolder(rootHandle, { scene, shotCode, taskType }) {
  const sceneName = `SC${scene}`;
  let shotDir;
  try {
    const sceneDir = await rootHandle.getDirectoryHandle(sceneName);
    shotDir = await sceneDir.getDirectoryHandle(shotCode);
  } catch {
    return null;
  }
  const tasksDir = await subdir(shotDir, "02_tasks");
  return ensureTaskFolder(tasksDir, taskType);
}

// Resolves the folder a task's submitted work should land in — every task
// type's render/ subfolder (not project/, which holds source files like
// nuke/AE scripts, not submitted output). Throws if the shot's folders
// don't exist on disk (caller should already be gating on that with
// foldersCreatedAt, but this is the authoritative check against the real
// filesystem).
export async function getTaskUploadFolder(rootHandle, { scene, shotCode, taskType }) {
  const sceneName = `SC${scene}`;
  const sceneDir = await rootHandle.getDirectoryHandle(sceneName);
  const shotDir = await sceneDir.getDirectoryHandle(shotCode);
  const tasksDir = await subdir(shotDir, "02_tasks");
  const taskDir = await ensureTaskFolder(tasksDir, taskType);
  if (!taskDir) return null;
  return subdir(taskDir, "render");
}

// Copies one real File (e.g. from an <input>/showOpenFilePicker result)
// into destDir under the given name.
export async function copyFileInto(destDir, name, file) {
  const destFile = await destDir.getFileHandle(name, { create: true });
  const writable = await destFile.createWritable();
  await writable.write(await file.arrayBuffer());
  await writable.close();
}

// Opens a single-file picker for a video, no destination side effects —
// the caller copies its returned File wherever it needs to.
export async function pickVideoFile() {
  const [handle] = await window.showOpenFilePicker({
    excludeAcceptAllOption: false,
    multiple: false,
    types: [{ description: "Video", accept: { "video/*": [".mov", ".mp4", ".mxf", ".avi"] } }],
  });
  return handle.getFile();
}

// Opens a folder picker for an image sequence's source folder — read-only,
// since nothing is written back into it.
export async function pickSequenceFolder() {
  return window.showDirectoryPicker({ mode: "read" });
}

// Every file directly inside a picked folder, as real File objects — no
// recursion into subfolders, a sequence is a flat folder of frames.
export async function readFolderFiles(dirHandle) {
  const files = [];
  for await (const [name, handle] of dirHandle.entries()) {
    if (handle.kind === "file") files.push(await handle.getFile());
  }
  return files;
}

// Copies every entry of sourceDir directly into an existing destDir (no
// wrapping folder of its own) — the shared recursion step behind both
// copyDirRecursive (which wraps the copy in a new named folder) and the
// legacy-folder migration below (which merges straight into one that
// already exists).
async function mergeDirInto(sourceDir, destDir) {
  for await (const [childName, handle] of sourceDir.entries()) {
    if (handle.kind === "directory") {
      await copyDirRecursive(handle, destDir, childName);
    } else {
      const file = await handle.getFile();
      const destFile = await destDir.getFileHandle(childName, { create: true });
      const writable = await destFile.createWritable();
      await writable.write(await file.arrayBuffer());
      await writable.close();
    }
  }
}

// Recursively copies every entry of sourceDir into a new-or-existing
// directory of the given name under destParentDir. Plain copy via the
// standard handle APIs (entries/getFileHandle/getDirectoryHandle) rather
// than a native move/rename — that API isn't reliably available across
// browsers yet, so this stays portable at the cost of an extra read pass.
async function copyDirRecursive(sourceDir, destParentDir, name) {
  const destDir = await destParentDir.getDirectoryHandle(name, { create: true });
  await mergeDirInto(sourceDir, destDir);
  return destDir;
}

// "zzz_" keeps this folder sorted to the bottom of a scene's folder listing
// (after any shot code, whether it starts with a digit or a letter) in both
// plain alphabetical and natural-sort file browsers.
const DELETED_FOLDER_NAME = "zzz_DELETED";
// The unprefixed name this folder used to get, before the "zzz_" prefix was
// added — migrated into the new name below so a scene never ends up with
// two separate "already deleted" folders side by side.
const LEGACY_DELETED_FOLDER_NAME = "DELETED";

// Moves a shot's folder into SC[SCENE]/zzz_DELETED/[SHOT]/ instead of
// removing it outright, so nothing an artist already dropped in there is
// lost. zzz_DELETED/ is created lazily — the first shot deleted in a scene
// makes it, every deletion after that just lands inside the existing one.
// A no-op (not an error) if the scene or shot folder was never created on
// disk in the first place.
export async function moveShotFolderToDeleted(rootHandle, { scene, shotCode }) {
  const sceneName = `SC${scene}`;
  let sceneDir;
  try {
    sceneDir = await rootHandle.getDirectoryHandle(sceneName);
  } catch {
    return { moved: false };
  }

  let shotDir;
  try {
    shotDir = await sceneDir.getDirectoryHandle(shotCode);
  } catch {
    return { moved: false };
  }

  const deletedDir = await sceneDir.getDirectoryHandle(DELETED_FOLDER_NAME, { create: true });

  try {
    const legacyDir = await sceneDir.getDirectoryHandle(LEGACY_DELETED_FOLDER_NAME);
    await mergeDirInto(legacyDir, deletedDir);
    await sceneDir.removeEntry(LEGACY_DELETED_FOLDER_NAME, { recursive: true });
  } catch {
    // No legacy DELETED/ folder in this scene — nothing to migrate.
  }

  await copyDirRecursive(shotDir, deletedDir, shotCode);
  await sceneDir.removeEntry(shotCode, { recursive: true });
  return { moved: true };
}

// Same "zzz_" sort-to-bottom idea, one level up — a scene isn't nested
// inside another scene, so its deleted folder sits at the project root
// instead of inside itself.
const DELETED_SCENES_FOLDER_NAME = "zzz_DELETED_SCENES";

// Moves an entire scene's folder (every shot inside it, untouched) into
// [SHOW]/zzz_DELETED_SCENES/SC[SCENE]/ instead of removing it outright.
// Created lazily — the first scene deleted in the project makes it, every
// deletion after that just lands inside the existing one. A no-op (not an
// error) if the scene folder was never created on disk in the first place.
export async function moveSceneFolderToDeleted(rootHandle, { scene }) {
  const sceneName = `SC${scene}`;
  let sceneDir;
  try {
    sceneDir = await rootHandle.getDirectoryHandle(sceneName);
  } catch {
    return { moved: false };
  }

  const deletedDir = await subdir(rootHandle, DELETED_SCENES_FOLDER_NAME);
  await copyDirRecursive(sceneDir, deletedDir, sceneName);
  await rootHandle.removeEntry(sceneName, { recursive: true });
  return { moved: true };
}
