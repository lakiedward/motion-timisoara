import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ImagePlus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'

import { fetchSports } from '@/api/sports'
import {
  clearSportDefaultPhoto,
  createSport,
  deleteSport,
  normalizeSportCode,
  setSportDefaultPhoto,
  sportErrorMessage,
  sportNameError,
  type SportPhotoResult,
} from '@/api/sports/admin-sports'
import { publicUrl } from '@/api/public'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { SportIllustration } from '@/components/sport/SportIllustration'

export default function AdminSportsPage() {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const pending = useRef(false)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const {
    data: sports = [],
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery({ queryKey: ['sports'], queryFn: fetchSports })

  const settle = () => {
    pending.current = false
  }
  const fail = (error: unknown, fallback: string) => {
    const message = sportErrorMessage(error, fallback)
    setFeedback(message)
    toast.error(message)
  }
  const refreshPhotos = () => {
    qc.invalidateQueries({ queryKey: ['sports'] })
    qc.invalidateQueries({ queryKey: ['courses'] })
    qc.invalidateQueries({ queryKey: ['course'] })
  }
  const photoSaved = (result: SportPhotoResult, message: string) => {
    refreshPhotos()
    setFeedback(result.warning)
    if (result.warning) toast.warning(result.warning)
    else toast.success(message)
  }

  const add = useMutation({
    mutationFn: (value: string) => createSport(normalizeSportCode(value), value.trim()),
    onSuccess: () => {
      setName('')
      qc.invalidateQueries({ queryKey: ['sports'] })
      toast.success('Sport adăugat.')
    },
    onError: (error) => fail(error, 'Nu am putut adăuga sportul. Încearcă din nou.'),
    onSettled: settle,
  })
  const del = useMutation({
    mutationFn: (id: string) => deleteSport(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sports'] })
      toast.success('Sport șters.')
    },
    onError: (error) =>
      fail(error, 'Nu am putut șterge sportul. Verifică conexiunea și încearcă din nou.'),
    onSettled: settle,
  })
  const setPhoto = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => setSportDefaultPhoto(id, file),
    onSuccess: (result) => photoSaved(result, 'Poză standard salvată pentru acest tip de curs.'),
    onError: (error) => {
      refreshPhotos()
      fail(error, 'Nu am putut încărca poza. Încearcă din nou.')
    },
    onSettled: settle,
  })
  const clearPhoto = useMutation({
    mutationFn: (id: string) => clearSportDefaultPhoto(id),
    onSuccess: (result) => photoSaved(result, 'Poză standard scoasă.'),
    onError: (error) => {
      refreshPhotos()
      fail(error, 'Nu am putut confirma scoaterea pozei. Reîncarcă lista înainte de a reîncerca.')
    },
    onSettled: settle,
  })
  const busy = add.isPending || del.isPending || setPhoto.isPending || clearPhoto.isPending
  const begin = () => {
    if (pending.current) return false
    pending.current = true
    setFeedback(null)
    return true
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-display mb-2 text-2xl font-bold text-foreground">Sporturi</h1>
      <p className="text-muted-foreground mb-6 text-sm">
        Poza standard pe tip de curs apare pe toate cursurile acelui sport când antrenorul nu a
        încărcat o fotografie proprie.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          const invalid = sportNameError(name)
          setNameError(invalid)
          if (!invalid && begin()) add.mutate(name)
        }}
        className="bg-card shadow-card mb-6 flex flex-col gap-3 rounded-3xl border p-5 sm:flex-row sm:items-end"
      >
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor="sport-name">Nume sport nou</Label>
          <Input
            id="sport-name"
            className="min-h-11"
            value={name}
            disabled={busy}
            aria-invalid={!!nameError}
            aria-describedby={nameError ? 'sport-name-error' : undefined}
            onChange={(event) => {
              setName(event.target.value)
              setNameError(null)
            }}
            placeholder="ex. Tenis"
          />
          {nameError && (
            <p id="sport-name-error" role="alert" className="text-destructive text-sm">
              {nameError}
            </p>
          )}
        </div>
        <Button className="min-h-11" type="submit" disabled={busy}>
          {add.isPending ? 'Se adaugă…' : 'Adaugă'}
        </Button>
      </form>
      {feedback && (
        <p role="alert" className="text-destructive mb-4 text-sm">
          {feedback}
        </p>
      )}
      {del.isPending && (
        <p role="status" className="text-muted-foreground mb-4 text-sm">
          Se șterge sportul {sports.find((sport) => sport.id === del.variables)?.name}…
        </p>
      )}
      {isLoading ? (
        <div role="status" aria-label="Se încarcă sporturile">
          <Skeleton className="h-40 rounded-3xl" />
        </div>
      ) : isError ? (
        <div role="alert" className="bg-card space-y-3 rounded-3xl border p-5">
          <p>Nu am putut încărca sporturile.</p>
          <Button
            className="min-h-11"
            variant="outline"
            disabled={isFetching}
            onClick={() => refetch()}
          >
            Reîncearcă
          </Button>
        </div>
      ) : sports.length === 0 ? (
        <p className="text-muted-foreground bg-card rounded-3xl border p-5">
          Nu există sporturi adăugate.
        </p>
      ) : (
        <ul className="space-y-3">
          {sports.map((sport) => {
            const thumb = publicUrl('sport-photos', sport.default_photo_storage_path)
            const changing = setPhoto.isPending && setPhoto.variables?.id === sport.id
            const clearing = clearPhoto.isPending && clearPhoto.variables === sport.id
            const deleting = del.isPending && del.variables === sport.id
            return (
              <li key={sport.id} className="bg-card flex items-start gap-3 rounded-2xl border p-3">
                <div className="bg-muted size-16 shrink-0 overflow-hidden rounded-xl">
                  {thumb ? (
                    <img src={thumb} alt="" className="size-full object-cover" />
                  ) : (
                    <SportIllustration code={sport.code} name={sport.name} compact />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="break-words font-medium">{sport.name}</div>
                  <div className="text-muted-foreground break-all text-xs">({sport.code})</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <input
                      ref={(element) => {
                        fileRefs.current[sport.id] = element
                      }}
                      type="file"
                      accept="image/*"
                      aria-label={`Alege poza standard pentru ${sport.name}`}
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        event.target.value = ''
                        if (file && begin()) setPhoto.mutate({ id: sport.id, file })
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="min-h-11"
                      aria-label={`${thumb ? 'Schimbă poza' : 'Poză standard'} pentru ${sport.name}`}
                      disabled={busy}
                      onClick={() => {
                        if (!pending.current) fileRefs.current[sport.id]?.click()
                      }}
                    >
                      <ImagePlus className="size-4" />
                      {changing ? 'Se salvează…' : thumb ? 'Schimbă poza' : 'Poză standard'}
                    </Button>
                    {thumb && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="min-h-11"
                        aria-label={`Scoate poza standard pentru ${sport.name}`}
                        disabled={busy}
                        onClick={() => {
                          if (begin()) clearPhoto.mutate(sport.id)
                        }}
                      >
                        <X className="size-4" /> {clearing ? 'Se scoate…' : 'Scoate'}
                      </Button>
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive min-h-11 min-w-11 shrink-0"
                  aria-label={`Șterge sportul ${sport.name}`}
                  disabled={busy}
                  onClick={() => {
                    if (!pending.current && confirm(`Ștergi sportul ${sport.name}?`) && begin())
                      del.mutate(sport.id)
                  }}
                >
                  <Trash2 />
                  {deleting && <span className="sr-only">Se șterge…</span>}
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
