// Naming + source lookup for the supervisor-made review renders:
//   HQ  — 4K-capped mp4:  03_review/<task>/<shot>_v003_vid_proxyHQ.mp4
//   UHQ — full-res (6K/8K) JPEG stills, one folder per render:
//         03_review/<task>/<shot>_v003_vid_proxyUHQ_f0042/            (single frame)
//         03_review/<task>/<shot>_v003_vid_proxyUHQ_f0040-0050/       (range)
//         03_review/<task>/<shot>_v003_vid_proxyUHQ_full/             (whole shot)
//         each holding <shot>_v003_UHQ.0042.jpg …
//
// Task fields (all keyed by version, so a new submission starts clean):
//   task.sourceFiles[version] = { kind: "vid" | "seq", names: [...] }  — recorded at upload
//   task.hqProxies[version]   = "<HQ file name>"
//   task.uhqRenders           = [{ id, version, folder, start, end, full, createdAt }]
//
// Frame numbers are 0-based internally (frame i of the 24fps proxy) and
// shown 1-based, same as the player.
import { formatVersion } from "./fsAccess.js";
import { isProxyableFrame } from "./ffmpeg.js";
import { groupSequenceFiles } from "./sequenceGrouping.js";

const pad4 = (frame) => String(frame + 1).padStart(4, "0");

// "vid" / "seq" from a normal proxy's file name; null for old unsuffixed ones.
export function proxyKind(reviewFile) {
  const match = reviewFile?.match(/_(vid|seq)_proxy\.mp4$/i);
  return match ? match[1].toLowerCase() : null;
}

export function hqProxyName(shotCode, version, kind) {
  return `${shotCode}_${formatVersion(version)}_${kind ?? "vid"}_proxyHQ.mp4`;
}

export function uhqFolderName(shotCode, version, kind, { start, end, full }) {
  const base = `${shotCode}_${formatVersion(version)}_${kind ?? "vid"}_proxyUHQ`;
  if (full) return `${base}_full`;
  return start === end ? `${base}_f${pad4(start)}` : `${base}_f${pad4(start)}-${pad4(end)}`;
}

export function uhqFrameName(shotCode, version, frame) {
  return `${shotCode}_${formatVersion(version)}_UHQ.${pad4(frame)}.jpg`;
}

export function uhqLabel(render) {
  if (render.full) return "Full range";
  return render.start === render.end ? `F ${pad4(render.start)}` : `F ${pad4(render.start)}–${pad4(render.end)}`;
}

const VIDEO_EXTS = new Set(["mp4", "mov", "mxf", "avi", "mkv", "m4v", "webm"]);
const isVideo = (file) => VIDEO_EXTS.has(file.name.split(".").pop().toLowerCase());

// Every file under dir (render/ can hold a sequence in a subfolder when it
// was rendered straight there), a couple of levels deep.
async function listFiles(dir, depth = 2) {
  const files = [];
  for await (const [, handle] of dir.entries()) {
    if (handle.kind === "file") files.push(await handle.getFile());
    else if (depth > 0) files.push(...(await listFiles(handle, depth - 1)));
  }
  return files;
}

// Finds the full-res render a task's current version was submitted as.
// Uses the names recorded at upload when there are any; older submissions
// fall back to the newest video (vid) or the longest image sequence (seq)
// in render/. Returns { kind, label, file } | { kind, label, frames } or
// throws with a readable reason.
export async function findTaskSource(renderDir, task) {
  const all = await listFiles(renderDir);
  const recorded = task.sourceFiles?.[task.version];
  let kind = proxyKind(task.reviewFile) ?? recorded?.kind ?? null;

  if (recorded?.names?.length) {
    const wanted = new Set(recorded.names);
    const seen = new Set();
    const matches = all.filter((f) => wanted.has(f.name) && !seen.has(f.name) && seen.add(f.name));
    if (matches.length) {
      if (recorded.kind === "vid") return { kind: "vid", label: matches[0].name, file: matches[0] };
      return { kind: "seq", label: sequenceLabel(matches), frames: matches };
    }
  }

  const videos = all.filter(isVideo).sort((a, b) => b.lastModified - a.lastModified);
  const sequences = groupSequenceFiles(all.filter(isProxyableFrame))
    .filter((g) => g.kind === "sequence")
    .sort((a, b) => b.files.length - a.files.length);
  if (!kind) kind = videos.length ? "vid" : "seq";

  if (kind === "vid" && videos.length) return { kind: "vid", label: videos[0].name, file: videos[0] };
  if (kind === "seq" && sequences.length) {
    return { kind: "seq", label: sequenceLabel(sequences[0].files, sequences[0].name), frames: sequences[0].files };
  }
  throw new Error(
    kind === "vid"
      ? "No submitted video was found in this task's render folder."
      : "No submitted image sequence was found in this task's render folder."
  );
}

function sequenceLabel(frames, name) {
  return `${name ?? frames[0].name} (${frames.length} frames)`;
}

// The folder a UHQ render lives in, created on demand.
export async function uhqFolder(reviewDir, render, { create = false } = {}) {
  return reviewDir.getDirectoryHandle(render.folder, { create });
}
