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
