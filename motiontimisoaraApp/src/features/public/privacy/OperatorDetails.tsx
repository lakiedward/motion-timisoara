import { Badge } from '@/components/ui/badge'

import { OPERATOR_FIELDS } from '../legal/operator'

export function OperatorDetails() {
  return (
    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-3">
      {OPERATOR_FIELDS.map((field) => (
        <div key={field.label} className="contents">
          <dt className="text-muted-foreground mt-1 sm:mt-0">{field.label}</dt>
          <dd className="text-foreground font-medium sm:col-span-2">
            {field.value ?? <Badge variant="highlight">De completat</Badge>}
          </dd>
        </div>
      ))}
    </dl>
  )
}
