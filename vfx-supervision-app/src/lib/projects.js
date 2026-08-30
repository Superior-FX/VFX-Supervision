import { useLocalStorageState } from "./useLocalStorageState.js";

// Base keys that get namespaced per project — kept in one place so deletion
// (Home.jsx) and the legacy migration (migrateLegacyProject.js) can't drift.
export const SCOPED_DATA_BASES = ["vfx-supe-post-reports", "vfx-supe-capture-reports", "vfx-supe-script-reports"];

export function useProjects() {
  return useLocalStorageState("vfx-supe-projects", []);
}

export function useActiveProjectId() {
  return useLocalStorageState("vfx-supe-active-project-id", "");
}

export function useActiveProject() {
  const [projects] = useProjects();
  const [activeId] = useActiveProjectId();
  return projects.find((p) => p.id === activeId) ?? null;
}

// Namespaces a shared data key (shots, capture reports, script reports) to
// one project, so each project gets its own — everything else (the artist
// roster, app-wide role state) stays a single shared key across projects.
export function scopedKey(base, projectId) {
  return `${base}:${projectId ?? "unscoped"}`;
}
