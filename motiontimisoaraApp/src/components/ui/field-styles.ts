export const fieldFocusClassName =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

export const fieldFocusWithinClassName =
  'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring'

export const selectClassName = `border-input dark:bg-input/30 flex h-touch-target w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs transition-[color,box-shadow] hover:border-muted-foreground ${fieldFocusClassName} aria-invalid:border-2 aria-invalid:border-destructive disabled:cursor-not-allowed disabled:opacity-50 md:text-sm`

export const formSelectMenuClassName = 'rounded-md bg-transparent px-3 dark:bg-input/30'

export const pickerTriggerClassName = `group bg-background border-input hover:border-muted-foreground data-[state=open]:border-primary aria-invalid:border-destructive aria-invalid:border-2 inline-flex h-touch-target w-full min-w-0 items-center gap-2 rounded-xl border px-4 text-left text-base shadow-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 md:text-sm ${fieldFocusClassName}`

export const pickerPanelClassName =
  'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 z-50 max-w-[calc(100vw-2rem)] rounded-xl border shadow-lg outline-hidden'
