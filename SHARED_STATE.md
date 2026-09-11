# Shared State — Build Activity Log

Auto-generated, append-only log of commits made to this repo, attributed by
machine — see `.githooks/dev-identity.json` for the hostname → developer
map. Populated automatically by the `post-commit` git hook. Don't edit by
hand; if you need to add your own machine to the map, see
`.githooks/README.md`.

Setup is automatic: running `npm install` in `vfx-supervision-app/` points
git at the shared hooks directory. If that didn't happen for some reason,
run `git config core.hooksPath .githooks` from the repo root.

---
- 2026-09-10T22:31:39-05:00 — **Will Cox** (Atom-Smasher) — `b4f937a` Finish Enter-key support: convert ShotCard and ArtistDirectory
- 2026-09-11T01:53:58-05:00 — **Will Cox** (Atom-Smasher) — `5931cb4` Scene-first shot tracking, split shot description, DMP task, artist rename cascade
- 2026-09-11T01:54:28-05:00 — **Will Cox** (Atom-Smasher) — `e2a826a` Add SHARED_STATE.md build-activity log via a shared post-commit hook
