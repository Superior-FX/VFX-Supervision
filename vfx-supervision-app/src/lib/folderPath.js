// Implements the naming convention documented in
// references/vfx-shot-folder-structure.md.

export function padScene(scene) {
  const trimmed = (scene ?? "").toString().trim();
  if (!trimmed) return "";
  return /^\d+$/.test(trimmed) ? trimmed.padStart(3, "0") : trimmed;
}

export function buildSceneFolderPath({ show, scene }) {
  const showTrim = (show ?? "").trim();
  const sceneTrim = padScene(scene);
  if (!showTrim || !sceneTrim) return null;

  return `${showTrim}/SC${sceneTrim}`;
}

export function buildFolderPath({ show, scene, shotCode }) {
  const showTrim = (show ?? "").trim();
  const sceneTrim = padScene(scene);
  const shotTrim = (shotCode ?? "").trim();
  if (!showTrim || !sceneTrim || !shotTrim) return null;

  return `${showTrim}/SC${sceneTrim}/${showTrim}_SC${sceneTrim}_${shotTrim}`;
}
