import { SlidersHorizontal } from 'lucide-react'

import { Button } from '@/components/ui/button'

export function MoreFiltersToggle({
  label,
  activeCount,
  open,
  controls,
  onToggle,
}: {
  label: string
  activeCount: number
  open: boolean
  controls: string
  onToggle: () => void
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full sm:hidden"
      aria-expanded={open}
      aria-controls={controls}
      onClick={onToggle}
    >
      <SlidersHorizontal aria-hidden="true" />
      {activeCount ? `${label} (${activeCount})` : label}
    </Button>
  )
}
