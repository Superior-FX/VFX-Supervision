import { createClient } from "@supabase/supabase-js";

// Keys come from .env.local (gitignored). Only the anon/publishable key ever
// belongs here — the service_role key bypasses row-level security and must
// never ship in the frontend.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && anonKey);

export const supabase = supabaseConfigured ? createClient(url, anonKey) : null;

export const ROLES = ["Admin", "VFX Supervisor", "Comp Supervisor", "Producer", "Artist"];
