# VFX Shot Folder Structure — Generic Template

A reusable, show-agnostic folder convention for organizing VFX shots across
traditional, AI-assisted, and hybrid pipelines. Derived from production use
on *Girl on the Plane* (GOTP), generalized for reuse on any show.

---

## Placeholders

| Placeholder | Meaning | Format |
|---|---|---|
| `[SHOW]` | Show/project code | Short uppercase code, e.g. `GOTP` |
| `[SEQUENCE]` | Named sequence within the show | e.g. `LilyBelle`, `Trident` |
| `[SCENE]` | Scene number | Zero-padded **3 digits**, e.g. `009` |
| `[SHOT]` | Shot/sub-shot identifier | Letter suffix appended to scene, e.g. `D`, `A` — omit if the scene has no sub-shots |
| `[VERSION]` | Comp/render version | `v001`, `v002`... never `v1` |
| `[FRAME]` | Frame number | 4-digit zero-padded, `%04d` |

---

## Folder Tree

```
[SHOW]_[SEQUENCE]/
  SC[SCENE]/
    [SHOW]_SC[SCENE]_[SHOT]/
      00_plates/            # raw/graded camera plates as delivered
      01_reference/         # HDRI, chrome/grey ball, clean plates, set reference stills
      02_roto_matte/        # roto and mattes (manual or AI-assist)
      03_ai_gen/            # ONLY for hybrid/AI-assist shots — omit for traditional-only
      04_comp/
        nuke/                # .nk scripts
        renders/             # comp output, organized by version
      05_review/             # dailies / client review exports
      [SHOW]_SC[SCENE]_[SHOT]_shot.json   # per-shot metadata (see schema below)
```

### Notes on structure
- **Sub-shots share a scene folder.** `SC009` holds `GOTP_SC009_D`, `GOTP_SC009_A`,
  `GOTP_SC009_E` as siblings — they are not separate scenes.
- **`03_ai_gen/` is conditional.** Only create it when the shot's pipeline type is
  `AI-assist` or `Hybrid`. Traditional-only shots (e.g. hero sim work) should not
  have this folder — its presence implies AI involvement in review/QC.
- **`04_comp/renders/`** holds versioned output following the naming convention
  below, organized into per-version subfolders (`v001/`, `v002/`) to prevent
  frame collisions between versions.

---

## File Naming Convention

```
[SHOW]_SC[SCENE]_[SHOT]_[VERSION]_[FRAME].ext
```

Example: `GOTP_SC009_D_v001_0042.exr`

Rules:
- Scene: zero-padded 3 digits (`SC009`, not `SC9`)
- Shot: letter suffix, no separator before the version (`_D_v001`, not `_D_V1`)
- Version: `v001` format always — never `v1`, `V001`, or unpadded
- Frame: 4-digit zero-padded (`0001`), use `%04d` in Nuke/shell tooling
- No spaces, no special characters other than underscore

---

## Per-Shot Metadata Schema (`[SHOW]_SC[SCENE]_[SHOT]_shot.json`)

Mirrors the columns used in shot-tracking spreadsheets so the two can be kept
in sync (manually or scripted).

```json
{
  "show": "GOTP",
  "sequence": "LilyBelle",
  "scene": "009",
  "shot": "D",
  "unit_location": "Water Unit A - Lake Superior",
  "time_of_day": "Day",
  "description": "Through windshield of Emma and Sam, VFX storm clouds in reflection",
  "vfx_category": "Comp / Sky reflection",
  "pipeline": "hybrid",
  "status": "not_shot",
  "hdri_captured": false,
  "clean_plate_captured": false,
  "tracking_markers_placed": false,
  "notes": "Needs clean windshield plate for reflection comp"
}
```

`pipeline` accepted values: `traditional`, `ai_assist`, `hybrid`.
`status` accepted values: `not_shot`, `shot`, `in_progress`, `review`, `approved`, `final`.

---

## Applying This to a New Show

1. Set `[SHOW]` to the show's confirmed file/folder code (lock this early — it
   should match what post/DI and vendors use).
2. Create one top-level folder per sequence: `[SHOW]_[SEQUENCE]/`.
3. For each scene in the shot list, create `SC[SCENE]/`.
4. For each shot/sub-shot, create the shot folder and its five numbered
   subfolders, adding `03_ai_gen/` only where the pipeline type calls for it.
5. Populate the per-shot JSON from the shot tracker.

See the `vfx-shot-folder-structure` skill for a script that automates steps
2–5 from a JSON shot list.
