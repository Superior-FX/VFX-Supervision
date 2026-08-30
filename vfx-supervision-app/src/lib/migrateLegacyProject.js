// One-time migration from the old single-project model (a bare
// `vfx-supe-project` object plus flat, unscoped shot/capture/script-report
// keys) to the multi-project model (`vfx-supe-projects` array +
// `vfx-supe-active-project-id`, with per-project-scoped data keys).
// Must run synchronously before any component's first render, since
// useLocalStorageState reads its initial value from localStorage on mount.
// The folder handle itself is NOT migrated here (that's IndexedDB, async) —
// see fsAccess.js's migrateLegacyRootHandle, called lazily from Home.jsx.
import { SCOPED_DATA_BASES } from "./projects.js";

const MIGRATION_FLAG_KEY = "vfx-supe-migrated-to-projects-v1";

export function migrateLegacyProjectIfNeeded() {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(MIGRATION_FLAG_KEY)) return;
  localStorage.setItem(MIGRATION_FLAG_KEY, "true");

  if (localStorage.getItem("vfx-supe-projects")) return;

  const rawOldProject = localStorage.getItem("vfx-supe-project");
  if (!rawOldProject) return;

  let oldProject;
  try {
    oldProject = JSON.parse(rawOldProject);
  } catch {
    return;
  }
  if (!oldProject?.showCode) return;

  const id = crypto.randomUUID();
  const migrated = { id, name: oldProject.name || oldProject.showCode, showCode: oldProject.showCode };
  localStorage.setItem("vfx-supe-projects", JSON.stringify([migrated]));
  localStorage.setItem("vfx-supe-active-project-id", JSON.stringify(id));

  for (const base of SCOPED_DATA_BASES) {
    const raw = localStorage.getItem(base);
    if (raw) localStorage.setItem(`${base}:${id}`, raw);
  }
}
