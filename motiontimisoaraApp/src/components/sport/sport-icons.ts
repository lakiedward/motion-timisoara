import {
  Bike,
  Dumbbell,
  Footprints,
  Medal,
  PersonStanding,
  Trophy,
  Waves,
  type LucideIcon,
} from 'lucide-react'

export const SPORT_ICON: Record<string, string> = {
  inot: '🏊',
  ciclism: '🚴',
  alergare: '🏃',
  triatlon: '🏆',
  atletism: '🏅',
  gimnastica: '🤸',
}

export const SPORT_GLYPH: Record<string, LucideIcon> = {
  inot: Waves,
  ciclism: Bike,
  alergare: Footprints,
  triatlon: Trophy,
  atletism: Medal,
  gimnastica: PersonStanding,
}

export const SPORT_GLYPH_FALLBACK = Dumbbell

export const SPORT_COLOR: Record<string, string> = {
  inot: '#0ea5e9',
  ciclism: '#f59e0b',
  alergare: '#22c55e',
  triatlon: '#2563eb',
  atletism: '#8b5cf6',
  gimnastica: '#ec4899',
}

export const SPORT_COLOR_FALLBACK = '#64748b'
