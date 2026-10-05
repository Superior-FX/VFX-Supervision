// Real ffmpeg, running client-side via WebAssembly (single-threaded core —
// avoids needing cross-origin-isolation headers, which would otherwise risk
// breaking the Google Fonts <link> tags in index.html).
const CORE_BASE_URL = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm";

let ffmpegPromise = null;
// Core downloaded once per page load — instances get recycled (see
// resetFFmpeg), and re-fetching the ~30MB wasm each time would be slow.
let coreUrlsPromise = null;

function getCoreUrls() {
  if (!coreUrlsPromise) {
    coreUrlsPromise = (async () => {
      const { toBlobURL } = await import("@ffmpeg/util");
      return {
        coreURL: await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.wasm`, "application/wasm"),
      };
    })();
    coreUrlsPromise.catch(() => {
      coreUrlsPromise = null;
    });
  }
  return coreUrlsPromise;
}

async function getFFmpeg() {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const ffmpeg = new FFmpeg();
      await ffmpeg.load(await getCoreUrls());
      return ffmpeg;
    })();
    ffmpegPromise.catch(() => {
      ffmpegPromise = null;
    });
  }
  return ffmpegPromise;
}

// Throws away the current instance (and all its in-memory files) so the
// next getFFmpeg() starts on a fresh heap. Needed after a crash — a wasm
// instance that hit "memory access out of bounds" stays broken, so every
// later call would fail the same way — and periodically during long
// sequences so memory can't build up.
async function resetFFmpeg() {
  const current = ffmpegPromise;
  ffmpegPromise = null;
  if (!current) return;
  try {
    (await current).terminate();
  } catch {
    // already dead — nothing to clean up
  }
}

function isWasmCrash(err) {
  const msg = String(err?.message ?? err);
  return /memory access out of bounds|out of memory|RuntimeError|unreachable|Aborted/i.test(msg);
}

function bytesToDataUrl(bytes, mime) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return `data:${mime};base64,${btoa(binary)}`;
}

function extensionOf(file) {
  const parts = file.name.split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "mp4";
}

// Returns a data: URL (persists in localStorage, unlike blob: URLs which die on reload).
export async function generateThumbnail(file, { onProgress } = {}) {
  if (file.type.startsWith("image/")) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    return bytesToDataUrl(bytes, file.type || "image/jpeg");
  }

  onProgress?.("Loading ffmpeg…");
  const { fetchFile } = await import("@ffmpeg/util");
  const ffmpeg = await getFFmpeg();

  const inputName = `input.${extensionOf(file)}`;
  const outputName = "thumb.jpg";

  await ffmpeg.writeFile(inputName, await fetchFile(file));

  onProgress?.("Extracting frame…");
  await ffmpeg.exec(["-i", inputName, "-ss", "00:00:00", "-frames:v", "1", "-vf", "scale=320:-1", outputName]);

  const data = await ffmpeg.readFile(outputName);
  await ffmpeg.deleteFile(inputName).catch(() => {});
  await ffmpeg.deleteFile(outputName).catch(() => {});

  return bytesToDataUrl(data, "image/jpeg");
}

// Runs an ffmpeg command, reporting its 0..1 progress to onFraction as it
// goes. ffmpeg.wasm's own estimate occasionally jumps outside 0..1 (or is
// NaN when it can't tell the input's duration), so those are dropped.
async function execWithProgress(ffmpeg, args, onFraction) {
  const handler = ({ progress }) => {
    if (Number.isFinite(progress) && progress >= 0 && progress <= 1) onFraction?.(progress);
  };
  ffmpeg.on("progress", handler);
  try {
    return await ffmpeg.exec(args);
  } finally {
    ffmpeg.off("progress", handler);
  }
}

// onProgress(stage, fraction) — fraction is 0..1, or null while a stage's
// length is unknown (shown as an indeterminate bar).

// Transcodes an uploaded video down to a small, universally-playable h.264
// mp4 for supervisor review — 1280px wide (height kept even, required by
// libx264 4:2:0), 24fps, CRF 23. Returns a Blob (never a data: URL — a
// review proxy easily runs tens of MB, far past what localStorage can
// hold, so it's written straight to disk by the caller instead).
export async function generateReviewProxy(file, opts = {}) {
  try {
    return await transcodeReviewProxy(file, opts);
  } catch (err) {
    // A crashed instance stays broken — drop it so the next upload works.
    if (isWasmCrash(err)) {
      await resetFFmpeg();
      throw new Error(`ffmpeg ran out of memory transcoding this video — it may be too large for the in-browser encoder (${err.message})`);
    }
    throw err;
  }
}

async function transcodeReviewProxy(file, { onProgress } = {}) {
  onProgress?.("Loading ffmpeg…");
  const { fetchFile } = await import("@ffmpeg/util");
  const ffmpeg = await getFFmpeg();

  const inputName = `input.${extensionOf(file)}`;
  const outputName = "proxy.mp4";

  await ffmpeg.writeFile(inputName, await fetchFile(file));

  onProgress?.("Encoding review proxy…", 0);
  await execWithProgress(ffmpeg, [
    "-i", inputName,
    "-vf", "scale=1280:-2",
    "-r", "24",
    "-c:v", "libx264",
    "-crf", "23",
    "-preset", "veryfast",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-movflags", "+faststart",
    outputName,
  ], (f) => onProgress?.("Encoding review proxy…", f));

  const data = await ffmpeg.readFile(outputName);
  await ffmpeg.deleteFile(inputName).catch(() => {});
  await ffmpeg.deleteFile(outputName).catch(() => {});

  return new Blob([data.buffer], { type: "video/mp4" });
}

// Still-image formats a frame sequence can be proxied from.
const SEQUENCE_FRAME_EXTS = new Set(["exr", "dpx", "png", "jpg", "jpeg", "tif", "tiff", "tga"]);

export function isProxyableFrame(file) {
  return SEQUENCE_FRAME_EXTS.has(extensionOf(file));
}

// Builds the same 1280px / 24fps / h.264 review proxy as generateReviewProxy,
// but from an image sequence. Nothing intermediate ever touches disk: each
// frame is downscaled to a small JPEG inside ffmpeg's in-memory FS and
// pulled straight back out into JS memory (the full-res source is dropped
// immediately), then all the JPEGs are encoded together and discarded.
// Renumbering to 1..N on the way also makes gaps/odd start frames a non-issue.
//
// ffmpeg.wasm's heap is small and doesn't give memory back, so the instance
// is recycled every RECYCLE_EVERY_FRAMES frames, and a frame that crashes it
// ("memory access out of bounds") is retried once on a fresh instance.
const RECYCLE_EVERY_FRAMES = 40;

async function frameToJpeg(ffmpeg, frame, fetchFile) {
  const ext = extensionOf(frame);
  const inputName = `frame_in.${ext}`;
  const jpgName = "frame_out.jpg";
  try {
    await ffmpeg.writeFile(inputName, await fetchFile(frame));
    // EXR is scene-linear; without a transfer curve it plays back far too dark.
    const decodeOpts = ext === "exr" ? ["-apply_trc", "iec61966_2_1"] : [];
    const code = await ffmpeg.exec([...decodeOpts, "-i", inputName, "-vf", "scale=1280:-2", "-q:v", "3", jpgName]);
    if (code !== 0) throw new Error(`ffmpeg couldn't decode ${frame.name}`);
    return await ffmpeg.readFile(jpgName);
  } finally {
    await ffmpeg.deleteFile(inputName).catch(() => {});
    await ffmpeg.deleteFile(jpgName).catch(() => {});
  }
}

export async function generateSequenceReviewProxy(frames, { onProgress, fps = 24 } = {}) {
  onProgress?.("Loading ffmpeg…");
  const { fetchFile } = await import("@ffmpeg/util");
  // Start clean — an earlier run may have left this instance's heap full.
  await resetFFmpeg();
  let ffmpeg = await getFFmpeg();

  const sorted = [...frames].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const jpegs = [];

  try {
    for (let i = 0; i < sorted.length; i++) {
      onProgress?.(`Building review proxy… frame ${i + 1}/${sorted.length}`, i / sorted.length);
      if (i > 0 && i % RECYCLE_EVERY_FRAMES === 0) {
        await resetFFmpeg();
        ffmpeg = await getFFmpeg();
      }
      try {
        jpegs.push(await frameToJpeg(ffmpeg, sorted[i], fetchFile));
      } catch (err) {
        if (!isWasmCrash(err)) throw err;
        await resetFFmpeg();
        ffmpeg = await getFFmpeg();
        try {
          jpegs.push(await frameToJpeg(ffmpeg, sorted[i], fetchFile));
        } catch (retryErr) {
          if (!isWasmCrash(retryErr)) throw retryErr;
          throw new Error(
            `ffmpeg ran out of memory decoding ${sorted[i].name} even on a fresh start — that frame is too large ` +
              `for the in-browser decoder (very high resolution, or a multi-layer EXR).`
          );
        }
      }
    }

    // Fresh instance for the encode, holding only the small JPEGs.
    onProgress?.("Encoding review proxy…", 0);
    await resetFFmpeg();
    ffmpeg = await getFFmpeg();
    for (let i = 0; i < jpegs.length; i++) {
      await ffmpeg.writeFile(`frame_${String(i + 1).padStart(5, "0")}.jpg`, jpegs[i]);
    }
    jpegs.length = 0;
    const code = await execWithProgress(ffmpeg, [
      "-framerate", String(fps),
      "-i", "frame_%05d.jpg",
      "-c:v", "libx264",
      "-crf", "23",
      "-preset", "veryfast",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      "proxy.mp4",
    ], (f) => onProgress?.("Encoding review proxy…", f));
    if (code !== 0) throw new Error("ffmpeg couldn't encode the review proxy");

    const data = await ffmpeg.readFile("proxy.mp4");
    return new Blob([data.buffer], { type: "video/mp4" });
  } catch (err) {
    if (isWasmCrash(err)) throw new Error(`ffmpeg ran out of memory building the review proxy (${err.message})`);
    throw err;
  } finally {
    // Drops every in-memory frame and the encoded mp4 in one go, and leaves
    // a clean instance for whatever runs next.
    await resetFFmpeg();
  }
}

// ---------------------------------------------------------------------------
// HQ (4K) and UHQ (6K/8K) review renders — made only when a supervisor asks
// for one in Review & Dailies, never at upload. Same frame timing as the
// normal proxy (24fps, frame i of the proxy == frame i here) so annotations
// and frame numbers line up across all three.
//
// Every intermediate frame is a PNG, never a JPEG: this ffmpeg.wasm build's
// mjpeg encoder is unreliable on big frames — at -q:v 2 it crashes ("memory
// access out of bounds") even at 2048px, and at -q:v 3 it HANGS forever on
// some frames (VFX_009A025.exr, a 4096×2160 PIZ EXR). PNG went through every
// frame of that sequence. The 6K/8K stills are still saved as JPEG, but made
// by the browser's own encoder from the PNG.
//
// Verified 2026-10-05 under Node with the same core, on that 25-frame
// 4096×2160 sequence: 25/25 frames, exactly 24fps, 3840×2026, 4.7MB,
// ~90s, peak heap ~430MB.
// ---------------------------------------------------------------------------

// The HQ proxy is capped at 4K UHD width; smaller sources stay native.
export const HQ_MAX_WIDTH = 3840;
const HQ_SCALE = `scale='min(iw,${HQ_MAX_WIDTH})':-2`;
// Big frames fill ffmpeg.wasm's heap fast, so instances are recycled far
// more often than for the 1280 proxy.
const HQ_RECYCLE_EVERY_FRAMES = 4;
const UHQ_RECYCLE_EVERY_FRAMES = 2;
// The HQ sequence is encoded in short chunks (4K PNGs are ~7MB each) and the
// chunks joined at the end, so a long shot never sits in the heap at once.
const HQ_SEGMENT_FRAMES = 8;
// Watchdog limits. A wedged ffmpeg call never returns on its own, so past
// these the instance is killed and the render fails with a clear message
// instead of sitting at "frame 25/25" forever.
const FRAME_TIMEOUT_MS = 120_000;
const SEGMENT_TIMEOUT_MS = 600_000;
const JOIN_TIMEOUT_MS = 180_000;
const VIDEO_HQ_TIMEOUT_MS = 60 * 60_000;

class FFmpegTimeoutError extends Error {}

// ffmpeg.exec with a hard time limit: on expiry the instance is terminated
// (which also rejects the stuck exec) and a timeout error is thrown.
async function execGuarded(ffmpeg, args, timeoutMs, what) {
  let timer;
  const watchdog = new Promise((_, reject) => {
    timer = setTimeout(async () => {
      await resetFFmpeg();
      reject(new FFmpegTimeoutError(`ffmpeg stopped responding while ${what} — it was stopped after ${Math.round(timeoutMs / 1000)}s.`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([ffmpeg.exec(args), watchdog]);
  } finally {
    clearTimeout(timer);
  }
}

function decodeOptsFor(file) {
  // EXR is scene-linear; without a transfer curve it plays back far too dark.
  return extensionOf(file) === "exr" ? ["-apply_trc", "iec61966_2_1"] : [];
}

// One still frame → 8-bit RGB PNG bytes, optionally scaled.
async function frameToPng(ffmpeg, frame, fetchFile, vf) {
  const inputName = `frame_in.${extensionOf(frame)}`;
  const outName = "frame_out.png";
  try {
    await ffmpeg.writeFile(inputName, await fetchFile(frame));
    const args = [...decodeOptsFor(frame), "-i", inputName];
    if (vf) args.push("-vf", vf);
    args.push("-pix_fmt", "rgb24", "-update", "1", outName);
    const code = await execGuarded(ffmpeg, args, FRAME_TIMEOUT_MS, `converting ${frame.name}`);
    if (code !== 0) throw new Error(`ffmpeg couldn't decode ${frame.name}`);
    return await ffmpeg.readFile(outName);
  } finally {
    await ffmpeg.deleteFile(inputName).catch(() => {});
    await ffmpeg.deleteFile(outName).catch(() => {});
  }
}

// Decodes sorted frames[i] for each i in `indices` to PNG, recycling the
// instance every `recycleEvery` frames and retrying a crashed frame once on
// a fresh one. Calls onPng(i, bytes) per frame; nothing is kept here.
async function decodeFramesToPngs(frames, indices, { vf, recycleEvery, onPng, onProgress, label }) {
  const { fetchFile } = await import("@ffmpeg/util");
  await resetFFmpeg();
  let ffmpeg = await getFFmpeg();
  for (let n = 0; n < indices.length; n++) {
    const i = indices[n];
    onProgress?.(`${label} frame ${n + 1}/${indices.length}`, n / indices.length);
    if (n > 0 && n % recycleEvery === 0) {
      await resetFFmpeg();
      ffmpeg = await getFFmpeg();
    }
    let bytes;
    try {
      bytes = await frameToPng(ffmpeg, frames[i], fetchFile, vf);
    } catch (err) {
      if (!isWasmCrash(err)) throw err;
      await resetFFmpeg();
      ffmpeg = await getFFmpeg();
      try {
        bytes = await frameToPng(ffmpeg, frames[i], fetchFile, vf);
      } catch (retryErr) {
        if (!isWasmCrash(retryErr)) throw retryErr;
        throw new Error(`ffmpeg ran out of memory decoding ${frames[i].name} — that frame is too large for the in-browser decoder.`);
      }
    }
    await onPng(i, bytes);
    // onPng may have swapped instances (segment encodes do) — use the current one.
    ffmpeg = await getFFmpeg();
  }
  await resetFFmpeg();
}

function sortFrames(frames) {
  return [...frames].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

// PNG bytes → JPEG Blob via the browser's own encoder (not ffmpeg's mjpeg).
async function pngToJpeg(pngBytes, quality = 0.95) {
  const bitmap = await createImageBitmap(new Blob([pngBytes.buffer], { type: "image/png" }));
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    canvas.getContext("2d").drawImage(bitmap, 0, 0);
    return await canvas.convertToBlob({ type: "image/jpeg", quality });
  } finally {
    bitmap.close();
  }
}

// 4K-capped HQ proxy from a submitted video. CRF 18 (vs 23 for the proxy).
export async function generateHQVideoProxy(file, { onProgress } = {}) {
  onProgress?.("Loading ffmpeg…");
  const { fetchFile } = await import("@ffmpeg/util");
  await resetFFmpeg();
  const ffmpeg = await getFFmpeg();
  const handler = ({ progress }) => {
    if (Number.isFinite(progress) && progress >= 0 && progress <= 1) onProgress?.("Encoding HQ proxy…", progress);
  };
  try {
    const inputName = `input.${extensionOf(file)}`;
    await ffmpeg.writeFile(inputName, await fetchFile(file));
    onProgress?.("Encoding HQ proxy…", 0);
    ffmpeg.on("progress", handler);
    const code = await execGuarded(
      ffmpeg,
      [
        "-i", inputName,
        "-vf", HQ_SCALE,
        "-r", "24",
        "-c:v", "libx264",
        "-crf", "18",
        "-preset", "veryfast",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-movflags", "+faststart",
        "hq.mp4",
      ],
      VIDEO_HQ_TIMEOUT_MS,
      "encoding the HQ proxy"
    );
    if (code !== 0) throw new Error("ffmpeg couldn't encode the HQ proxy");
    const data = await ffmpeg.readFile("hq.mp4");
    return new Blob([data.buffer], { type: "video/mp4" });
  } catch (err) {
    if (isWasmCrash(err)) {
      throw new Error(`ffmpeg ran out of memory making the HQ proxy — the source may be too large for the in-browser encoder (${err.message})`);
    }
    throw err;
  } finally {
    ffmpeg.off("progress", handler);
    await resetFFmpeg();
  }
}

// One chunk of PNGs → a raw H.264 stream. No B-frames: raw streams joined
// end to end lose B-frames at the seams (25 frames came back as 23).
async function encodePngSegment(pngs, fps) {
  await resetFFmpeg();
  const ffmpeg = await getFFmpeg();
  try {
    for (let i = 0; i < pngs.length; i++) {
      await ffmpeg.writeFile(`seg_${String(i + 1).padStart(5, "0")}.png`, pngs[i]);
    }
    const code = await execGuarded(
      ffmpeg,
      [
        "-framerate", String(fps),
        "-i", "seg_%05d.png",
        "-c:v", "libx264",
        "-crf", "18",
        "-preset", "veryfast",
        "-bf", "0",
        "-pix_fmt", "yuv420p",
        "-f", "h264",
        "segment.h264",
      ],
      SEGMENT_TIMEOUT_MS,
      "encoding an HQ segment"
    );
    if (code !== 0) throw new Error("ffmpeg couldn't encode an HQ proxy segment");
    return await ffmpeg.readFile("segment.h264");
  } finally {
    await resetFFmpeg();
  }
}

// 4K-capped HQ proxy from a submitted image sequence: PNG frames, encoded in
// short raw-H.264 chunks, joined byte for byte and wrapped as a 24fps mp4.
// (Joining mp4 chunks with the concat demuxer instead left the timestamps
// uneven — it reported ~22fps, which would throw frame numbers off.)
export async function generateHQSequenceProxy(frames, { onProgress, fps = 24 } = {}) {
  const sorted = sortFrames(frames);
  const segments = [];
  let pending = [];
  try {
    await decodeFramesToPngs(sorted, sorted.map((_, i) => i), {
      vf: HQ_SCALE,
      recycleEvery: HQ_RECYCLE_EVERY_FRAMES,
      label: "Building HQ proxy…",
      onProgress,
      onPng: async (i, bytes) => {
        pending.push(bytes);
        if (pending.length === HQ_SEGMENT_FRAMES || i === sorted.length - 1) {
          onProgress?.(`Encoding HQ frames ${i + 2 - pending.length}–${i + 1}…`, (i + 1) / sorted.length);
          segments.push(await encodePngSegment(pending, fps));
          pending = [];
        }
      },
    });

    onProgress?.("Finishing HQ proxy…", 1);
    const joined = new Uint8Array(segments.reduce((n, s) => n + s.length, 0));
    let offset = 0;
    for (const seg of segments) {
      joined.set(seg, offset);
      offset += seg.length;
    }
    segments.length = 0;
    await resetFFmpeg();
    const ffmpeg = await getFFmpeg();
    await ffmpeg.writeFile("all.h264", joined);
    const code = await execGuarded(
      ffmpeg,
      ["-framerate", String(fps), "-i", "all.h264", "-c", "copy", "-movflags", "+faststart", "hq.mp4"],
      JOIN_TIMEOUT_MS,
      "joining the HQ proxy"
    );
    if (code !== 0) throw new Error("ffmpeg couldn't join the HQ proxy segments");
    const data = await ffmpeg.readFile("hq.mp4");
    return new Blob([data.buffer], { type: "video/mp4" });
  } catch (err) {
    if (isWasmCrash(err)) throw new Error(`ffmpeg ran out of memory building the HQ proxy (${err.message})`);
    throw err;
  } finally {
    await resetFFmpeg();
  }
}

// Full-resolution (6K/8K) JPEG stills for proxy frames start..end
// (0-based, inclusive). Each is handed to onFrame(index, Blob) as soon as
// it's made — the caller writes it to disk — so nothing piles up in memory.
// source: { kind: "seq", frames: File[] } | { kind: "vid", file: File }
export async function generateFullResFrames(source, { start, end, onFrame, onProgress }) {
  const count = end - start + 1;
  if (source.kind === "seq") {
    const sorted = sortFrames(source.frames);
    if (end >= sorted.length) throw new Error(`The source only has ${sorted.length} frames.`);
    const indices = Array.from({ length: count }, (_, n) => start + n);
    await decodeFramesToPngs(sorted, indices, {
      vf: null,
      recycleEvery: UHQ_RECYCLE_EVERY_FRAMES,
      label: "Rendering full-res",
      onProgress,
      onPng: async (i, bytes) => onFrame(i, await pngToJpeg(bytes)),
    });
    return;
  }

  // Video: written into ffmpeg once, then pulled one frame at a time by
  // timestamp (frame i sits at i/24s, matching the 24fps proxy). A wedged
  // instance is replaced and the video written into the new one.
  onProgress?.("Loading ffmpeg…");
  const { fetchFile } = await import("@ffmpeg/util");
  const inputName = `input.${extensionOf(source.file)}`;
  const inputBytes = await fetchFile(source.file);
  const freshInstance = async () => {
    await resetFFmpeg();
    const instance = await getFFmpeg();
    await instance.writeFile(inputName, inputBytes);
    return instance;
  };
  let ffmpeg = await freshInstance();
  try {
    for (let f = start; f <= end; f++) {
      onProgress?.(`Rendering full-res frame ${f - start + 1}/${count}`, (f - start) / count);
      const code = await execGuarded(
        ffmpeg,
        ["-ss", (f / 24).toFixed(5), "-i", inputName, "-vf", "fps=24", "-frames:v", "1", "-pix_fmt", "rgb24", "-update", "1", "uhq.png"],
        FRAME_TIMEOUT_MS,
        `extracting frame ${f + 1}`
      );
      if (code !== 0) throw new Error("ffmpeg couldn't extract full-res frames from the video");
      const bytes = await ffmpeg.readFile("uhq.png");
      await ffmpeg.deleteFile("uhq.png").catch(() => {});
      await onFrame(f, await pngToJpeg(bytes));
      if ((f - start + 1) % UHQ_RECYCLE_EVERY_FRAMES === 0 && f < end) ffmpeg = await freshInstance();
    }
  } catch (err) {
    if (isWasmCrash(err)) throw new Error(`ffmpeg ran out of memory rendering full-res frames (${err.message})`);
    throw err;
  } finally {
    await resetFFmpeg();
  }
}
