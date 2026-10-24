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
- 2026-09-24T01:57:12-05:00 — **Will Cox** (Atom-Smasher) — `4c6ca56` Wire up ffmpeg review-proxy pipeline and live Review & Dailies
- 2026-10-03T22:36:38-05:00 — **Will Cox** (Atom-Smasher) — `3d7b0ef` Upload Shot: versioning, sequence proxies, progress bar, undo on disk
- 2026-10-04T01:17:25-05:00 — **Will Cox** (Atom-Smasher) — `bb6f212` Upload Shot: version proxies only, vid/seq suffix, ffmpeg crash recovery
- 2026-10-04T01:24:41-05:00 — **Will Cox** (Atom-Smasher) — `182a236` Shared project-folder warning on Post Reports, Review, and Upload
- 2026-10-04T21:18:16-05:00 — **Will Cox** (Atom-Smasher) — `ae6338e` Review & Dailies: per-frame annotation tool with frame notes
- 2026-10-04T22:07:39-05:00 — **Will Cox** (Atom-Smasher) — `be93780` Review & Dailies: full screen, loop/speed, sort & filter queue
- 2026-10-04T22:32:22-05:00 — **Will Cox** (Atom-Smasher) — `a620e1e` Collapsible sidebar groups, lock pre-prod/production, VIEW buttons
- 2026-10-04T22:55:20-05:00 — **Will Cox** (Atom-Smasher) — `e6e14f6` Artist Portal: Shot Viewer replaces Shot Tracking in the sidebar
- 2026-10-05T01:05:51-05:00 — **Will Cox** (Atom-Smasher) — `8e736e3` Review: full-screen zoom/pan, supervisor HQ 4K proxy, 6K/8K stills
- 2026-10-05T16:05:02-05:00 — **Will Cox** (Atom-Smasher) — `f5c4edf` Company-wide Dashboard, plate import, version/plate viewing
- 2026-10-05T23:25:25-05:00 — **Will Cox** (Atom-Smasher) — `e92ec7a` SHARED_STATE: log 8e736e3 and f5c4edf
- 2026-10-09T23:31:47-05:00 — **Will Cox** (Atom-Smasher) — `aa2fca9` SHARED_STATE: log e92ec7a
- 2026-10-09T23:54:45-05:00 — **Will Cox** (Atom-Smasher) — `e970d02` Add ComfyUI LTX setup notes for remote use
- 2026-10-12T22:18:17-05:00 — **Will Cox** (Atom-Smasher) — `0475dbe` Footage Ingest tab, Home folder button, _proxy naming, remembered pickers
- 2026-10-12T22:29:51-05:00 — **Will Cox** (Atom-Smasher) — `2a5102a` Run ffmpeg jobs one at a time
- 2026-10-15T01:12:50-05:00 — **Will Cox** (Atom-Smasher) — `f65f7f5` Read videos from disk in ffmpeg so >2 GB plates work
- 2026-10-20T23:41:35-05:00 — **Will Cox** (Atom-Smasher) — `8d19b37` Supabase sign-in, roles and Team & Access page
- 2026-10-21T00:17:37-05:00 — **Will Cox** (Atom-Smasher) — `d3a8835` Comp Approved status: Comp Supervisor's Final flags for VFX Sup sign-off
- 2026-10-21T00:24:10-05:00 — **Will Cox** (Atom-Smasher) — `b20f1ac` Delete requests: non-Admin deletes wait for Admin approval
- 2026-10-21T01:15:55-05:00 — **Will Cox** (Atom-Smasher) — `fb10b39` Shared project data in Supabase with live updates
- 2026-10-21T01:42:38-05:00 — **Will Cox** (Atom-Smasher) — `17e2bbc` Prepare for hosting on Vercel at app.superior-fx.com
- 2026-10-21T02:16:56-05:00 — **Will Cox** (Atom-Smasher) — `37f61b7` Tab title "Sup-FX App"; go-live guide reflects who does what
- 2026-10-21T02:27:02-05:00 — **Will Cox** (Atom-Smasher) — `a101453` Say "still syncing from Google Drive" instead of "moved or deleted"
- 2026-10-21T02:56:11-05:00 — **Will Cox** (Atom-Smasher) — `a2e8cd8` SHARED_STATE: log e970d02 through a101453
- 2026-10-21T23:31:07-05:00 — **Will Cox** (Atom-Smasher) — `845f174` SHARED_STATE: log a2e8cd8
- 2026-10-21T23:35:40-05:00 — **Will Cox** (Atom-Smasher) — `1332633` Add Jon's setup steps for the Sup-FX App
- 2026-10-24T17:34:09-05:00 — **Will Cox** (Atom-Smasher) — `1aa3945` Only list artists approved for a task's type in the assign dropdown
