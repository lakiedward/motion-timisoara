import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ImagePlus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'

import { fetchSports } from '@/api/sports'
import { clearSportDefaultPhoto, createSport, deleteSport, setSportDefaultPhoto } from '@/api/admin'
import { publicUrl } from '@/api/public'
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
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})
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

  const setPhoto = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => setSportDefaultPhoto(id, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sports'] })
      qc.invalidateQueries({ queryKey: ['courses'] })
      qc.invalidateQueries({ queryKey: ['course'] })
      toast.success('Poză standard salvată pentru acest tip de curs.')
    },
    onError: () => toast.error('Nu am putut încărca poza.'),
  })

  const clearPhoto = useMutation({
    mutationFn: ({ id, path }: { id: string; path: string | null }) => clearSportDefaultPhoto(id, path),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sports'] })
      qc.invalidateQueries({ queryKey: ['courses'] })
      qc.invalidateQueries({ queryKey: ['course'] })
      toast.success('Poză standard ștearsă.')
    },
    onError: () => toast.error('Nu am putut șterge poza.'),
  })

  return (
    <div className="max-w-2xl">
      <h1 className="font-display mb-2 text-2xl font-bold text-foreground">Sporturi</h1>
      <p className="text-muted-foreground mb-6 text-sm">
        Poza standard pe tip de curs apare pe toate cursurile acelui sport când antrenorul nu a
        încărcat o fotografie proprie.
      </p>

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
        <ul className="space-y-3">
          {sports.map((s) => {
            const thumb = publicUrl('sport-photos', s.default_photo_storage_path)
            return (
              <li key={s.id} className="bg-card flex items-center gap-3 rounded-2xl border p-3">
                <div className="bg-muted size-16 shrink-0 overflow-hidden rounded-xl">
                  {thumb ? (
                    <img src={thumb} alt="" className="size-full object-cover" />
                  ) : (
                    <div className="text-muted-foreground grid size-full place-items-center text-[10px]">
                      fără poză
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{s.name}</div>
                  <div className="text-muted-foreground text-xs">({s.code})</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <input
                      ref={(el) => {
                        fileRefs.current[s.id] = el
                      }}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        e.target.value = ''
                        if (file) setPhoto.mutate({ id: s.id, file })
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={setPhoto.isPending}
                      onClick={() => fileRefs.current[s.id]?.click()}
                    >
                      <ImagePlus className="size-4" />
                      {thumb ? 'Schimbă poza' : 'Poză standard'}
                    </Button>
                    {thumb && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={clearPhoto.isPending}
                        onClick={() => clearPhoto.mutate({ id: s.id, path: s.default_photo_storage_path })}
                      >
                        <X className="size-4" /> Scoate
                      </Button>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive shrink-0"
                  disabled={del.isPending}
                  onClick={() => {
                    if (confirm(`Ștergi sportul ${s.name}?`)) del.mutate(s.id)
                  }}
                >
                  <Trash2 />
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
