# Going live at app.superior-fx.com

The VFX Supervision app is ready to host. It's a static site (the `vfx-supervision-app` folder), and all data and sign-in run through Supabase, so the host only serves files. These are the steps, and who does each one.

| # | Who | Where | What |
|---|-----|-------|------|
| 1 | Will | vercel.com | Create the Vercel project ✅ live at https://vfx-supervision.vercel.app |
| 2 | Will | Supabase | Allow the new web address for sign-in emails ✅ for the vercel.app address |
| 3 | Will | Vercel | Add the `app.superior-fx.com` domain, then copy the DNS value it shows |
| 4 | Will | GoDaddy (DNS for superior-fx.com) | Add one CNAME record |
| 5 | **Jon** | Base44 (superior-fx.com site) | Add a hidden, admin-only **"Sup-FX App"** link |
| 6 | Will | the app → Team & Access | Invite Jon; Jon signs up |

---

## 1. Vercel project (Will)

1. Go to **vercel.com** and **Sign up with GitHub**, using the GitHub account that can see `Superior-FX/VFX-Supervision`.
2. **Add New… → Project**, then import `Superior-FX/VFX-Supervision`.
3. **Root Directory:** click *Edit* and choose **`vfx-supervision-app`**. Vercel should then detect **Vite**. Leave the build settings alone; `vercel.json` sets them.
4. **Environment Variables:** add both, for all environments:
   - `VITE_SUPABASE_URL` = `https://akkpjqvdeplouqhaqcsf.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = the anon key from `vfx-supervision-app/.env.local`

   The anon key is safe in a website, because Supabase's row-level rules protect the data. **Never** add the `service_role` key.
5. **Deploy.** You'll get a test address such as `vfx-supervision-xxxx.vercel.app`. Open it: you should see the Superior-FX sign-in page.
6. **Production branch** (Settings → Git): recommended `master`. Pushes to `shared-state-log` then get private preview links, and the live site only changes when work is merged to `master`. Before the first real deploy, bring `master` up to date with `shared-state-log`.

## 2. Supabase sign-in addresses (Will)

Supabase dashboard → **Authentication → URL Configuration**:

- **Redirect URLs:** add these and keep `http://localhost:5173/**` for local work:
  - `https://app.superior-fx.com/**`
  - your exact Vercel test address from step 1, e.g. `https://vfx-supervision-xxxx.vercel.app/**`
  - for preview links, only your own team's addresses: `https://*-<your-vercel-team-slug>.vercel.app/**`. The team slug is the last part of any preview URL Vercel gives you. Don't use a bare `*.vercel.app`, which would let *any* Vercel site receive your sign-in links.
- **Site URL:** change it to `https://app.superior-fx.com` once step 4 is done. This is the default address in confirmation and password-reset emails.

## 3. Custom domain in Vercel (Will)

Vercel project → **Settings → Domains → Add** → `app.superior-fx.com`.

Vercel then shows the DNS record it needs, normally a **CNAME** for **`app`** pointing to a `…vercel-dns…` address. **Use exactly what Vercel shows** in step 4; it can be project-specific.

## 4. DNS record (Will, in GoDaddy)

GoDaddy → superior-fx.com → **DNS → Add record**:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| CNAME | `app` | *the value from Vercel, step 3* | default (1 hour) |

This only adds `app.`. It doesn't touch `www` or the current site, which stay on Base44. Vercel issues the HTTPS certificate automatically, usually within minutes to an hour.

## 5. Hidden admin-only link on superior-fx.com (Jon, in Base44)

The public shouldn't see the app at all. Only people signed in to the superior-fx.com site as **admins** should see a **"Sup-FX App"** link, which opens the app in a new tab, where they sign in to the app itself.

Paste this into the Base44 AI chat for the superior-fx.com app:

> Add an admin-only link to the site's navigation labeled **"Sup-FX App"** that opens **https://app.superior-fx.com** in a **new browser tab** (target="_blank", rel="noopener noreferrer").
> - Show it **only** when the visitor is signed in **and** their user role is **admin**. Hide it completely, including from the HTML and the mobile menu, for logged-out visitors and for signed-in users who aren't admins.
> - It's a plain external link. Do **not** embed the app in an iframe or a page on this site.
> - Don't change anything else about the site, its pages, or its public navigation.

Then in Base44, under the app's **Users** settings, make sure Will (and anyone else who needs the app) is an **admin** user on the site, so the link appears for them.

**Notes:**
- **Use a link, not an embed or iframe.** Inside an iframe, the app's project-folder access (Chrome's File System Access) and sign-in session are blocked by the browser.
- Hiding the link only keeps the site tidy; it isn't the security. The app at app.superior-fx.com has its own sign-in and roles (Team & Access), so anyone who finds the address still can't get in without an account you've given access to.
- The app's browser tab reads **"Sup-FX App"**.

## 6. Accounts

1. Will: in the app, open **Admin → Team & Access**. Invite Jon's email with his roles and link him to his artist in the roster.
2. Jon: open `https://app.superior-fx.com`, choose **New here? Create an account**, and sign up **with that same email**. Then click the confirmation link in the email.
3. Each person connects their own Google Drive GOTP folder in the app; folder access is per computer. Use **Chrome or Edge**, and set the GOTP folder to **"Available offline"** in Google Drive so proxies play from local copies.

---

### Good to know

- **Data:** projects, shots and notes live in Supabase and are shared live. Media (plates, renders, proxies) stays in the shared Drive folder and never goes to Vercel or Supabase.
- **Cost:** the free tiers of Vercel and Supabase cover this. A free Supabase project pauses after about a week with no activity; it wakes from the dashboard.
- **Running locally still works:** `npm run dev` in `vfx-supervision-app`, with `.env.local` holding the two keys above.
