import { useEffect, useState } from "react";
import { padScene } from "./folderPath.js";
import { getTaskReviewFolder, readFileFrom } from "./fsAccess.js";

// Loads a task's review proxy — and its 4K HQ proxy, when the supervisor
// has made one for this version — from 03_review/<task>/ on disk, and hands
// back object URLs to play. Shared by Review & Dailies (supervisor) and the
// Shot Viewer (artist) so both read the proxies the same way.
//
// `folder` is the useProjectFolder() result; `entry` is { shot, task } or null.
// Also returns `reviewDir` (the task's review folder handle) for pages that
// read more out of it (the supervisor's 6K/8K stills).
export function useReviewProxy(folder, entry) {
  const [videoUrl, setVideoUrl] = useState(null);
  const [hqUrl, setHqUrl] = useState(null);
  const [reviewDir, setReviewDir] = useState(null);
  const [videoError, setVideoError] = useState("");
  const rootHandle = folder.rootHandle;
  const hqFile = entry?.task.hqProxies?.[entry.task.version] ?? null;

  useEffect(() => {
    setVideoUrl(null);
    setReviewDir(null);
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
        const dir = await getTaskReviewFolder(rootHandle, {
          scene: padScene(entry.shot.scene),
          shotCode: entry.shot.shotCode,
          taskType: entry.task.type,
        });
        if (!dir) throw new Error("No review folder for this task type.");
        const file = await readFileFrom(dir, entry.task.reviewFile);
        if (cancelled) return;
        objectUrl = URL.createObjectURL(file);
        setReviewDir(dir);
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

  // The HQ loads on its own, so generating one mid-review swaps it in
  // without reloading (and unmounting) the player that's already up.
  useEffect(() => {
    setHqUrl(null);
    if (!reviewDir || !hqFile) return;
    let cancelled = false;
    let objectUrl = null;
    (async () => {
      try {
        const hq = await readFileFrom(reviewDir, hqFile);
        if (cancelled) return;
        objectUrl = URL.createObjectURL(hq);
        setHqUrl(objectUrl);
      } catch (err) {
        // The normal proxy still plays; the HQ just isn't offered.
        console.error("Couldn't load HQ proxy:", err);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [reviewDir, hqFile]);

  return { videoUrl, hqUrl, reviewDir, videoError };
}
