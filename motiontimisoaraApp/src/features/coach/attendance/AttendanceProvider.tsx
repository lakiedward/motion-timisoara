import { useEffect, useMemo, type ReactNode } from 'react'
import { Preferences } from '@capacitor/preferences'
import { App } from '@capacitor/app'
import { useQueryClient } from '@tanstack/react-query'
import { recordAttendance } from '@/api/attendance'
import { useAuth } from '@/lib/auth-context'
import { isNative } from '@/lib/platform'
import { AttendanceQueue } from './attendance-queue'
import { AttendanceContext } from './attendance-context'

const queues = new Map<string, AttendanceQueue>()

export function AttendanceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const queue = useMemo(() => {
    if (!user || user.role !== 'COACH' || !isNative()) return null
    const existing = queues.get(user.id)
    if (existing) return existing
    const key = `motion.attendance.v1.${user.id}`
    const created = new AttendanceQueue(
      user.id,
      {
        get: async () => (await Preferences.get({ key })).value,
        set: async (value) => {
          await Preferences.set({ key, value })
        },
      },
      recordAttendance,
      (occurrenceId) => {
        void qc.invalidateQueries({ queryKey: ['roster', occurrenceId] })
        void qc.invalidateQueries({ queryKey: ['coach-sessions'] })
      },
    )
    queues.set(user.id, created)
    return created
  }, [user, qc])

  useEffect(() => {
    if (!queue) return
    queue.activate()
    const retry = () => {
      void queue.retry()
    }
    window.addEventListener('online', retry)
    const timer = window.setInterval(retry, 30_000)
    const listener = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) retry()
    })
    return () => {
      queue.deactivate()
      window.removeEventListener('online', retry)
      window.clearInterval(timer)
      void listener.then((handle) => handle.remove())
    }
  }, [queue])

  return <AttendanceContext.Provider value={queue}>{children}</AttendanceContext.Provider>
}
