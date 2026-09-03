import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import QRCode from 'qrcode'
import { ArrowLeft, Download, Printer, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

import { getChild, regenereazaCodulCopilului, type Child } from '@/api/account'
import { useAuth } from '@/lib/auth-context'
import { codQr } from '@/lib/cod-qr'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Codul QR al unui copil — identitatea lui scanabilă (#318).
 *
 * Același ecran pentru toți cei care au voie să vadă copilul: părintele îl
 * deschide din „Copiii mei", antrenorul și clubul din lista de înscriși, ca
 * rezervă când părintele n-are telefonul la el. Cine are voie decide RLS-ul
 * lui `children`, nu pagina: un id străin ajunge la „copilul nu a fost găsit".
 *
 * Codul se desenează AICI, din token, nu vine de la server: după prima
 * încărcare rămâne în cache-ul interogării, deci se arată și fără rețea, la
 * intrarea în bazin.
 */
export default function ChildQrPage({ inapoi }: { inapoi: string }) {
  const { id } = useParams()
  const childId = id as string
  const { user } = useAuth()
  const qc = useQueryClient()
  const poateRegenera = user?.role === 'PARENT' || user?.role === 'ADMIN'

  const {
    data: copil,
    isPending,
    isError,
    refetch,
  } = useQuery({ queryKey: ['child', childId], queryFn: () => getChild(childId) })

  const regenerare = useMutation({
    mutationFn: () => regenereazaCodulCopilului(childId),
    onSuccess: (token) => {
      qc.setQueryData<Child | null>(['child', childId], (vechi) => (vechi ? { ...vechi, qr_token: token } : vechi))
      qc.invalidateQueries({ queryKey: ['children'] })
      toast.success('Cod nou generat. Cel vechi nu mai e recunoscut.')
    },
    onError: () => toast.error('Nu am putut genera un cod nou.'),
  })

  if (isError) {
    return (
      <Cadru inapoi={inapoi}>
        <div role="alert" className="mt-6 rounded-3xl border border-dashed py-16 text-center">
          <p className="text-foreground font-medium">Nu am putut încărca copilul.</p>
          <Button className="mt-4 h-11 min-h-11" type="button" onClick={() => refetch()}>
            Reîncearcă
          </Button>
        </div>
      </Cadru>
    )
  }

  if (isPending) {
    return (
      <Cadru inapoi={inapoi}>
        <Skeleton className="mt-6 h-8 w-48 rounded-lg" />
        <Skeleton className="mx-auto mt-6 size-64 rounded-3xl" />
      </Cadru>
    )
  }

  if (!copil) {
    return (
      <Cadru inapoi={inapoi}>
        <p className="text-muted-foreground mt-6">Copilul nu a fost găsit.</p>
      </Cadru>
    )
  }

  return (
    <Cadru inapoi={inapoi}>
      <h1 className="font-display mt-4 text-2xl font-bold">Codul QR al lui {copil.name}</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Arată-l antrenorului la intrare: îl scanează și pontează prezența. Ține ecranul luminos și
        codul întreg în cadru.
      </p>

      <ImagineQr token={copil.qr_token} nume={copil.name} />

      {poateRegenera && (
        <div className="mt-8 rounded-2xl border border-dashed p-4">
          <p className="text-sm">
            Ai pierdut o poză printată sau crezi că a văzut-o cineva străin? Generează un cod nou:
            cel vechi nu va mai fi recunoscut de nimeni.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-3 h-11 min-h-11"
            disabled={regenerare.isPending}
            onClick={() => {
              if (confirm(`Generezi un cod nou pentru ${copil.name}? Codul de acum nu va mai fi recunoscut.`))
                regenerare.mutate()
            }}
          >
            <RefreshCw className="size-4" /> Generează un cod nou
          </Button>
        </div>
      )}
    </Cadru>
  )
}

function ImagineQr({ token, nume }: { token: string; nume: string }) {
  // Rezultatul poartă tokenul din care a fost desenat: la un token nou, cel
  // vechi devine automat „încă nedesenat", fără un setState în efect.
  const [desenat, setDesenat] = useState<{ token: string; imagine: string | null; aEsuat: boolean } | null>(
    null,
  )
  const imagine = desenat?.token === token ? desenat.imagine : null
  const aEsuat = desenat?.token === token && desenat.aEsuat

  useEffect(() => {
    let anulat = false
    // Nivelul M de corecție: un cod încă lizibil cu o zgârietură pe folie sau un
    // reflex pe ecran, fără să devină prea des pentru camera de telefon.
    QRCode.toDataURL(codQr(token), { errorCorrectionLevel: 'M', margin: 2, width: 640 })
      .then((url) => {
        if (!anulat) setDesenat({ token, imagine: url, aEsuat: false })
      })
      .catch(() => {
        if (!anulat) setDesenat({ token, imagine: null, aEsuat: true })
      })
    return () => {
      anulat = true
    }
  }, [token])

  const fisier = `cod-qr-${nume
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')}.png`

  const printeaza = () => {
    if (!imagine) return
    // O fereastră doar cu codul și numele: pagina de cont are meniu, antet și
    // fundal colorat, care pe hârtie ar mânca cerneală și ar micșora codul.
    const f = window.open('', '_blank', 'width=600,height=700')
    if (!f) {
      toast.error('Browserul a blocat fereastra de printare.')
      return
    }
    // Construit din noduri, nu din șir: numele copilului e text scris de un
    // părinte și ajunge pe ecranul antrenorului, deci nu se interpretează ca HTML.
    const d = f.document
    d.title = `Cod QR — ${nume}`
    d.body.style.cssText =
      'margin:0;display:grid;place-items:center;min-height:100vh;font-family:sans-serif;text-align:center'
    const cutie = d.createElement('div')
    const img = d.createElement('img')
    img.src = imagine
    img.alt = ''
    img.style.cssText = 'width:80vmin;max-width:600px'
    const titlu = d.createElement('p')
    titlu.textContent = nume
    titlu.style.cssText = 'font-size:24px;margin:8px 0 0'
    const nota = d.createElement('p')
    nota.textContent = 'Motion Timișoara · arată codul antrenorului la intrare'
    nota.style.cssText = 'font-size:14px;margin:4px 0 0'
    cutie.append(img, titlu, nota)
    d.body.append(cutie)
    f.focus()
    f.print()
  }

  if (aEsuat) {
    return (
      <p role="alert" className="text-destructive mt-6 text-sm">
        Nu am putut desena codul. Reîncarcă pagina.
      </p>
    )
  }

  return (
    <div className="mt-6">
      {/* Fundal alb dinadins, indiferent de temă: un cod QR pe fundal închis se
          scanează prost, iar contrastul lui e cerința, nu estetica. */}
      <div className="bg-white mx-auto w-fit rounded-3xl p-4 shadow-sm">
        {imagine ? (
          <img src={imagine} alt={`Codul QR al lui ${nume}`} className="size-64 sm:size-80" />
        ) : (
          <Skeleton className="size-64 rounded-2xl sm:size-80" />
        )}
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Button asChild variant="outline" className="h-11 min-h-11" aria-disabled={!imagine}>
          <a href={imagine ?? undefined} download={fisier}>
            <Download className="size-4" /> Salvează imaginea
          </a>
        </Button>
        <Button type="button" variant="outline" className="h-11 min-h-11" disabled={!imagine} onClick={printeaza}>
          <Printer className="size-4" /> Printează
        </Button>
      </div>
    </div>
  )
}

function Cadru({ inapoi, children }: { inapoi: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl">
      <Link
        to={inapoi}
        className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Înapoi
      </Link>
      {children}
    </div>
  )
}
