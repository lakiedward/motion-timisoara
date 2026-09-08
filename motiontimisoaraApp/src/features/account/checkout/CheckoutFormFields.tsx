import { useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
