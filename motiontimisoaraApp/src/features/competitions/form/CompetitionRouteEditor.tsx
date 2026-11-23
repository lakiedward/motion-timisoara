import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  competitionRouteGpxDownloadUrl,
  competitionRouteGpxUrl,
} from '@/api/competition/competition-offers'
import { Button } from '@/components/ui/button'
import { FilePicker } from '@/components/ui/file-picker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CompetitionRouteMap } from '../CompetitionRouteMap'

export type RouteDraft = {
  id: string | null
  name: string
  description: string
  gpxPath: string | null
  detachGpx: boolean
  file: File | null
}

export function CompetitionRouteEditor({
  draft,
  busy,
  error,
  onChange,
  onSave,
  onCancel,
}: {
  draft: RouteDraft
  busy: boolean
  error: string | null
  onChange: (draft: RouteDraft) => void
  onSave: (event: FormEvent<HTMLFormElement>) => void
  onCancel: () => void
}) {
  const [preview, setPreview] = useState(false)
  const errorRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    if (error) errorRef.current?.focus()
  }, [error])

  return (
    <form onSubmit={onSave} className="space-y-4 rounded-xl border p-4">
      <h4 className="font-semibold">
        {draft.id ? 'Editează traseul sau proba' : 'Traseu sau probă nouă'}
      </h4>
      <div className="space-y-2">
        <Label htmlFor="competition-route-name">Nume traseu sau probă</Label>
        <Input
          id="competition-route-name"
          value={draft.name}
          maxLength={120}
          required
          disabled={busy}
          className="h-touch-target lg:h-9"
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="competition-route-description">Descriere</Label>
        <Textarea
          id="competition-route-description"
          value={draft.description}
          maxLength={4000}
          required
          disabled={busy}
          rows={3}
          onChange={(event) => onChange({ ...draft, description: event.target.value })}
        />
      </div>
      {draft.gpxPath && !draft.file && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {!draft.detachGpx && (
              <Button
                type="button"
                variant="outline"
                aria-expanded={preview}
                disabled={busy}
                onClick={() => setPreview(!preview)}
              >
                {preview ? 'Ascunde previzualizarea' : 'Previzualizează GPX-ul atașat'}
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setPreview(false)
                onChange({ ...draft, detachGpx: !draft.detachGpx })
              }}
            >
              {draft.detachGpx ? 'Păstrează GPX-ul' : 'Elimină GPX-ul atașat'}
            </Button>
          </div>
          {draft.detachGpx && (
            <p role="status" className="text-muted-foreground text-sm">
              GPX-ul va fi eliminat la salvare. Traseul și categoriile se păstrează.
            </p>
          )}
          {preview && (
            <CompetitionRouteMap
              routeLabel={draft.name}
              gpxUrl={competitionRouteGpxUrl(draft.gpxPath)}
              downloadUrl={competitionRouteGpxDownloadUrl(draft.gpxPath)}
            />
          )}
        </div>
      )}
      <FilePicker
        id="competition-route-file"
        label="Fișier GPX (opțional)"
        hint="Folosește un GPX pentru trasee în aer liber. Maximum 12 MB."
        accept=".gpx,application/gpx+xml,application/xml,text/xml"
        file={draft.file}
        chooseLabel={draft.gpxPath && !draft.detachGpx ? 'Înlocuiește GPX-ul' : 'Alege fișierul GPX'}
        disabled={busy}
        onFileChange={(file) => {
          setPreview(false)
          onChange({ ...draft, file, detachGpx: file ? false : draft.detachGpx })
        }}
      />
      {error && (
        <p ref={errorRef} role="alert" tabIndex={-1} className="text-destructive text-sm">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="min-h-touch-target" disabled={busy}>
          Salvează
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-touch-target"
          disabled={busy}
          onClick={onCancel}
        >
          Renunță
        </Button>
      </div>
    </form>
  )
}
