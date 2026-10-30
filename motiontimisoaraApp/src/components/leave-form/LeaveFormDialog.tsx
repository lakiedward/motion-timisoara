import { ConfirmDialog } from '@/components/ui/confirm-dialog'

export function LeaveFormDialog({
  open,
  onOpenChange,
  onLeave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onLeave: () => void
}) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Renunți la modificări?"
      cancelLabel="Rămân"
      confirmLabel="Renunț"
      destructive
      onConfirm={onLeave}
    />
  )
}
