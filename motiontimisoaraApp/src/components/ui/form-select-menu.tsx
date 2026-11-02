import type { ComponentProps } from 'react'
import {
  useController,
  type Control,
  type FieldPath,
  type FieldPathValue,
  type FieldValues,
} from 'react-hook-form'

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
  const {
    field: { ref: triggerRef, name: fieldName, onBlur, onChange, value: fieldValue },
    fieldState,
  } = useController({
    control,
    name,
    defaultValue: '' as FieldPathValue<TValues, FieldPath<TValues>>,
  })
  const value = fieldValue === null || fieldValue === undefined ? '' : String(fieldValue)
  return (
    <SelectMenu
      {...props}
      ref={triggerRef}
      name={fieldName}
      value={value}
      aria-invalid={props['aria-invalid'] ?? (fieldState.invalid || undefined)}
      onBlur={onBlur}
      onValueChange={(next) => {
        onChange(next)
        onValueChange?.(next)
      }}
    />
  )
}
