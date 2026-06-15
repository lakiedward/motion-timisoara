import { createBrowserRouter } from 'react-router-dom'
import RootLayout from '@/routes/RootLayout'
import CoreLayout from '@/layout/CoreLayout'
import { RequireAuth, RequireRole } from '@/routes/guards'
import CoachLayout from '@/features/coach/CoachLayout'
import CoachDashboard from '@/features/coach/CoachDashboard'
import CoachCoursesPage from '@/features/coach/CoachCoursesPage'
import CourseFormPage from '@/features/coach/CourseFormPage'
import PortalComingSoon from '@/features/PortalComingSoon'
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
          { path: '/dev/ui', element: <UiGalleryPage /> },
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
              { path: '/coach/activities', element: <PortalComingSoon title="Activități" /> },
              { path: '/coach/locations', element: <PortalComingSoon title="Locații" /> },
              { path: '/coach/attendance', element: <PortalComingSoon title="Prezență" /> },
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
