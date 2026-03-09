# End-to-End (E2E) Verification Plan - TriathlonTeamTimisoara

This document outlines the complete verification strategy for an AI Agent or QA Engineer to validate the `TriathlonTeamFE` (Angular) and `TriathlonTeamBE` (Spring Boot) application.

**Objective:** Ensure every page and functionality works as expected across all user roles.

## 1. Environment Setup & Prerequisites

Before running these tests, ensure:
- **Backend**: Running on `http://localhost:8081` (`./gradlew bootRun` in `TriathlonTeamBE`).
- **Frontend**: Running on `http://localhost:4200` (`npm start` in `TriathlonTeamFE`).
- **Database**: PostgreSQL is running and migrations (Flyway) have applied successfully.
- **Configuration**:
  - `TriathlonTeamFE/src/index.html` should have `<meta name="api-base-url" content="http://localhost:8081">` or similar dev proxy setup.
  - Stripe Test keys are configured in Backend.

---

## 2. Public Access Verification (No Login)

These pages are accessible to anyone (SEO & Landing).

### 2.1 Home & Static Pages
- [ ] **Home** (`/`):
  - Verify Hero section loads.
  - Verify "Ultimii 7 ani" stats or similar dynamic content loads.
  - Check for broken images.
- [ ] **About** (`/despre`):
  - Verify content rendering.
- [ ] **Contact** (`/contact`):
  - Verify contact form displays.
  - **Action**: Submit the form.
  - **Verify**: Backend receives the email/message (Check logs or `PublicContactController`).

### 2.2 Content Discovery
- [ ] **Courses List** (`/cursuri`):
  - Verify list of active courses.
  - Test filtering (if implemented).
- [ ] **Course Detail** (`/cursuri/{id}`):
  - **Action**: Click on a course.
  - **Verify**: Price, Schedule, Location, and Coach info are visible.
  - **Verify**: "Înscrie-te" button redirects to Login/Register if not logged in.
- [ ] **Coaches List** (`/antrenori`):
  - Verify grid of coaches.
- [ ] **Coach Profile** (`/antrenori/{id}`):
  - Verify bio and assigned courses.
- [ ] **Camps** (`/tabere` & `/tabere/{slug}`):
  - Verify list of camps and individual camp details.

### 2.3 Authentication
- [ ] **Register** (`/register`):
  - **Action**: Create a new user (Parent).
  - **Verify**: Successful redirection to Dashboard.
  - **Verify**: Validation on duplicate email.
- [ ] **Login (classic)** (`/login`):
  - **Action**: Login with the new user.
  - **Action**: Test "Forgot Password" UI elements (link/button) are visible.
- [ ] **Login with Google OAuth** (`/login` → `Continua cu Google`):
  - **Action**: Click Google button and go through provider flow until redirect to `/auth/callback`.
  - **Verify**: On success, `OAuthCallbackComponent` reads query params (`needsProfileCompletion`, `redirect`, `reason`).
  - **Verify**: When backend signals `needsProfileCompletion=true` or user profile has `needsProfileCompletion`, a **Profile Completion Dialog** appears (name + phone fields, required & validated).
  - **Action**: Complete dialog and save.
  - **Verify**: User is redirected to target (default `/account` or saved return URL) and subsequent refresh keeps profile complete.
  - **Error cases**: Simulate failure `reason` query (`missing_email`, `provider_mismatch`, `invalid_authentication`, generic) and verify:
    - Toast/snackbar shows mapped human message.
    - User is redirected back to `/login?error=oauth_failed&reason=...`.

---

## 3. Parent / User Role Verification (`/account/...`)

**Pre-requisite**: Logged in as a user with `ROLE_USER` (Parent).

### 3.1 Dashboard & Profile
- [ ] **Dashboard** (`/account`):
  - Verify welcome message.
  - Verify summary of active enrollments, recent payments and upcoming events/cards.
  - **Calendar/Upcoming events API**: Confirm calls to `/api/parent/overview`, `/api/parent/payments`, `/api/parent/calendar`, `/api/parent/upcoming-events` succeed and data appears in widgets.
- [ ] **Children Management** (`/account/children`):
  - **Action**: Click "Adaugă copil" (`/account/child/new`).
  - **Form**: Fill Name, DOB, Gender.
  - **Photo**: Upload a photo (verify `ParentChildController` handles BLOB).
  - **Verify**: Child appears in the list with the correct photo.
  - **Action**: Edit child (`/account/child/{id}`). Change T-shirt size/contacts. Save.
  - **Delete flow (fără înscrieri active)**:
    - **Action**: Select a child fără înscrieri active și apasă "Șterge".
    - **Verify**: Se deschide `DeleteChildDialogComponent` cu mesaj neutru.
    - **Action**: Confirmă.
    - **Verify**: Copilul este șters, dispare din listă, iar BE răspunde 204 la `DELETE /api/parent/children/{id}`.
  - **Delete flow (cu înscrieri active)**:
    - **Setup**: Copilul are cel puțin o înscriere `pending/active` (EnrollmentService).
    - **Action**: Apasă "Șterge".
    - **Verify**: Dialogul afișează card de warning cu numărul de înscrieri active și lista impactului (înscrieri, plăți, prezențe).
    - **Action**: Confirmă și verifică că înscrierile sunt anulate conform politicii de business.

### 3.2 Enrollment & Payments
- [ ] **Enrollment Flow**:
  - **Action**: Navigate to a public Course page.
  - **Action**: Click "Înscrie-te".
  - **UI**: Select a Child from the dropdown.
  - **Verify**: Redirection to Checkout (`/account/checkout`) or immediate confirmation if free.
- [ ] **Checkout** (`/account/checkout`):
  - **Verify**: Stripe Elements/Form loads.
  - **Action**: Complete payment with Stripe Test Card.
  - **Verify**: Success message + Backend record created in `EnrollmentController`.
- [ ] **My Enrollments** (`/account/enrollments`):
  - Verify the new course appears here.

### 3.3 Engagement
- [ ] **Attendance** (`/account/attendance`):
  - Verify history of attended sessions (empty initially).
- [ ] **Announcements** (`/account/announcements`):
  - Verify the global feed of announcements from enrolled courses.
  - Check "New (7 days)" badge logic.

### 3.4 Ratings (Parent perspective)
- [ ] **Rate Course from Course page** (`/cursuri/{id}` fiind logat ca părinte):
  - **Action**: Deschide dialogul de rating (butonul de evaluare curs).
  - **Verify**: `RatingDialogComponent` afișează stelele, câmpul de comentariu și numele cursului.
  - **Action**: Trimite rating valid (1–5 stele) → verifică POST `/api/ratings/courses/{courseId}`.
  - **Verify**: Ratingul se salvează și media cursului se actualizează (`GET /api/ratings/courses/{courseId}/average`).
- [ ] **Update Course Rating**:
  - **Action**: Re-deschide dialogul.
  - **Verify**: Valoarea existentă este pre-încărcată via `GET /api/ratings/courses/{courseId}/mine`.
  - **Action**: Schimbă rating/comentariu și salvează.
- [ ] **Rate Coach from Coach profile** (`/antrenori/{id}` logat):
  - Analog cu cursul, dar folosind `/api/ratings/coaches/{coachId}` și endpoints de medie + `mine` pentru antrenor.
- [ ] **Restrictions**:
  - **Action**: Încearcă să evaluezi fără copil înscris.
  - **Verify**: Backend răspunde cu 400 și mesaj clar („Nu îndeplinești condițiile…”), afișat în dialog.

---

## 4. Coach Role Verification (`/coach/...`)

**Pre-requisite**: Logged in as `ROLE_COACH`.

### 4.1 Dashboard & Courses
- [ ] **Coach Dashboard** (`/coach/dashboard`):
  - Verify quick stats.
- [ ] **My Courses** (`/coach/courses`):
  - Verify list of courses assigned to this coach.
- [ ] **Edit Course** (`/coach/courses/{id}/edit`):
  - **Action**: Update description or prerequisites.
  - **Verify**: Changes reflected on public page.

### 4.2 Class Management
- [ ] **Attendance Tracking** (`/coach/attendance-payments`):
  - **Action**: Select a course and date.
  - **Verify**: List of enrolled children appears.
  - **Action**: Deschide modalul de prezență (`AttendanceModalComponent`).
  - **Mark presence**: Click pe un copil pentru a comuta între prezent/absent; salvează și verifică în DB/BE (`CoachAttendanceController`).
  - **Bulk actions**: Folosește shortcut-urile „Toți prezenți” (P) și „Toți absenți” (A) și verifică că toate cardurile se actualizează.
  - **Low sessions filter**: Activează filtrul „Atenție / low-sessions” și verifică afișarea doar a copiilor cu puține sesiuni rămase.
  - **Add session packages**: Pentru un copil, deschide secțiunea „Adaugă sesiuni” și testează butoanele rapide +5/+10/+15 și input custom, verificând încasarea pe backend.
- [ ] **Course Announcements** (`/coach/courses/{id}/announcements`):
  - **Action**: Create a new post.
  - **Content**: Add Text + Image Upload + Video Link.
  - **Action**: Pin the post.
  - **Verify**: Post appears at top of feed.
  - **Verify (Parent View)**: Switch to Parent account, verify post is visible on Course Tab and Global Feed.
- [ ] **Global Announcements** (`/coach/announcements`):
  - Verify aggregation of all coach's posts.

---

## 5. Admin Role Verification (`/admin/...`)

**Pre-requisite**: Logged in as `ROLE_ADMIN`.

### 5.1 User & Staff Management
- [ ] **Coaches** (`/admin/coaches`):
  - **Action**: Deschide dialogul „Invite Coach” (`InviteCoachDialogComponent`).
  - **Form**: Completează nume, email, telefon, bio și selectează cel puțin un sport.
  - **Verify**: La submit, se apelează `POST /api/admin/coaches/invite` și în UI apare coach-ul invitat (status corect).
  - **Error**: Lasă sporturile ne-selectate → verifică validarea „cel puțin un sport”.
- [ ] **Users**:
  - Verify ability to search/list parents (if UI exists in Reports/Settings).

### 5.2 Course & Resource Management
- [ ] **Locations** (`/admin/locations`):
  - **Action**: CRUD on physical locations (Map URL, Address).
- [ ] **Sports** (`/admin/sports`):
  - **Action**: Add a new Sport category.
- [ ] **Courses** (`/admin/courses`):
  - **Action**: Create a new Course linked to a Location, Coach, and Sport.
  - **Photos**: Manage course gallery (`/admin/courses/{id}/photos`). Upload/Delete.
- [ ] **Camps** (`/admin/camps`):
  - **Action**: Create/Edit a Camp. Verify dates and pricing fields.

### 5.3 Financials & Reports
- [ ] **Payments** (`/admin/payments`):
  - Verify list of recent transactions filtrabile după status/metodă/tip (`/api/admin/payments`).
  - **Cash Payments**: Din Admin, folosește acțiunea „marcare cash plătit” și verifică `PATCH /api/admin/payments/{paymentId}/mark-cash-paid`.
  - **Coach Cash Payments**: Din zona Coach (dacă UI prezent), verifică `PATCH /api/coach/payments/{paymentId}/mark-cash-paid` (inclusiv restricția ca antrenorul să poată marca doar plățile proprii).
- [ ] **Reports** (`/admin/reports`):
  - Verify generation of simple stats (e.g., total revenue, total students).
- [ ] **Attendance Payments** (`/admin/attendance-payments`):
  - Verify admin override capabilities for attendance, inclusiv deschiderea `AttendanceModalComponent`, schimbarea prezențelor și adăugarea de sesiuni plătite.
  - **Export CSV**: Dacă există acțiune în UI, pornește un export și verifică răspunsul `GET /api/admin/payments/export.csv` (conținut CSV valid, header `Content-Disposition`).

### 5.4 System Settings
- [ ] **Settings** (`/admin/settings`):
  - Verify global configs (if any).

---

## 6. Technical & Edge Case Checks

### 6.1 Server-Side Rendering (SSR)
- [ ] **Action**: Curl the homepage `curl http://localhost:4200/`.
- [ ] **Verify**: HTML response contains actual content (not just `<app-root>`), ensuring SEO works.

### 6.2 Responsive Design
- [ ] **Action**: Resize browser to mobile width (375px).
- [ ] **Verify**:
  - Hamburger menu works.
  - Tables scroll horizontally or stack.
  - Checkout form is usable.

### 6.3 Error Handling
- [ ] **Action**: Navigate to non-existent URL (`/random-page`).
- [ ] **Verify**: 404 Page or Redirect to Home.
- [ ] **Action**: Try to access Admin route as Parent.
- [ ] **Verify**: Access Denied / Redirect to Dashboard.
 - [ ] **Logout flow**:
   - **Action**: Din header (meniul de cont sau drawer mobil), apasă "Deconectare".
   - **Verify**: Se apelează `POST /api/auth/logout`, cookie-urile Jwt sunt șterse, iar front-end-ul redirecționează spre `/` sau `/login`, meniul afișând opțiunile de guest (Autentificare/Creează cont).

---

## Summary of Roles & Routes

| Role | Key Prefix | Description |
|------|------------|-------------|
| **Public** | `/` | SEO, Information, Auth |
| **Parent** | `/account` | Children, Payments, Enrollment |
| **Coach** | `/coach` | Attendance, Class Management |
| **Admin** | `/admin` | Global Configuration, Financials |
