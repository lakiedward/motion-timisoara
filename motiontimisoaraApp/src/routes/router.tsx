import { createBrowserRouter } from 'react-router-dom'
import RootLayout from '@/routes/RootLayout'
import CoreLayout from '@/layout/CoreLayout'
import { RequireAuth, RequireRole } from '@/routes/guards'
import {
  ADMIN_SUBSCRIPTION_ROUTES,
  CLUB_SUBSCRIPTION_ROUTES,
  COACH_SUBSCRIPTION_ROUTES,
  SUBSCRIPTION_ROUTES,
} from '@/routes/subscription-routes'
import { NATIVE_BUILD, webOnly } from '@/lib/store-compliance'
import { pageTitle } from '@/lib/page-title'
import CoachLayout from '@/features/coach/CoachLayout'
import CoachDashboard from '@/features/coach/CoachDashboard'
import CoachCoursesPage from '@/features/coach/CoachCoursesPage'
import CourseFormPage from '@/features/coach/CourseFormPage'
import CoachActivitiesPage from '@/features/coach/CoachActivitiesPage'
import ActivityFormPage from '@/features/coach/ActivityFormPage'
import CoachLocationsPage from '@/features/coach/CoachLocationsPage'
import CoachAttendancePage from '@/features/coach/CoachAttendancePage'
import CoachOwnProfilePage from '@/features/coach/CoachOwnProfilePage'
import CoachAnnouncementsPage from '@/features/coach/announcements/CoachAnnouncementsPage'
import AdminLayout from '@/features/admin/AdminLayout'
import AdminDashboard from '@/features/admin/AdminDashboard'
import AdminUsersPage from '@/features/admin/AdminUsersPage'
import AdminUserEditPage from '@/features/admin/users/AdminUserEditPage'
import AdminClubsPage from '@/features/admin/AdminClubsPage'
import AdminCoursesPage from '@/features/admin/AdminCoursesPage'
import AdminLocationsPage from '@/features/admin/AdminLocationsPage'
import AdminActivitiesPage from '@/features/admin/AdminActivitiesPage'
import AdminAnnouncementsPage from '@/features/admin/announcements/AdminAnnouncementsPage'
import AdminAnnouncementFormPage from '@/features/admin/announcements/AdminAnnouncementFormPage'
import AdminAttendancePage from '@/features/admin/attendance/AdminAttendancePage'
import { EditCourseAction, NewCourseButton } from '@/features/admin/courses/CourseEditActions'
import AdminSportsPage from '@/features/admin/AdminSportsPage'
import AdminInviteCodesPage from '@/features/admin/AdminInviteCodesPage'
import AdminProfilePage from '@/features/admin/AdminProfilePage'
import ParentProfilePage from '@/features/account/profile/ParentProfilePage'
import ClubLayout from '@/features/club/ClubLayout'
import { ClubApprovalGate } from '@/features/club/ClubApproval'
import ClubDashboard from '@/features/club/ClubDashboard'
import ClubProfilePage from '@/features/club/profile/ClubProfilePage'
import ClubCoachesPage from '@/features/club/coaches/ClubCoachesPage'
import ClubAnnouncementsPage from '@/features/club/ClubAnnouncementsPage'
import ClubCoursesPage from '@/features/club/ClubCoursesPage'
import ClubCourseFormPage from '@/features/club/ClubCourseFormPage'
import ClubActivitiesPage from '@/features/club/ClubActivitiesPage'
import ClubLocationsPage from '@/features/club/ClubLocationsPage'
import ClubLocationFormPage from '@/features/club/ClubLocationFormPage'
import CampsListPage from '@/features/camps/CampsListPage'
import AdminCampsPage from '@/features/admin/camps/AdminCampsPage'
import CampFormPage from '@/features/camps/CampFormPage'
import CampEnrolledPage from '@/features/camps/CampEnrolledPage'
import ClubStripePage from '@/features/club/ClubStripePage'
import CoachStripePage from '@/features/coach/CoachStripePage'
import CashPaymentsPage from '@/features/payments/CashPaymentsPage'
import AdminPaymentsPage from '@/features/admin/payments/AdminPaymentsPage'
import HomePage from '@/features/public/HomePage'
import ProgramPage from '@/features/public/ProgramPage'
import CourseDetailsPage from '@/features/public/CourseDetailsPage'
import ActivitiesPage from '@/features/public/ActivitiesPage'
import ActivityDetailPage from '@/features/public/ActivityDetailPage'
import CampsPage from '@/features/public/CampsPage'
import CampDetailsPage from '@/features/public/CampDetailsPage'
import CompetitionsPage from '@/features/competitions/CompetitionsPage'
import CompetitionDetailsPage from '@/features/competitions/CompetitionDetailsPage'
import CompetitionsListPage from '@/features/competitions/CompetitionsListPage'
import CompetitionFormPage from '@/features/competitions/CompetitionFormPage'
import CompetitionRegistrationPage from '@/features/competitions/registration/CompetitionRegistrationPage'
import CompetitionPodiumPage from '@/features/competitions/podium/CompetitionPodiumPage'
import CoachesPage from '@/features/public/CoachesPage'
import CoachProfilePage from '@/features/public/CoachProfilePage'
import ClubsPage from '@/features/public/ClubsPage'
import ClubDetailPage from '@/features/public/ClubDetailPage'
import MapPage from '@/features/public/MapPage'
import AboutPage from '@/features/public/AboutPage'
import ContactPage from '@/features/public/ContactPage'
import UiGalleryPage from '@/features/dev/UiGalleryPage'
import NotFoundPage from '@/features/NotFoundPage'
import LoginPage from '@/features/auth/LoginPage'
import RegisterPage from '@/features/auth/RegisterPage'
import SignupChoicePage from '@/features/auth/SignupChoicePage'
import ForgotPasswordPage from '@/features/auth/ForgotPasswordPage'
import ResetPasswordPage from '@/features/auth/ResetPasswordPage'
import OAuthCallbackPage from '@/features/auth/OAuthCallbackPage'
import CoachSignupPage from '@/features/auth/CoachSignupPage'
import ClubSignupPage from '@/features/auth/ClubSignupPage'
import AccountLayout from '@/features/account/AccountLayout'
import ParentDashboard from '@/features/account/ParentDashboard'
import ChildrenPage from '@/features/account/ChildrenPage'
import ChildFormPage from '@/features/account/ChildFormPage'
import EnrollmentsPage from '@/features/account/EnrollmentsPage'
import AttendancePage from '@/features/account/AttendancePage'
import AnnouncementsPage from '@/features/account/AnnouncementsPage'
import CoachLocationPage from '@/features/live-location/parent/CoachLocationPage'
import CheckoutPage from '@/features/account/CheckoutPage'
import PaymentReturnPage from '@/features/account/PaymentReturnPage'
import ChildQrPage from '@/features/children/ChildQrPage'
import EntranceCheckinPage from '@/features/account/entrance/EntranceCheckinPage'
import CoachEntranceCodePage from '@/features/coach/entrance/CoachEntranceCodePage'
import PrivacyPage from '@/features/public/PrivacyPage'
import TermsPage from '@/features/public/TermsPage'
import AccountDeletionPage from '@/features/public/account-deletion/AccountDeletionPage'
import NativeExplorePage from '@/layout/native/NativeExplorePage'
import NativeAccountPage from '@/layout/native/NativeAccountPage'
import { usesNativeNavigation } from '@/layout/native/native-runtime'

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      ...(usesNativeNavigation()
        ? [
            { path: '/exploreaza', element: <NativeExplorePage /> },
            { path: '/cont', element: <NativeAccountPage /> },
          ]
        : []),
      {
        element: <CoreLayout />,
        children: [
          { path: '/', element: <HomePage /> },
          { path: '/cursuri', element: <ProgramPage />, handle: pageTitle('Cursuri') },
          { path: '/cursuri/:id', element: <CourseDetailsPage />, handle: pageTitle('Cursuri') },
          { path: '/activitati', element: <ActivitiesPage />, handle: pageTitle('Activități') },
          {
            path: '/activitati/:id',
            element: <ActivityDetailPage />,
            handle: pageTitle('Activități'),
          },
          { path: '/tabere', element: <CampsPage />, handle: pageTitle('Tabere') },
          { path: '/tabere/:slug', element: <CampDetailsPage />, handle: pageTitle('Tabere') },
          { path: '/concursuri', element: <CompetitionsPage />, handle: pageTitle('Concursuri') },
          {
            path: '/concursuri/:slug',
            element: <CompetitionDetailsPage />,
            handle: pageTitle('Concursuri'),
          },
          { path: '/antrenori', element: <CoachesPage />, handle: pageTitle('Antrenori') },
          { path: '/antrenori/:id', element: <CoachProfilePage />, handle: pageTitle('Antrenori') },
          { path: '/cluburi', element: <ClubsPage />, handle: pageTitle('Cluburi') },
          { path: '/cluburi/:id', element: <ClubDetailPage />, handle: pageTitle('Cluburi') },
          { path: '/harta', element: <MapPage />, handle: pageTitle('Harta') },
          { path: '/despre', element: <AboutPage />, handle: pageTitle('Despre noi') },
          { path: '/contact', element: <ContactPage />, handle: pageTitle('Contact') },
          { path: '/termeni', element: <TermsPage />, handle: pageTitle('Termeni și condiții') },
          {
            path: '/confidentialitate',
            element: <PrivacyPage />,
            handle: pageTitle('Confidențialitate'),
          },
          {
            path: '/stergere-cont',
            element: <AccountDeletionPage />,
            handle: pageTitle('Ștergerea contului'),
          },
          ...(NATIVE_BUILD ? [] : webOnly(SUBSCRIPTION_ROUTES)),
          ...(import.meta.env.DEV
            ? [
                { path: '/dev/ui', element: <UiGalleryPage /> },
                { path: '/dev/camp-form-draft', element: <CampFormPage baza="/club/camps" /> },
              ]
            : []),
          {
            element: <RequireAuth />,
            children: [
              {
                element: <AccountLayout />,
                children: [
                  { path: '/account', element: <ParentDashboard /> },
                  { path: '/account/children', element: <ChildrenPage /> },
                  { path: '/account/child/new', element: <ChildFormPage /> },
                  { path: '/account/child/:id', element: <ChildFormPage /> },
                  {
                    path: '/account/child/:id/qr',
                    element: <ChildQrPage inapoi="/account/children" />,
                  },
                  { path: '/account/enrollments', element: <EnrollmentsPage /> },
                  { path: '/account/attendance', element: <AttendancePage /> },
                  {
                    path: '/prezenta/:token',
                    element: <EntranceCheckinPage />,
                    handle: pageTitle('Prezența la intrare'),
                  },
                  { path: '/account/announcements', element: <AnnouncementsPage /> },
                  { path: '/account/profile', element: <ParentProfilePage /> },
                  { path: '/account/locatie', element: <CoachLocationPage /> },
                  { path: '/account/checkout', element: <CheckoutPage /> },
                  { path: '/account/plata', element: <PaymentReturnPage /> },
                  {
                    path: '/account/competitions/:slug/register',
                    element: <CompetitionRegistrationPage />,
                  },
                ],
              },
            ],
          },
          { path: '*', element: <NotFoundPage />, handle: pageTitle('Pagina nu a fost găsită') },
        ],
      },
      {
        element: <RequireRole roles={['COACH', 'ADMIN']} />,
        children: [
          {
            element: <CoachLayout />,
            children: [
              { path: '/coach', element: <CoachDashboard /> },
              { path: '/coach/courses', element: <CoachCoursesPage /> },
              { path: '/coach/announcements', element: <CoachAnnouncementsPage /> },
              { path: '/coach/courses/new', element: <CourseFormPage /> },
              { path: '/coach/courses/:id/edit', element: <CourseFormPage /> },
              { path: '/coach/activities', element: <CoachActivitiesPage /> },
              { path: '/coach/activities/new', element: <ActivityFormPage /> },
              { path: '/coach/activities/:id/edit', element: <ActivityFormPage /> },
              { path: '/coach/locations', element: <CoachLocationsPage /> },
              { path: '/coach/locations/new', element: <ClubLocationFormPage portal="coach" /> },
              {
                path: '/coach/locations/:id/edit',
                element: <ClubLocationFormPage portal="coach" />,
              },
              {
                path: '/coach/competitions',
                element: <CompetitionsListPage baza="/coach/competitions" />,
              },
              {
                path: '/coach/competitions/new',
                element: <CompetitionFormPage baza="/coach/competitions" />,
              },
              {
                path: '/coach/competitions/:id/edit',
                element: <CompetitionFormPage baza="/coach/competitions" />,
              },
              {
                path: '/coach/competitions/:id/results',
                element: <CompetitionPodiumPage baza="/coach/competitions" />,
              },
              { path: '/coach/camps', element: <CampsListPage baza="/coach/camps" /> },
              { path: '/coach/camps/new', element: <CampFormPage baza="/coach/camps" /> },
              { path: '/coach/camps/:id/edit', element: <CampFormPage baza="/coach/camps" /> },
              {
                path: '/coach/camps/:id/enrolled',
                element: <CampEnrolledPage baza="/coach/camps" />,
              },
              { path: '/coach/attendance', element: <CoachAttendancePage /> },
              { path: '/coach/attendance/entrance-code', element: <CoachEntranceCodePage /> },
              { path: '/coach/payments', element: <CashPaymentsPage /> },
              {
                path: '/coach/children/:id/qr',
                element: <ChildQrPage inapoi="/coach/attendance" />,
              },
              { path: '/coach/profile', element: <CoachOwnProfilePage /> },
              { path: '/coach/stripe', element: <CoachStripePage /> },
              ...(NATIVE_BUILD ? [] : webOnly(COACH_SUBSCRIPTION_ROUTES)),
              { path: '/stripe/onboarding/complete', element: <CoachStripePage /> },
              { path: '/stripe/onboarding/refresh', element: <CoachStripePage /> },
            ],
          },
        ],
      },
      {
        element: <RequireRole roles={['ADMIN']} />,
        children: [
          {
            element: <AdminLayout />,
            children: [
              { path: '/admin', element: <AdminDashboard />, handle: pageTitle('Panou') },
              {
                path: '/admin/profile',
                element: <AdminProfilePage />,
                handle: pageTitle('Profil'),
              },
              {
                path: '/admin/users',
                element: <AdminUsersPage />,
                handle: pageTitle('Utilizatori'),
              },
              {
                path: '/admin/users/:id/edit',
                element: <AdminUserEditPage />,
                handle: pageTitle('Editează utilizator'),
              },
              { path: '/admin/clubs', element: <AdminClubsPage />, handle: pageTitle('Cluburi') },
              {
                path: '/admin/clubs/:id/edit',
                element: <ClubProfilePage portal="admin" />,
                handle: pageTitle('Editează club'),
              },
              {
                path: '/admin/courses',
                handle: pageTitle('Cursuri'),
                element: (
                  <AdminCoursesPage
                    headerActions={<NewCourseButton />}
                    renderRowActions={(course) => <EditCourseAction course={course} />}
                  />
                ),
              },
              {
                path: '/admin/courses/new',
                element: <ClubCourseFormPage portal="admin" />,
                handle: pageTitle('Curs nou'),
              },
              {
                path: '/admin/courses/:id/edit',
                element: <ClubCourseFormPage portal="admin" />,
                handle: pageTitle('Editează curs'),
              },
              {
                path: '/admin/competitions',
                handle: pageTitle('Concursuri'),
                element: <CompetitionsListPage baza="/admin/competitions" />,
              },
              {
                path: '/admin/competitions/new',
                handle: pageTitle('Concurs nou'),
                element: <CompetitionFormPage baza="/admin/competitions" />,
              },
              {
                path: '/admin/competitions/:id/edit',
                handle: pageTitle('Editează concurs'),
                element: <CompetitionFormPage baza="/admin/competitions" />,
              },
              {
                path: '/admin/competitions/:id/results',
                handle: pageTitle('Rezultate concurs'),
                element: <CompetitionPodiumPage baza="/admin/competitions" />,
              },
              { path: '/admin/camps', element: <AdminCampsPage />, handle: pageTitle('Tabere') },
              {
                path: '/admin/camps/new',
                element: <CampFormPage baza="/admin/camps" />,
                handle: pageTitle('Tabără nouă'),
              },
              {
                path: '/admin/camps/:id/edit',
                element: <CampFormPage baza="/admin/camps" />,
                handle: pageTitle('Editează tabără'),
              },
              {
                path: '/admin/camps/:id/enrolled',
                handle: pageTitle('Înscriși tabără'),
                element: <CampEnrolledPage baza="/admin/camps" />,
              },
              {
                path: '/admin/activities',
                element: <AdminActivitiesPage />,
                handle: pageTitle('Activități'),
              },
              {
                path: '/admin/activities/new',
                element: <ActivityFormPage portal="admin" />,
                handle: pageTitle('Activitate nouă'),
              },
              {
                path: '/admin/activities/:id/edit',
                handle: pageTitle('Editează activitate'),
                element: <ActivityFormPage portal="admin" />,
              },
              {
                path: '/admin/announcements',
                element: <AdminAnnouncementsPage />,
                handle: pageTitle('Anunțuri'),
              },
              {
                path: '/admin/announcements/new',
                element: <AdminAnnouncementFormPage />,
                handle: pageTitle('Anunț nou'),
              },
              {
                path: '/admin/attendance',
                element: <AdminAttendancePage />,
                handle: pageTitle('Prezență'),
              },
              {
                path: '/admin/payments',
                element: <AdminPaymentsPage />,
                handle: pageTitle('Plăți'),
              },
              ...(NATIVE_BUILD ? [] : webOnly(ADMIN_SUBSCRIPTION_ROUTES)),
              {
                path: '/admin/locations',
                element: <AdminLocationsPage />,
                handle: pageTitle('Locații'),
              },
              {
                path: '/admin/locations/new',
                element: <ClubLocationFormPage portal="admin" />,
                handle: pageTitle('Locație nouă'),
              },
              {
                path: '/admin/locations/:id/edit',
                handle: pageTitle('Editează locație'),
                element: <ClubLocationFormPage portal="admin" />,
              },
              {
                path: '/admin/sports',
                element: <AdminSportsPage />,
                handle: pageTitle('Sporturi'),
              },
              {
                path: '/admin/codes',
                element: <AdminInviteCodesPage />,
                handle: pageTitle('Coduri invitație'),
              },
            ],
          },
        ],
      },
      {
        element: <RequireRole roles={['CLUB']} />,
        children: [
          {
            element: <ClubLayout />,
            children: [
              { path: '/club/profile', element: <ClubProfilePage /> },
              {
                element: <ClubApprovalGate />,
                children: [
                  { path: '/club', element: <ClubDashboard /> },
                  { path: '/club/stripe', element: <ClubStripePage /> },
                  ...(NATIVE_BUILD ? [] : webOnly(CLUB_SUBSCRIPTION_ROUTES)),
                  { path: '/club/stripe/onboarding/complete', element: <ClubStripePage /> },
                  { path: '/club/stripe/onboarding/refresh', element: <ClubStripePage /> },
                  { path: '/club/coaches', element: <ClubCoachesPage /> },
                  { path: '/club/announcements', element: <ClubAnnouncementsPage /> },
                  { path: '/club/payments', element: <CashPaymentsPage /> },
                  { path: '/club/courses', element: <ClubCoursesPage /> },
                  { path: '/club/courses/new', element: <ClubCourseFormPage /> },
                  { path: '/club/courses/:id/edit', element: <ClubCourseFormPage /> },
                  { path: '/club/activities', element: <ClubActivitiesPage /> },
                  { path: '/club/activities/new', element: <ClubActivitiesPage /> },
                  { path: '/club/activities/:id/edit', element: <ClubActivitiesPage /> },
                  { path: '/club/locations', element: <ClubLocationsPage /> },
                  { path: '/club/locations/new', element: <ClubLocationFormPage /> },
                  { path: '/club/locations/:id/edit', element: <ClubLocationFormPage /> },
                  {
                    path: '/club/competitions',
                    element: <CompetitionsListPage baza="/club/competitions" />,
                  },
                  {
                    path: '/club/competitions/new',
                    element: <CompetitionFormPage baza="/club/competitions" />,
                  },
                  {
                    path: '/club/competitions/:id/edit',
                    element: <CompetitionFormPage baza="/club/competitions" />,
                  },
                  {
                    path: '/club/competitions/:id/results',
                    element: <CompetitionPodiumPage baza="/club/competitions" />,
                  },
                  { path: '/club/camps', element: <CampsListPage baza="/club/camps" /> },
                  { path: '/club/camps/new', element: <CampFormPage baza="/club/camps" /> },
                  { path: '/club/camps/:id/edit', element: <CampFormPage baza="/club/camps" /> },
                  {
                    path: '/club/camps/:id/enrolled',
                    element: <CampEnrolledPage baza="/club/camps" />,
                  },
                  { path: '/club/children/:id/qr', element: <ChildQrPage inapoi="/club/camps" /> },
                ],
              },
            ],
          },
        ],
      },
      { path: '/login', element: <LoginPage />, handle: pageTitle('Autentificare') },
      { path: '/signup', element: <SignupChoicePage />, handle: pageTitle('Creează un cont') },
      { path: '/register', element: <RegisterPage />, handle: pageTitle('Cont de părinte') },
      {
        path: '/register-coach',
        element: <CoachSignupPage />,
        handle: pageTitle('Înregistrare antrenor'),
      },
      {
        path: '/register-club',
        element: <ClubSignupPage />,
        handle: pageTitle('Înregistrare club'),
      },
      {
        path: '/forgot-password',
        element: <ForgotPasswordPage />,
        handle: pageTitle('Resetează parola'),
      },
      { path: '/reset-password', element: <ResetPasswordPage />, handle: pageTitle('Parolă nouă') },
      { path: '/auth/callback', element: <OAuthCallbackPage />, handle: pageTitle('Te conectăm') },
    ],
  },
])
