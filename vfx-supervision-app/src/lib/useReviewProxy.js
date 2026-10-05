import { useEffect, useState } from "react";
import { padScene } from "./folderPath.js";
import { getPlateFolders, getTaskReviewFolder, listProxyVersions, readFileFrom } from "./fsAccess.js";

// Loads a task's review proxy — and its 4K HQ proxy, when the supervisor
// has made one for that version — from 03_review/<task>/ on disk, and hands
// back object URLs to play. Shared by Review & Dailies (supervisor), the
// Shot Viewer (artist) and the Dashboard's shot viewer so they all read the
// proxies the same way.
//
// `folder` is the useProjectFolder() result; `entry` is { shot, task } or
// null. `version` picks an older submission; omitted (or null) means the
// task's current one. `versions` lists every version with a proxy on disk
// (oldest first) for the version pickers. Also returns `reviewDir` (the
// task's review folder handle) for pages that read more out of it (the
// supervisor's 6K/8K stills).
export function useReviewProxy(folder, entry, { version = null } = {}) {
  const [videoUrl, setVideoUrl] = useState(null);
  const [hqUrl, setHqUrl] = useState(null);
  const [reviewDir, setReviewDir] = useState(null);
  const [versions, setVersions] = useState([]);
  const [videoError, setVideoError] = useState("");
  const rootHandle = folder.rootHandle;
  const task = entry?.task;
  const wanted = version ?? task?.version ?? null;
  const isCurrent = !task || wanted === (task.version ?? null);
  const fileName = isCurrent ? task?.reviewFile ?? null : versions.find((v) => v.version === wanted)?.name ?? null;
  const hqFile = task?.hqProxies?.[wanted] ?? null;

  // The task's review folder, and which versions it holds.
  useEffect(() => {
    setReviewDir(null);
    setVersions([]);
    setVideoError("");
    if (!entry) return;
    if (folder.status !== "connected") {
      // The page's FolderStatusBanner explains why and has the fix; once
      // it's applied, status flips and this effect re-runs.
      if (task.reviewFile && (folder.status === "missing" || folder.status === "needs-permission")) {
        setVideoError("Can't play the proxy until the project folder is connected — see above.");
      }
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const dir = await getTaskReviewFolder(rootHandle, {
          scene: padScene(entry.shot.scene),
          shotCode: entry.shot.shotCode,
          taskType: task.type,
        });
        if (!dir) throw new Error("No review folder for this task type.");
        const list = await listProxyVersions(dir, entry.shot.shotCode);
        if (cancelled) return;
        setReviewDir(dir);
        setVersions(list);
      } catch (err) {
        if (!cancelled && task.reviewFile) {
          console.error("Couldn't open review folder:", err);
          setVideoError("Couldn't load the review proxy — it may have been moved or deleted on disk.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [task?.id, task?.reviewFile, task?.version, rootHandle, folder.status]);

  // The proxy for the version being looked at.
  useEffect(() => {
    setVideoUrl(null);
    if (!reviewDir || !fileName) return;
    let cancelled = false;
    let objectUrl = null;
    (async () => {
      try {
        const file = await readFileFrom(reviewDir, fileName);
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
  }, [reviewDir, fileName]);

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

  return { videoUrl, hqUrl, reviewDir, versions, videoError, hasProxy: Boolean(fileName) };
}

// Every version number a picker should offer for a task: whatever has a
// proxy on disk plus the current one (newest first).
export function versionChoices(task, versions) {
  const set = new Set(versions.map((v) => v.version));
  if (task?.version && task.reviewFile) set.add(task.version);
  return [...set].sort((a, b) => b - a);
}

// A shot's plate proxy (03_review/plate/), loaded only while `enabled`.
export function usePlateProxy(folder, shot, enabled = true) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState("");
  const proxy = shot?.plate?.proxy ?? null;

  useEffect(() => {
    setUrl(null);
    setError("");
    if (!enabled || !shot || !proxy) return;
    if (folder.status !== "connected") {
      if (folder.status === "missing" || folder.status === "needs-permission") {
        setError("Can't play the plate until the project folder is connected — see above.");
      }
      return;
    }
    let cancelled = false;
    let objectUrl = null;
    (async () => {
      try {
        const { reviewDir } = await getPlateFolders(folder.rootHandle, {
          scene: padScene(shot.scene),
          shotCode: shot.shotCode,
        });
        const file = await readFileFrom(reviewDir, proxy);
        if (cancelled) return;
        objectUrl = URL.createObjectURL(file);
        setUrl(objectUrl);
      } catch (err) {
        if (!cancelled) {
          console.error("Couldn't load plate proxy:", err);
          setError("Couldn't load the plate proxy — it may have been moved or deleted on disk.");
        }
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [enabled, shot?.id, proxy, folder.rootHandle, folder.status]);

  return { plateUrl: url, plateError: error };
}
