// Google Drive, for client review links.
//
// The rest of the app reaches the show's files through the folder Google
// Drive for Desktop keeps in sync on this computer. A client has no such
// folder, so to share a proxy we go to Drive's own API: find the proxy's
// copy in Drive, set it to "anyone with the link can view", and hand the
// client page its file id. Revoking a link takes that permission back off.
//
// Setup (once, in Google Cloud Console — see the commit / support notes):
//   VITE_GOOGLE_CLIENT_ID  an OAuth "Web application" client id, with
//                          app.superior-fx.com and localhost:5173 as
//                          authorised JavaScript origins.
//   VITE_GOOGLE_API_KEY    an API key restricted to the Drive API and to
//                          those same sites. It's public by design: the
//                          client page uses it to stream the shared files.

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;

// Full Drive access: the proxies weren't created by this app, so the
// narrower drive.file scope can't see them.
const SCOPE = "https://www.googleapis.com/auth/drive";
const API = "https://www.googleapis.com/drive/v3";

export const driveConfigured = Boolean(CLIENT_ID && API_KEY);

let gisPromise = null;
function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (!gisPromise) {
    gisPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        gisPromise = null;
        reject(new Error("Couldn't load Google sign-in. Check your connection and try again."));
      };
      document.head.appendChild(s);
    });
  }
  return gisPromise;
}

// Start loading early (on page mount) so the sign-in popup can open straight
// from the button click — browsers block popups opened after an await.
export function preloadGoogle() {
  if (driveConfigured) loadGis().catch(() => {});
}

let token = null; // { value, expiresAt }

export function hasDriveToken() {
  return Boolean(token && token.expiresAt > Date.now() + 60_000);
}

// Asks Google for an access token (a popup the first time each session,
// silent after that until it expires, ~1 hour). Call from a click handler.
export async function getDriveToken() {
  if (hasDriveToken()) return token.value;
  await loadGis();
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (res) => {
        if (res.error) {
          reject(new Error(res.error_description || "Google sign-in was cancelled."));
          return;
        }
        if (!window.google.accounts.oauth2.hasGrantedAllScopes(res, SCOPE)) {
          reject(new Error("Google Drive access wasn't granted, so the proxies can't be shared."));
          return;
        }
        token = { value: res.access_token, expiresAt: Date.now() + Number(res.expires_in) * 1000 };
        resolve(token.value);
      },
      error_callback: (err) => reject(new Error(err?.message || "Google sign-in was closed.")),
    });
    client.requestAccessToken({ prompt: "" });
  });
}

async function driveFetch(path, { method = "GET", body, params = {} } = {}) {
  const accessToken = await getDriveToken();
  const url = new URL(`${API}/${path}`);
  url.searchParams.set("supportsAllDrives", "true");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) token = null;
  if (!res.ok) {
    let message = `Google Drive returned ${res.status}.`;
    try {
      const data = await res.json();
      if (data?.error?.message) message = data.error.message;
    } catch {
      // keep the status message
    }
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

const quote = (s) => `'${String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;

async function folderName(id, cache) {
  if (!cache.has(id)) {
    cache.set(id, driveFetch(`files/${id}`, { params: { fields: "name,parents" } }));
  }
  return cache.get(id);
}

// Finds the Drive copy of a review proxy. Several files can share a name
// (an old copy in zzz_DELETED, another show), so a match must also sit in
// <shotCode>/03_review/<taskFolder>/ — the same place the app wrote it on
// disk. Throws a plain-English error when it isn't in Drive yet.
export async function findReviewProxy({ fileName, shotCode, taskFolder }) {
  const q = `name = ${quote(fileName)} and trashed = false`;
  const data = await driveFetch("files", {
    params: {
      q,
      fields: "files(id,name,size,parents)",
      corpora: "allDrives",
      includeItemsFromAllDrives: "true",
      pageSize: "20",
    },
  });
  const files = data.files ?? [];
  if (files.length === 0) {
    throw new Error(
      `${fileName} isn't in Google Drive yet. Check that Google Drive for Desktop has finished uploading it, then try again.`
    );
  }

  const cache = new Map();
  for (const file of files) {
    const taskDir = file.parents?.[0] && (await folderName(file.parents[0], cache));
    if (!taskDir || taskDir.name !== taskFolder) continue;
    const reviewDir = taskDir.parents?.[0] && (await folderName(taskDir.parents[0], cache));
    if (!reviewDir || reviewDir.name !== "03_review") continue;
    const shotDir = reviewDir.parents?.[0] && (await folderName(reviewDir.parents[0], cache));
    if (!shotDir || shotDir.name !== shotCode) continue;
    return file;
  }
  throw new Error(
    `Found ${fileName} in Google Drive, but not in ${shotCode}/03_review/${taskFolder}/, so it wasn't shared.`
  );
}

// "Anyone with the link can view". allowFileDiscovery false keeps it out of
// search. Returns the permission id, needed to take it back off.
export async function shareWithAnyone(fileId) {
  const perm = await driveFetch(`files/${fileId}/permissions`, {
    method: "POST",
    body: { type: "anyone", role: "reader", allowFileDiscovery: false },
    params: { fields: "id" },
  });
  return perm.id;
}

// Takes a link share back off. A file or permission that's already gone
// counts as done.
export async function unshare(fileId, permissionId) {
  try {
    await driveFetch(`files/${fileId}/permissions/${permissionId}`, { method: "DELETE" });
  } catch (err) {
    if (err.status !== 404) throw err;
  }
}

// What the client page plays: the file streamed straight from Drive's API
// (works in our own player, so frame stepping and full screen work), and
// Drive's own embedded player as the fallback.
export function driveStreamUrl(fileId) {
  return `${API}/files/${encodeURIComponent(fileId)}?alt=media&key=${encodeURIComponent(API_KEY ?? "")}`;
}

export function drivePreviewUrl(fileId) {
  return `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview`;
}

export function hasStreamKey() {
  return Boolean(API_KEY);
}
