export const POST_TASK_TYPES = [
  "3D Tracking / Matchmove",
  "Roto / Paint",
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
  "Roto / Paint": "02_roto_matte",
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
