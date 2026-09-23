import { useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Plus } from 'lucide-react'
import { toast } from 'sonner'

import {
  competitionRouteGpxDownloadUrl,
  competitionOfferErrorMessage,
  createCompetitionCategory,
  createCompetitionRoute,
  deleteCompetitionCategory,
  deleteCompetitionRoute,
  listCompetitionOffers,
  updateCompetitionCategory,
  updateCompetitionRoute,
  validateCompetitionCategory,
  type CompetitionAgeCategory,
  type CompetitionOffers,
  type CompetitionRoute,
} from '@/api/competition/competition-offers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { baniToRon, formatRonOffer, ronToBani } from '@/lib/money'
import { CompetitionRouteGalleryEditor } from './CompetitionRouteGalleryEditor'

type RouteDraft = {
  id: string | null
  name: string
  description: string
  file: File | null
}

type CategoryDraft = {
  id: string | null
  name: string
  routeId: string
  ageFrom: string
  ageTo: string
  priceLei: string
}

function routeDraftFrom(route?: CompetitionRoute): RouteDraft {
  return {
    id: route?.id ?? null,
    name: route?.name ?? '',
    description: route?.description ?? '',
    file: null,
  }
}

function categoryDraftFrom(
  category: CompetitionAgeCategory | undefined,
  routes: CompetitionRoute[],
): CategoryDraft {
  return {
    id: category?.id ?? null,
    name: category?.name ?? '',
    routeId: category?.route_id ?? routes.find((route) => route.gpx_storage_path)?.id ?? '',
    ageFrom: category ? String(category.age_from) : '',
    ageTo: category ? String(category.age_to) : '',
    priceLei: category ? String(baniToRon(category.price_bani)) : '0',
  }
}

function categoryInputFrom(draft: CategoryDraft, offers: CompetitionOffers) {
  const ageFrom = /^\d+$/.test(draft.ageFrom) ? Number(draft.ageFrom) : NaN
  const ageTo = /^\d+$/.test(draft.ageTo) ? Number(draft.ageTo) : NaN
  const normalizedPrice = draft.priceLei.trim().replace(',', '.')
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalizedPrice)) {
    throw new Error('Scrie prețul în lei cu maximum două zecimale.')
  }
  const priceBani = ronToBani(Number(normalizedPrice))
  return validateCompetitionCategory(
    {
      name: draft.name,
      route_id: draft.routeId,
      age_from: ageFrom,
      age_to: ageTo,
      price_bani: priceBani,
    },
    offers,
    draft.id ?? undefined,
  )
}

export function CompetitionOffersSection({ competitionId }: { competitionId: string }) {
  const queryClient = useQueryClient()
  const offersQuery = useQuery({
    queryKey: ['competition-offers', competitionId],
    queryFn: () => listCompetitionOffers(competitionId),
  })
  const [routeDraft, setRouteDraft] = useState<RouteDraft | null>(null)
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmRouteId, setConfirmRouteId] = useState<string | null>(null)
  const [confirmCategoryId, setConfirmCategoryId] = useState<string | null>(null)

  async function invalidateOffers() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['competition-offers', competitionId] }),
      queryClient.invalidateQueries({ queryKey: ['competition-routes', competitionId] }),
      queryClient.invalidateQueries({ queryKey: ['competition-categories', competitionId] }),
      queryClient.invalidateQueries({ queryKey: ['concurs-public'] }),
    ])
  }

  async function saveRoute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!routeDraft) return
    setBusy('route-save')
    setError(null)
    try {
      if (routeDraft.id) {
        const result = await updateCompetitionRoute(
          competitionId,
          routeDraft.id,
          routeDraft,
          routeDraft.file,
        )
        if (result.cleanupFailed)
          toast.warning('Traseul a fost salvat, dar fișierul vechi nu a putut fi șters.')
        else toast.success('Traseul a fost salvat.')
      } else {
        if (!routeDraft.file) throw new Error('Fișierul GPX este obligatoriu pentru un traseu nou.')
        await createCompetitionRoute(competitionId, routeDraft, routeDraft.file)
        toast.success('Traseul a fost adăugat.')
      }
      setRouteDraft(null)
      await invalidateOffers()
    } catch (saveError) {
      setError(competitionOfferErrorMessage(saveError))
    } finally {
      setBusy(null)
    }
  }

  async function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!categoryDraft || !offersQuery.data) return
    setBusy('category-save')
    setError(null)
    try {
      const input = categoryInputFrom(categoryDraft, offersQuery.data)
      if (categoryDraft.id) {
        await updateCompetitionCategory(competitionId, categoryDraft.id, input)
        toast.success('Categoria a fost salvată.')
      } else {
        await createCompetitionCategory(competitionId, input)
        toast.success('Categoria a fost adăugată.')
      }
      setCategoryDraft(null)
      await invalidateOffers()
    } catch (saveError) {
      setError(competitionOfferErrorMessage(saveError))
    } finally {
      setBusy(null)
    }
  }

  async function removeRoute(routeId: string) {
    setBusy(`route-${routeId}`)
    setError(null)
    try {
      const result = await deleteCompetitionRoute(competitionId, routeId)
      setConfirmRouteId(null)
      if (result.cleanupFailed)
        toast.warning('Traseul a fost șters, dar unele fișiere nu au putut fi curățate.')
      else toast.success('Traseul a fost șters.')
      await invalidateOffers()
    } catch (deleteError) {
      setError(competitionOfferErrorMessage(deleteError))
    } finally {
      setBusy(null)
    }
  }

  async function removeCategory(categoryId: string) {
    setBusy(`category-${categoryId}`)
    setError(null)
    try {
      await deleteCompetitionCategory(competitionId, categoryId)
      setConfirmCategoryId(null)
      toast.success('Categoria a fost ștearsă.')
      await invalidateOffers()
    } catch (deleteError) {
      setError(competitionOfferErrorMessage(deleteError))
    } finally {
      setBusy(null)
    }
  }

  if (offersQuery.isPending) {
    return (
      <section aria-label="Trasee și categorii" className="space-y-4">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </section>
    )
  }

  if (offersQuery.isError) {
    return (
      <section aria-label="Trasee și categorii" role="alert" className="rounded-2xl border p-5">
        <p>Nu am putut încărca traseele și categoriile concursului.</p>
        <Button
          type="button"
          variant="outline"
          className="mt-3 min-h-11"
          onClick={() => void offersQuery.refetch()}
        >
          Reîncearcă
        </Button>
      </section>
    )
  }

  const { routes, categories } = offersQuery.data
  const completeRoutes = routes.filter((route) => route.gpx_storage_path)

  return (
    <section aria-labelledby="competition-offers-title" className="space-y-6">
      <div>
        <h2 id="competition-offers-title" className="font-display text-xl font-bold">
          Trasee și categorii
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Salvează concursul înainte de a adăuga trasee. Vârsta participantului se verifică la data
          înscrierii.
        </p>
      </div>

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      <div className="space-y-4 rounded-2xl border p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-lg font-semibold">Trasee</h3>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={busy !== null}
            onClick={() => {
              setRouteDraft(routeDraftFrom())
              setError(null)
            }}
          >
            <Plus aria-hidden="true" className="size-4" /> Adaugă traseu
          </Button>
        </div>
        {routes.length === 0 ? (
          <p role="status" className="text-muted-foreground text-sm">
            Nu există trasee. Adaugă primul traseu pentru a crea categorii.
          </p>
        ) : (
          <ul className="space-y-3" aria-label="Traseele concursului">
            {routes.map((route) => {
              const categoryCount = categories.filter(
                (category) => category.route_id === route.id,
              ).length
              const downloadUrl = competitionRouteGpxDownloadUrl(route.gpx_storage_path)
              return (
                <li key={route.id} className="bg-muted/40 space-y-2 rounded-xl p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{route.name}</p>
                      <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                        {route.description}
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {categoryCount} {categoryCount === 1 ? 'categorie' : 'categorii'} ·{' '}
                        {downloadUrl ? 'GPX atașat' : 'Fără GPX · traseu incomplet'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {downloadUrl && (
                        <Button asChild type="button" variant="outline" className="min-h-11">
                          <a href={downloadUrl} download>
                            <Download aria-hidden="true" className="size-4" /> GPX
                          </a>
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11"
                        disabled={busy !== null}
                        onClick={() => {
                          setRouteDraft(routeDraftFrom(route))
                          setError(null)
                        }}
                      >
                        Editează
                      </Button>
                      <Button
                        type="button"
                        variant={confirmRouteId === route.id ? 'destructive' : 'outline'}
                        className="min-h-11"
                        disabled={busy !== null || categoryCount > 0}
                        onClick={() =>
                          confirmRouteId === route.id
                            ? void removeRoute(route.id)
                            : setConfirmRouteId(route.id)
                        }
                      >
                        {confirmRouteId === route.id ? 'Confirmă ștergerea' : 'Șterge'}
                      </Button>
                    </div>
                  </div>
                  {categoryCount > 0 && (
                    <p className="text-muted-foreground text-xs">
                      Mută sau șterge categoriile înainte de a șterge traseul.
                    </p>
                  )}
                  <CompetitionRouteGalleryEditor
                    competitionId={competitionId}
                    routeId={route.id}
                    routeName={route.name}
                  />
                </li>
              )
            })}
          </ul>
        )}

        {routeDraft && (
          <form
            key={routeDraft.id ?? 'new-route'}
            onSubmit={(event) => void saveRoute(event)}
            className="space-y-4 rounded-xl border p-4"
          >
            <h4 className="font-semibold">{routeDraft.id ? 'Editează traseul' : 'Traseu nou'}</h4>
            <div className="space-y-2">
              <Label htmlFor="competition-route-name">Nume traseu</Label>
              <Input
                id="competition-route-name"
                value={routeDraft.name}
                maxLength={120}
                required
                className="h-11 lg:h-9"
                onChange={(event) => setRouteDraft({ ...routeDraft, name: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="competition-route-description">Descriere traseu</Label>
              <textarea
                id="competition-route-description"
                value={routeDraft.description}
                maxLength={4000}
                required
                rows={3}
                className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent p-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                onChange={(event) =>
                  setRouteDraft({ ...routeDraft, description: event.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="competition-route-file">
                Fișier GPX (obligatoriu pentru un traseu nou, maximum 12 MB)
              </Label>
              <Input
                id="competition-route-file"
                type="file"
                accept=".gpx,application/gpx+xml,application/xml,text/xml"
                className="h-11"
                onChange={(event) =>
                  setRouteDraft({
                    ...routeDraft,
                    file: event.target.files?.[0] ?? null,
                  })
                }
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" className="min-h-11" disabled={busy !== null}>
                Salvează traseul
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={busy !== null}
                onClick={() => setRouteDraft(null)}
              >
                Renunță
              </Button>
            </div>
          </form>
        )}
      </div>

      <div className="space-y-4 rounded-2xl border p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-lg font-semibold">Categorii de vârstă</h3>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={busy !== null || completeRoutes.length === 0}
            onClick={() => {
              setCategoryDraft(categoryDraftFrom(undefined, routes))
              setError(null)
            }}
          >
            <Plus aria-hidden="true" className="size-4" /> Adaugă categorie
          </Button>
        </div>
        <p className="text-muted-foreground text-sm">
          Capetele intervalului sunt incluse. Fiecare categorie are un traseu și un preț propriu; 0
          lei înseamnă gratuit.
        </p>
        {completeRoutes.length === 0 && (
          <p className="text-muted-foreground text-sm">
            Încarcă un GPX valid pe un traseu înainte de a adăuga categorii.
          </p>
        )}
        {categories.length === 0 ? (
          <p role="status" className="text-muted-foreground text-sm">
            Nu există categorii de vârstă.
          </p>
        ) : (
          <ul className="space-y-3" aria-label="Categoriile concursului">
            {categories.map((category) => (
              <li
                key={category.id}
                className="bg-muted/40 flex flex-wrap items-center justify-between gap-3 rounded-xl p-4"
              >
                <div>
                  <p className="font-medium">{category.name}</p>
                  <p className="text-muted-foreground text-sm">
                    {category.age_from}–{category.age_to} ani ·{' '}
                    {routes.find((route) => route.id === category.route_id)?.name ??
                      'Traseu indisponibil'}{' '}
                    · {formatRonOffer(category.price_bani)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    disabled={busy !== null}
                    onClick={() => {
                      setCategoryDraft(categoryDraftFrom(category, routes))
                      setError(null)
                    }}
                  >
                    Editează
                  </Button>
                  <Button
                    type="button"
                    variant={confirmCategoryId === category.id ? 'destructive' : 'outline'}
                    className="min-h-11"
                    disabled={busy !== null}
                    onClick={() =>
                      confirmCategoryId === category.id
                        ? void removeCategory(category.id)
                        : setConfirmCategoryId(category.id)
                    }
                  >
                    {confirmCategoryId === category.id ? 'Confirmă ștergerea' : 'Șterge'}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {categoryDraft && (
          <form
            onSubmit={(event) => void saveCategory(event)}
            className="space-y-4 rounded-xl border p-4"
          >
            <h4 className="font-semibold">
              {categoryDraft.id ? 'Editează categoria' : 'Categorie nouă'}
            </h4>
            <div className="space-y-2">
              <Label htmlFor="competition-category-name">Nume categorie</Label>
              <Input
                id="competition-category-name"
                value={categoryDraft.name}
                maxLength={120}
                required
                className="h-11 lg:h-9"
                onChange={(event) =>
                  setCategoryDraft({ ...categoryDraft, name: event.target.value })
                }
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="competition-category-min-age">Vârsta minimă</Label>
                <Input
                  id="competition-category-min-age"
                  type="number"
                  min={0}
                  max={120}
                  step={1}
                  required
                  value={categoryDraft.ageFrom}
                  className="h-11 lg:h-9"
                  onChange={(event) =>
                    setCategoryDraft({ ...categoryDraft, ageFrom: event.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="competition-category-max-age">Vârsta maximă</Label>
                <Input
                  id="competition-category-max-age"
                  type="number"
                  min={0}
                  max={120}
                  step={1}
                  required
                  value={categoryDraft.ageTo}
                  className="h-11 lg:h-9"
                  onChange={(event) =>
                    setCategoryDraft({ ...categoryDraft, ageTo: event.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="competition-category-route">Traseu</Label>
              <select
                id="competition-category-route"
                value={categoryDraft.routeId}
                required
                className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-11 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] lg:h-9"
                onChange={(event) =>
                  setCategoryDraft({ ...categoryDraft, routeId: event.target.value })
                }
              >
                {completeRoutes.map((route) => (
                  <option key={route.id} value={route.id}>
                    {route.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="competition-category-price">Taxa de înscriere (lei)</Label>
              <Input
                id="competition-category-price"
                inputMode="decimal"
                required
                value={categoryDraft.priceLei}
                className="h-11 lg:h-9"
                onChange={(event) =>
                  setCategoryDraft({ ...categoryDraft, priceLei: event.target.value })
                }
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" className="min-h-11" disabled={busy !== null}>
                Salvează categoria
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={busy !== null}
                onClick={() => setCategoryDraft(null)}
              >
                Renunță
              </Button>
            </div>
          </form>
        )}
      </div>
    </section>
  )
}
