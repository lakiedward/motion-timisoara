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

## Follow-up: video retention (slice 4)

Checked in production on 2026-10-20:

- The deletion date already shows under every video on the club, coach and parent cards (`AnnouncementMedia`, from `expires_at`, 30 days after upload).
- The cron job `curatenie-media-expirata` (migration 00024) is active and runs daily at 03:30 UTC; `purge-expired-media` is deployed. Each run returns early with a warning because the Vault secret `service_role_key` is missing, so two test videos that expired on 2026-09-26 are still in the bucket.
- While the job is blocked, those cards showed a deletion date in the past. The card now says "Filmarea se șterge în curând." once the date has passed, and the download stays available until the file is gone.

The job needs no code change. Once the owner adds the legacy `service_role` key to the Vault under `service_role_key`, one manual call of `public.cheama_purge_expired_media()` proves the deletion of both the files and the rows.
