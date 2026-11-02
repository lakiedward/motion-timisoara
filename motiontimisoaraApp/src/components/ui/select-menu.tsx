import * as React from 'react'
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { Check, ChevronDown } from 'lucide-react'

import { cn } from '@/lib/utils'
import { fieldFocusClassName } from '@/components/ui/field-styles'

export type SelectMenuOption = { value: string; label: string; disabled?: boolean }
export type SelectMenuGroup = { label: string; options: SelectMenuOption[] }

type SelectMenuProps = {
  id?: string
  name?: string
  value: string
  onValueChange: (value: string) => void
  onBlur?: () => void
  options?: SelectMenuOption[]
  groups?: SelectMenuGroup[]
  emptyLabel?: string
  placeholder?: string
  disabled?: boolean
  className?: string
  'aria-label'?: string
  'aria-labelledby'?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean | 'true' | 'false'
}

const ITEM_CLASS =
  'focus:bg-accent focus:text-accent-foreground data-[state=checked]:text-primary data-[disabled]:pointer-events-none data-[disabled]:opacity-50 flex min-h-touch-target cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm outline-hidden select-none data-[state=checked]:font-semibold'

function Item({ option }: { option: SelectMenuOption }) {
  return (
    <DropdownMenuPrimitive.RadioItem
      value={option.value}
      disabled={option.disabled}
      className={ITEM_CLASS}
    >
      <span className="min-w-0 flex-1 break-words">{option.label}</span>
      <DropdownMenuPrimitive.ItemIndicator>
        <Check aria-hidden="true" className="size-4" />
      </DropdownMenuPrimitive.ItemIndicator>
    </DropdownMenuPrimitive.RadioItem>
  )
}

const SelectMenu = React.forwardRef<HTMLButtonElement, SelectMenuProps>(function SelectMenu(
  {
    id,
    name,
    value,
    onValueChange,
    onBlur,
    options = [],
    groups = [],
    emptyLabel,
    placeholder,
    disabled,
    className,
    ...aria
  },
  ref,
) {
  const all = [...options, ...groups.flatMap((group) => group.options)]
  const selected = all.find((option) => option.value === value)
  const shown = selected?.label ?? (value === '' ? (emptyLabel ?? placeholder) : undefined)

  return (
    <DropdownMenuPrimitive.Root modal={false}>
      <DropdownMenuPrimitive.Trigger
        ref={ref}
        id={id}
        disabled={disabled}
        onBlur={onBlur}
        aria-invalid={aria['aria-invalid']}
        aria-describedby={aria['aria-describedby']}
        aria-label={aria['aria-label']}
        aria-labelledby={aria['aria-labelledby']}
        className={cn(
          'group bg-background border-input hover:border-muted-foreground data-[state=open]:border-primary aria-invalid:border-destructive aria-invalid:border-2 inline-flex h-touch-target w-full min-w-0 items-center gap-2 rounded-xl border px-4 text-left text-base shadow-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          fieldFocusClassName,
          className,
        )}
      >
        <span className={cn('min-w-0 flex-1 truncate', selected ? '' : 'text-muted-foreground')}>
          {shown}
        </span>
        <ChevronDown
          aria-hidden="true"
          className="size-4 shrink-0 opacity-70 transition-transform group-data-[state=open]:rotate-180"
        />
      </DropdownMenuPrimitive.Trigger>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          align="start"
          sideOffset={6}
          className="bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 z-50 max-h-(--radix-dropdown-menu-content-available-height) w-(--radix-dropdown-menu-trigger-width) min-w-48 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border p-1.5 shadow-lg"
        >
          <DropdownMenuPrimitive.RadioGroup value={value} onValueChange={onValueChange}>
            {emptyLabel !== undefined ? <Item option={{ value: '', label: emptyLabel }} /> : null}
            {options.map((option) => (
              <Item key={option.value} option={option} />
            ))}
            {groups.map((group) => (
              <DropdownMenuPrimitive.Group key={group.label}>
                <DropdownMenuPrimitive.Label className="text-muted-foreground px-3 pt-3 pb-1 text-xs font-semibold tracking-wide uppercase">
                  {group.label}
                </DropdownMenuPrimitive.Label>
                {group.options.map((option) => (
                  <Item key={option.value} option={option} />
                ))}
              </DropdownMenuPrimitive.Group>
            ))}
          </DropdownMenuPrimitive.RadioGroup>
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  )
})

export { SelectMenu }
