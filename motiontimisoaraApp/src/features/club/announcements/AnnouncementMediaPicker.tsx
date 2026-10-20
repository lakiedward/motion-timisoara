import { useEffect, useMemo, useRef, useState } from 'react'
import { Film, ImagePlus, X } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { alegeDinGalerie, galeriaSeDeschideNativ } from '@/lib/galerie'
import {
  MAX_FILM_MB,
  MAX_FILM_SECUNDE,
  MAX_FILME,
  MAX_POZE,
  marime,
  pregatesteFisiere,
  RETENTIE_FILM_ZILE,
  termenulFilmarii,
  type FisierPregatit,
} from '@/lib/media'

type Props = {
  files: FisierPregatit[]
  onChange: (files: FisierPregatit[]) => void
  disabled?: boolean
}

function formatDuration(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function formatDeletionDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' })
}

function usePreviewUrls(files: FisierPregatit[]): string[] {
  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f.continut)), [files])
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls])
  return urls
}

function videoMeta(f: FisierPregatit): string {
  return [f.durata ? formatDuration(f.durata) : null, marime(f.continut.size)]
    .filter(Boolean)
    .join(' · ')
}

export default function AnnouncementMediaPicker({ files, onChange, disabled = false }: Props) {
  const [preparing, setPreparing] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const urls = usePreviewUrls(files)
  const photoCount = files.filter((f) => f.fel === 'IMAGE').length
  const videoCount = files.filter((f) => f.fel === 'VIDEO').length
  const photosFull = photoCount >= MAX_POZE
  const videoFull = videoCount >= MAX_FILME
  const busy = disabled || preparing
  const deletionDate = formatDeletionDate(termenulFilmarii('VIDEO')!)

  const addFiles = async (picked: File[]) => {
    if (!picked.length) return
    setPreparing(true)
    try {
      const { pregatite, refuzate } = await pregatesteFisiere(picked, {
        poze: photoCount,
        filme: videoCount,
      })
      if (pregatite.length) onChange([...files, ...pregatite])
      for (const reason of refuzate) toast.error(reason)
    } finally {
      setPreparing(false)
    }
  }

  const openNativeGallery = async () => {
    setPreparing(true)
    try {
      const picked = await alegeDinGalerie(MAX_POZE + MAX_FILME - files.length)
      setPreparing(false)
      await addFiles(picked)
    } catch {
      setPreparing(false)
      toast.error('Nu am putut deschide galeria.')
    }
  }

  const open = () => (galeriaSeDeschideNativ() ? void openNativeGallery() : input.current?.click())

  const remove = (index: number) => onChange(files.filter((_, j) => j !== index))

  const preview = (f: FisierPregatit, i: number) =>
    f.fel === 'VIDEO' ? (
      <div className="bg-muted text-muted-foreground flex aspect-square w-full items-center justify-center">
        <Film className="size-6" aria-hidden="true" />
      </div>
    ) : (
      <img src={urls[i]} alt="" className="aspect-square w-full object-cover" />
    )

  const meta = (f: FisierPregatit) => (f.fel === 'VIDEO' ? videoMeta(f) : marime(f.continut.size))

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        className="w-full sm:w-auto"
        disabled={busy || (photosFull && videoFull)}
        onClick={open}
      >
        <ImagePlus /> Adaugă poze sau filmare
      </Button>
      <input
        ref={input}
        type="file"
        multiple
        accept="image/*,video/*"
        aria-label="Alege poze sau filmare"
        className="hidden"
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? [])
          e.target.value = ''
          void addFiles(picked)
        }}
      />
      <p className="text-muted-foreground text-xs" aria-live="polite">
        {photoCount} din {MAX_POZE} poze · {videoCount} din {MAX_FILME} filmare.{' '}
        {videoCount > 0
          ? `Filmarea se șterge pe ${deletionDate}; pozele rămân.`
          : `Filmarea: cel mult ${MAX_FILM_SECUNDE} de secunde și ${MAX_FILM_MB} MB, se șterge după ${RETENTIE_FILM_ZILE} de zile; pozele rămân.`}
      </p>
      {preparing && (
        <p role="status" className="text-muted-foreground text-xs">
          Se pregătesc fișierele…
        </p>
      )}
      {!!files.length && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {files.map((f, i) => (
            <li key={`${f.numeOriginal}-${i}`} className="min-w-0">
              <div className="relative overflow-hidden rounded-xl border">
                {preview(f, i)}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute top-0 right-0 rounded-full hover:bg-transparent dark:hover:bg-transparent"
                  aria-label={`Scoate ${f.numeOriginal}`}
                  onClick={() => remove(i)}
                >
                  <span className="bg-background/90 text-foreground flex size-7 items-center justify-center rounded-full border">
                    <X className="size-4" />
                  </span>
                </Button>
              </div>
              <p className="text-muted-foreground mt-1 truncate text-xs">{meta(f)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
