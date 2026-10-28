import { useCallback, useRef } from 'react'
import { useBlocker } from 'react-router-dom'

export function useLeaveGuard(when: boolean) {
  const permis = useRef(false)
  const blocker = useBlocker(
    useCallback(
      ({ currentLocation, nextLocation }) =>
        when && !permis.current && currentLocation.pathname !== nextLocation.pathname,
      [when],
    ),
  )
  const allowLeave = useCallback(() => {
    permis.current = true
  }, [])
  return {
    allowLeave,
    dialog: {
      open: blocker.state === 'blocked',
      onOpenChange: (open: boolean) => {
        if (!open && blocker.state === 'blocked') blocker.reset()
      },
      onLeave: () => {
        if (blocker.state === 'blocked') blocker.proceed()
      },
    },
  }
}
