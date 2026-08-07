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
