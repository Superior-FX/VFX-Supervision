# Shared hooks

Git hooks in this directory are shared via the repo (normal `.git/hooks/`
isn't tracked by git, so hooks meant for everyone live here instead and git
is pointed at this folder via `core.hooksPath`).

## Setup

Automatic: running `npm install` inside `vfx-supervision-app/` runs the
`prepare` script, which points this repo's git at `.githooks/`.

Manual fallback, if that didn't happen for some reason — run from the repo
root:

```
git config core.hooksPath .githooks
```

## What's here

- **`post-commit`** — after every commit, logs it to `SHARED_STATE.md` at
  the repo root (who, which machine, commit hash + message).
- **`log-commit.js`** — does the actual logging; called by `post-commit`.
- **`dev-identity.json`** — maps a machine's hostname to a developer's name.
  **Add your own machine here** the first time you set this up: find your
  hostname (`hostname` in a terminal) and add a line, e.g.:
  ```json
  { "Atom-Smasher": "Will Cox", "YOUR-HOSTNAME": "Your Name" }
  ```
  A machine that isn't listed still gets logged, just under its raw
  hostname instead of a name — nothing breaks, it just won't have your name
  on it until you add the entry.
- **`setup.js`** — run once via `npm install`'s `prepare` script; points
  git at this directory.
