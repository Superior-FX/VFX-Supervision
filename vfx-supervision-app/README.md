# VFX Supervision App

Desktop reference and checklist companion for VFX supervisors. Independent
of `../element-library` — no shared code or data between the two projects.

## Areas

- **Tools** — placeholder for future utilities (see `tools/README.md` for
  candidates). Not built out yet.
- **References** — browsable markdown reference library (`references/`):
  colorspace/ACES/OCIO, pre-production, on-set supervision, DIT workflow,
  post budgeting, editorial & deliveries, codecs, Nuke/After Effects/ComfyUI
  workflows, CGI pipeline, camera tracking, lens distortion, camera & lens
  specs, FFmpeg (core concepts, conversion, filters, trimming/merging,
  audio), DIY motion-capture (overview, IMU hardware, firmware/sensor
  fusion, optical mocap, suit fabrication), streamer deliverable specs
  (Netflix-style IMF), VFX shot-type taxonomy, camera department
  reference, and client intake checklist.
- **Checklists** — checkable pre-production / production / post-production
  checklists (`checklists/*.json`). Checked state is saved locally to
  `checklists/.state.json` (gitignored — per-machine progress, not shared).

## Requirements

- Python 3.9+
- `pip install -r requirements.txt` (installs PySide6)

## Run

```
python main.py
```

## Adding content

- Drop a new `.md` file into `references/` and it shows up in the
  References list automatically (its `# Title` heading is used as the
  display name).
- Add a new checklist by adding a JSON file (same `{title, sections: [{title,
  items: [{id, label}]}]}` shape as the existing ones) and registering it in
  `CHECKLIST_FILES` in `main.py`.
