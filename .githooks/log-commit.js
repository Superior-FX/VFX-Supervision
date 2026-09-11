// Appends one entry to SHARED_STATE.md for the commit that was just made.
// Invoked by the post-commit hook — see .githooks/post-commit. A machine
// that isn't in dev-identity.json yet still gets logged, just under its
// raw hostname, so a missing map entry never blocks a commit.
//
// Never throws in a way that reaches git: a logging failure should look
// like nothing happened, not like the commit itself failed.
const { execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

function run(cmd) {
  return execSync(cmd, { encoding: "utf8" }).trim();
}

try {
  const repoRoot = run("git rev-parse --show-toplevel");
  const identityPath = path.join(repoRoot, ".githooks", "dev-identity.json");
  const statePath = path.join(repoRoot, "SHARED_STATE.md");

  const host = os.hostname();
  let name = host;
  try {
    const map = JSON.parse(fs.readFileSync(identityPath, "utf8"));
    if (map[host]) name = map[host];
  } catch {
    // No map file, or this hostname isn't listed yet — fall back to the
    // raw hostname rather than failing the whole hook.
  }

  const hash = run("git rev-parse --short HEAD");
  const message = run("git log -1 --pretty=%s");
  // The commit's own timestamp, not "now" — matters when this runs late
  // (e.g. a hook installed after some commits already exist).
  const timestamp = run("git log -1 --pretty=%cI");

  const line = `- ${timestamp} — **${name}** (${host}) — \`${hash}\` ${message}\n`;
  fs.appendFileSync(statePath, line);
} catch (err) {
  console.error("SHARED_STATE logging skipped:", err.message);
}
