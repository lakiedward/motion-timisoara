import { Toaster as Sonner, type ToasterProps } from 'sonner'

import { useThemePreference } from '@/lib/theme/use-theme'

function Toaster(props: ToasterProps) {
  const { resolved } = useThemePreference()
  return (
    <Sonner
      className="toaster group"
      theme={resolved}
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-popover group-[.toaster]:text-popover-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:rounded-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
