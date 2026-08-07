// Mirrors references/vfx-shot-type-taxonomy.md — keep the two in sync.
export const VFX_EFFECT_GROUPS = [
  {
    group: "Environment",
    colorKey: "accent",
    effects: [
      "Set extension",
      "Sky replacement",
      "Digital matte painting (DMP)",
      "Full digital environment build",
      "Weather/atmospherics",
      "Day-for-night conversion",
      "Set dressing removal/addition",
      "Time-of-day or seasonal change",
    ],
  },
  {
    group: "Characters",
    colorKey: "warning",
    effects: [
      "CG creature",
      "Digital double",
      "De-aging / age-up",
      "Face replacement",
      "Crowd replication / tiling",
      "Wire and rig removal",
      "Prosthetic/makeup enhancement",
      "Body augmentation",
    ],
  },
  {
    group: "Objects & Effects",
    colorKey: "danger",
    effects: [
      "Fire/smoke/explosion simulation",
      "Water simulation",
      "Destruction/debris simulation",
      "Vehicle CG or replacement",
      "Muzzle flash/gunfire FX",
      "Screen replacement/comp",
      "Practical FX enhancement",
      "Particle FX",
    ],
  },
  {
    group: "Post / Invisible",
    colorKey: "success",
    effects: [
      "Color/beauty cleanup",
      "Logo/product removal",
      "Continuity fix",
      "Stabilization",
      "Split screen",
      "Time remap/speed ramp",
      "Invisible wire/rig removal",
      "Crew/equipment removal",
    ],
  },
];

export const ALL_VFX_EFFECTS = VFX_EFFECT_GROUPS.flatMap((g) => g.effects);

export function effectColorKey(effectName) {
  const group = VFX_EFFECT_GROUPS.find((g) => g.effects.includes(effectName));
  return group ? group.colorKey : "accent";
}

export const COMPLEXITY_LEVELS = ["Minimal", "Low", "Medium", "High", "Hero"];
