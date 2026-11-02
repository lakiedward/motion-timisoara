import { Archive, Trash2 } from 'lucide-react'

import { DELETED_ITEMS, KEPT_ITEMS } from './delete-account-items'

export function DeletionLists() {
  return (
    <div className="grid gap-3 text-sm">
      <div className="space-y-1.5">
        <p className="text-foreground flex items-center gap-2 font-semibold">
          <Trash2 aria-hidden="true" className="text-destructive size-4" />
          Se șterg definitiv
        </p>
        <ul className="text-muted-foreground list-disc space-y-1 pl-6">
          {DELETED_ITEMS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <div className="space-y-1.5">
        <p className="text-foreground flex items-center gap-2 font-semibold">
          <Archive aria-hidden="true" className="text-muted-foreground size-4" />
          Rămân în evidențe
        </p>
        <ul className="text-muted-foreground list-disc space-y-1 pl-6">
          {KEPT_ITEMS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
