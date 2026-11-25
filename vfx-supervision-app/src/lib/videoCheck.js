// Catches an unfinished QuickTime/MP4 render before it's uploaded.
//
// A .mov/.mp4 is a run of "atoms": the frames go in `mdat`, and the index
// that says where each frame is goes in `moov`. Nuke / After Effects /
// Resolve write the moov last, when the render finishes cleanly — so a
// render that crashed, was cancelled, or was grabbed while still writing
// has frames but no moov, and nothing can play it (ffmpeg says "moov atom
// not found"). This walks the atom headers only (16 bytes each), so it's
// quick even on a multi-GB file.

const QUICKTIME_EXTS = new Set(["mov", "mp4", "m4v", "qt"]);
const MAX_ATOMS = 10000;

async function readBytes(file, start, length) {
  return new DataView(await file.slice(start, start + length).arrayBuffer());
}

// Returns null if the file looks complete (or isn't a QuickTime/MP4 file),
// otherwise a sentence saying what's wrong.
export async function findUnfinishedVideo(file) {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!QUICKTIME_EXTS.has(ext)) return null;

  const unfinished = (why) =>
    `${file.name} looks unfinished (${why}), so it can't be played or proxied. The render was probably interrupted or the file was picked while it was still being written. Re-render or re-export it, let it finish, then upload again.`;

  if (file.size < 8) return unfinished("the file is empty");

  let offset = 0;
  let sawMoov = false;
  for (let i = 0; i < MAX_ATOMS && offset + 8 <= file.size; i++) {
    const head = await readBytes(file, offset, 16);
    let size = head.getUint32(0);
    const type = String.fromCharCode(head.getUint8(4), head.getUint8(5), head.getUint8(6), head.getUint8(7));
    if (type === "moov") sawMoov = true;

    if (size === 1) {
      // 64-bit size follows the type.
      if (head.byteLength < 16) return unfinished("it ends partway through a header");
      size = Number(head.getBigUint64(8));
    } else if (size === 0) {
      // This atom runs to the end of the file — it's the last one.
      size = file.size - offset;
    }

    if (size < 8) {
      // Not a sane atom header — not something we can judge, so don't block.
      return null;
    }
    if (offset + size > file.size) {
      // A section that runs past the end of the file means it was cut short.
      return unfinished("it stops partway through, so the end is missing");
    }
    offset += size;
  }

  return sawMoov ? null : unfinished("it has no index (\"moov atom\")");
}
