// Wraps the File System Access API so Post Reports can create the real
// on-disk folder tree described in references/vfx-shot-folder-structure.md.
// FileSystemDirectoryHandle isn't JSON-serializable, so it's persisted to
// IndexedDB separately from the rest of the app's localStorage state, one
// handle per project (keyed by project id).

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

// Creates just SC[SCENE]/ under the project root — the group folder a scene
// gets as soon as it's created, before any of its shots exist.
export async function createSceneFolder(rootHandle, { scene }) {
  const sceneName = `SC${scene}`;
  await subdir(rootHandle, sceneName);
  return { path: sceneName };
}

// Builds SC[SCENE]/[SHOT]/ with its numbered subfolders, plus the per-shot
// metadata JSON, under rootHandle. The shot folder is named for just the
// shot code — SC[SCENE]/ already establishes the show/scene context, so
// repeating it on every shot folder underneath would be redundant.
export async function createShotFolders(rootHandle, { scene, shotCode, pipeline, meta }) {
  const sceneName = `SC${scene}`;
  const shotName = shotCode;

  const sceneDir = await subdir(rootHandle, sceneName);
  const shotDir = await subdir(sceneDir, shotName);

  await subdir(shotDir, "00_plates");
  await subdir(shotDir, "01_reference");
  await subdir(shotDir, "02_roto_matte");
  if (pipeline === "ai_assist" || pipeline === "hybrid") {
    await subdir(shotDir, "03_ai_gen");
  }
  const compDir = await subdir(shotDir, "04_comp");
  await subdir(compDir, "nuke");
  await subdir(compDir, "renders");
  await subdir(shotDir, "05_review");

  const fileHandle = await shotDir.getFileHandle(`${shotName}_shot.json`, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(meta, null, 2));
  await writable.close();

  return { path: `${sceneName}/${shotName}` };
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
