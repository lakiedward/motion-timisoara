import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { getChildAttendance, getMyChildren } from '@/api/account'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const selectCls =
  'border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]'

export default function AttendancePage() {
  const { data: children = [] } = useQuery({ queryKey: ['children'], queryFn: getMyChildren })
  const [selected, setSelected] = useState('')
  // Default to the first child until the user picks one (derived, no effect).
  const childId = selected || children[0]?.id || ''

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['attendance', childId],
    queryFn: () => getChildAttendance(childId),
    enabled: !!childId,
  })

  const present = records.filter((r) => r.status === 'PRESENT').length

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Prezență</h1>
        {children.length > 1 && (
          <select value={childId} onChange={(e) => setSelected(e.target.value)} className={cn(selectCls)}>
            {children.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {!children.length ? (
        <div className="text-muted-foreground rounded-3xl border border-dashed py-16 text-center">
          Adaugă un copil pentru a vedea prezența.
        </div>
      ) : isLoading ? (
        <Skeleton className="h-40 rounded-3xl" />
      ) : records.length ? (
        <div className="space-y-4">
          <div className="bg-card shadow-card rounded-3xl p-5 text-sm">
            <span className="font-semibold">{present}</span> prezențe din{' '}
            <span className="font-semibold">{records.length}</span> ședințe înregistrate.
          </div>
          <ul className="space-y-2">
            {records
              .slice()
              .sort(
                (a, b) =>
                  +new Date(b.occurrence?.starts_at ?? 0) - +new Date(a.occurrence?.starts_at ?? 0)
              )
              .map((r) => (
                <li key={r.id} className="bg-card flex items-center justify-between rounded-2xl border p-3 text-sm">
                  <span>
                    {r.occurrence?.course?.name ?? 'Ședință'} ·{' '}
                    {r.occurrence?.starts_at
                      ? new Date(r.occurrence.starts_at).toLocaleDateString('ro-RO')
                      : ''}
                  </span>
                  <span
                    className={cn(
                      'font-medium',
                      r.status === 'PRESENT' ? 'text-success' : 'text-destructive'
                    )}
                  >
                    {r.status === 'PRESENT' ? 'Prezent' : 'Absent'}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      ) : (
        <div className="text-muted-foreground rounded-3xl border border-dashed py-16 text-center">
          Nicio prezență înregistrată încă.
        </div>
      )}
    </div>
  )
}
