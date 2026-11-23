import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { deleteOffer, type OfferTable } from '@/api/offer-deletion'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

const offers = {
  courses: {
    name: 'cursul',
    success: 'Cursul a fost șters.',
    keys: [
      'my-courses', 'club-courses', 'admin-courses', 'courses', 'course-catalog', 'course',
      'course-edit', 'club-course-edit', 'coach-courses', 'coach-sessions', 'admin-coach-courses',
      'club-audiences',
    ],
  },
  activities: {
    name: 'activitatea',
    success: 'Activitatea a fost ștearsă.',
    keys: ['my-activities', 'club-activities', 'admin-activities', 'activities', 'activitati-publice', 'activitate-detaliu', 'activity-edit', 'club-activity', 'coach-activities'],
  },
  camps: {
    name: 'tabăra',
    success: 'Tabăra a fost ștearsă.',
    keys: ['taberele-mele', 'tabere-publice', 'tabere-invitat', 'tabara-de-editat', 'camp-detail', 'club-camps', 'coach-camps'],
  },
  competitions: {
    name: 'concursul',
    success: 'Concursul a fost șters.',
    keys: ['concursurile-mele', 'concursuri-publice', 'concurs-de-editat', 'concurs-public'],
  },
}

interface OfferDeleteActionProps {
  table: OfferTable
  id: string
  listPath: string
  disabled?: boolean
  allowLeave?: () => void
}

export function OfferDeleteAction({ table, id, listPath, disabled, allowLeave }: OfferDeleteActionProps) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { name, success, keys } = offers[table]
  const deletion = useMutation({
    mutationFn: () => deleteOffer(table, id),
    onSuccess: () => {
      allowLeave?.()
      navigate(listPath, { replace: true })
      void qc.invalidateQueries({
        predicate: ({ queryKey }) => typeof queryKey[0] === 'string' && keys.includes(queryKey[0]),
      })
      toast.success(success)
    },
  })

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="min-h-touch-target"
        disabled={disabled || deletion.isPending}
        onClick={() => {
          deletion.reset()
          setOpen(true)
        }}
      >
        Șterge {name}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Ștergi ${name}?`}
        description="Oferta dispare din liste și de pe pagina publică. Ștergerea este definitivă."
        confirmLabel={`Șterge ${name}`}
        destructive
        pending={deletion.isPending}
        confirmDisabled={disabled}
        onConfirm={() => deletion.mutate()}
      >
        {deletion.error && (
          <p className="text-destructive text-sm" role="alert">{deletion.error.message}</p>
        )}
      </ConfirmDialog>
    </>
  )
}
