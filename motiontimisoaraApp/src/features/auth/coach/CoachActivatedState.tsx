import { Link } from 'react-router-dom'
import { CircleAlert, CircleCheck } from 'lucide-react'

import { AuthLayout } from '../AuthLayout'
import { Button } from '@/components/ui/button'

export const COACH_PROFILE_LOAD_ERROR =
  'Profilul nu s-a încărcat. Verifică conexiunea și reîncearcă.'

interface CoachActivatedStateProps {
  refreshing: boolean
  error: string | null
  onRetry: () => void
}

export function CoachActivatedState({ refreshing, error, onRetry }: CoachActivatedStateProps) {
  return (
    <AuthLayout
      title="Contul de antrenor e activ"
      footer={
        <Link
          to="/"
          className="text-primary min-h-touch-target inline-flex items-center font-semibold"
        >
          Mergi la pagina principală
        </Link>
      }
    >
      <div className="space-y-4 text-sm">
        <span className="bg-primary/10 text-primary grid size-12 place-items-center rounded-full">
          <CircleCheck className="size-6" aria-hidden="true" />
        </span>
        {error && (
          <p
            className="bg-destructive/10 text-destructive flex items-start gap-2 rounded-md px-3 py-2 text-sm"
            role="alert"
          >
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}
        <Button type="button" className="w-full" disabled={refreshing} onClick={onRetry}>
          {refreshing ? 'Se încarcă profilul…' : 'Reîncearcă încărcarea profilului'}
        </Button>
      </div>
    </AuthLayout>
  )
}
