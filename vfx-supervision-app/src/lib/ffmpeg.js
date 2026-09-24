// Real ffmpeg, running client-side via WebAssembly (single-threaded core —
// avoids needing cross-origin-isolation headers, which would otherwise risk
// breaking the Google Fonts <link> tags in index.html).
const CORE_BASE_URL = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm";

let ffmpegPromise = null;

async function getFFmpeg() {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const { toBlobURL } = await import("@ffmpeg/util");
      const ffmpeg = new FFmpeg();
      await ffmpeg.load({
        coreURL: await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.wasm`, "application/wasm"),
      });
      return ffmpeg;
    })();
  }
  return ffmpegPromise;
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

// Transcodes an uploaded video down to a small, universally-playable h.264
// mp4 for supervisor review — 1280px wide (height kept even, required by
// libx264 4:2:0), 24fps, CRF 23. Returns a Blob (never a data: URL — a
// review proxy easily runs tens of MB, far past what localStorage can
// hold, so it's written straight to disk by the caller instead).
export async function generateReviewProxy(file, { onProgress } = {}) {
  onProgress?.("Loading ffmpeg…");
  const { fetchFile } = await import("@ffmpeg/util");
  const ffmpeg = await getFFmpeg();

  const inputName = `input.${extensionOf(file)}`;
  const outputName = "proxy.mp4";

  await ffmpeg.writeFile(inputName, await fetchFile(file));

  onProgress?.("Encoding review proxy…");
  await ffmpeg.exec([
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
  ]);

  const data = await ffmpeg.readFile(outputName);
  await ffmpeg.deleteFile(inputName).catch(() => {});
  await ffmpeg.deleteFile(outputName).catch(() => {});

  return new Blob([data.buffer], { type: "video/mp4" });
}
