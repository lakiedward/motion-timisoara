import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { fetchSports } from '@/api/sports'
import { createSport, deleteSport } from '@/api/admin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'

function toCode(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

export default function AdminSportsPage() {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const { data: sports = [], isLoading } = useQuery({ queryKey: ['sports'], queryFn: fetchSports })

  const add = useMutation({
    mutationFn: () => createSport(toCode(name), name.trim()),
    onSuccess: () => {
      setName('')
      qc.invalidateQueries({ queryKey: ['sports'] })
      toast.success('Sport adăugat.')
    },
    onError: () => toast.error('Nu am putut adăuga sportul (poate există deja).'),
  })

  const del = useMutation({
    mutationFn: (id: string) => deleteSport(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sports'] })
      toast.success('Sport șters.')
    },
    onError: () => toast.error('Nu se poate șterge (folosit de cursuri/antrenori).'),
  })

  return (
    <div className="max-w-2xl">
      <h1 className="font-display mb-6 text-2xl font-bold text-foreground">Sporturi</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim().length >= 2) add.mutate()
        }}
        className="bg-card shadow-card mb-6 flex items-end gap-3 rounded-3xl border p-5"
      >
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="sport-name">Nume sport nou</Label>
          <Input id="sport-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. Tenis" />
        </div>
        <Button type="submit" disabled={add.isPending || name.trim().length < 2}>
          Adaugă
        </Button>
      </form>

      {isLoading ? (
        <Skeleton className="h-40 rounded-3xl" />
      ) : (
        <ul className="space-y-2">
          {sports.map((s) => (
            <li key={s.id} className="bg-card flex items-center justify-between rounded-2xl border p-3">
              <span>
                <span className="font-medium">{s.name}</span>{' '}
                <span className="text-muted-foreground text-xs">({s.code})</span>
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                disabled={del.isPending}
                onClick={() => {
                  if (confirm(`Ștergi sportul ${s.name}?`)) del.mutate(s.id)
                }}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
