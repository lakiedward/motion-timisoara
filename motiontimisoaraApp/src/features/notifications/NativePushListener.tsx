import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { App } from '@capacitor/app'
import { PushNotifications } from '@capacitor/push-notifications'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth-context'
import { observePushAuth, pushNotifications, supportsPush } from '@/api/notifications'
import { parsePushPayload } from '@/api/notifications/payload'
import type { PushPayload } from '@/api/notifications/types'

const pendingTaps = new Map<string, PushPayload>()
const pendingReceived = new Map<string, PushPayload>()
const receivedEvents = new Set<string>()
const affectedQueries = new Set([
  'parent-announcement-feed',
  'parent-announcement-visit',
  'parent-announcement-courses',
  'attendance',
  'enrollments',
  'children',
  'courses',
  'course',
  'course-spots',
  'tabere-publice',
  'camp-detail',
])

export function NativePushListener() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const client = useQueryClient()
  const auth = useRef({ user, loading })
  const userId = user?.id
  const role = user?.role

  useEffect(() => {
    auth.current = { user, loading }
  }, [user, loading])

  useEffect(() => {
    if (!supportsPush() || loading) return
    if (role === 'PARENT' && userId) void pushNotifications.restore(userId)
    else {
      pendingTaps.clear()
      pendingReceived.clear()
      void pushNotifications.clearForSignOut().catch(() => undefined)
    }
  }, [userId, role, loading])

  useEffect(() => {
    if (!supportsPush()) return
    let active = true
    const invalidate = () => {
      void client.invalidateQueries({
        predicate: (query) => affectedQueries.has(String(query.queryKey[0])),
      })
    }
    const showReceived = (payload: PushPayload) => {
      const key = `${payload.bindingId}:${payload.eventId}`
      if (receivedEvents.has(key)) return
      receivedEvents.add(key)
      if (receivedEvents.size > 100) receivedEvents.delete(receivedEvents.values().next().value!)
      invalidate()
      toast.info(payload.title, {
        description: payload.body,
        action: {
          label: 'Deschide',
          onClick: () => {
            if (!active || auth.current.loading || auth.current.user?.role !== 'PARENT') return
            const selected = pushNotifications.consume(payload)
            if (selected) {
              invalidate()
              navigate(selected.path)
            }
          },
        },
      })
    }
    const flush = () => {
      if (!active || auth.current.loading) return
      if (auth.current.user?.role !== 'PARENT') {
        pendingTaps.clear()
        pendingReceived.clear()
        return
      }
      const state = pushNotifications.getSnapshot()
      if (state.status === 'loading' || state.busy || state.status === 'error') return
      for (const [id, value] of pendingTaps) {
        const payload = pushNotifications.consume(value)
        pendingTaps.delete(id)
        if (payload) {
          invalidate()
          navigate(payload.path)
        }
      }
      for (const [id, value] of pendingReceived) {
        const payload = pushNotifications.authorizedPayload(value)
        pendingReceived.delete(id)
        if (payload) showReceived(payload)
      }
    }
    const restore = () => {
      const current = auth.current
      if (
        active &&
        !current.loading &&
        !pushNotifications.getSnapshot().busy &&
        current.user?.role === 'PARENT'
      )
        void pushNotifications.restore(current.user.id)
    }
    const unsubscribeAuth = observePushAuth()
    const unsubscribeState = pushNotifications.subscribe(flush)
    const listeners = [
      PushNotifications.addListener('registration', ({ value }) => {
        if (active) void pushNotifications.refreshToken(value)
      }),
      PushNotifications.addListener('pushNotificationReceived', ({ data }) => {
        const payload = parsePushPayload(data)
        if (!payload) return
        pendingReceived.set(`${payload.bindingId}:${payload.eventId}`, payload)
        if (pendingReceived.size > 20) pendingReceived.delete(pendingReceived.keys().next().value!)
        flush()
      }),
      PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
        const payload = parsePushPayload(notification.data)
        if (!payload) return
        pendingTaps.set(`${payload.bindingId}:${payload.eventId}`, payload)
        if (pendingTaps.size > 20) pendingTaps.delete(pendingTaps.keys().next().value!)
        flush()
      }),
      App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) restore()
      }),
    ]
    window.addEventListener('online', restore)
    void Promise.all(listeners)
      .then(flush)
      .catch(() => undefined)
    return () => {
      active = false
      unsubscribeAuth()
      unsubscribeState()
      window.removeEventListener('online', restore)
      for (const listener of listeners)
        void listener.then((handle) => handle.remove()).catch(() => undefined)
    }
  }, [navigate, client])
  return null
}
