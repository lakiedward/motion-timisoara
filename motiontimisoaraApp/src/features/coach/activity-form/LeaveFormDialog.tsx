import * as Dialog from '@radix-ui/react-dialog'

import { Button } from '@/components/ui/button'

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
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content
          aria-describedby={undefined}
          className="bg-background text-foreground fixed top-1/2 right-4 left-4 z-50 mx-auto max-w-md -translate-y-1/2 rounded-lg border p-6 shadow-lg outline-none"
        >
          <Dialog.Title className="font-display text-lg font-semibold">
            Renunți la modificări?
          </Dialog.Title>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button type="button" onClick={() => onOpenChange(false)}>
              Rămân
            </Button>
            <Button type="button" variant="outline" onClick={onLeave}>
              Renunț
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
