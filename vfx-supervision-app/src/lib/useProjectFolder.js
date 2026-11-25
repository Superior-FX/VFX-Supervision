import { useCallback, useEffect, useState } from "react";
import {
  ensurePermission,
  isFsAccessSupported,
  loadRootHandle,
  reconnectProjectRootFolder,
  withFolderTimeout,
} from "./fsAccess.js";

// A stale folder handle (folder moved, renamed, or a Google Drive virtual
// drive that stopped answering) can make Chrome never answer a permission
// query, which left every page stuck at "loading". Past this, the saved
// folder is treated as gone, so the page offers Reconnect Folder… instead.
const CHECK_TIMEOUT_MS = 5000;

// The project's on-disk root folder, shared by every page that touches it
// (Post Reports, Review & Dailies, Upload Shot) — previously each page
// loaded the handle itself and only Post Reports noticed when it was gone.
//
// status:
//   "unsupported"      — browser has no File System Access API
//   "loading"          — still reading the saved handle
//   "missing"          — no folder saved for this project in this browser
//                        (other Chrome profile, backup import, cleared data)
//   "needs-permission" — folder is saved, but this session hasn't been
//                        allowed to use it yet (normal after a restart)
//   "connected"
export function useProjectFolder(project) {
  const supported = isFsAccessSupported();
  const [rootHandle, setRootHandle] = useState(null);
  const [permission, setPermission] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setRootHandle(null);
    setPermission(null);
    setLoaded(false);
    if (!project || !supported) return;
    let cancelled = false;
    (async () => {
      try {
        const handle = await withFolderTimeout(loadRootHandle(project.id), CHECK_TIMEOUT_MS);
        const perm = handle ? await withFolderTimeout(handle.queryPermission({ mode: "readwrite" }), CHECK_TIMEOUT_MS) : null;
        if (cancelled) return;
        setRootHandle(handle);
        setPermission(perm);
      } catch (err) {
        // treated as "missing" — the banner's Reconnect Folder… fixes it
        if (err?.name === "TimeoutError") console.warn("Saved project folder didn't answer; treating it as disconnected.");
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [project?.id, supported]);

  // Access is often granted from somewhere else on the page (any action
  // that calls ensurePermission), which fires no event — so re-check while
  // it's outstanding, so the warning clears on its own once granted.
  useEffect(() => {
    if (!rootHandle || permission === "granted") return;
    const id = setInterval(async () => {
      try {
        setPermission(await withFolderTimeout(rootHandle.queryPermission({ mode: "readwrite" }), CHECK_TIMEOUT_MS));
      } catch {
        // leave as is
      }
    }, 1500);
    return () => clearInterval(id);
  }, [rootHandle, permission]);

  const status = !supported
    ? "unsupported"
    : !loaded
      ? "loading"
      : !rootHandle
        ? "missing"
        : permission !== "granted"
          ? "needs-permission"
          : "connected";

  // For a handle obtained some other way (e.g. Post Reports' first-time
  // "Choose Destination Folder…", which creates the show folder).
  const adoptHandle = useCallback((handle) => {
    setRootHandle(handle);
    setPermission("granted");
  }, []);

  const grantAccess = useCallback(async () => {
    if (!rootHandle) return false;
    const ok = await ensurePermission(rootHandle);
    setPermission(ok ? "granted" : await rootHandle.queryPermission({ mode: "readwrite" }));
    return ok;
  }, [rootHandle]);

  const reconnect = useCallback(async () => {
    const handle = await reconnectProjectRootFolder(project.id, project.showCode);
    adoptHandle(handle);
    return handle;
  }, [project?.id, project?.showCode, adoptHandle]);

  return { rootHandle, status, supported, adoptHandle, grantAccess, reconnect };
}
