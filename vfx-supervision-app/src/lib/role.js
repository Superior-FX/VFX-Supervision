// Sign-in / role switching is temporarily disabled — everyone is Admin.
// To reconnect it later:
// 1. In Layout.jsx and PostReports.jsx, swap
//    `import { CURRENT_ROLE } from "../lib/role.js"` back to
//    `useLocalStorageState("vfx-supe-role", "Admin")`.
// 2. Layout.jsx lost its Artist-only route redirect (it used to bounce
//    Artist-role users to /upload if they hit a non-Artist-Portal route) and
//    the sidebar's "Switch role" link. Both were removed since they're
//    meaningless while role is hardcoded — re-add the ARTIST_ROUTES
//    array + a useEffect redirect, and the switch-role link/onClick, if
//    picking this back up.
// Login.jsx and its role/artist picker are otherwise untouched and ready.
export const CURRENT_ROLE = "Admin";
