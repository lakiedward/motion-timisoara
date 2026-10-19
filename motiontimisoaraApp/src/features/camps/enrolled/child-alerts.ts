import {
  AlertTriangle,
  CameraOff,
  HeartPulse,
  Utensils,
  Waves,
  type LucideIcon,
} from 'lucide-react'

import type { CopilInscris } from '@/api/camp-enrolled'

export type CheieAlerta = 'alergii' | 'medicatie' | 'dieta' | 'faraPoze' | 'nuInoata'

export type TonAlerta = 'danger' | 'warn' | 'info' | 'neutral'

export interface TipAlerta {
  cheie: CheieAlerta
  eticheta: string
  icon: LucideIcon
  ton: TonAlerta
  detaliu: (c: CopilInscris) => string | null
}

export const TIPURI_ALERTA: TipAlerta[] = [
  {
    cheie: 'alergii',
    eticheta: 'Alergii',
    icon: AlertTriangle,
    ton: 'danger',
    detaliu: (c) => c.alergii?.trim() || null,
  },
  {
    cheie: 'medicatie',
    eticheta: 'Medicație',
    icon: HeartPulse,
    ton: 'danger',
    detaliu: (c) => c.afectiuni,
  },
  {
    cheie: 'dieta',
    eticheta: 'Dietă',
    icon: Utensils,
    ton: 'warn',
    detaliu: (c) => c.restrictiiAlimentare,
  },
  {
    cheie: 'faraPoze',
    eticheta: 'Fără poze',
    icon: CameraOff,
    ton: 'neutral',
    detaliu: (c) => (c.acordFoto === false ? 'Fără poze sau video cu acest copil' : null),
  },
  {
    cheie: 'nuInoata',
    eticheta: 'Nu înoată',
    icon: Waves,
    ton: 'info',
    detaliu: (c) => (c.inot === 'no' ? 'Nu știe să înoate' : null),
  },
]

export const TON_CLASE: Record<TonAlerta, string> = {
  danger: 'border-destructive/25 bg-destructive/10 text-destructive',
  warn: 'border-highlight/40 bg-highlight/10 text-highlight-ink',
  info: 'border-transparent bg-accent text-accent-foreground',
  neutral: 'border-transparent bg-secondary text-secondary-foreground',
}

export function alerteCopil(c: CopilInscris) {
  if (c.fel === 'adult') return []
  return TIPURI_ALERTA.flatMap((tip) => {
    const detaliu = tip.detaliu(c)
    return detaliu ? [{ tip, detaliu }] : []
  })
}

export function areAlerta(c: CopilInscris, cheie: CheieAlerta) {
  return alerteCopil(c).some((a) => a.tip.cheie === cheie)
}
