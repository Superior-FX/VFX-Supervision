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
- 2026-09-11T02:14:40-05:00 — **Will Cox** (Atom-Smasher) — `dd21745` Log the SHARED_STATE hook's own commit
- 2026-09-13T01:03:31-05:00 — **Will Cox** (Atom-Smasher) — `1ac5059` Post Reports: shot collapse/expand, multi-artist tasks, folder fixes
- 2026-09-13T01:12:59-05:00 — **Will Cox** (Atom-Smasher) — `38016e4` Pin dev-server port and add full data export/import
- 2026-09-13T01:33:55-05:00 — **Will Cox** (Atom-Smasher) — `968a8cb` Real Superior-FX logo, Home nav link, folder-backed export/import
- 2026-09-13T02:58:05-05:00 — **Will Cox** (Atom-Smasher) — `ca006f1` Consistent shot sorting, Artist Report rework, Upload Shot rebuild, scene deletion, and push-triggered task folders
- 2026-09-13T03:38:16-05:00 — **Will Cox** (Atom-Smasher) — `5cb8e9a` Shot Board driven by live task status; Upload Shot dedup guard
- 2026-09-18T02:45:38-05:00 — **Will Cox** (Atom-Smasher) — `c0d2a96` Fix silent folder-disconnect no-op on scene/shot delete
- 2026-09-20T00:11:29-05:00 — **Will Cox** (Atom-Smasher) — `4f0e752` Add CSV export to Post Reports for Google Sheets
- 2026-09-20T01:00:13-05:00 — **Will Cox** (Atom-Smasher) — `3eaa67c` Switch Post Reports export to a real styled .xlsx
- 2026-09-20T01:36:30-05:00 — **Will Cox** (Atom-Smasher) — `0b8ef69` Add scene rename with automatic on-disk folder rename
