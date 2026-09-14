# Motion web deployment, 2026-09-14

The owner authorized web publication at https://motiontimisoara.com after accepting
PR #77. The deployed application source is master commit
5f30541285b838ce40d7827bc35be01c6376c1b6. No mobile store release was requested.

Netlify project: motiontimisoara, 22f2a86a-422b-4fe6-a030-30b66012ebdd.
Production deploy: 6aa7a74bdcefc0c0a2320513. The local production build passed;
the published /assets/index-CLlqK0HT.js matches the local artifact byte for byte,
SHA-256 de1a723a056a9b338ab903cd7a830c1025e9ad5d88d31d803e719b77eb0f00c3.

Namecheap BasicDNS remains authoritative. The apex URL redirect was replaced with
A 75.2.60.5; www now points to motiontimisoara.netlify.app instead of the former
Railway frontend. The api Railway record, DKIM and Private Email configuration
were preserved. Public DNS confirmed both Private Email MX records. Netlify issued
TLS for the apex and www, expiring December 13, 2026. Standard HTTPS requests to the
apex return 200 without certificate overrides. The www alias belongs to the same site.

The SPA fallback serves index.html for application routes. HTTP checks returned 200
and the app root for /, /cursuri, /activitati, /tabere, /account/checkout and /login.
Chrome loaded the public homepage and authenticated the authorized audit parent
against the product backend, showing the account dashboard and existing children.

Supabase Site URL was corrected from localhost:3000 to https://motiontimisoara.com.
Allowed redirects now include the app's auth/callback route with return-query support
and /reset-password. Configuration was read back after saving. No recovery email
or Google OAuth flow was sent or exercised. Approved client build variables were
stored in Netlify; secret values are absent from the repository.

Stripe remains in test mode. This deployment does not establish live-money payments
or native-device behavior. The remaining broader #149 cash/native verification
items in the implementation specification are not silently marked complete here.

The Netlify configuration and local metadata ignore rule received local review:
the active React app is the sole publish directory, secrets are not tracked, and
route fallback preserves asset serving. This initial deployment uses a local CLI
upload; automatic repository-triggered publication has not been configured.
