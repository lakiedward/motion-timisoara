import { createBrowserRouter } from 'react-router-dom'
import RootLayout from '@/routes/RootLayout'
import CoreLayout from '@/layout/CoreLayout'
import { RequireAuth, RequireRole } from '@/routes/guards'
import CoachLayout from '@/features/coach/CoachLayout'
import CoachDashboard from '@/features/coach/CoachDashboard'
import CoachCoursesPage from '@/features/coach/CoachCoursesPage'
import CourseFormPage from '@/features/coach/CourseFormPage'
import CoachActivitiesPage from '@/features/coach/CoachActivitiesPage'
import ActivityFormPage from '@/features/coach/ActivityFormPage'
import CoachLocationsPage from '@/features/coach/CoachLocationsPage'
import LocationFormPage from '@/features/coach/LocationFormPage'
import CoachAttendancePage from '@/features/coach/CoachAttendancePage'
import CoachOwnProfilePage from '@/features/coach/CoachOwnProfilePage'
import AdminLayout from '@/features/admin/AdminLayout'
import AdminDashboard from '@/features/admin/AdminDashboard'
import AdminUsersPage from '@/features/admin/AdminUsersPage'
import AdminClubsPage from '@/features/admin/AdminClubsPage'
import AdminCoursesPage from '@/features/admin/AdminCoursesPage'
import AdminSportsPage from '@/features/admin/AdminSportsPage'
import AdminInviteCodesPage from '@/features/admin/AdminInviteCodesPage'
import ClubLayout from '@/features/club/ClubLayout'
import ClubDashboard from '@/features/club/ClubDashboard'
import ClubProfilePage from '@/features/club/ClubProfilePage'
import ClubCoachesPage from '@/features/club/ClubCoachesPage'
import ClubAnnouncementsPage from '@/features/club/ClubAnnouncementsPage'
import ClubCoursesPage from '@/features/club/ClubCoursesPage'
import ClubCourseFormPage from '@/features/club/ClubCourseFormPage'
import ClubLocationsPage from '@/features/club/ClubLocationsPage'
import ClubLocationFormPage from '@/features/club/ClubLocationFormPage'
import CampsListPage from '@/features/camps/CampsListPage'
import CampFormPage from '@/features/camps/CampFormPage'
import CampEnrolledPage from '@/features/camps/CampEnrolledPage'
import ClubStripePage from '@/features/club/ClubStripePage'
import CoachStripePage from '@/features/coach/CoachStripePage'
import HomePage from '@/features/public/HomePage'
import ProgramPage from '@/features/public/ProgramPage'
import CourseDetailsPage from '@/features/public/CourseDetailsPage'
import ActivitiesPage from '@/features/public/ActivitiesPage'
import ActivityDetailPage from '@/features/public/ActivityDetailPage'
import CampsPage from '@/features/public/CampsPage'
import CampDetailsPage from '@/features/public/CampDetailsPage'
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
import CheckoutPage from '@/features/account/CheckoutPage'

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        element: <CoreLayout />,
        children: [
          { path: '/', element: <HomePage /> },
          { path: '/cursuri', element: <ProgramPage /> },
          { path: '/cursuri/:id', element: <CourseDetailsPage /> },
          { path: '/activitati', element: <ActivitiesPage /> },
          { path: '/activitati/:id', element: <ActivityDetailPage /> },
          { path: '/tabere', element: <CampsPage /> },
          { path: '/tabere/:slug', element: <CampDetailsPage /> },
          { path: '/antrenori', element: <CoachesPage /> },
          { path: '/antrenori/:id', element: <CoachProfilePage /> },
          { path: '/cluburi', element: <ClubsPage /> },
          { path: '/cluburi/:id', element: <ClubDetailPage /> },
          { path: '/harta', element: <MapPage /> },
          { path: '/despre', element: <AboutPage /> },
          { path: '/contact', element: <ContactPage /> },
          // Galeria de componente e o unealtă internă, dar stătea aici ca rută
          // publică — deasupra lui `RequireAuth`, deci oricine o putea deschide
          // pe site. Verificat pe un build de producție servit: /dev/ui randa
          // „Galerie componente", fără sesiune.
          //
          // `import.meta.env.DEV` e înlocuit cu `false` la build, deci ramura e
          // cod mort și cade la tree-shaking împreună cu singura referință spre
          // `UiGalleryPage`. Măsurat pe `dist`: după schimbare, nici șirul
          // „/dev/ui" și nici textul galeriei nu mai apar în bundle — importul
          // static de mai sus nu mai trebuie făcut dinamic pentru asta.
          ...(import.meta.env.DEV ? [{ path: '/dev/ui', element: <UiGalleryPage /> }] : []),
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
                  { path: '/account/enrollments', element: <EnrollmentsPage /> },
                  { path: '/account/attendance', element: <AttendancePage /> },
                  { path: '/account/announcements', element: <AnnouncementsPage /> },
                  { path: '/account/checkout', element: <CheckoutPage /> },
                ],
              },
            ],
          },
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
              { path: '/coach/courses/new', element: <CourseFormPage /> },
              { path: '/coach/courses/:id/edit', element: <CourseFormPage /> },
              { path: '/coach/activities', element: <CoachActivitiesPage /> },
              { path: '/coach/activities/new', element: <ActivityFormPage /> },
              { path: '/coach/activities/:id/edit', element: <ActivityFormPage /> },
              { path: '/coach/locations', element: <CoachLocationsPage /> },
              { path: '/coach/locations/new', element: <LocationFormPage /> },
              { path: '/coach/locations/:id/edit', element: <LocationFormPage /> },
              { path: '/coach/camps', element: <CampsListPage baza="/coach/camps" /> },
              { path: '/coach/camps/new', element: <CampFormPage baza="/coach/camps" /> },
              { path: '/coach/camps/:id/edit', element: <CampFormPage baza="/coach/camps" /> },
              { path: '/coach/camps/:id/enrolled', element: <CampEnrolledPage baza="/coach/camps" /> },
              { path: '/coach/attendance', element: <CoachAttendancePage /> },
              { path: '/coach/profile', element: <CoachOwnProfilePage /> },
              { path: '/coach/stripe', element: <CoachStripePage /> },
              // Return URLs handed to Stripe by the stripe-connect Edge Function
              // for coach accounts. Stripe controls these paths, so they are not
              // namespaced under /coach.
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
              { path: '/admin', element: <AdminDashboard /> },
              { path: '/admin/users', element: <AdminUsersPage /> },
              { path: '/admin/clubs', element: <AdminClubsPage /> },
              { path: '/admin/courses', element: <AdminCoursesPage /> },
              { path: '/admin/sports', element: <AdminSportsPage /> },
              { path: '/admin/codes', element: <AdminInviteCodesPage /> },
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
              { path: '/club', element: <ClubDashboard /> },
              { path: '/club/stripe', element: <ClubStripePage /> },
              { path: '/club/stripe/onboarding/complete', element: <ClubStripePage /> },
              { path: '/club/stripe/onboarding/refresh', element: <ClubStripePage /> },
              { path: '/club/profile', element: <ClubProfilePage /> },
              { path: '/club/coaches', element: <ClubCoachesPage /> },
              { path: '/club/announcements', element: <ClubAnnouncementsPage /> },
              { path: '/club/courses', element: <ClubCoursesPage /> },
              { path: '/club/courses/new', element: <ClubCourseFormPage /> },
              { path: '/club/courses/:id/edit', element: <ClubCourseFormPage /> },
              { path: '/club/locations', element: <ClubLocationsPage /> },
              { path: '/club/locations/new', element: <ClubLocationFormPage /> },
              { path: '/club/locations/:id/edit', element: <ClubLocationFormPage /> },
              { path: '/club/camps', element: <CampsListPage baza="/club/camps" /> },
              { path: '/club/camps/new', element: <CampFormPage baza="/club/camps" /> },
              { path: '/club/camps/:id/edit', element: <CampFormPage baza="/club/camps" /> },
              { path: '/club/camps/:id/enrolled', element: <CampEnrolledPage baza="/club/camps" /> },
            ],
          },
        ],
      },
      { path: '/login', element: <LoginPage /> },
      { path: '/signup', element: <SignupChoicePage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/register-coach', element: <CoachSignupPage /> },
      { path: '/register-club', element: <ClubSignupPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
      { path: '/auth/callback', element: <OAuthCallbackPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
