import { Button } from '@/components/ui/button'
import { StatusView } from '@/components/ui/status-view'

export function FilteredEmptyState({ title, onReset }: { title: string; onReset: () => void }) {
  return (
    <StatusView
      state="empty"
      title={title}
      text="Încearcă altă lună, alt buget sau altă locație."
      action={
        <Button type="button" variant="outline" className="mt-3" onClick={onReset}>
          Resetează filtrele
        </Button>
      }
    />
  )
}
