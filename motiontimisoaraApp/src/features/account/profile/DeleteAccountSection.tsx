import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  ACCOUNT_DELETION_ERROR,
  AccountDeletionError,
  deleteMyAccount,
  signOutDeletedAccount,
} from '@/api/account-deletion'
import { FormSection } from '@/components/FormSection'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DeletionLists } from './DeletionLists'
import { useDeletionSummary } from './useDeletionSummary'

export function DeleteAccountSection({ userId }: { userId: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [understood, setUnderstood] = useState(false)
  const [pending, setPending] = useState(false)
  const summary = useDeletionSummary(userId, open)

  const onDelete = async () => {
    setPending(true)
    try {
      await deleteMyAccount(userId)
      navigate('/', { replace: true })
      await signOutDeletedAccount()
      queryClient.clear()
      toast.success('Contul tău a fost șters.')
    } catch (error) {
      toast.error(error instanceof AccountDeletionError ? error.message : ACCOUNT_DELETION_ERROR)
      setPending(false)
    }
  }

  return (
    <FormSection
      id="sterge-contul"
      title="Ștergerea contului"
      description="Îți ștergem contul și datele copiilor. Acțiunea nu se poate anula."
    >
      <Button
        type="button"
        variant="outline"
        className="min-h-touch-target text-destructive hover:text-destructive"
        onClick={() => {
          setUnderstood(false)
          setOpen(true)
        }}
      >
        <Trash2 aria-hidden="true" />
        Șterge contul
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Ștergi contul definitiv?"
        description="Te deconectăm imediat și nu mai poți intra cu acest cont."
        confirmLabel={pending ? 'Se șterge…' : 'Șterge contul'}
        destructive
        pending={pending}
        confirmDisabled={!understood || summary.loading}
        onConfirm={() => void onDelete()}
      >
        <DeletionLists />
        {summary.activeCount ? (
          <p role="alert" className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
            {summary.activeCount === 1
              ? 'Ai o înscriere activă. Se anulează'
              : `Ai ${summary.activeCount} înscrieri active. Se anulează`}
            , iar ședințele plătite nu se rambursează automat. Vorbește cu clubul înainte.
          </p>
        ) : null}
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="accent-primary focus-visible:outline-ring mt-0.5 size-4 shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2"
            checked={understood}
            disabled={pending}
            onChange={(e) => setUnderstood(e.target.checked)}
          />
          <span>Am înțeles că ștergerea este definitivă.</span>
        </label>
      </ConfirmDialog>
    </FormSection>
  )
}
