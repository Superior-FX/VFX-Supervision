// Footage Ingest: turns a picked folder / set of files into ingestable
// sources, and matches each one to a shot by its name.
import { isProxyableFrame } from "./ffmpeg.js";
import { groupSequenceFiles } from "./sequenceGrouping.js";

const VIDEO_EXTS = [".mov", ".mp4", ".mxf", ".avi", ".m4v"];
// How deep a picked folder is searched — enough for e.g.
// footage/SC002/GOTP_002_010/frames, without wandering a whole drive.
const MAX_DEPTH = 4;

export function isVideoFile(name) {
  const lower = name.toLowerCase();
  return VIDEO_EXTS.some((ext) => lower.endsWith(ext));
}

// "-", ".", spaces etc. all count as "_" so 002-010 and 002.010 still match 002_010.
function normalize(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

// The shot whose code appears in `name`. A code only counts when it isn't
// glued to more digits on either side — so "GOTP_SC002_010_plate" matches
// 002_010, but "002_0100" doesn't. Longest code wins (002_010_a beats
// 002_010); two different codes tied for longest is ambiguous -> null.
export function matchShot(names, shots) {
  const haystacks = names.filter(Boolean).map(normalize);
  let best = [];
  let bestLen = 0;
  for (const shot of shots) {
    const code = normalize(shot.shotCode ?? "").replace(/^_+|_+$/g, "");
    if (!code) continue;
    const found = haystacks.some((h) => {
      let i = h.indexOf(code);
      while (i !== -1) {
        const before = h[i - 1];
        const after = h[i + code.length];
        if (!/[0-9]/.test(before ?? "") && !/[0-9]/.test(after ?? "")) return true;
        i = h.indexOf(code, i + 1);
      }
      return false;
    });
    if (!found) continue;
    if (code.length > bestLen) {
      best = [shot];
      bestLen = code.length;
    } else if (code.length === bestLen) {
      best.push(shot);
    }
  }
  return best.length === 1 ? { shot: best[0], ambiguous: [] } : { shot: null, ambiguous: best };
}

// Videos picked as individual files -> sources.
export function sourcesFromFiles(files) {
  return files.filter((f) => isVideoFile(f.name)).map((file) => videoSource(file, []));
}

function videoSource(file, folderNames) {
  return {
    id: crypto.randomUUID(),
    kind: "video",
    name: file.name,
    file,
    matchNames: [file.name, ...folderNames],
    size: file.size,
  };
}

// Walks a picked folder: every video becomes its own source, and every
// numbered image sequence becomes one source. A folder holding just one
// sequence is named after the folder (that's usually the shot's name);
// otherwise after the sequence's own base name.
export async function sourcesFromFolder(dirHandle) {
  const sources = [];
  await walk(dirHandle, [], 0, sources);
  return sources;
}

async function walk(dirHandle, parents, depth, sources) {
  const files = [];
  const subdirs = [];
  for await (const [, handle] of dirHandle.entries()) {
    if (handle.kind === "file") files.push(await handle.getFile());
    else subdirs.push(handle);
  }
  const folderNames = [dirHandle.name, ...parents];

  for (const f of files) if (isVideoFile(f.name)) sources.push(videoSource(f, folderNames));

  const sequences = groupSequenceFiles(files.filter((f) => !isVideoFile(f.name))).filter(
    (g) => g.kind === "sequence" && isProxyableFrame(g.files[0])
  );
  for (const g of sequences) {
    const baseName = g.name.replace(/\.[^.]+$/, "");
    sources.push({
      id: crypto.randomUUID(),
      kind: "sequence",
      name: sequences.length === 1 ? dirHandle.name : baseName,
      files: g.files,
      frames: g.files.length,
      matchNames: [baseName, ...folderNames],
      size: g.files.reduce((n, f) => n + f.size, 0),
    });
  }

  if (depth >= MAX_DEPTH) return;
  for (const sub of subdirs) {
    // Skip the app's own housekeeping folders if someone points at a show folder.
    if (/^(zzz_deleted|deleted|03_review|\.)/i.test(sub.name)) continue;
    await walk(sub, folderNames, depth + 1, sources);
  }
}

export function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
}
