import { generateReviewProxy, generateSequenceReviewProxy, isProxyableFrame } from "./ffmpeg.js";
import {
  copyFileInto,
  FOOTAGE_FOLDER_PICKER_ID,
  FOOTAGE_PICKER_ID,
  getPlateFolders,
  pickSequenceFolder,
  pickVideoFile,
  plateProxyName,
  readFolderFiles,
} from "./fsAccess.js";
import { groupSequenceFiles } from "./sequenceGrouping.js";

// Grabs a 320px JPEG from the middle of a video blob, using the browser's
// own decoder (the plate proxy is plain h.264, so no ffmpeg needed). Returns
// a data: URL so it persists in the shot record like every other thumbnail.
export function thumbnailFromVideo(blob, width = 320) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const video = document.createElement("video");
    video.muted = true;
    video.preload = "auto";
    const done = (fn, arg) => {
      URL.revokeObjectURL(url);
      fn(arg);
    };
    const timer = setTimeout(() => done(reject, new Error("Timed out grabbing a thumbnail frame")), 20000);
    video.onloadedmetadata = () => {
      video.currentTime = Number.isFinite(video.duration) ? video.duration / 2 : 0;
    };
    video.onseeked = () => {
      clearTimeout(timer);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = Math.round((video.videoHeight / video.videoWidth) * width) || Math.round(width * 0.5625);
      canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
      done(resolve, canvas.toDataURL("image/jpeg", 0.82));
    };
    video.onerror = () => {
      clearTimeout(timer);
      done(reject, new Error("The browser couldn't decode the plate proxy"));
    };
    video.src = url;
  });
}

// Imports a shot's plate: pick a movie file or an image-sequence folder
// (the picker reopens wherever footage was last picked from; a plate picked
// from inside 00_plates/ is used in place rather than copied), copy it into 00_plates/ if it isn't there
// already, build a review proxy in 03_review/plate/, and take the shot
// thumbnail from that proxy. A sequence is copied into its own subfolder so
// the plate's frames stay together.
//
// Returns { plate, thumbnail, warning } — plate is what goes on the shot
// record. The copy is the plate itself, so a proxy/thumbnail failure only
// becomes a warning rather than undoing it.
export async function importPlate(rootHandle, { scene, shotCode, kind, onProgress }) {
  const { platesDir } = await getPlateFolders(rootHandle, { scene, shotCode });
  if (kind === "video") {
    const { file, handle } = await pickVideoFile(null, { pickerId: FOOTAGE_PICKER_ID });
    const inPlace = (await platesDir.resolve(handle)) !== null;
    return ingestPlate(rootHandle, { scene, shotCode, source: { kind: "video", file }, inPlace, onProgress });
  }
  const folderHandle = await pickSequenceFolder(null, { pickerId: FOOTAGE_FOLDER_PICKER_ID });
  const files = await readFolderFiles(folderHandle);
  if (files.length === 0) throw new Error("That folder is empty.");
  const inPlace = (await platesDir.resolve(folderHandle)) !== null;
  return ingestPlate(rootHandle, {
    scene,
    shotCode,
    source: { kind: "sequence", name: folderHandle.name, files },
    inPlace,
    onProgress,
  });
}

// The copy -> proxy -> thumbnail step for a source that's already been
// chosen — by importPlate's pickers above, or by Footage Ingest matching
// files to shots by name. source is { kind: "video", file } or
// { kind: "sequence", name, files }; inPlace skips the copy when the source
// already lives in 00_plates/.
export async function ingestPlate(rootHandle, { scene, shotCode, source: picked, inPlace = false, onProgress }) {
  const { platesDir, reviewDir } = await getPlateFolders(rootHandle, { scene, shotCode });
  const report = (stage, fraction = null) => onProgress?.(stage, fraction);

  let proxyBlob = null;
  let source;
  let warning = "";

  if (picked.kind === "video") {
    const { file } = picked;
    if (!inPlace) {
      report("Copying plate…", 0);
      await copyFileInto(platesDir, file.name, file, {
        onProgress: (written, total) => report("Copying plate…", written / total),
      });
    }
    source = { kind: "vid", name: file.name, frames: null };
    try {
      proxyBlob = await generateReviewProxy(file, { onProgress: report });
    } catch (err) {
      console.error("Plate proxy failed:", err);
      warning = `The plate was imported, but no proxy could be made: ${err?.message || err}`;
    }
  } else {
    const { files, name } = picked;
    if (!inPlace) {
      const dest = await platesDir.getDirectoryHandle(name, { create: true });
      for (let i = 0; i < files.length; i++) {
        report(`Copying frames… ${i}/${files.length}`, i / files.length);
        await copyFileInto(dest, files[i].name, files[i]);
      }
    }
    const longest = groupSequenceFiles(files)
      .filter((g) => g.kind === "sequence" && isProxyableFrame(g.files[0]))
      .sort((a, b) => b.files.length - a.files.length)[0];
    source = { kind: "seq", name, frames: longest?.files.length ?? files.length };
    if (!longest) {
      warning = "The plate was imported, but that folder has no numbered image sequence to make a proxy from.";
    } else {
      try {
        proxyBlob = await generateSequenceReviewProxy(longest.files, { onProgress: report });
      } catch (err) {
        console.error("Plate sequence proxy failed:", err);
        warning = `The plate was imported, but no proxy could be made: ${err?.message || err}`;
      }
    }
  }

  let proxy = null;
  let thumbnail = null;
  if (proxyBlob) {
    report("Saving plate proxy…");
    proxy = plateProxyName(shotCode);
    await copyFileInto(reviewDir, proxy, proxyBlob);
    try {
      thumbnail = await thumbnailFromVideo(proxyBlob);
    } catch (err) {
      console.error("Plate thumbnail failed:", err);
    }
  }

  return {
    plate: { ...source, proxy, importedAt: new Date().toISOString() },
    thumbnail,
    warning,
  };
}
