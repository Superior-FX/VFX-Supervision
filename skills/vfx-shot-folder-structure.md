# VFX Shot Folder Structure — Generic Template

A reusable, show-agnostic folder convention for organizing VFX shots across
traditional, AI-assisted, and hybrid pipelines. Derived from production use
on *Girl on the Plane* (GOTP), generalized for reuse on any show.

---

## Placeholders

| Placeholder | Meaning | Format |
|---|---|---|
| `[SHOW]` | Show/project code | Short uppercase code, e.g. `GOTP` |
| `[SCENE]` | Scene number | Zero-padded **3 digits**, e.g. `009` |
| `[SHOT]` | Shot/sub-shot identifier | Letter suffix appended to scene, e.g. `D`, `A` — omit if the scene has no sub-shots |
| `[VERSION]` | Comp/render version | `v001`, `v002`... never `v1` |
| `[FRAME]` | Frame number | 4-digit zero-padded, `%04d` |

---

## Folder Tree

```
[SHOW]/                          # project root — created once per show
  SC[SCENE]/                     # created as soon as a scene exists, before any shots do
    [SHOT]/                      # named for just the shot code — SC[SCENE]/ already gives it show/scene context
      00_plates/            # raw/graded camera plates as delivered
      01_reference/         # HDRI, chrome/grey ball, clean plates, set reference stills
      02_tasks/             # one subfolder per task type actually pushed on this shot (see table below)
        01_comp/
          project/
            nuke/                # .nk scripts
            AE/                  # .aep projects
          render/                # comp output, organized by version — artists upload here
        02_roto_matte/
          project/               # source files (flat — no nuke/AE split outside comp)
          render/                # artists upload here
        03_ai/
        ...                    # only the task types this shot's pushed assignments actually have
      03_review/             # dailies / client review exports
      [SHOT]_shot.json      # per-shot metadata (see schema below)
```

### Task folders (`02_tasks/`)

Each task type gets a fixed numbered slot — the same task type always lands
in the same folder across every shot and every show, so gaps in the
numbering (a shot skipping tasks it doesn't have) are normal and expected.
Only the task types actually assigned to a shot get a folder; the rest of
the slots below simply don't exist for that shot.

Every task folder gets a `project/` (source files) and `render/`
(submitted output — where Upload Shot lands an artist's work) split.
Compositing's `project/` further splits into `nuke/` and `AE/`, since comp
work happens in either app; every other task type's `project/` stays flat.

| Task type | Folder |
|---|---|
| Compositing | `01_comp` (`project/{nuke,AE}` + `render/`) |
| Roto / Paint | `02_roto_matte` |
| AI Generation | `03_ai` |
| Particle / Fluid Simulation | `04_particle_fluid` |
| 3D Tracking / Matchmove | `05_tracking` |
| Modeling | `06_modeling` |
| Texturing / Look Dev | `07_texturing` |
| Rigging | `08_rigging` |
| Animation | `09_animation` |
| Lighting / Rendering | `10_lighting` |
| Digital Matte Painting (DMP) | `11_dmp` |
| Color / Grading | `12_color` |
| QC / Delivery | `13_qc` |

A task's folder is created when the shot is pushed (Push/Re-push
Assignment in Post Reports) — not the moment the task is assigned.
`02_tasks/` itself exists (empty) as soon as the shot's folders are
created; individual task subfolders wait until there's actually a real
assignment going out, so an in-progress shot's growing task list doesn't
scatter empty folders before there's real work ready to start. Re-pushing
picks up any task types added since the last push. See `TASK_FOLDER_SLUGS`
/ `ensureTaskFolder` in `src/lib/fsAccess.js` and `src/data/postTasks.js`
for the source of truth.

### Notes on structure
- **Scenes are created ahead of their shots.** `SC[SCENE]/` exists as its own
  group folder the moment a scene is entered in Post Reports — shots get
  added into it afterward, each generating its own subfolder tree.
- **Sub-shots share a scene folder.** `SC009` holds `D`, `A`, `E` as sibling
  shot folders — they are not separate scenes.
- **The shot folder itself carries no show/scene prefix.** Its parent path
  (`[SHOW]/SC[SCENE]/`) already establishes that context, so the folder name
  is just `[SHOT]` (e.g. `D`, `057A`) rather than repeating
  `[SHOW]_SC[SCENE]_[SHOT]` on every shot. The compound
  `[SHOW]_SC[SCENE]_[SHOT]` form is still used for individual files inside
  the shot (see File Naming Convention below), where the file may end up out
  of its folder context (e.g. sent to a vendor, attached to review notes).
- **Deleting a shot in Post Reports moves its folder, not removes it.** The
  shot folder is relocated to `SC[SCENE]/zzz_DELETED/[SHOT]/`, created lazily
  the first time a shot is deleted in that scene, so nothing an artist already
  dropped in there is lost. The `zzz_` prefix keeps it sorted to the bottom of
  the scene folder's listing, after every real shot code.
- **Deleting a scene works the same way, one level up.** The whole
  `SC[SCENE]/` folder (every shot inside it, untouched) relocates to
  `[SHOW]/zzz_DELETED_SCENES/SC[SCENE]/`, created lazily the first time a
  scene is deleted in the project. A scene can be deleted whether or not it
  still has shots in it — deleting a populated scene removes all of its
  shots from tracking too, not just the scene record.
- **Every task's `render/` folder** (e.g. `02_tasks/01_comp/render/`) holds
  versioned submitted output following the naming convention below,
  organized into per-version subfolders (`v001/`, `v002/`) to prevent frame
  collisions between versions. Artists uploading through Upload Shot land
  here automatically, regardless of task type.
- **Shots created before this task-folder scheme existed keep their old
  layout** (`00_plates/01_reference/02_roto_matte/03_ai_gen/04_comp/05_review/`)
  — nothing migrates it automatically. Only shots whose folders are created
  from here on use `02_tasks/`.

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

## Per-Shot Metadata Schema (`[SHOT]_shot.json`)

Mirrors the columns used in shot-tracking spreadsheets so the two can be kept
in sync (manually or scripted). Description is split into two fields: what
the script or client actually specifies, and the supervisor's internal read
on what the shot needs.

```json
{
  "show": "GOTP",
  "scene": "009",
  "shot": "D",
  "unit_location": "Water Unit A - Lake Superior",
  "time_of_day": "Day",
  "scriptDescription": "Through windshield of Emma and Sam, storm visible in reflection",
  "internalDescription": "Comp storm clouds into windshield reflection; needs clean plate for the glass",
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
   should match what post/DI and vendors use). This is also the project's
   root folder name.
2. For each scene in the shot list, create `SC[SCENE]/` — do this as soon as
   the scene is known, ahead of having any shots to put in it.
3. For each shot/sub-shot, create the shot folder with `00_plates/`,
   `01_reference/`, `02_tasks/` (empty), and `03_review/`. Add a `02_tasks/`
   subfolder for each task type once that assignment is actually pushed to
   artists (see the task-folder table above) — not just because it exists
   on the shot tracker.
4. Populate the per-shot JSON from the shot tracker.

See the `vfx-shot-folder-structure` skill for a script that automates steps
2–4 from a JSON shot list.
