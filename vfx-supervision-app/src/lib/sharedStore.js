import { SCOPED_DATA_BASES } from "./projects.js";
import { supabase } from "./supabase.js";

// The team's shared data (supabase/migrations/003): projects, the artist
// roster and every project's shots/scenes/reports, one row per item in
// public.records. Pages keep using the same storage keys and array
// get/set they always did — useLocalStorageState hands shared keys to this
// store — so nothing upstream had to learn about the cloud.
//
// Everything is loaded once after sign-in (loadAll), so reads are
// synchronous, like localStorage was. Writes update the in-memory copy at
// once and are sent in the background: each changed item becomes an
// upsert, each removed item a delete. Other people's changes arrive over
// realtime.
//
// Writes to one item are sent one at a time and coalesced (only the newest
// waiting value goes next), so fast typing can't land out of order; while an
// item has writes in flight, realtime echoes for it are ignored so they
// can't drag an input back to an older value.

const GLOBAL_KEYS = { "vfx-supe-projects": "projects", "vfx-supe-artists": "artists" };

// "vfx-supe-post-reports:<projectId>" -> { collection: "post-reports", projectId }
export function sharedKeyInfo(key) {
  if (GLOBAL_KEYS[key]) return { collection: GLOBAL_KEYS[key], projectId: "" };
  for (const base of SCOPED_DATA_BASES) {
    if (key.startsWith(`${base}:`)) {
      return { collection: base.slice("vfx-supe-".length), projectId: key.slice(base.length + 1) };
    }
  }
  return null;
}

const docKeyOf = (collection, projectId) => `${collection}|${projectId}`;
const rowKeyOf = (collection, projectId, id) => `${collection}|${projectId}|${id}`;

// docKey -> { rows: Map<id, { position, data }>, list: data[] in position order }
let docs = new Map();
const listeners = new Map(); // docKey -> Set<fn>
const anyListeners = new Set(); // called on every change, for views spanning projects
let version = 0;
const statusListeners = new Set();
let status = { loaded: false, error: "", saving: 0 };
let channel = null;
// Bumped by reset(), so a load that was still running when the user signed
// out (or React re-ran the effect) can't install stale data afterwards.
let generation = 0;

const EMPTY = Object.freeze([]);

function doc(docKey) {
  let d = docs.get(docKey);
  if (!d) {
    d = { rows: new Map(), list: EMPTY };
    docs.set(docKey, d);
  }
  return d;
}

function rebuildList(d) {
  d.list = [...d.rows.values()].sort((a, b) => a.position - b.position).map((r) => r.data);
}

function notify(docKey) {
  version++;
  for (const fn of listeners.get(docKey) ?? []) fn();
  for (const fn of anyListeners) fn();
}

// For views that read many keys at once (the Dashboard overview): a number
// that changes whenever anything shared does.
export function subscribeAny(fn) {
  anyListeners.add(fn);
  return () => anyListeners.delete(fn);
}

export function getVersion() {
  return version;
}

function setStatus(patch) {
  status = { ...status, ...patch };
  for (const fn of statusListeners) fn();
}

export function getStatus() {
  return status;
}

export function subscribeStatus(fn) {
  statusListeners.add(fn);
  return () => statusListeners.delete(fn);
}

export function subscribe(key, fn) {
  const info = sharedKeyInfo(key);
  const docKey = docKeyOf(info.collection, info.projectId);
  if (!listeners.has(docKey)) listeners.set(docKey, new Set());
  listeners.get(docKey).add(fn);
  return () => listeners.get(docKey).delete(fn);
}

// The current array for a shared key ([] if it has nothing yet). The same
// array comes back until something changes it.
export function read(key) {
  const info = sharedKeyInfo(key);
  return docs.get(docKeyOf(info.collection, info.projectId))?.list ?? EMPTY;
}

// ── Loading ──────────────────────────────────────────────────────────────

export async function loadAll() {
  const myGeneration = generation;
  const PAGE = 1000;
  const next = new Map();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("records")
      .select("collection, project_id, id, position, data")
      .order("collection")
      .order("project_id")
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    for (const row of data) {
      const docKey = docKeyOf(row.collection, row.project_id);
      if (!next.has(docKey)) next.set(docKey, { rows: new Map(), list: EMPTY });
      next.get(docKey).rows.set(row.id, { position: row.position, data: row.data });
    }
    if (data.length < PAGE) break;
  }
  if (myGeneration !== generation) return;
  for (const d of next.values()) rebuildList(d);
  docs = next;
  startRealtime();
  setStatus({ loaded: true, error: "" });
  for (const docKey of listeners.keys()) notify(docKey);
}

// Signing out (or in as someone else) starts from nothing.
export function reset() {
  generation++;
  if (channel) supabase.removeChannel(channel);
  channel = null;
  docs = new Map();
  pending.clear();
  queues.clear();
  setStatus({ loaded: false, error: "", saving: 0 });
}

// Live updates are a bonus on top of loadAll — if they can't start, the app
// still works (it just won't see others' changes until the next load).
// Each start gets its own channel name: removing a channel is async, and
// asking for one with the same name too soon hands back the old one, already
// subscribed, which refuses new listeners.
function startRealtime() {
  try {
    if (channel) supabase.removeChannel(channel);
    channel = supabase
      .channel(`records-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "records" }, applyRemote)
      .subscribe();
  } catch (err) {
    console.error("Live updates couldn't start:", err);
    channel = null;
  }
}

function applyRemote(payload) {
  const row = payload.eventType === "DELETE" ? payload.old : payload.new;
  if (!row?.collection) return;
  const rowKey = rowKeyOf(row.collection, row.project_id, row.id);
  if (pending.has(rowKey)) return;
  const docKey = docKeyOf(row.collection, row.project_id);
  const d = doc(docKey);
  if (payload.eventType === "DELETE") d.rows.delete(row.id);
  else d.rows.set(row.id, { position: row.position, data: row.data });
  rebuildList(d);
  notify(docKey);
}

// ── Writing ──────────────────────────────────────────────────────────────

// Replaces a shared key's array, the way localStorage.setItem used to —
// only items that actually changed are sent.
export function write(key, nextList) {
  const info = sharedKeyInfo(key);
  const docKey = docKeyOf(info.collection, info.projectId);
  const d = doc(docKey);
  const seen = new Set();

  nextList.forEach((item, position) => {
    const id = item?.id;
    if (id === undefined || id === null || id === "") {
      console.error(`Shared item without an id in ${key} — not saved:`, item);
      return;
    }
    const sid = String(id);
    if (seen.has(sid)) console.error(`Duplicate id ${sid} in ${key} — the later one wins.`);
    seen.add(sid);
    const existing = d.rows.get(sid);
    if (existing && existing.position === position && (existing.data === item || sameJson(existing.data, item))) {
      return;
    }
    d.rows.set(sid, { position, data: item });
    queueWrite(rowKeyOf(info.collection, info.projectId, sid), {
      op: "upsert",
      row: { collection: info.collection, project_id: info.projectId, id: sid, position, data: item },
    });
  });

  for (const id of [...d.rows.keys()]) {
    if (seen.has(id)) continue;
    d.rows.delete(id);
    queueWrite(rowKeyOf(info.collection, info.projectId, id), {
      op: "delete",
      match: { collection: info.collection, project_id: info.projectId, id },
    });
  }

  rebuildList(d);
  notify(docKey);
}

function sameJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

const pending = new Set(); // rowKeys with writes queued or in flight
const queues = new Map(); // rowKey -> { inflight, next }

function queueWrite(rowKey, op) {
  let q = queues.get(rowKey);
  if (!q) {
    q = { inflight: false, next: null };
    queues.set(rowKey, q);
    pending.add(rowKey);
    setStatus({ saving: status.saving + 1 });
  }
  q.next = op;
  if (!q.inflight) flush(rowKey);
}

async function flush(rowKey) {
  const q = queues.get(rowKey);
  if (!q) return;
  if (!q.next) {
    queues.delete(rowKey);
    pending.delete(rowKey);
    setStatus({ saving: status.saving - 1 });
    return;
  }
  const op = q.next;
  q.next = null;
  q.inflight = true;
  const { error } =
    op.op === "upsert"
      ? await supabase.from("records").upsert(op.row)
      : await supabase.from("records").delete().match(op.match);
  q.inflight = false;
  if (error) {
    console.error("Couldn't save to the cloud:", error, op);
    setStatus({ error: `Couldn't save a change: ${error.message}` });
    // Put the item back the way the server has it.
    if (!q.next) await refetchRow(op.row ?? op.match);
  }
  flush(rowKey);
}

async function refetchRow({ collection, project_id, id }) {
  const { data } = await supabase
    .from("records")
    .select("position, data")
    .match({ collection, project_id, id })
    .maybeSingle();
  const docKey = docKeyOf(collection, project_id);
  const d = doc(docKey);
  if (data) d.rows.set(id, { position: data.position, data: data.data });
  else d.rows.delete(id);
  rebuildList(d);
  notify(docKey);
}

export function clearError() {
  setStatus({ error: "" });
}

// ── Whole-project and whole-dataset operations ───────────────────────────

// Everything filed under one project (shots, scenes, reports).
export async function deleteProjectData(projectId) {
  for (const [docKey, d] of docs) {
    if (docKey.endsWith(`|${projectId}`)) {
      d.rows.clear();
      d.list = EMPTY;
      notify(docKey);
    }
  }
  const { error } = await supabase.from("records").delete().eq("project_id", projectId);
  if (error) setStatus({ error: `Couldn't delete the project's data: ${error.message}` });
}

// Full replace of the shared data with a backup/export-format object (see
// backup.js) — a restore, not a merge. Admin/supervisor only (RLS).
export async function replaceAll(data) {
  const rows = [];
  const add = (collection, projectId, list) =>
    (list ?? []).forEach((item, position) => {
      if (item?.id === undefined || item?.id === null || item?.id === "") return;
      rows.push({ collection, project_id: projectId, id: String(item.id), position, data: item });
    });

  add("projects", "", data.projects);
  add("artists", "", data.artists);
  for (const [projectId, entry] of Object.entries(data.projectData ?? {})) {
    for (const base of SCOPED_DATA_BASES) add(base.slice("vfx-supe-".length), projectId, entry[base]);
  }

  // Every row has a non-empty collection, so this clears the table.
  const { error: delError } = await supabase.from("records").delete().neq("collection", "");
  if (delError) throw delError;
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from("records").insert(rows.slice(i, i + 500));
    if (error) throw error;
  }
  await loadAll();
  return rows.length;
}
