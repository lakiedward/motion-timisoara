import { getMyClub, type Club } from '@/api/club'
import { getMyCoachStripeStatus, type CoachStripeStatus } from '@/api/coach'

export type StripeScope = 'club' | 'coach'

export type Billable = { label: string; complete: boolean } | null

export interface ScopeConfig {
  queryKey: string[]
  queryFn: () => Promise<unknown>
  select: (data: unknown) => Billable
  description: (label: string) => string
  setupHint: string
  missing: string
  loadError: string
  backTo: string
}

export const SCOPES: Record<StripeScope, ScopeConfig> = {
  club: {
    queryKey: ['my-club'],
    queryFn: getMyClub,
    select: (data) => {
      const club = data as Club | null
      return club ? { label: club.name, complete: club.stripe_onboarding_complete } : null
    },
    description: (label) =>
      `Cont Stripe Connect pentru ${label}, ca părinții să poată plăti cursurile clubului cu cardul.`,
    setupHint:
      'Configurezi o singură dată, direct la Stripe: datele firmei și contul bancar (IBAN).',
    missing: 'Niciun club asociat contului.',
    loadError: 'Nu am putut încărca clubul.',
    backTo: '/club',
  },
  coach: {
    queryKey: ['my-coach-stripe'],
    queryFn: getMyCoachStripeStatus,
    select: (data) => {
      const status = data as CoachStripeStatus | undefined
      return status?.hasProfile
        ? { label: 'contul tău', complete: status.onboardingComplete }
        : null
    },
    description: () =>
      'Cont Stripe Connect pentru tine, ca părinții să poată plăti cursurile tale cu cardul.',
    setupHint: 'Configurezi o singură dată, direct la Stripe: datele tale și contul bancar (IBAN).',
    missing: 'Niciun profil de antrenor asociat contului.',
    loadError: 'Nu am putut încărca profilul de antrenor.',
    backTo: '/coach',
  },
}
