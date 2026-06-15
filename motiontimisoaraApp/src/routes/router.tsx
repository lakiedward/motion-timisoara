import { createBrowserRouter } from 'react-router-dom'
import RootLayout from '@/routes/RootLayout'
import CoreLayout from '@/layout/CoreLayout'
import { RequireAuth } from '@/routes/guards'
import HomePage from '@/features/public/HomePage'
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
import AccountPlaceholder from '@/features/account/AccountPlaceholder'

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        element: <CoreLayout />,
        children: [
          { path: '/', element: <HomePage /> },
          { path: '/dev/ui', element: <UiGalleryPage /> },
          {
            element: <RequireAuth />,
            children: [{ path: '/account', element: <AccountPlaceholder /> }],
          },
        ],
      },
      // Auth routes — full-page, outside the public shell
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
