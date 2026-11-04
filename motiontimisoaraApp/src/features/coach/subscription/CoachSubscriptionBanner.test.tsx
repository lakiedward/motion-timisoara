import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import type { SubscriptionView } from '@/features/subscriptions/subscription-state'
import { CoachSubscriptionBanner } from './CoachSubscriptionBanner'
import { useCoachSubscription } from './use-coach-subscription'

vi.mock('./use-coach-subscription', () => ({ useCoachSubscription: vi.fn() }))

type HookState = ReturnType<typeof useCoachSubscription>

function mockState(
  over: Partial<Pick<HookState, 'view' | 'coverSettled' | 'isCoach'>> & {
    coveringClubs?: { id: string; name: string }[]
  },
) {
  vi.mocked(useCoachSubscription).mockReturnValue({
    isCoach: true,
    view: null,
    coverSettled: true,
    coveringClubs: [],
    ...over,
  } as unknown as HookState)
}

function renderBanner() {
  return render(
    <MemoryRouter>
      <CoachSubscriptionBanner />
    </MemoryRouter>,
  )
}

const trial = (daysLeft: number): SubscriptionView => ({
  kind: 'trialing',
  endsAt: '2026-12-01T00:00:00.000Z',
  daysLeft,
  paid: false,
})

describe('CoachSubscriptionBanner', () => {
  it('links to the subscription page when the free period is ending', () => {
    mockState({ view: trial(9) })
    renderBanner()
    expect(screen.getByTestId('subscription-banner')).toHaveAttribute('href', '/coach/abonament')
    expect(screen.getByText('Perioada gratuită se termină în 9 zile')).toBeInTheDocument()
  })

  it('shows the failed payment notice', () => {
    mockState({ view: { kind: 'past_due', graceEndsAt: null } })
    renderBanner()
    expect(screen.getByText('Plata abonamentului nu a trecut')).toBeInTheDocument()
  })

  it('stays hidden when there is nothing to warn about', () => {
    mockState({ view: trial(40) })
    renderBanner()
    expect(screen.queryByTestId('subscription-banner')).toBeNull()
  })

  it('stays hidden while a club already covers the coach', () => {
    mockState({ view: trial(5), coveringClubs: [{ id: 'c1', name: 'Club A' }] })
    renderBanner()
    expect(screen.queryByTestId('subscription-banner')).toBeNull()
  })

  it('stays hidden until the club lookup settled and for non-coaches', () => {
    mockState({ view: trial(5), coverSettled: false })
    const { unmount } = renderBanner()
    expect(screen.queryByTestId('subscription-banner')).toBeNull()
    unmount()
    mockState({ view: trial(5), isCoach: false })
    renderBanner()
    expect(screen.queryByTestId('subscription-banner')).toBeNull()
  })
})
