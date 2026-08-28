// Implements the naming convention documented in
// references/vfx-shot-folder-structure.md.

export function padScene(scene) {
  const trimmed = (scene ?? "").toString().trim();
  if (!trimmed) return "";
  return /^\d+$/.test(trimmed) ? trimmed.padStart(3, "0") : trimmed;
}

export function buildFolderPath({ show, sequence, scene, shotCode }) {
  const showTrim = (show ?? "").trim();
  const sequenceTrim = (sequence ?? "").trim();
  const sceneTrim = padScene(scene);
  const shotTrim = (shotCode ?? "").trim();
  if (!showTrim || !sequenceTrim || !sceneTrim || !shotTrim) return null;

  return `${showTrim}_${sequenceTrim}/SC${sceneTrim}/${showTrim}_SC${sceneTrim}_${shotTrim}`;
}
