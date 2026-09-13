// Implements the naming convention documented in
// references/vfx-shot-folder-structure.md.

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
