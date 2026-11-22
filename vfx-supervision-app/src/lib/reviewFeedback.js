import { supabase } from "./supabase.js";

// Client feedback on review links (migration 006). Clients reach it through
// two database functions that only answer for a live link; the team reads
// the review_feedback table directly.

export const DECISIONS = {
  approved: { label: "Approved", tone: "success" },
  changes: { label: "Changes requested", tone: "danger" },
};

const notSetUp = (err) =>
  err && (err.code === "42P01" || err.code === "PGRST202" || /review_feedback|save_review_feedback/.test(err.message));

export const FEEDBACK_SETUP_MESSAGE =
  "Client feedback isn't set up in the database yet — run supabase/migrations/006_client_review_feedback.sql.";

// Client side: what this reviewer already left, keyed by Drive file id.
export async function loadMyFeedback(token, reviewer) {
  const { data, error } = await supabase.rpc("get_review_feedback", { p_token: token, p_reviewer: reviewer });
  if (error) throw new Error(notSetUp(error) ? "Notes can't be saved on this link yet." : error.message);
  const byFile = {};
  for (const f of data ?? []) byFile[f.driveFileId] = f;
  return byFile;
}

// Client side: saves this reviewer's whole feedback for one file.
export async function saveMyFeedback(token, reviewer, driveFileId, { annotations, comment, decision }) {
  const { data, error } = await supabase.rpc("save_review_feedback", {
    p_token: token,
    p_drive_file_id: driveFileId,
    p_reviewer: reviewer,
    p_annotations: annotations ?? [],
    p_comment: comment ?? "",
    p_decision: decision ?? null,
  });
  if (error) throw new Error(notSetUp(error) ? "Notes can't be saved on this link yet." : error.message);
  if (data !== true) throw new Error("This review link has expired or been turned off, so notes can't be saved.");
}

// Team side: every piece of client feedback on a project, newest first.
export async function loadProjectFeedback(projectId) {
  const { data, error } = await supabase
    .from("review_feedback")
    .select("*")
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(notSetUp(error) ? FEEDBACK_SETUP_MESSAGE : error.message);
  return data ?? [];
}

export async function deleteFeedback(id) {
  const { error } = await supabase.from("review_feedback").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// Does a feedback row hold anything worth showing?
export const hasContent = (f) => Boolean(f.decision || f.comment?.trim() || f.annotations?.length);

export function formatFeedbackDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
