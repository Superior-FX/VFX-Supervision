import { useEffect, useState } from "react";
import { padScene } from "./folderPath.js";
import { getTaskReviewFolder, readFileFrom } from "./fsAccess.js";

// Loads a task's review proxy from 03_review/<task>/ on disk and hands back
// an object URL to play. Shared by Review & Dailies (supervisor) and Artist
// Review so both read the proxy the same way.
//
// `folder` is the useProjectFolder() result; `entry` is { shot, task } or null.
export function useReviewProxy(folder, entry) {
  const [videoUrl, setVideoUrl] = useState(null);
  const [videoError, setVideoError] = useState("");
  const rootHandle = folder.rootHandle;

  useEffect(() => {
    setVideoUrl(null);
    setVideoError("");
    if (!entry || !entry.task.reviewFile) return;
    if (folder.status !== "connected") {
      // The page's FolderStatusBanner explains why and has the fix; once
      // it's applied, status flips and this effect re-runs.
      if (folder.status === "missing" || folder.status === "needs-permission") {
        setVideoError("Can't play the proxy until the project folder is connected — see above.");
      }
      return;
    }
    let cancelled = false;
    let objectUrl = null;
    (async () => {
      try {
        const reviewDir = await getTaskReviewFolder(rootHandle, {
          scene: padScene(entry.shot.scene),
          shotCode: entry.shot.shotCode,
          taskType: entry.task.type,
        });
        if (!reviewDir) throw new Error("No review folder for this task type.");
        const file = await readFileFrom(reviewDir, entry.task.reviewFile);
        if (cancelled) return;
        objectUrl = URL.createObjectURL(file);
        setVideoUrl(objectUrl);
      } catch (err) {
        if (!cancelled) {
          console.error("Couldn't load review proxy:", err);
          setVideoError("Couldn't load the review proxy — it may have been moved or deleted on disk.");
        }
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [entry?.task.id, entry?.task.reviewFile, rootHandle, folder.status]);

  return { videoUrl, videoError };
}
