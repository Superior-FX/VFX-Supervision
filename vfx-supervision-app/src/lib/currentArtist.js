// Sign-in is disabled for now (see role.js) — the Artist Portal is being
// built/tested as a single hardcoded artist rather than through the (now
// unlinked) Login artist picker. To reconnect real sign-in later: read
// `vfx-supe-current-artist-id` from localStorage instead of matching by name.
export const CURRENT_ARTIST_NAME = "Will Cox";

export function resolveCurrentArtist(artists) {
  return artists.find((a) => a.name.trim().toLowerCase() === CURRENT_ARTIST_NAME.toLowerCase()) ?? null;
}
