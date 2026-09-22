import { useState } from 'react'
import { AlertCircle, Loader2, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { AdultValidation, ChildValidation } from '@/api/checkout'
import { childAge, type Child } from '@/api/account'

export function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <div>
      <Label className="mb-1.5 block">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

export function AddChildInline({
  onAdd,
  pending,
}: {
  onAdd: (v: { name: string; birth_date: string }) => void
  pending: boolean
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)} className="w-full">
        <Plus className="mr-2 size-4" /> Adaugă un copil
      </Button>
    )
  }

  return (
    <div className="bg-card shadow-card space-y-3 rounded-3xl p-5">
      <Field label="Nume" value={name} onChange={setName} />
      <div>
        <Label className="mb-1.5 block">Data nașterii</Label>
        <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <Button
          disabled={pending || name.trim().length < 2 || !birthDate}
          onClick={() => {
            onAdd({ name: name.trim(), birth_date: birthDate })
            setName('')
            setBirthDate('')
            setOpen(false)
          }}
        >
          {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
          Salvează
        </Button>
        <Button variant="outline" onClick={() => setOpen(false)}>
          Renunță
        </Button>
      </div>
    </div>
  )
}

export function CheckoutAdultRow({
  adult,
  includeSelf,
  onToggle,
}: {
  adult: AdultValidation
  includeSelf: boolean
  onToggle: (next: boolean) => void
}) {
  const blocked = adult.eligible === false
  return (
    <label
      className={cn(
        'bg-card shadow-card flex cursor-pointer items-start gap-3 rounded-3xl p-5',
        blocked && 'cursor-not-allowed opacity-60',
      )}
    >
      <input
        type="checkbox"
        className="mt-1 size-4"
        checked={includeSelf && !blocked}
        disabled={blocked}
        onChange={(e) => onToggle(e.target.checked)}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{adult.name}</span>
          <Badge variant="outline">Adult</Badge>
          {adult.severity === 'error' && <Badge variant="destructive">Nu poate</Badge>}
          {adult.severity === 'warning' && <Badge variant="outline">Atenție</Badge>}
          {adult.eligible && !adult.severity && <Badge variant="success">Poate participa</Badge>}
        </div>
        <p className="text-muted-foreground mt-1 text-sm">Mă înscriu și eu</p>
        {adult.reason && (
          <p className="text-muted-foreground mt-1 flex items-start gap-1 text-sm">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
            {adult.reason}
          </p>
        )}
      </div>
    </label>
  )
}

export function CheckoutChildRow({
  child,
  verdict,
  checked,
  onToggle,
}: {
  child: Child
  verdict: ChildValidation | undefined
  checked: boolean
  onToggle: (next: boolean) => void
}) {
  const blocked = verdict?.eligible === false
  return (
    <label
      className={cn(
        'bg-card shadow-card flex cursor-pointer items-start gap-3 rounded-3xl p-5',
        blocked && 'cursor-not-allowed opacity-60',
      )}
    >
      <input
        type="checkbox"
        className="mt-1 size-4"
        checked={checked}
        disabled={blocked}
        onChange={(e) => onToggle(e.target.checked)}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{child.name}</span>
          <span className="text-muted-foreground text-sm">{childAge(child.birth_date)} ani</span>
          {verdict?.severity === 'error' && <Badge variant="destructive">Nu poate</Badge>}
          {verdict?.severity === 'warning' && <Badge variant="outline">Atenție</Badge>}
          {verdict && !verdict.severity && <Badge variant="success">Poate participa</Badge>}
        </div>
        {verdict?.reason && (
          <p className="text-muted-foreground mt-1 flex items-start gap-1 text-sm">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
            {verdict.reason}
          </p>
        )}
      </div>
    </label>
  )
}
