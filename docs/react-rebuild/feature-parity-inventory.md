I'll synthesize the nine area maps into one comprehensive feature parity inventory. This is a documentation synthesis task—I have all the source material in the prompt and need to combine it into a single well-organized markdown document.

# Feature Parity Inventory

> **Source of truth for rebuilding the Angular "Motion Timisoara" app in React + Supabase.** The Supabase backend (schema, RLS, Edge Functions, Storage, Realtime) is reused untouched. UI language is **Romanian** throughout. Money is stored in **minor units (bani / cents)** in the DB — divide by 100 for display, multiply for amounts sent to Edge Functions.

---

## 1. Master Route Table

### Public routes (under `CoreLayoutComponent` shell — shared header/footer)

| Path | Screen | Role | Purpose |
|------|--------|------|---------|
| `/` | Home / Landing | Public | Marketing landing: hero, programs, coaches, testimonials, CTAs |
| `/despre` | About | Public | Static about-us page |
| `/contact` | Contact | Public | Contact info + message form (→ `contact-form` EF) |
| `/cursuri` | Course Listing | Public | Browse/filter active courses |
| `/cursuri/:id` | Course Details | Public | Full course detail + booking sidebar + ratings + announcements |
| `/harta` | Map Page | Public | Leaflet map of locations with active courses/activities |
| `/activitati` | Activities Listing | Public | Browse one-off activities/workshops |
| `/activitati/:id` | Activity Detail | Public | Full activity detail + enroll |
| `/tabere` | Camps Listing | Public | Browse camps |
| `/tabere/:slug` | Camp Detail | Public | Full camp detail + enroll with payment-method choice |
| `/antrenori` | Coaches Listing | Public | Public coach directory with filters |
| `/antrenori/:id` | Coach Profile | Public | Full coach profile + their courses + rating |
| `/cluburi` | Clubs Listing | Public | Public club directory |
| `/cluburi/:id` | Club Detail | Public | Full club profile: info, sports, courses, coaches, contact |
| `/termeni`, `/terms` | Terms | Public | Static legal (linked, page TBD) |
| `/confidentialitate`, `/privacy` | Privacy | Public | Static legal (linked, page TBD) |
| `/gdpr` | GDPR | Public | Static legal (linked in footer) |

### Auth routes (public, lazy-loaded)

| Path | Screen | Role | Purpose |
|------|--------|------|---------|
| `/login` | Login | Public | Email/password + Google sign-in |
| `/signup` | Signup Choice | Public | Account-type picker (parent / club / coach) |
| `/register` | Register (Parent) | Public | Self-service PARENT account creation |
| `/register-coach` | Coach Signup | Public | 3-step invitation-gated COACH registration + Stripe hand-off |
| `/register-club` | Club Signup | Public | 3-step CLUB registration + branding upload + Stripe |
| `/forgot-password` | Forgot Password | Public | Request reset email |
| `/reset-password` | Reset Password | Public | Set new password from email link (`?token`) |
| `/auth/callback` | OAuth Callback | Public | Finalize Google OAuth, optional profile-completion dialog |

### Parent / Account routes (guard: `PARENT`, `COACH`, `ADMIN`)

| Path | Screen | Role | Purpose |
|------|--------|------|---------|
| `/account` | Parent Dashboard | PARENT (+ degraded staff view) | Welcome, stats, calendar, children, alerts |
| `/account/children` | Children List | PARENT | Manage children (list/add/edit/delete) |
| `/account/child/new` | Child Profile (create) | PARENT | Create child |
| `/account/child/:id` | Child Profile (edit) | PARENT | Edit child + photo + enrollments |
| `/account/enrollments` | Enrollments & Payments | PARENT | All children's enrollments + payment status + invoices |
| `/account/attendance` | Attendance History | PARENT | Per-child attendance grouped by course |
| `/account/announcements` | Announcements (parent feed) | PARENT | Aggregated coach/admin announcements (`?courseId=`) |
| `/account/checkout` | Checkout | PARENT | 4-step enroll + pay wizard (`?kind`, `?id`/`?slug`, `?payment`) |

### Coach routes (guard: `COACH`, `ADMIN`)

| Path | Screen | Role | Purpose |
|------|--------|------|---------|
| `/coach` → `/coach/dashboard` | Coach Dashboard | COACH | Overview: quick actions, KPIs, Stripe status, sessions, alerts |
| `/coach/courses` | Courses List | COACH | Grid of coach's courses + management |
| `/coach/courses/new` | Course Create | COACH | Create course (+ photos) |
| `/coach/courses/:id/edit` | Course Edit | COACH | Edit course (+ hero/gallery photos) |
| `/coach/courses/:id/announcements` | Course Announcements | COACH | Per-course announcement composer |
| `/coach/announcements` | Global Announcements | COACH | Aggregated feed + bulk composer |
| `/coach/activities` | Activities List | COACH | Grid of activities + participant/cash mgmt |
| `/coach/activities/new` | Activity Create | COACH | Create activity (+ hero photo) |
| `/coach/activities/:id/edit` | Activity Edit | COACH | Edit activity |
| `/coach/attendance-payments` | Attendance & Payments | COACH | Weekly calendar + attendance + cash + session top-ups |
| `/coach/locations` | Locations List | COACH | Browse/filter/manage locations |
| `/coach/locations/new` | Location Create | COACH | Create location (Leaflet + geocoding) |
| `/coach/locations/:id/edit` | Location Edit | COACH | Edit location |
| `/coach/my-clubs` | My Clubs | COACH | View clubs, join (code), leave |
| `/coach/stripe-onboarding/complete` | Stripe Complete | COACH (no guard — Stripe return) | Onboarding return landing |
| `/coach/stripe-onboarding/refresh` | Stripe Refresh | COACH (no guard) | Regenerate expired onboarding link |

### Club routes (guard: `CLUB`)

| Path | Screen | Role | Purpose |
|------|--------|------|---------|
| `/club` | Club Dashboard | CLUB | Branding, Stripe alert, invitation codes, coach roster |
| `/club/profile` | Profile / Settings | CLUB | Public info, contact, GDPR consent, billing/company |
| `/club/coaches` | Coaches List | CLUB | Manage roster + invitation codes |
| `/club/coaches/new` | Coach Create | CLUB | Create coach (account + profile) |
| `/club/coaches/:id/edit` | Coach Edit | CLUB | Edit coach |
| `/club/locations` | Locations List | CLUB | Manage venues |
| `/club/locations/new` | Location Create | CLUB | Create location (Leaflet) |
| `/club/locations/:id/edit` | Location Edit | CLUB | Edit location |
| `/club/courses` | Courses List | CLUB | Manage club courses |
| `/club/courses/new` | Course Create | CLUB | Create course (coach + payment recipient + photos) |
| `/club/courses/:id/edit` | Course Edit | CLUB | Edit course |
| `/club/attendance-payments` | Attendance & Payments | CLUB | Weekly calendar across club coaches + cash + sessions |
| `/club/announcements` | Announcements | CLUB | Club-wide announcements (priority) |
| `/club/stripe/onboarding/complete` | Stripe Complete | CLUB (no guard — Stripe return) | Onboarding return landing |
| `/club/stripe/onboarding/refresh` | Stripe Refresh | CLUB (no guard) | Regenerate expired onboarding link |

### Admin routes (guard: `ADMIN`; default `/admin` → `/admin/coaches`)

| Path | Screen | Role | Purpose |
|------|--------|------|---------|
| `/admin/coaches` | Coach List | ADMIN | Manage coaches + invitation codes |
| `/admin/coaches/new` | Coach Create | ADMIN | Create coach (+ photo + sports) |
| `/admin/coaches/:id/edit` | Coach Edit | ADMIN | Edit coach |
| `/admin/clubs` | Club List | ADMIN | View/administer clubs |
| `/admin/clubs/:id` | Club Form (edit only) | ADMIN | Edit club profile, billing, sports, logo |
| `/admin/users` | User List | ADMIN | Manage all users; role-based edit routing |
| `/admin/users/:id/edit` | Parent Form | ADMIN | Edit parent + manage children (full CRUD) |
| `/admin/sports` | Sports List | ADMIN | CRUD sports taxonomy |
| `/admin/courses` | Course List | ADMIN | Manage courses |
| `/admin/courses/new` | Course Create | ADMIN | Create course (coach selector + shared form) |
| `/admin/courses/:id/edit` | Course Edit | ADMIN | Edit course (+ hero/gallery) |
| `/admin/courses/:id/photos` | Course Photos | ADMIN | Dedicated gallery manager (drag-drop reorder) |
| `/admin/locations` | Location List | ADMIN | Manage venues |
| `/admin/locations/new` | Location Create | ADMIN | Create location (Leaflet + geocoding) |
| `/admin/locations/:id/edit` | Location Edit | ADMIN | Edit location |
| `/admin/camps` | Camp List | ADMIN | Manage camps |
| `/admin/camps/new` | Camp Create | ADMIN | Create camp |
| `/admin/camps/:campId/edit` | Camp Edit | ADMIN | Edit camp |
| `/admin/activities` | Activity List | ADMIN | Manage activities |
| `/admin/activities/new` | Activity Create | ADMIN | Create activity (+ hero photo) |
| `/admin/activities/:id/edit` | Activity Edit | ADMIN | Edit activity |
| `/admin/attendance-payments` | Attendance & Payments | ADMIN | Weekly calendar + attendance + cash + Realtime |
| `/admin/payments` | Payments | ADMIN | Cross-entity payment ledger + filters + CSV export |
| `/admin/reports` | Reports | ADMIN | **Stub** ("disponibilă în curând") |
| `/admin/settings` | Settings | ADMIN | **Stub** (not in header nav) |
| `/admin/schedule` | Schedule (legacy) | ADMIN | Read-only weekly schedule (superseded) |

### Catch-all

| Path | Screen | Role | Purpose |
|------|--------|------|---------|
| `**` | Not Found (404) | Public | 404 page |

---

## 2. Per-Portal Feature Inventory

### 2.1 Public Site

**Home / Landing (`/`)** — Hero ("Building Future Champions") with "Join the Team" (→ `/register`) and "View Programs" (→ `/cursuri`); animated count-up metrics (easeOutQuart, scroll-triggered); Training Pathways grid (top 3 courses); Coaches grid (top 4); static testimonials/gallery/moments/newsletter perks (hardcoded arrays); lightbox for moments gallery (keyboard arrows/Escape, looping); **simulated** newsletter form (no API, confetti + toast); `quickEnrollment()` legacy `prompt()`; mobile carousel with scroll-snap.
- **Data:** `getSchedule({size:12})` → `courses` (top-3 cards); `getCoaches()` → `coach_profiles` (top-4). No writes. Falls back to hardcoded `fallbackPrograms` on error/SSR.

**About (`/despre`)** — Fully static markup, scroll-reveal sections, scroll-progress bar. No data.

**Contact (`/contact`)** — Quick-contact buttons (`tel:+40750420455`, smooth-scroll to form); reactive form (name req min2, email req, subject optional, message req min10) with per-field RO validation; OpenStreetMap iframe (Str. Blaise Pascal 37, Dumbrăvița); "Obține indicații" Google Maps link.
- **Data:** `submitContact()` → EF `contact-form` (writes `audit_logs`, `target_entity_type='CONTACT_FORM'`; email send is TODO).

**Course Listing (`/cursuri`)** — Hero + count badge; sort dropdown (Recomandate/Rating↓/Rating↑/Alfabetic — client-side); `FilterPanelComponent` sidebar; grid of `CourseCardComponent`; skeleton cards; empty state.
- **Data:** `getSchedule(filters)` → `courses` (joins `sports`, `coach_profiles`→`profiles`, `locations`, `course_occurrences`), `.eq('active',true)`, page size 9. Server filters: sport (code→id lookup), level, age (`age_to>=ageFrom`/`age_from<=ageTo`), locationId, coachId, clubId. **Day-of-week filter is client-side only** (PostgREST can't express it). Weekday: JS Sun=0 → 7.
- **Filter Panel:** sport chips (single, from `sports` w/ hardcoded fallback), days multi-select (L/Ma/Mi/J/V/S/D → 1–7), level (hardcoded incepator/intermediar/avansat), age buckets (5), location select. Debounced 200ms.
- **Course Card:** hero (`course-photos` or gradient), sport/level/age, coach avatar (`coach-photos` by id, initials fallback), occurrences preview (deduped by weekday, max 7), price, Detalii/Înscrie-te.

**Course Details (`/cursuri/:id`)** — Back link, loading/error states, hero, info cards (Nivel/Vârstă/Locație/Capacitate), **WeekCalendar** sub-component, description, "Ce învățăm" (never populated), **CourseGallery** carousel, **CourseAnnouncements** feed, coach card, **LocationMap** (Leaflet). Booking sidebar: price, star-rating, spots/capacity bar + Sold Out/Ultimele N badges, enroll CTA, rate button (parents only), mobile fixed-bottom bar. **RatingDialog** for course rating.
- **Data:** `getCourse(id)` → `courses` single + joins + `course_photos`. **⚠️ Rating via legacy `RatingService` HTTP `/api/ratings/courses/:id/mine` + POST** (NOT migrated → must move to `course_ratings`). **⚠️ CourseAnnouncements via legacy `/api/parent/courses/:id/announcements`** (PARENT only, handles 403 as forbidden state; → must move to `course_announcements`).
- Sub-components: **LocationMap** (Leaflet, dynamic import, CartoDB Voyager tiles, custom 📍 marker, Google Maps popup, fallback text when no lat/lng, scrollWheelZoom off); **CourseGallery** (carousel, keyboard, thumbnails, excludes hero); **WeekCalendar** (Mon–Sun grouping, today marker, horizontal scroll).

**Map Page (`/harta`)** — Full Leaflet map (dynamic, CartoDB, custom markers/zoom controls), sidebar filters (Sport + City derived from data, RO-collated, NFD-normalized), location list (click flies + opens popup), marker popups (up to 5 courses/activities, links to detail or `/cursuri?locationId=`, wired via NgZone).
- **Data:** `forkJoin(getPublicLocations(), getSchedule({size:1000}), getActivities(false))`. Only locations with lat/lng + ≥1 matching course/activity shown. Activities without locationId matched by unique normalized name.

**Activities Listing (`/activitati`)** — Hero with feature pills; cards (hero `activity-photos` or 🎯, sport badge, "Încheiată" for past, date RO + time + location, price, spots, Detalii/Înscrie-te).
- **Data:** `getActivities(true)` → `activities` + sport/location joins, `active=true`, splits upcoming/past client-side. Listing `spotsLeft` always null. Past = local datetime < now.

**Activity Detail (`/activitati/:id`)** — Hero, date/time/duration, coach, description, **LocationMap** (reused), spots/Sold Out, enroll (auth-gated, disabled if past/sold out).
- **Data:** `getActivity(id)` → `activities` single + joins + `enrollments` count (`entity_type='ACTIVITY'`, `status='ACTIVE'`) → `spotsLeft=max(0,capacity-enrolled)`.

**Camps Listing (`/tabere`)** — Hero + scroll progress; Material camp cards (scroll-reveal, image-fallback): hero, title, date range, location, price. Links to `/tabere/:slug`.
- **Data:** `getCamps()` → `camps` (no active filter), `gallery_json` parsed, `soldOut` hardcoded false.

**Camp Detail (`/tabere/:slug`)** — Loading/error, hero + badges (Sold out / Plata cash), title/period/location/price/summary, enroll flow (not logged → `/login?redirect=`; logged → payment-options panel: card / cash (if allowCash) / cancel → `/account/checkout?kind=CAMP&slug=&payment=`), **rich-text mini-parser** for description (markdown-ish → heading/paragraph/list blocks), photo gallery strip.
- **Data:** `getCampBySlug(slug)` → `camps.eq('slug').single()`.

**Coaches Listing (`/antrenori`)** — Hero, count, sort (Recomandat/Rating↓/Rating↑/Alfabetic — rating no-op), `CoachFilterPanelComponent`, grid of `CoachCardComponent`, skeletons, empty state.
- **Data:** `getCoaches(filters)` → `coach_profiles` + `profiles` + `coach_sports`→`sports`. clubId→`club_coaches`, sportId→`coach_sports` lookups; empty match returns `[]`. (locationId collected but not filtered — minor gap.)

**Coach Profile (`/antrenori/:id`)** — Header (avatar `coach-photos`, name, headline, stat tiles), specializări (not populated), biography (`bio`), Cursuri predate grid, sidebar action card (rating display or "Fără evaluări", rate button parents-only, verified badge), **RatingDialog**.
- **Data:** `getCoach(id)` → `coach_profiles` single + joins + `courses` (active). `loadFullCourses` via `getSchedule({coachId})`. **⚠️ Rating via legacy `/api/ratings/coaches/...`** (→ `coach_ratings`).

**Clubs Listing (`/cluburi`)** — Hero, count, sort (Recomandat/Alfabetic/Oraș/Antrenori↓), clickable club cards (keyboard-accessible), skeletons (6), empty state.
- **Data:** `getPublicClubs()` → `clubs.eq('active',true)` + `club_sports`→`sports` + `club_coaches`. `coachCount`=joined length. Assets via `club-assets`.

**Club Detail (`/cluburi/:id`)** — Hero (cover+logo), info cards (Oraș/Antrenori/Sporturi/Website/Telefon), description read-more (>500 chars), sports list, Cursuri club grid, Antrenori club grid, Website section, sidebar Contact rapid (phone/email linkified), mobile fixed-bottom Website CTA.
- **Data:** `forkJoin(getPublicClub(id), getCoaches({clubId}), getSchedule({clubId}))`.

**Public cross-cutting:** scroll-progress bar + IntersectionObserver scroll-reveal on nearly every page; SSR guards (`isPlatformBrowser`); enroll/auth-gating CTA (logged → `/account/checkout?kind&id|slug`; else `/login?redirect=`); prices ÷100; image resolution (absolute URL passthrough else `storage(bucket).getPublicUrl`); loading idiom "Se încarcă...".

### 2.2 Auth

All public, `OnPush`, lazy-loaded. State via `AuthService.currentUser$` (`BehaviorSubject<User|null>`) hydrated by `onAuthStateChange` + `profiles` read. `User { id, name, email, role, phone?, oauthProvider?, avatarUrl?, needsProfileCompletion }`. `needsProfileCompletion = !profile.phone`.

**Login** — Hero + card, Google button, email (req,email) + password (req,min6), forgot link, scroll-reveal.
- **Data:** `signInWithPassword` → read `profiles`. Redirect: honors `?redirect`/`?returnUrl` (preserves all query params); else role default (ADMIN→`/admin`, CLUB→`/club`, COACH→`/coach`, else `/account`). 401→"Email sau parola sunt greșite."

**Signup Choice** — Three cards: Părinte→`/register`; Club→`/register-club` ("Stripe obligatorie"); Antrenor→`/register-coach` ("Necesită cod invitație"). Pure navigation.

**Register (Parent)** — Google button, name (req min3), email, password (min6), phone (`^\+?[0-9]{8,15}$`).
- **Data:** `signUp({options.data:{name,phone,role:'PARENT'}})` → trigger creates profile → read `profiles`. Redirect to `?redirect` else `/account`.

**Coach Signup** — 3-step wizard (Cod invitație / Date cont / Finalizare) with progress bar. Step 0: invitationCode (req min5, `COACH-XXXXXXXX`). Step 1: name/email/password (show-hide)/phone + sports multi-select chips (`Set<string>`). Step 2: review + Stripe notice + terms links + submit. Success view: if `stripeOnboardingUrl` → "Configurează Stripe" full-page redirect; else "Mergi la dashboard" → `/coach`.
- **Data:** sports via `SportService.getSports()`. Submit → EF `register-coach`. 400 invalid/expired/used code; 409 email exists. Step gating (can't leave step until valid).

**Club Signup** — 3-step wizard (Administrator / Club / Finalizare). Step 0: ownerName/email/password/phone. Step 1: clubName + optional desc/email/phone/city/address + sports chips. Step 2: review + submit. Success: **branding card** (logo + hero uploaders, preview, auto-save on select), optional Stripe card.
- **Data:** Submit → EF `register-club`. Branding → EFs `club-upload-logo`/`club-delete-logo`/`club-upload-hero-photo`/`club-delete-hero-photo`. Image validation: MIME jpeg/jpg/png/gif/webp, max 10MB, base64 data URL. Delete needs `confirm()`. 409 email exists.

**Forgot Password** — Single email field, success block (shown regardless for privacy).
- **Data:** `resetPasswordForEmail(email, {redirectTo: origin+'/reset-password'})`.

**Reset Password** — Reads `?token`; states: missing-token / form (password+confirm min6) / success. `password===confirmPassword` client-side.
- **Data:** `updateUser({password})` (relies on recovery session from email link; token is presence guard only).

**OAuth Callback** — Loading / error states; may open **ProfileCompletionDialog**. Reads `needsProfileCompletion`/`redirect`/`reason`/`returnUrl`. Redirect precedence: `popOAuthReturnUrl()` → `redirect` → `/account`. `reason` present → failure (mapped messages: missing_email, provider_mismatch, missing_provider_id, invalid_authentication).
- **Data:** `handleOAuthCallback()` → `me()` → `getSession()` + read `profiles`.

**Profile Completion Dialog** (no route, opened by callback) — name (req min3, prefilled) + phone (req pattern). `disableClose:true`.
- **Data:** `completeProfile({name,phone})` → `profiles.update`.

**Google Sign-in Button** (shared) — inline Google SVG, inputs `label`/`redirectUrl`/`disabled`, output `beforeRedirect`. → `signInWithOAuth({provider:'google', options.redirectTo:'/auth/callback?returnUrl='})`. Browser-only.

### 2.3 Parent / Account

No route guards inside module — gated by parent `/account` guard + RLS. Direct PostgREST reads scoped by RLS; complex mutations via Edge Functions. **Caveat:** `AccountService`/`ChildrenService` silently return mock data on error.

**Parent Dashboard (`/account`)** — Two views by role: *staff* (COACH/ADMIN) → role card + links to `/coach`/`/admin`; *parent* → hero with children names, quick-stats (children count, upcoming events), sidebar Acces Rapid (4 links w/ "Nou" badge), pending-cash alert, recent announcements (3), sessions overview (remaining/purchased, low-session warning ≤3), embedded `<app-calendar>`, children cards grid + "Adaugă copil".
- **Data:** `getParentOverview()` → `enrollments` (status ACTIVE/PENDING, joins children/courses→locations/payments/occurrences) + `payments`. `getCalendarEvents(start,+60d)` → `course_occurrences`. `loadChildren()` → `children`. **⚠️ `listParentFeed({limit:20})` → legacy `/api/parent/announcements`.**

**Children List (`/account/children`)** — Scroll-progress, child cards (avatar, name, age, emergency phone, allergies), Editează/Prezențe/delete per card, delete loads enrollments first then **DeleteChildDialog**.
- **Data:** `loadChildren()`, `getEnrollments()` (active count), `deleteChild(id)`.
- **DeleteChildDialog** — warning header, impact card if active enrollments >0 (cancels enrollments, removes payments/attendance), Ireversibil banner, returns boolean.

**Child Profile (`/account/child/new`|`/:id`)** — Edit mode: profile hero, photo upload (hidden file input), meta rows. Form: Nume (req min2), Nivel (select), Data nașterii (date, req), Alergii, Contact urgență + phone (`^[0-9+ ]{6,20}$`), Contact secundar + phone, Mărime tricou (XXS–XXL), GDPR checkbox (always disabled+true). Edit mode shows read-only enrollments list.
- **Data:** `getChild(id)` (cache-first), `saveChild()` (**only persists name→first/last, birth_date, allergies→notes — level/emergency/secondary/tshirt NOT mapped to DB**). `uploadChildPhoto` → Storage `child-photos` path `children/{id}/photo`. Photo validation: types + ≤10MB.
- **Child Form Dialog** (alternate, not routed) — simpler Material dialog variant; legacy/secondary.

**Enrollments & Payments (`/account/enrollments`)** — Enrollment cards (kind badge Curs/Tabără/Activitate, status badge, detail rows, sessions remaining/purchased w/ low badge), pending-cash alert per card, payment section (amount RON ÷100, status, date, CARD pending/failed messages, optional invoice link — always undefined).
- **Data:** `getEnrollments()` → `enrollments` + joins. Client: filter missing childId, sort by payment date desc, dedupe by `childId|title|period`. Status/payment normalization to RO labels.

**Calendar** (shared `app-calendar`, embedded) — prev/next month, Mon-first 6-week grid (42 cells), ≤3 markers/day (color by type), legend (Curs/Tabără/Prezență), selected-day event list. Receives `events` via input. Today auto-selected if events.

**Attendance History (`/account/attendance`)** — Scroll-progress, child selector (>1 → select), overall stats (Total Prezent/Absent/rate%), per-course cards (rate% --good if ≥80%, present/absent/total, recent 10 sessions w/ status icon, "Arată toate/mai puține" toggle).
- **Data:** `loadChildren()`, `getChildAttendance(childId)` → `attendance` filtered `child_id`, joined `course_occurrences`→`courses`, grouped client-side. Status: ABSENT/EXCUSED/else present. Rates exclude excused.

**Announcements (`/account/announcements`, `?courseId=`)** — Hero + "Nou" badge (7d), course filter (chips ≤6 else select), feed cards (author avatar/name/role, date, course, pinned icon, content), attachments (images grid → Lightbox; videos `<video>` for VIDEO_FILE, `<app-video-embed>` for VIDEO_LINK), infinite scroll (IntersectionObserver, client pageSize 20 over fetched 50).
- **Data:** **⚠️ `listParentFeed({courseId,limit:50})` → legacy `/api/parent/announcements`.** Media via Storage `announcement-attachments` path `{courseId}/{announcementId}/{attachmentId}`.

**Checkout (`/account/checkout`)** — 4-step `mat-stepper` (linear, responsive orientation): (1) **Copii** — checkbox list, per-child validation badges (eligible/age error/conflict warning), inline add-child form; (2) **Confirmă detalii** — session-package selector (5/10/20 + custom, courses only), per-child price, total, accept-rules checkbox; (3) **Date facturare** — name/email/addressLine1/city/postalCode (CARD only); (4) **Plată** — order summary, payment radio (Card always; Cash if allowCash), Stripe Card Element (`#cardElement`), cash banner, Finalizează.
- **Data:** `getCourse/getActivity/getCampBySlug`; `loadChildren()`, `createChild()`, `validateChildren()` → EF `validate-enrollment`; `createEnrollment()` → EF `create-enrollment`; `createIntent()` → EF `create-payment-intent` → `stripe.confirmCardPayment` (20s timeout); `cancelDraftEnrollment()` → EF `cancel-draft-enrollment` (rollback). **Realtime:** channel `user:{userId}:payments`, events `enrollment_ready`/`payment_failed`; after card payment waits ≤15s for `enrollment_ready`.
- **Pricing:** COURSE = pricePerSession×sessionPackageSize×childCount; CAMP/ACTIVITY = price×childCount. Cents ÷100 display. Default package 10. Stripe.js from `window.STRIPE_PUBLISHABLE_KEY`/`NG_APP_STRIPE_KEY`.

> **Parent area flags:** `SessionPurchaseService` exists (→ EF `purchase-sessions`) but no component calls it. `validate-enrollment`/`cancel-draft-enrollment` not in CLAUDE.md's EF table but exist in client code.

### 2.4 Coach

Gated `COACH`/`ADMIN`. `CoachService` central. Money in bani (×/÷100). Course monthly `price = pricePerSession × 8`.

**Coach Dashboard (`/coach`→`/coach/dashboard`)** — Hero, quick-action cards (Curs Nou/Anunț/Prezență/Cursuri/Alătură-te Club→JoinClubDialog), 4 stat cards, Payment Status Card (3 states by paymentDestination COACH/CLUB/NONE), Sesiuni Următoare (first 5), Alerte (course with enrolledUnpaidCount>2).
- **Data:** `getMyCourses()`, `getWeeklyCalendar(weekStart)` → EF `get-weekly-calendar`, `getStripeAccountStatus()` → EF `stripe-connect{action:'status'}`, onboarding link → `stripe-connect{action:'onboarding-link'}`. averageAttendance hardcoded 85.

**Join Club Dialog** — code input (`XXXX-XXXX`, uppercased), → EF `join-club`, auto-close 1.5s.

**Courses List (`/coach/courses`)** — Hero + Adaugă Curs, 3 stats, course cards (hero `course-photos/{id}/hero`, status badge, paid/unpaid counts), per-card Anunțuri/Editează/Toggle/Șterge.
- **Data:** `getMyCourses()`; toggle → `courses.update({active})`; delete → EF `delete-course` (native confirm).

**Course Wrapper + Form (`/coach/courses/new`|`/:id/edit`)** — `CoachCourseWrapperComponent` embeds shared `CourseFormComponent`. Sections: (1) Detalii (Nume min3, Sport, Nivel, Descriere); (2) Participanți (vârstă min/max, capacitate, preț/ședință RON, package config `număr:preț`, `LocationPickerComponent`); (3) Program (day chips toggling time rows, schedule preview); (4) Încasări & Club (Stripe warning, club select, payment recipient COACH/CLUB radio). Photos: hero (single) + gallery (multi, delete).
- **Data:** `getCourse(id)`, `getCoursePhotos(id)`; save → EF `create-course`/`update-course` (recurrenceRule JSON, clubId, paymentRecipient, heroPhoto base64); gallery → EF `upload-course-photo`/`delete-course-photo`. **Validations:** ageRange (from≤to), ≥1 valid schedule day (end>start), pricing RON→bani, recurrence JSON `{daySchedules:{"1-7":{start,end}}}`, paymentRecipient=CLUB disabled unless clubId. Photo types + 10MB.

**Course Announcements (`/coach/courses/:id/announcements`)** — Composer (content, images ≤10@≤4MB, video files ≤2@≤150MB + URL links ≤2, pin checkbox), list (pinned-first, pin/delete, gallery + VideoEmbed).
- **Data:** **⚠️ legacy `AnnouncementsService`** GET/POST/`/upload`/PATCH pin/DELETE `/api/coach/courses/{id}/announcements`. Attachments via Storage `announcement-attachments`.

**Global Announcements (`/coach/announcements`)** — Course filter select (`?course=`), pinned/recent counts, composer (specific course → that composer; "all" → inline bulk), aggregated list. Bulk post = forkJoin per course.
- **Data:** `getMyCourses()` + `forkJoin(listCoach per course)`.

**Activities List (`/coach/activities`)** — Hero + Activitate Nouă, 3 stats, activity cards (status/sport badges, date/time/location/price ÷100, enrolled/capacity), Participanți/Editează/Toggle/Șterge. **Participants dialog** (custom overlay): enrollees w/ status + payment + "Confirmă Plata" for CASH+PENDING.
- **Data:** `getMyActivities()`; toggle → `activities.update`; delete → EF `delete-activity`; participants → `enrollments` (`entity_type='ACTIVITY'`); confirm cash → `payments.update({status:'SUCCEEDED',paid_at})`.

**Activity Form (`/coach/activities/new`|`/:id/edit`)** — Nume(≤255)/Descriere/Sport/Locație/Data/Ora start/final (HH:MM regex)/Preț RON/Capacitate/Activ + hero photo.
- **Data:** **⚠️ dropdowns via legacy `HttpClient` `/api/public/locations` + `/api/public/sports`**; load `getActivityById`; save → EF `create-activity`/`update-activity`; hero → EF `upload-activity-hero-photo`/`delete-activity-hero-photo`.

**Attendance & Payments (`/coach/attendance-payments`)** — Week navigator (Monday-anchored, ro-RO), 3 stats, Plăți cash în așteptare (Confirmă cash), weekly calendar (per-coach → 7 days → session cards) → **AttendanceModalComponent** (shared from admin; returns save/addSessions/addSessionsAll).
- **Data:** `getWeeklyCalendar` → EF `get-weekly-calendar`; `getSessionAttendance` → EF `get-session-attendance`; save → EF `mark-session-attendance`; `purchaseSessions` → EF `purchase-sessions` (CASH); pending cash via `CoachPendingPaymentsService` (`payments` PENDING+CASH, `markCashPaid`).

**Locations List (`/coach/locations`)** — Hero + Adaugă, city filter, search, recent locations, cards (type, active toggle, edit, delete via PremiumConfirmDialog).
- **Data:** **⚠️ legacy core `LocationService`** (`/api/locations/...` `withCredentials`). `canManage`: ADMIN all; COACH only own + no clubId.

**Location Form (`/coach/locations/new`|`/:id/edit`)** — Nume(min2)/Oraș/Tip(POOL/TRACK/GYM/OTHER)/Adresă/Lat/Lng + Leaflet map (CartoDB, RO bounds, draggable marker), address search (geocode) + reverse-geocode on move (debounced 400ms).
- **Data:** **⚠️ legacy `LocationService`** CRUD; `GeocodingService` (Nominatim). Leaflet from unpkg CDN, browser-only.

**My Clubs (`/coach/my-clubs`)** — Join form (`^[A-Z0-9]{4}-[A-Z0-9]{4}$`, auto-normalized), club cards (initials, payment/Stripe badges), leave (PremiumConfirmDialog).
- **Data:** `getMyClubs()` → `coach_profiles`→`club_coaches`→`clubs`; `joinClub` → EF `join-club`; `leaveClub` → EF `leave-club`. `canReceivePayments = stripe_onboarding_complete`.

**Stripe Onboarding Complete (`/coach/stripe-onboarding/complete`)** — outside layout. States: loading / complete (success + links) / pending. `refreshStripeStatus()` → EF `stripe-connect{action:'refresh-status'}`.

**Stripe Onboarding Refresh (`/coach/stripe-onboarding/refresh`)** — auto-regenerate expired link → `stripe-connect{action:'onboarding-link'}` → redirect.

> **Coach EFs not yet in `supabase/functions/`** (must be authored): `create-course`, `update-course`, `delete-course`, `upload-course-photo`, `delete-course-photo`, `export-participants-csv`, `create-activity`, `update-activity`, `delete-activity`, `upload-activity-hero-photo`, `delete-activity-hero-photo`, `join-club`, `leave-club`, `get-today-attendance`, `mark-attendance`, `mark-course-attendance`, `get-weekly-calendar`, `get-session-attendance`, `mark-session-attendance`, `purchase-sessions`.

### 2.5 Club

Mounted `/club`, gated `CLUB`. Stripe routes outside guard. `ClubService` derives club id from `clubs.owner_user_id = auth user`. Money in cents.

**Dashboard (`/club`)** — Hero (logo + cover, inline edit), Personalizare branding editor (logo + hero upload/replace/delete auto-save), alerts (Stripe not configured, branding missing), stats (coach count, active codes, Stripe status), invitation codes (filter chips Recente/Active/Folosite/Toate, copy, delete, uses counter, used-by), coaches grid (avatar, sports, Stripe badge, edit/remove), "Invită Antrenor" (generate code maxUses:1/30d, auto-copy).
- **Data:** `getProfile()`, `getStats()`, `getCoaches()`, `getInvitationCodes()`; EFs `club-create-invitation-code`/`club-remove-coach`/`club-upload-logo`/`club-delete-logo`/`club-upload-hero-photo`/`club-delete-hero-photo`/`club-stripe-onboarding-link`/`club-stripe-dashboard-link`; direct delete code. Storage `coach-photos`, `club-assets` (cache-bust `?v=`).

**Profile / Settings (`/club/profile`)** — 3 sections: Date publice (name*/desc/website), Contact (email, publicEmailConsent slide-toggle + privacy notice, phone/address/city), Date facturare (companyName/CUI/reg/address/IBAN/bankName). GDPR: withdraw-consent button via PremiumConfirmDialog (warning).
- **Data:** `getProfile()`/`updateProfile()` direct `clubs` update; `withdrawEmailConsent()` sets `public_email_consent=false`.

**Coaches List (`/club/coaches`)** — Richer dashboard version: Invită Antrenor + Creează Antrenor (→ `/club/coaches/new`), stats, invitation codes (filter chips + `isExpired()`), coaches grid.
- **Data:** `getCoaches()`, `getInvitationCodes()`, `createInvitationCode()` → EF `club-create-invitation-code`, delete code direct, `removeCoach()` → EF `club-remove-coach`. (Unused `CreateCoachDialogComponent` exists.)

**Coach Form (`/club/coaches/new`|`/:id/edit`)** — Photo upload (10MB, image types), sports multi-select, name (req min3), email, password (req min8 create / optional edit), phone (`^\+?[0-9]{8,15}$`), bio.
- **Data:** `getCoachById()`, `createCoach()` → EF `club-create-coach`, `updateCoach()` → EF `club-update-coach`. Photo via `coach-photos` base64.

**Locations List (`/club/locations`)** — Hero + Adaugă, stats, location cards (type, active toggle mini-switch, edit/delete via PremiumConfirmDialog danger).
- **Data:** `getLocations()` **derived** (read `courses` where club_id → distinct location_ids → `locations` in(...)); `updateLocation()`/`deleteLocation()` direct.

**Location Form (`/club/locations/new`|`/:id/edit`)** — name(min2)/city/type(POOL/GYM/OUTDOOR/TRACK/OTHER)/address/lat/lng + Leaflet (CartoDB, RO bounds, draggable, reverse-geocode, forward search).
- **Data:** `createLocation()`/`updateLocation()` direct `locations` (insert sets type??'OTHER', active:true); `GeocodingService`.

**Courses List (`/club/courses`)** — Hero + Adaugă, stats, course cards (sport/active badges, edit/toggle/delete), footer price÷100 + capacity.
- **Data:** `getCourses()` (filtered club_id), `getCourseStats()`, `setCourseStatus()` direct, `deleteCourse()` → EF `club-delete-course` (force flag). **409 → re-open DeleteCourseDialog force mode.**

**Course Form (`/club/courses/new`|`/:id/edit`)** — Antrenor & Plăți (coach select w/ Stripe badge, payment recipient CLUB/COACH — COACH disabled unless canReceivePayments), Media (hero + gallery w/ CDK drag-drop reorder, edit uploads immediately / create queues), reuses coach `CourseFormComponent` sub-form (`showClubPaymentSection=false`).
- **Data:** `getCoaches()`, `getCourseById()` (occurrences→schedule slots), `getCoursePhotos()`; create → EF `club-create-course`, update → EF `club-update-course`, photos → EF `club-upload-course-photo`/`club-delete-course-photo`, reorder direct `display_order`. If recipient=COACH but no Stripe → force CLUB.

**Attendance & Payments (`/club/attendance-payments`)** — Week nav (Monday), stats, pending cash payments (Confirmă cash), weekly calendar per coach → **AttendanceModalComponent**.
- **Data:** EFs `club-weekly-calendar`/`club-session-attendance`/`club-mark-session-attendance`/`purchase-sessions`; `getPendingCashPayments()` derived chain (clubs→courses→enrollments→payments PENDING+CASH); `markCashPaid()` direct. Uses `PendingPaymentsService<T>` base + `ClubPendingPaymentsService`.

**Announcements (`/club/announcements`)** — Hero + Adaugă, stats (incl. hardcoded "Vizualizări 0"), inline add form (title/content/priority LOW/NORMAL/HIGH/URGENT), list (priority+active badges, toggle active, delete native confirm).
- **Data:** `getAnnouncements()` → `club_announcements` + author, `createAnnouncement()`/`updateAnnouncement()`/`deleteAnnouncement()` direct.

**Stripe Onboarding Complete/Refresh** — same pattern as coach; EFs `club-stripe-status`/`club-stripe-onboarding-link`.

> **Club cross-feature reuse:** admin `DeleteCourseDialogComponent`, admin `AttendanceModalComponent`, admin `SportService`, coach `CourseFormComponent`, shared `PremiumConfirmDialogComponent`/`ProductLabelPipe`/`GeocodingService`.

### 2.6 Admin

All children of `AdminLayoutComponent`. Two services: `AdminService` (main) + `AdminApiService` (payments/schedule/attendance). Money in bani. Common shell: hero + 3-card stats + section-card + filter chips + loading/empty/error states.

**Coach List (`/admin/coaches`)** — Invită + Creează CTAs, stats, Invitation Codes section (filter chips, status badge, copy, used-by, counter, delete/revoke), Coaches grid (search diacritic-insensitive, city filter, photo/initials, sport badges, course count, edit/delete).
- **Data:** `getAllCoaches`, `getInvitationCodes` (forkJoin); generate → EF `admin-create-invitation-code`; delete code → `revokeInvitationCode` if uses>0 else hard delete; delete coach → EF `admin-delete-coach({force})` (409 re-prompt force).

**Coach Form (`/admin/coaches/new`|`/:id/edit`)** — name(min3)/email/password(req min8 create, optional edit)/phone/bio/sports multi-select/photo.
- **Data:** `SportService.getSports`, `getCoachById`; create → EF `admin-invite-coach` (base64 photo); edit → EF `admin-update-coach`. 10MB/image types.

**Club List (`/admin/clubs`)** — stats, status filter chips, club cards (logo/initials, counts, Stripe indicator, edit/toggle/delete).
- **Data:** `getAllClubs`; toggle → `setClubStatus`; delete → **DeleteClubDialog** → EF `admin-delete-club({force:true})`.
- **DeleteClubDialog** — dependency warning (coach/course counts), Șterge oricum vs Confirmă.

**Club Form (`/admin/clubs/:id`, edit only)** — name/email/phone/website/desc/address/city + Company info (companyName/CUI/regNumber/address/bankAccount/bankName) + sports checkboxes + logo.
- **Data:** `forkJoin(getClubById, getAllSports)`; save → `updateClub` direct + `forkJoin(updateClubSports delete+reinsert, uploadClubLogo?)`; logo → EF `admin-upload-club-logo`.

**User List (`/admin/users`)** — stats, status + role chip groups, entity cards (avatar candidate chain coach photo→club logo→avatars bucket→initials, OAuth badge, role/active badges, children/enrollments counts). **Edit routing by role:** COACH→`/admin/coaches/:id/edit`; CLUB→`/admin/clubs/:clubId`; PARENT→`/admin/users/:id/edit`; ADMIN/other→inline edit form.
- **Data:** `getAllUsers` (`profiles` + children counts + club ownership); inline save → `updateUser`; toggle → `setUserStatus`; delete → **DeleteUserDialog** → EF `admin-delete-user({force})`. **ADMIN users cannot be toggled/deleted.**
- **DeleteUserDialog** — 3 modes: ADMIN blocked / has-dependencies (impact list) / clean. Returns `{confirmed, force}`.

**Parent Form (`/admin/users/:id/edit`)** — Parent form (name min3/email/phone) + children inline CRUD (name min2/birthDate/level/allergies/emergency contact+phone/secondary contact+phone/tshirt/photo, computed age, enrollment count).
- **Data:** `forkJoin(getUserById, getUserChildren)`; parent → `updateUser`; child create → `createUserChild` + `uploadUserChildPhoto` (EF `admin-upload-child-photo`); child update → `updateUserChild`; child delete → EF `admin-delete-child({force:true})`.

**Sports List (`/admin/sports`)** — sorted, duplicate-code/name counts, add/edit → **SportDialog**, delete → PremiumConfirmDialog.
- **Data:** `SportService` `getSports`/`createSport`/`updateSport`/`deleteSport`. Delete fails on FK reference.
- **SportDialog** — name (req min2), code auto-generated (lowercase, strip diacritics, spaces→`_`) with live preview.

**Course List (`/admin/courses`)** — stats, course cards (hero photo, active toggle, enrolled/reserved counts, edit/delete + photos link).
- **Data:** `getAllCourses` + enrollment counts; toggle → `setCourseStatus`; delete → **DeleteCourseDialog** → EF `admin-delete-course` (409 re-prompt force).

**Course Form (`/admin/courses/new`|`/:id/edit`)** — coach selector (req) + shared `CourseFormComponent` + hero photo + gallery (add/delete/reorder move left-right debounced).
- **Data:** `getAllCoaches`, `getCourseById`; save → EF `admin-create-course`/`admin-update-course` (recurrenceRule JSON); hero → EF `admin-upload-course-hero-photo`/`admin-delete-course-hero-photo`; gallery → `getCoursePhotos`, EF `admin-upload-course-photo`/`admin-delete-course-photo`, `reorderCoursePhotos`. pricePerSession fallback = price/8.

**Course Photos (`/admin/courses/:id/photos`)** — upload, delete (confirm), CDK drag-drop reorder.
- **Data:** `getCoursePhotos`, EF upload/delete photo, `reorderCoursePhotos`.

**Camp List (`/admin/camps`)** — stats, camp cards (period, price, enrolled/capacity, computed status, edit, archive stub).
- **Data:** `getAllCamps` + enrollment counts.

**Camp Form (`/admin/camps/new`|`/:campId/edit`)** — title(min3)/periodStart/periodEnd/locationText/price RON/capacity/allowCash/description/imageUrls textarea. Cross-field `invalidPeriod` (end≥start).
- **Data:** save → `createCamp`/`updateCamp` direct `camps`. slug auto-generated. galleryJson = URL array. Price→bani.

**Activity List (`/admin/activities`)** — stats, activity cards (date/time/price/capacity, enrolled/reserved, active toggle, edit, delete native confirm).
- **Data:** `getAllActivities` + counts; toggle → `setActivityStatus`; delete → direct `activities.delete()`.

**Activity Form (`/admin/activities/new`|`/:id/edit`)** — name(max255)/desc/coachId/sport/locationId/activityDate/startTime/endTime(HH:MM)/price RON/capacity/active + hero photo.
- **Data:** coaches `getAllCoaches`; **⚠️ locations & sports via legacy `HttpClient` `/api/public/locations` + `/api/public/sports`**; save → `createActivity`/`updateActivity` direct (sport_id resolved from code, price→bani); hero → EF `admin-upload-activity-hero-photo`/`admin-delete-activity-hero-photo`.

**Location List (`/admin/locations`)** — stats, type filter chips, cards (type icon/label, edit/delete via PremiumConfirmDialog).
- **Data:** `AdminLocationService` `getAll`/`delete` direct `locations`. FK fail message.

**Location Form (`/admin/locations/new`|`/:id/edit`)** — name(min2)/type/address/lat/lng + Leaflet (CartoDB, RO bounds, draggable Uber-style center-pin, address search → reverse-geocode debounced 400ms).
- **Data:** `AdminLocationService` `getById`/`create`/`update` direct; `GeocodingService`.

**Payments (`/admin/payments`)** — stats, filter form (kind/status/method/coachId/from/to, auto-reload), Material table (child/parent/product/coach/method/status/amount/updated/actions), Marchează cash, Export CSV.
- **Data:** `AdminApiService` `getCoaches`, `getPayments` → EF `admin-get-payments`, `exportPaymentsCsv` → EF `admin-export-payments-csv` (Blob download), `markCashPaid` direct.

**Attendance & Payments (`/admin/attendance-payments`)** — Week navigator (Monday, ro-RO), calendar grid per coach → day columns → session cards → **AttendanceModal**. Modal: hero, stat cards (Total/Prezenți/Atenție), quick actions Toți Prezenți(P)/Absenți(A), per-child presence toggle + remaining/used + low-session warning + expandable +5/+10/+15/custom purchase panel, keyboard shortcuts. Returns save/addSessions/addSessionsAll.
- **Data:** `AdminApiService` `getWeeklyCalendar` → EF `admin-weekly-calendar`; `getSessionAttendance` → EF `admin-session-attendance`; save → EF `admin-mark-session-attendance`; top-up → EF `purchase-sessions`. **Realtime:** `sessionPurchase$` → toast + reload calendar + live-refresh open modal.

**Reports (`/admin/reports`)** — Stub. **Settings (`/admin/settings`)** — Stub (not in header). **Schedule (`/admin/schedule`)** — legacy read-only weekly schedule (`getWeeklySchedule` → `course_occurrences`).

> **Admin dead code (NgModule artifacts, not route-reachable):** `AdminCourseDialogComponent`, `AdminCampDialogComponent`, `AdminLocationDialogComponent`, `InviteCoachDialogComponent`, `AdminCoachesComponent`. Verify before porting.

### 2.7 Shared / Core Chrome (consumed by all portals)

- **Core Layout:** `CoreLayoutComponent` (Header + Outlet + Footer + FabAccount + LoaderOverlay).
- **Header:** context-aware nav. Public dropdowns (Programe/Hartă/Echipă/Despre); guest "Cont" → login/register; authenticated avatar dropdown + role-gated menus (Contul meu / Antrenor [COACH+ADMIN] / Club [CLUB] / Admin [ADMIN]). Hover+click dropdowns, scroll state, mobile drawer, avatar resolution chain (coach-photos → avatars bucket → initials).
- **Footer:** static — brand, contact, link groups (Navigare/Programe/Legal/Social), copyright.
- **FabAccount:** floating button, visible when logged in, → `/account`.
- **Shared components:** form-error, lightbox, loader-overlay, location-picker (ControlValueAccessor, most complex — search/recent/inline-create/Leaflet map modal), premium-confirm-dialog (warning/danger variants), rating-dialog (1–5 stars + comment), skeleton-loader, star-rating (half-star support), video-embed (YouTube/Vimeo/Drive/mp4/link), toast-container.
- **Directives:** image-fallback, scroll-reveal, tooltip.
- **Pipes:** image-only, video-only, product-label, safe.
- **Shared services:** loading-indicator (ref-counted, 200ms debounce), error-snackbar (responsive placement).
- **Utils:** image-upload (`validateImageFile` 10MB + MIME allowlist, `readFileAsDataUrl`), string-utils (`getInitials`).

---

## 3. Flat Parity Checklist

> Every distinct screen and capability the React app must implement. `[stub]` = static placeholder; `[legacy]` = currently on Spring Boot `/api`, must be reimplemented on Supabase.

**Public site**
- [ ] Home/landing (hero, count-up metrics, top-3 programs, top-4 coaches, testimonials, gallery+lightbox, simulated newsletter, mobile carousel)
- [ ] About page (static)
- [ ] Contact page + form → `contact-form` EF
- [ ] Course listing (sort, filter panel, cards, client-side day-of-week filter, age semantics)
- [ ] Course details (week calendar, gallery, location map, coach card, booking sidebar, ratings, announcements)
- [ ] `[legacy]` Course ratings (display + my-rating + submit) → `course_ratings`
- [ ] `[legacy]` Course announcements feed (parent-only) → `course_announcements`
- [ ] Map page (Leaflet, sport/city filters, marker popups, fly-to)
- [ ] Activities listing (upcoming/past split, cards)
- [ ] Activity detail (+ live spots count)
- [ ] Camps listing
- [ ] Camp detail (rich-text parser, payment-method choice flow)
- [ ] Coaches listing (filter panel, cards)
- [ ] `[legacy]` Coach ratings → `coach_ratings`
- [ ] Coach profile (courses grid, rating sidebar)
- [ ] Clubs listing (sort, cards)
- [ ] Club detail (info, sports, courses, coaches, contact, read-more)

**Auth**
- [ ] Login (email/password + Google + redirect logic)
- [ ] Signup choice hub
- [ ] Register parent
- [ ] Coach signup 3-step wizard (invitation code → `register-coach` EF + Stripe hand-off)
- [ ] Club signup 3-step wizard (→ `register-club` EF + branding upload + Stripe)
- [ ] Forgot password
- [ ] Reset password
- [ ] OAuth callback + profile-completion dialog
- [ ] Google sign-in button (shared)

**Parent / Account**
- [ ] Parent dashboard (parent view + degraded staff view)
- [ ] Children list + delete-child dialog
- [ ] Child profile create/edit + photo upload (`child-photos`)
- [ ] Enrollments & payments list
- [ ] Calendar component (month grid)
- [ ] Attendance history (per-child, per-course rates)
- [ ] `[legacy]` Parent announcements feed → `course_announcements`
- [ ] Checkout 4-step wizard (validate-enrollment, create-enrollment, payment-intent, cash, realtime wait)

**Coach**
- [ ] Coach dashboard (stats, Stripe status, sessions, alerts)
- [ ] Join-club dialog
- [ ] Courses list (toggle, delete)
- [ ] Course create/edit form + hero + gallery
- [ ] `[legacy]` Course announcements composer (per-course)
- [ ] `[legacy]` Global announcements feed + bulk composer
- [ ] Activities list + participants dialog + cash confirm
- [ ] Activity create/edit form + hero
- [ ] Attendance & payments (weekly calendar, attendance modal, pending cash, session top-ups)
- [ ] `[legacy]` Locations list (canManage rules)
- [ ] `[legacy]` Location create/edit form + Leaflet + geocoding
- [ ] My clubs (join/leave)
- [ ] Stripe onboarding complete page
- [ ] Stripe onboarding refresh page

**Club**
- [ ] Club dashboard (branding editor, invitation codes, coach roster)
- [ ] Profile/settings (public/contact/GDPR/billing)
- [ ] Coaches list + invitation codes
- [ ] Coach create/edit form + photo
- [ ] Locations list (derived from courses)
- [ ] Location create/edit form + Leaflet
- [ ] Courses list (force-delete on 409)
- [ ] Course create/edit form (coach + payment recipient + gallery drag-drop)
- [ ] Attendance & payments (weekly calendar, attendance modal, pending cash)
- [ ] Announcements (priority, toggle active)
- [ ] Stripe onboarding complete page
- [ ] Stripe onboarding refresh page

**Admin**
- [ ] Coach list + invitation codes
- [ ] Coach create/edit form
- [ ] Club list + delete-club dialog
- [ ] Club form (edit only)
- [ ] User list (role-based edit routing, ADMIN protection)
- [ ] Delete-user dialog (3 modes)
- [ ] Parent form (+ children inline CRUD)
- [ ] Sports list + sport dialog (code auto-gen)
- [ ] Course list + delete-course dialog
- [ ] Course create/edit form + hero + gallery
- [ ] Course photos standalone manager (drag-drop)
- [ ] Camp list
- [ ] Camp create/edit form
- [ ] Activity list
- [ ] Activity create/edit form + hero (`[legacy]` dropdowns)
- [ ] Location list
- [ ] Location create/edit form + Leaflet
- [ ] Payments ledger + filters + CSV export
- [ ] Attendance & payments + attendance modal + Realtime live-refresh
- [ ] `[stub]` Reports page
- [ ] `[stub]` Settings page
- [ ] Schedule (legacy read-only) — optional/deprecated

**Cross-cutting capabilities**
- [ ] Supabase client singleton + SSR-safe session handling
- [ ] AuthContext (currentUser$, onAuthStateChange, profile load, needsProfileCompletion=!phone)
- [ ] Route guards (authGuard equiv, roleGuard equiv) with redirects (`/login?returnUrl`, `/`)
- [ ] Realtime subscriptions (`user:{id}:payments`, `admin:session-purchases`)
- [ ] Stripe.js card payment + Connect onboarding redirects (coach + club)
- [ ] Leaflet maps (CartoDB Voyager, RO bounds) + Nominatim geocoding
- [ ] Image/file upload (10MB + MIME, base64 → Edge Functions; signed URLs for private buckets)
- [ ] Star ratings UI + rating dialog
- [ ] Romanian copy + `ro-RO` locale + Romanian route slugs
- [ ] Toast notifications (persistent errors, 5s others)
- [ ] Loader overlay (global loading, 200ms debounce)
- [ ] Lightbox, video-embed, location-picker, scroll-reveal, premium-confirm-dialog, skeleton-loader (shared)
- [ ] Money cents↔display conversion (÷100 / ×100) everywhere

---

## 4. Data-Layer Map

### 4.1 Supabase tables by consuming portal/screen

> **Naming note (from migrations — authoritative over CLAUDE.md):** actual tables are `audit_logs` (plural) and `announcement_attachments` (NOT `course_announcement_attachments`). `attendance.occurrence_id` (not `course_occurrence_id`). Attendance enum is `PRESENT`/`ABSENT` only (`EXCUSED` appears in FE labels but is not a DB value). Enrollment status DB = `ACTIVE`/`PENDING`/`CANCELLED` (FE also references COMPLETED/EXPIRED — normalize on read).

| Table | Portals / Screens |
|-------|-------------------|
| `profiles` | Auth (login/register/me/callback/complete), Header avatar, Admin users, all role lookups |
| `sports` | Public (filters, cards), Auth (coach/club signup), Coach/Club/Admin forms, Admin sports CRUD |
| `coach_profiles` | Public coaches/coach profile/course cards, Coach my-clubs, Club coaches, Admin coaches; Stripe Connect flags |
| `coach_sports` | Public coach filter, Coach signup, Club/Admin coach forms |
| `clubs` | Public clubs/club detail, Auth club signup, Club portal (all, derived club id), Admin clubs; Stripe Connect flags |
| `club_sports` | Public club detail, Club signup/profile, Admin club form |
| `club_coaches` | Public coach/club filters + counts, Club roster, Admin |
| `locations` | Public listing/map/details, Coach/Club/Admin location CRUD, location-picker |
| `user_recent_locations` | `[legacy]` location-picker recents |
| `courses` | Public listing/details/coach/club, Coach/Club/Admin course CRUD, derived club locations, schedule |
| `course_occurrences` | Public course week calendar, Parent dashboard/calendar/attendance, Course form schedule slots, Admin schedule |
| `camps` | Public camps/camp detail, Checkout, Admin camps CRUD |
| `activities` | Public activities/detail/map, Coach/Admin activities CRUD, Checkout |
| `children` | Parent (dashboard/children/child/checkout/attendance/enrollments), Admin parent form, coach/club RLS reads |
| `enrollments` | Parent (dashboard/enrollments/checkout/children-delete), Coach/Club/Admin attendance+payments+participants, counts |
| `payments` | Parent enrollments/dashboard, Coach/Club/Admin pending-cash + payments ledger, cash confirm |
| `monthly_payments` | (schema + RLS only — no EF writes; read-only placeholder) |
| `invoices` | (schema + RLS only — no EF writes; read-only placeholder, SmartBill/ANAF) |
| `attendance` | Parent attendance history, Coach/Club/Admin attendance modal (via `record-attendance`/session EFs) |
| `course_photos` | Public course gallery, Coach/Club/Admin course gallery + reorder |
| `course_announcements` | `[legacy]` Parent feed, Coach composers, Course details announcements |
| `announcement_attachments` | `[legacy]` announcement media (Storage `announcement-media`) |
| `club_announcements` | Club announcements CRUD; public read gated by publish/expire window |
| `course_ratings` | `[legacy]` Course details + rating dialog |
| `coach_ratings` | `[legacy]` Coach profile + rating dialog |
| `coach_invitation_codes` | Coach signup validation, Admin coach codes |
| `club_invitation_codes` | Coach join-club, Club invitation codes, `validateClubCode` (latent) |
| `audit_logs` | `contact-form` writes; Admin-only read |

### 4.2 Edge Functions — contracts and callers

**Implemented in `supabase/functions/`:**

| Function | Auth | Request | Response | Called by |
|----------|------|---------|----------|-----------|
| `register-coach` | anon | `{email,password,name,phone?,invitationCode,bio?,sportIds?}` | `{userId,stripeAccountId,message}` | Coach signup |
| `register-club` | anon | `{email,password,name,phone?,clubName,clubDescription?,clubAddress?,clubCity?,clubPhone?,clubEmail?,clubWebsite?,company*?,bank*?,sportIds?}` | `{userId,clubId,stripeAccountId,message}` | Club signup |
| `create-enrollment` | PARENT JWT | `{kind,entityId,childIds[],paymentMethod,sessionPackageSize?,billingDetails?}` | `{enrollmentId,requiresPaymentIntent}` | Checkout |
| `cancel-enrollment` | PARENT JWT | `{enrollmentId}` | `{success:true}` | (cancel flow; checkout uses `cancel-draft-enrollment`) |
| `create-payment-intent` | user JWT | `{enrollmentId}` | `{clientSecret}` | Checkout |
| `mark-cash-paid` | COACH/ADMIN JWT | `{paymentId}` | `{success:true}` | (cash confirm — see note) |
| `record-attendance` | COACH/ADMIN JWT | `{occurrenceId,childId,status}` | `{success:true}` | (attendance — see note) |
| `contact-form` | anon | `{name,email,subject?,message}` | `{success:true,message}` | Contact page |
| `stripe-connect` | COACH/CLUB JWT | `{action:'create-account'|'onboarding-link'|'dashboard-link'|'refresh-status'}` | `{accountId}` / `{url}` / status object | Coach/Club Stripe pages + dashboards |
| `stripe-webhook` | Stripe sig | raw body | `{received:true,type}` | (backend — broadcasts realtime) |
| `stripe-connect-webhook` | Stripe sig | raw body | `{received:true}` | (backend — updates Connect flags) |

**Referenced by client but NOT yet in `supabase/functions/` — must be authored for parity:**

- Parent/checkout: `validate-enrollment`, `cancel-draft-enrollment`, `purchase-sessions`
- Coach: `create-course`, `update-course`, `delete-course`, `upload-course-photo`, `delete-course-photo`, `export-participants-csv`, `create-activity`, `update-activity`, `delete-activity`, `upload-activity-hero-photo`, `delete-activity-hero-photo`, `join-club`, `leave-club`, `get-today-attendance`, `mark-attendance`, `mark-course-attendance`, `get-weekly-calendar`, `get-session-attendance`, `mark-session-attendance`
- Club: `club-create-invitation-code`, `club-remove-coach`, `club-create-coach`, `club-update-coach`, `club-upload-logo`, `club-delete-logo`, `club-upload-hero-photo`, `club-delete-hero-photo`, `club-stripe-status`, `club-stripe-onboarding-link`, `club-stripe-dashboard-link`, `club-create-course`, `club-update-course`, `club-delete-course`, `club-upload-course-photo`, `club-delete-course-photo`, `club-weekly-calendar`, `club-session-attendance`, `club-mark-session-attendance`
- Admin: `admin-invite-coach`, `admin-update-coach`, `admin-delete-coach`, `admin-create-course`, `admin-update-course`, `admin-delete-course`, `admin-upload-course-hero-photo`, `admin-delete-course-hero-photo`, `admin-upload-course-photo`, `admin-delete-course-photo`, `admin-upload-activity-hero-photo`, `admin-delete-activity-hero-photo`, `admin-create-invitation-code`, `admin-delete-club`, `admin-upload-club-logo`, `admin-get-enrollments`, `admin-mark-camp-paid`, `admin-delete-user`, `admin-delete-child`, `admin-upload-child-photo`, `admin-get-payments`, `admin-export-payments-csv`, `admin-get-attendance`, `admin-mark-attendance`, `admin-weekly-calendar`, `admin-session-attendance`, `admin-mark-session-attendance`

> **Note:** the implemented `mark-cash-paid` and `record-attendance` are the canonical backend contracts; the role-namespaced variants (`coach-*`/`club-*`/`admin-*` weekly-calendar/session-attendance/mark/cash) referenced by the FE are the per-portal API surface that must be consolidated or authored. Treat the implemented functions as the source of truth for business logic (session accounting, Connect destination, platform fee).

### 4.3 Realtime channels (broadcast)

| Channel | Event | Payload | Emitted by | Subscribed by (screen) |
|---------|-------|---------|-----------|------------------------|
| `user:{parentId}:payments` | `enrollment_ready` | `{enrollmentId,status:'ACTIVE'}` | `stripe-webhook` (success) | Checkout (wait ≤15s) |
| `user:{parentId}:payments` | `payment_failed` | `{enrollmentId,reason}` | `stripe-webhook` (fail) | Checkout |
| `admin:session-purchases` | `session_purchase` | `{enrollmentId,sessionCount,courseId}` | `mark-cash-paid`, `stripe-webhook` | Admin attendance-payments (toast + live refresh); subscribed by ADMIN/COACH only |
| `admin:pending-cash-payments` | `pending_cash_payment` | `{enrollmentId,sessionCount,courseId}` | `create-enrollment` (COURSE+CASH) | (admin pending-cash awareness) |
| `admin:pending-activity-payments` | `pending_activity_payment` | `{enrollmentId,activityId,childName}` | `create-enrollment` (ACTIVITY+CASH) | (admin awareness) |

### 4.4 Storage buckets

| Bucket | Public | Path | Uploaded by (screen → EF/Storage) |
|--------|--------|------|-----------------------------------|
| `course-photos` | yes | `{courseId}/hero/...`, `{courseId}/gallery/...` (FE also reads `{courseId}/hero`, `{courseId}/{photoId}`) | Coach/Club/Admin course form (hero + gallery EFs) |
| `coach-photos` | yes | `{userId}/{uuid}.ext` | Coach/Club/Admin coach forms; read by header avatar, public coach cards |
| `club-assets` (a.k.a. `club-logos` in admin map) | yes | `{clubId}/logo/...`, `{clubId}/hero/...` | Club dashboard branding, club signup, Admin club logo |
| `activity-photos` | yes | `{activityId}/hero/...` | Coach/Admin activity form hero |
| `announcement-media` (FE refers to `announcement-attachments`) | **no — signed URLs** | `{announcementId}/{uuid}.ext` (FE path `{courseId}/{announcementId}/{attachmentId}`) | Coach announcement composers; read by parent/coach feeds |
| `child-photos` | **no — signed URLs** | `{parentId}/{childId}/...` (FE path `children/{id}/photo`) | Parent child profile, Admin parent form child photo |
| `avatars` | yes | — | OAuth avatar resolution (read-only via header) |

> Public buckets use `getPublicUrl` (cache-bust `?v=timestamp`); private buckets (`announcement-media`, `child-photos`) require `createSignedUrl`. Reconcile FE path conventions with the migration's actual conventions during rebuild.

---

## 5. Cross-Cutting Concerns

**Auth / session / role model**
- Supabase Auth (email/password + Google OAuth). No custom JWT, no CSRF, no cookie auth — JS client manages bearer tokens + auto-refresh.
- `User { id, name, email, role, phone?, oauthProvider?, avatarUrl?, needsProfileCompletion }`; single role per user in `profiles.role` (`ADMIN`/`CLUB`/`COACH`/`PARENT`).
- Bootstrap (browser-only): `getSession()` → load `profiles` → populate `currentUser$`; subscribe `onAuthStateChange`. SSR must NOT persist/detect session.
- `needsProfileCompletion = !phone` — OAuth users with no phone get the profile-completion dialog.
- Signup metadata: `signUp({data:{name,role}})` — DB trigger `handle_new_user` creates the `profiles` row (role defaults PARENT). Coach/club via Edge Functions (invitation-code validated for coach; club self-registers freely).
- Auth Hook `custom_access_token_hook` injects `app_role` JWT claim from `profiles.role` (must be enabled in dashboard) — but always load the profile row too, don't rely solely on the claim.
- Route guards (client UX only; RLS is the real enforcement): authGuard → `/login?returnUrl=`; roleGuard wrong-role → `/`. Role visibility: COACH menus visible to COACH+ADMIN; CLUB only CLUB; ADMIN only ADMIN.

**Realtime notifications** — `broadcast`-type channels (not Postgres-changes). On login subscribe `user:{id}:payments` (all) + `admin:session-purchases` (ADMIN/COACH only); unsubscribe on logout. Backend (Stripe webhooks / EFs) must broadcast on these exact channel + event names.

**Stripe** — Payments (Card Element + `confirmCardPayment`, 20s timeout, Stripe.js from `window.STRIPE_PUBLISHABLE_KEY`). Connect (Express accounts, RO; coach `individual`, club `company`). Onboarding redirect flow: `stripe-connect{action:'onboarding-link'}` → `window.location.href`; return pages at `/coach/stripe-onboarding/{complete,refresh}` and `/club/stripe/onboarding/{complete,refresh}` (outside auth guards). Connect destination resolved by `payment_recipient` + account enabled flags, COACH↔CLUB fallback. **Platform fee = 1.00 RON fixed + 3.5% of the amount, plus 19% VAT on that fee, `Math.round`, in bani** (in `_shared/stripe.ts`; changed from a flat 1% on 2026-08-20 — a flat percentage could not cover Stripe's own fixed-plus-percentage cost, so the fee mirrors its shape and yields a constant ~2% margin). `FRONTEND_URL` env builds return URLs.

**Leaflet maps + geocoding** — Leaflet (CDN `window.L` in Angular; use `react-leaflet` in React), CartoDB Voyager tiles, RO max-bounds `[43.6,20.2]–[48.4,29.9]`, default center Timișoara `[45.7489,21.2087]`, custom 📍 markers, browser-only. Used by: public LocationMap (course/activity detail), map page, all location forms (coach/club/admin), location-picker map modal. Geocoding via OpenStreetMap Nominatim (`countrycodes=ro`, `accept-language=ro`, `X-Skip-Auth` header) — `search` (limit 6) + `reverse` (city/town/county). Port as-is.

**File / photo upload** — `validateImageFile` (max 10MB, MIME jpeg/jpg/png/gif/webp), `readFileAsDataUrl` → base64 sent to Edge Functions (FE never writes Storage directly for managed entities; private buckets read via signed URLs). Announcement videos: ≤2 (files+links combined) @≤150MB; images ≤10@≤4MB.

**Ratings** — 1–5 stars + optional comment (max 500 chars), star-rating component (half-star), rating-dialog (create vs update). UNIQUE(entity, parent) → upsert. Permission ("must have enrolled child") currently a backend 400 → moves to RLS (only parents with an enrollment may insert). `[legacy]` currently on `/api/ratings` → reimplement on `course_ratings`/`coach_ratings`.

**Romanian language / routes** — All UI copy in Romanian (preserve exact strings or move to i18n); `LOCALE_ID='ro-RO'`; Romanian route slugs (`cursuri`, `tabere`, `antrenori`, `cluburi`, `activitati`, `despre`, `harta`). Diacritic-insensitive search (NFD-strip) in several lists. Weekday normalization JS Sun=0 → 7 (Mon=1…Sun=7); day-name↔ISO-weekday map in recurrence rules.

**SSR / prerender** — Every component guards browser-only work (`isPlatformBrowser`/`afterNextRender`): session persistence, scroll-progress/IntersectionObserver, Leaflet, FileReader, `window.location` redirects, `matchMedia`. Home pre-seeds fallback data for SSR. React (Next/SSR) needs equivalent client-only guards + a root error boundary + Romanian i18n default.

**Shared chrome / utilities** — toast bus (persistent errors, 5s others), global loader overlay (200ms debounce; note Supabase calls bypass HttpClient so they don't trigger it — feature components manage own loading), error-reporting (sanitizes/redacts email/password/token/card/etc.), `getInitials`, premium SCSS mixins design system (cards, gradient buttons, badges, scroll-reveal animations, CSS vars).

**Money** — integer bani everywhere; divide by 100 for display, multiply for amounts sent to EFs (though amounts are computed server-side from entity prices, not trusted from client). Course monthly `price = pricePerSession × 8`.

---

## 6. Risks & Notable Complexity

**Highest risk / hardest to port:**

1. **Checkout wizard + payment + realtime choreography** — 4-step linear stepper with per-child server-side validation (`validate-enrollment`), enrollment creation, Stripe PaymentIntent + `confirmCardPayment`, rollback (`cancel-draft-enrollment`), and a 15s wait on the `user:{id}:payments` Realtime `enrollment_ready` event before navigating (with fallback). Card Element mount/teardown lifecycle keyed to step index, cash vs card branching, billing details. Most stateful flow in the app.

2. **Stripe Connect onboarding redirects (coach + club)** — Full-page redirects to Stripe and back to return/refresh pages that live *outside* auth guards (user returns unauthenticated-ish from Stripe). Connect destination resolution (`payment_recipient` + account-enabled flags + COACH↔CLUB fallback) and platform-fee math (1 RON + 3.5% + VAT) must match `_shared/stripe.ts` exactly — read the constant, do not hardcode the number. Onboarding link expiry (15 min) handling.

3. **Attendance + payments flows (3 portals)** — Weekly calendar (Monday-anchored, per-coach grouping) + shared AttendanceModal with symmetric session accounting (PRESENT decrements remaining/increments used; PRESENT→ABSENT restores; blocks at remaining≤0). Cash confirmation gated by CASH+PENDING. Session top-ups create pending CASH payments that must then be confirmed. Admin variant adds Realtime `session_purchase` live-refresh of an open modal. Three near-identical portal implementations (coach/club/admin) over role-namespaced EFs.

4. **Admin portal breadth + reporting** — 13 list screens + forms, role-based edit routing in user list (4 destinations), 3-mode delete-user dialog with ADMIN protection, force-delete 409 re-prompt pattern (coaches/courses/clubs), CSV export (Blob download), Realtime. Reports & Settings are stubs (low risk but must exist).

5. **Calendar / scheduling** — Recurrence encoded as JSON `{daySchedules:{"1-7":{start,end}}}` serialized/parsed in course forms; `course_occurrences` are the concrete dated sessions; month-grid parent calendar; per-course week calendar (dedup by time slot, today marker). Day-of-week course filter is client-side only (PostgREST can't express it).

6. **location-picker (shared, ControlValueAccessor)** — Most complex shared component: debounced search, recent + city dropdown, inline create modal, full Leaflet map-picker modal, "open in new tab" area inference. Value is a location-id string — must plug into React form libraries via value/onChange.

**Migration gaps (must be resolved — currently broken against Supabase-only backend):**

- `[legacy]` **RatingService** (`/api/ratings/...`) → reimplement on `course_ratings`/`coach_ratings` with RLS-based enrollment gating. Used by course details, coach profile, rating dialog.
- `[legacy]` **AnnouncementsService** CRUD (`/api/coach/...`, `/api/parent/...`) → reimplement on `course_announcements`/`announcement_attachments`. Used by parent feed, coach composers, course-detail announcements. (Storage URLs already on Supabase.)
- `[legacy]` **LocationService** CRUD (`/api/locations/...`) → reimplement on `locations`/`user_recent_locations`. Used by coach locations, location-picker.
- `[legacy]` **Activity form dropdowns** (`/api/public/locations`, `/api/public/sports`) in coach + admin activity forms → switch to Supabase queries.
- **~80 Edge Functions referenced by the FE are not in `supabase/functions/`** (coach/club/admin namespaced course/activity/attendance/photo/Stripe/CSV functions) — they must be authored; the 11 implemented functions are the canonical business-logic reference.

**Other parity caveats:**
- **Partial child persistence** — child forms collect level/emergency/secondary/tshirt/GDPR but only name/birth_date/allergies(→notes) persist; GDPR checkbox hardcoded disabled+true. Decide whether to add columns. (DB `children` table *does* have these columns per migration — FE mapper just doesn't write them; align in rebuild.)
- **Mock-data fallbacks** — `AccountService`/`ChildrenService` silently return mock data on error, conflating error with empty. Replace with explicit error states.
- **Never-populated fields** — `whatWeLearn`, `faqs`, coach `focusAreas`/`headline`, listing-level `spotsLeft` (courses/activities always null), camp `soldOut` (hardcoded false) — corresponding UI rarely/never renders.
- **Table naming drift** between CLAUDE.md and actual migrations (`audit_logs`/`announcement_attachments`/`attendance.occurrence_id`); migrations are authoritative.
- **`invoices` + `monthly_payments`** have schema + RLS but no EF writes — surface read-only (SmartBill/ANAF + recurring billing are future integrations).
- **Dead code** to skip: admin NgModule dialog artifacts, `ChildFormComponent` dialog variant, `validateClubCode` (latent), `core.module.ts`.

---

Source files referenced throughout are under `C:\Users\lakie\Desktop\motion-timisoara\TriathlonTeamFE\src\app\` (features/core/shared) and `C:\Users\lakie\Desktop\motion-timisoara\supabase\` (migrations 00001–00004, functions, seed).
