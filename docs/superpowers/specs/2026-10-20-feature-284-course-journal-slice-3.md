# Feature #284 — Course journal, slice 3: a real video download

## Problem

Every announcement video shows "Descarcă" next to its deletion date, so parents can keep a copy before retention removes it. The link pointed at the same signed Storage URL the player uses. That URL lives on the Supabase domain, and browsers ignore the `download` attribute on cross-origin links, so the click opened the video in a new page instead of saving it. In the Capacitor WebView the link did nothing useful either.

## Change

- `getAtasamente` signs video paths a second time with Supabase's `download` option, which makes Storage answer with `Content-Disposition: attachment`. The file is named `filmare-motiontimisoara.<ext>`; paths are batched per extension, so one extra request covers all MP4 videos of a feed page. The player keeps the inline link.
- `AtasamentAfisabil` gains `linkDescarcare` (null for photos and external links). "Descarcă" uses it and falls back to the inline link.
- In the native app the click opens the download link in the system browser (`@capacitor/browser`, already used by Google sign-in), which handles attachments; the WebView does not.

No migration and no policy change: the same signed-URL permission applies.

## Tradeoffs

- One name per extension, not per video: a batched signing call accepts a single file name. Browsers add a counter when several downloads share it.
- The download link expires with the inline link (one hour), the same as today.

## Verification

- Unit tests for the extra signing call, the download name and the native branch.
- Browser on deploy-preview: the response for "Descarcă" carries `Content-Disposition: attachment`, and the browser saves the file instead of navigating. Native WebView behavior is not verifiable from the cloud and is reported as such.
