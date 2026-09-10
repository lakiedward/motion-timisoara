import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { queryClient } from '@/lib/query'
import { AuthProvider } from '@/lib/auth-context'
import { AttendanceProvider } from '@/features/coach/attendance/AttendanceProvider'
import { router } from '@/routes/router'
import { LiveLocationProvider } from '@/features/live-location/LiveLocationProvider'

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AttendanceProvider>
          <LiveLocationProvider>
            <RouterProvider router={router} />
          </LiveLocationProvider>
        </AttendanceProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
