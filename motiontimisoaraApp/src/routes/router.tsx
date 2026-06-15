import { createBrowserRouter } from 'react-router-dom'
import RootLayout from '@/routes/RootLayout'
import CoreLayout from '@/layout/CoreLayout'
import HomePage from '@/features/public/HomePage'
import NotFoundPage from '@/features/NotFoundPage'

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        element: <CoreLayout />,
        children: [{ path: '/', element: <HomePage /> }],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
