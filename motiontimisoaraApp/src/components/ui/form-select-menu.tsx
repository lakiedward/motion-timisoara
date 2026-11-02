import type { ComponentProps } from 'react'
import { useController, type Control, type FieldPath, type FieldValues } from 'react-hook-form'

import { SelectMenu } from '@/components/ui/select-menu'

type FormSelectMenuProps<TValues extends FieldValues> = Omit<
  ComponentProps<typeof SelectMenu>,
  'value' | 'onValueChange' | 'onBlur' | 'name'
> & {
  control: Control<TValues>
  name: FieldPath<TValues>
  onValueChange?: (value: string) => void
}

export function FormSelectMenu<TValues extends FieldValues>({
  control,
  name,
  onValueChange,
  ...props
}: FormSelectMenuProps<TValues>) {
  const { field, fieldState } = useController({ control, name })
  const value = field.value === null || field.value === undefined ? '' : String(field.value)
  return (
    <SelectMenu
      {...props}
      ref={field.ref}
      name={field.name}
      value={value}
      aria-invalid={props['aria-invalid'] ?? (fieldState.invalid || undefined)}
      onBlur={field.onBlur}
      onValueChange={(next) => {
        field.onChange(next)
        onValueChange?.(next)
      }}
    />
  )
}
