import { cloneElement, isValidElement, useId } from 'react'

import { Label } from '@/components/ui/label'

export default function CampFormField({
  eticheta,
  ajutor,
  eroare,
  children,
}: {
  eticheta: string
  ajutor?: string
  eroare?: string
  children: React.ReactNode
}) {
  const id = useId()
  const camp = isValidElement<{ id?: string }>(children)
    ? cloneElement(children, { id: children.props.id ?? id })
    : children
  return (
    <div className="mt-3 first:mt-0">
      <Label htmlFor={id} className="mb-1.5 block">
        {eticheta}
      </Label>
      {camp}
      {ajutor && !eroare && <p className="text-muted-foreground mt-1 text-xs">{ajutor}</p>}
      {eroare && (
        <p className="text-destructive mt-1 text-xs" role="alert">
          {eroare}
        </p>
      )}
    </div>
  )
}
