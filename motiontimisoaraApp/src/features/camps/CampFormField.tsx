import { cloneElement, isValidElement, useId, type ReactNode } from 'react'

import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export default function CampFormField({
  eticheta,
  ajutor,
  eroare,
  rand,
  children,
}: {
  eticheta: string
  ajutor?: string
  eroare?: string
  rand?: boolean
  children: ReactNode
}) {
  const id = useId()
  const camp = isValidElement<{ id?: string }>(children)
    ? cloneElement(children, { id: children.props.id ?? id })
    : children
  const mesaj = (spatiu: boolean) => (
    <>
      {ajutor && !eroare && (
        <p className={cn('text-muted-foreground text-xs', spatiu && 'mt-1')}>{ajutor}</p>
      )}
      {eroare && (
        <p className={cn('text-destructive text-xs', spatiu && 'mt-1')} role="alert">
          {eroare}
        </p>
      )}
    </>
  )
  return (
    <div className={rand ? 'grid grid-rows-subgrid row-span-3 gap-y-1.5' : 'mt-3 first:mt-0'}>
      <Label htmlFor={id} className={rand ? 'self-end' : 'mb-1.5 block'}>
        {eticheta}
      </Label>
      {camp}
      {rand ? <div>{mesaj(false)}</div> : mesaj(true)}
    </div>
  )
}

export function CampFormRand({
  columns,
  className,
  children,
}: {
  columns: 'two' | 'ages' | 'amount' | 'article'
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'grid min-w-0 flex-1 grid-cols-1 gap-3 sm:gap-x-3 sm:gap-y-1.5',
        columns === 'two' && 'sm:grid-cols-2',
        columns === 'ages' && 'sm:grid-cols-2',
        columns === 'amount' && 'sm:grid-cols-[minmax(0,1fr)_140px_auto]',
        columns === 'article' && 'sm:grid-cols-[minmax(0,1fr)_120px_auto]',
        className,
      )}
    >
      {children}
    </div>
  )
}

export const campFormRandAction =
  'size-11 min-h-11 shrink-0 sm:col-start-3 sm:row-start-2 sm:self-center'
