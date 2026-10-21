import { useAuth } from "./auth.jsx";

// The roster artist the signed-in person is linked to (Team page sets
// profile.artist_id). Until someone's linked, fall back to a roster artist
// with the same name as their profile, so existing data keeps working.
export function resolveCurrentArtist(artists, profile) {
  if (!profile) return null;
  if (profile.artist_id) {
    const linked = artists.find((a) => a.id === profile.artist_id);
    if (linked) return linked;
  }
  const name = (profile.name ?? "").trim().toLowerCase();
  return name ? artists.find((a) => a.name.trim().toLowerCase() === name) ?? null : null;
}

export function useCurrentArtist(artists) {
  const { profile } = useAuth();
  return resolveCurrentArtist(artists, profile);
}
