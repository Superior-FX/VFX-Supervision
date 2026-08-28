// Wraps the File System Access API so Post Reports can create the real
// on-disk folder tree described in references/vfx-shot-folder-structure.md.
// FileSystemDirectoryHandle isn't JSON-serializable, so it's persisted to
// IndexedDB separately from the rest of the app's localStorage state.

const DB_NAME = "vfx-supe-fs";
const STORE_NAME = "handles";
const ROOT_HANDLE_KEY = "project-root";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveRootHandle(handle) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(handle, ROOT_HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadRootHandle() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(ROOT_HANDLE_KEY);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export function isFsAccessSupported() {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

export async function pickProjectRootFolder() {
  const handle = await window.showDirectoryPicker({ mode: "readwrite" });
  await saveRootHandle(handle);
  return handle;
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

// Builds [SHOW]_[SEQUENCE]/SC[SCENE]/[SHOW]_SC[SCENE]_[SHOT]/ with its
// numbered subfolders, plus the per-shot metadata JSON, under rootHandle.
export async function createShotFolders(rootHandle, { show, sequence, scene, shotCode, pipeline, meta }) {
  const showSeqName = `${show}_${sequence}`;
  const sceneName = `SC${scene}`;
  const shotName = `${show}_${sceneName}_${shotCode}`;

  const showSeqDir = await subdir(rootHandle, showSeqName);
  const sceneDir = await subdir(showSeqDir, sceneName);
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

  return { path: `${showSeqName}/${sceneName}/${shotName}` };
}
