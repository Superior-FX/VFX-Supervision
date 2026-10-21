import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRole } from "./role.js";
import { supabase } from "./supabase.js";

// Delete requests (supabase/migrations/002). Admins delete directly; anyone
// else's typed DELETE files a request that an Admin approves — the approving
// Admin's own app then runs the normal delete, folder moves and all.
//
// useDeleteRequests(projectId) loads the pending requests for one project,
// or for every project when projectId is null (Home).
export function useDeleteRequests(projectId) {
  const { profile, isAdmin } = useRole();
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    let query = supabase.from("delete_requests").select("*").eq("status", "pending").order("created_at");
    if (projectId) query = query.eq("project_id", projectId);
    const { data, error: err } = await query;
    if (err) setError(err.message);
    else setError("");
    setRequests(data ?? []);
  }, [projectId]);

  // Pick up requests filed or decided elsewhere whenever the tab regains focus.
  useEffect(() => {
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [refresh]);

  const run = async (promise) => {
    const { error: err } = await promise;
    if (err) setError(err.message);
    else setError("");
    await refresh();
    return !err;
  };

  return {
    isAdmin,
    requests,
    error,
    refresh,
    pendingFor: (kind, targetId) => requests.find((r) => r.kind === kind && r.target_id === targetId) ?? null,
    // { kind, targetId, parentId?, label, projectId? }
    request: ({ kind, targetId, parentId = null, label, projectId: forProject = projectId }) =>
      run(
        supabase.from("delete_requests").insert({
          project_id: forProject,
          kind,
          target_id: targetId,
          parent_id: parentId,
          label,
          requested_by_name: profile?.name || profile?.email || "",
        })
      ),
    cancel: (id) => run(supabase.from("delete_requests").update({ status: "cancelled" }).eq("id", id)),
    // Admin only. Approving just records the decision — the caller performs
    // the delete itself first.
    decide: (id, status) => run(supabase.from("delete_requests").update({ status }).eq("id", id)),
  };
}

// Post Reports shares one instance with its scene/shot/task rows.
const DeleteRequestsContext = createContext(null);
export const DeleteRequestsProvider = DeleteRequestsContext.Provider;
export function useDeleteRequestsContext() {
  return useContext(DeleteRequestsContext);
}
