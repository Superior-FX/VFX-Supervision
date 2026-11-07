export const POST_TASK_TYPES = [
  "3D Tracking / Matchmove",
  "Roto / Paint / Matte",
  "Modeling",
  "Texturing / Look Dev",
  "Rigging",
  "Animation",
  "Particle / Fluid Simulation",
  "Lighting / Rendering",
  "AI Generation",
  "Digital Matte Painting (DMP)",
  "Compositing",
  "Color / Grading",
  "QC / Delivery",
];

// Each task type's on-disk folder under a shot's 02_tasks/ — a fixed slot
// per type (not creation order), so the same task type always lands in the
// same numbered folder across every shot and every show. A shot only gets
// the folders for task types actually assigned to it — gaps in the
// numbering are normal and expected.
export const TASK_FOLDER_SLUGS = {
  Compositing: "01_comp",
  "Roto / Paint / Matte": "02_roto_matte",
  "AI Generation": "03_ai",
  "Particle / Fluid Simulation": "04_particle_fluid",
  "3D Tracking / Matchmove": "05_tracking",
  Modeling: "06_modeling",
  "Texturing / Look Dev": "07_texturing",
  Rigging: "08_rigging",
  Animation: "09_animation",
  "Lighting / Rendering": "10_lighting",
  "Digital Matte Painting (DMP)": "11_dmp",
  "Color / Grading": "12_color",
  "QC / Delivery": "13_qc",
};

export function taskFolderSlug(type) {
  return TASK_FOLDER_SLUGS[type] ?? null;
}

// Task types that were renamed. Records saved under the old name are
// rewritten to the new one as they load (see normalizeRecord), so shots and
// artists from before a rename keep matching the current list.
const RENAMED_TASK_TYPES = { "Roto / Paint": "Roto / Paint / Matte" };

const renameType = (t) => RENAMED_TASK_TYPES[t] ?? t;

// Rewrites old task-type names inside a stored shot or artist record.
// Returns the same object when nothing needed changing.
export function normalizeRecord(data) {
  if (!data || typeof data !== "object") return data;
  let out = data;
  if (Array.isArray(data.tasks) && data.tasks.some((t) => RENAMED_TASK_TYPES[t?.type])) {
    out = { ...out, tasks: data.tasks.map((t) => (RENAMED_TASK_TYPES[t?.type] ? { ...t, type: renameType(t.type) } : t)) };
  }
  if (Array.isArray(data.departments) && data.departments.some((d) => RENAMED_TASK_TYPES[d])) {
    out = { ...out, departments: data.departments.map(renameType) };
  }
  if (typeof data.department === "string" && RENAMED_TASK_TYPES[data.department]) {
    out = { ...out, department: renameType(data.department) };
  }
  return out;
}
