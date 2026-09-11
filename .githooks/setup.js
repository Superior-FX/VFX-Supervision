// One-time setup: points git at this repo's shared hooks directory so
// SHARED_STATE.md gets updated automatically on every commit. Runs via
// vfx-supervision-app's npm "prepare" script, so a plain `npm install` is
// enough — nothing manual required on either machine.
const { execSync } = require("child_process");
const path = require("path");

try {
  const repoRoot = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
  // Forward slashes read reliably across platforms in git config values,
  // even on Windows where path.join gives back backslashes.
  const hooksPath = path.join(repoRoot, ".githooks").replace(/\\/g, "/");
  execSync(`git config core.hooksPath "${hooksPath}"`);
  console.log(`Git hooks path set to ${hooksPath}`);
} catch (err) {
  console.warn("Couldn't configure git hooks path (not a git repo?):", err.message);
}
