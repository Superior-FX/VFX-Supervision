// Implements the naming convention documented in
// references/vfx-shot-folder-structure.md.
import { taskFolderSlug } from "../data/postTasks.js";

export function padScene(scene) {
  const trimmed = (scene ?? "").toString().trim();
  if (!trimmed) return "";
  // Strip a leading "SC" the user may have typed themselves — the folder
  // convention always adds its own "SC" prefix, so a scene value that
  // already has one would otherwise double up (e.g. "SCSC057-080").
  const withoutPrefix = /^sc/i.test(trimmed) ? trimmed.slice(2) : trimmed;
  return /^\d+$/.test(withoutPrefix) ? withoutPrefix.padStart(3, "0") : withoutPrefix;
}

export function buildSceneFolderPath({ show, scene }) {
  const showTrim = (show ?? "").trim();
  const sceneTrim = padScene(scene);
  if (!showTrim || !sceneTrim) return null;

  return `${showTrim}/SC${sceneTrim}`;
}

// The shot's own leaf folder is named for just its shot code — the scene
// folder it lives under (SC[SCENE]/) already gives it show/scene context,
// so repeating "[SHOW]_SC[SCENE]_" on every shot folder was redundant.
export function buildFolderPath({ show, scene, shotCode }) {
  const showTrim = (show ?? "").trim();
  const sceneTrim = padScene(scene);
  const shotTrim = (shotCode ?? "").trim();
  if (!showTrim || !sceneTrim || !shotTrim) return null;

  return `${showTrim}/SC${sceneTrim}/${shotTrim}`;
}

// Display-only path for where a task's uploaded work actually lands —
// [SHOW]/SC[SCENE]/[SHOT]/02_tasks/[slug]/render — so Upload Shot can show
// the artist exactly where a file is headed before/after they pick it,
// per task. Mirrors the real resolution in getTaskUploadFolder
// (src/lib/fsAccess.js) but as a plain string, no disk access.
export function buildTaskUploadPath({ show, scene, shotCode, taskType }) {
  const base = buildFolderPath({ show, scene, shotCode });
  const slug = taskFolderSlug(taskType);
  if (!base || !slug) return null;
  return `${base}/02_tasks/${slug}/render`;
}
