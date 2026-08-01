# VFX Supervision

This repo hosts two independent projects plus the Claude Code skill content
that powers VFX-supervision assistance in this workspace.

## Projects

- **[`element-library/`](element-library/README.md)** — standalone, portable
  toolkit for indexing, browsing, and auditing a VFX stock-element library
  (fire, smoke, sparks, blood, textures, etc.). Copy the folder to any
  machine to deploy it.
- **[`vfx-supervision-app/`](vfx-supervision-app/README.md)** — desktop app
  for VFX supervisors with Tools, References, and Checklists
  (pre-production / production / post-production) areas. Fully independent
  of `element-library/`.

## Claude Code skills

- `skills/` and `.claude/skills/vfx-supervisor/` — reference content that
  powers the `vfx-supervisor` Claude Code skill (colorspace, pre-production,
  on-set supervision, budgeting, DIT, editorial, codecs, Nuke/AE/ComfyUI,
  CGI, camera/lens). Also includes separate mocap/IMU and ffmpeg-cookbook
  skill bundles unrelated to VFX supervision.
- `.agents/skills/`, `.agent/skills/` — additional skill installs managed by
  the skill installer (`skills-lock.json`).

`vfx-supervision-app/references/` is a separate, human/UI-facing copy of the
relevant `skills/*.md` content for in-app display — it is not the source of
truth for the Claude skill itself.
