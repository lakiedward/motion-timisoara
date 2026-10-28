export const fieldFocusClassName =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

export const fieldFocusWithinClassName =
  'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring'

export const selectClassName = `border-input dark:bg-input/30 flex h-touch-target w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs transition-[color,box-shadow] hover:border-muted-foreground ${fieldFocusClassName} aria-invalid:border-2 aria-invalid:border-destructive disabled:cursor-not-allowed disabled:opacity-50 md:text-sm`
