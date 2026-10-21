import { useState, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { Browser } from '@capacitor/browser'
import { ExternalLink, FileText } from 'lucide-react'

import type { EnrollmentKind } from '@/api/checkout'
import {
  campRulesFileKindLabel,
  formatCampRulesFileSize,
  type CampRulesFileLink,
} from '@/lib/camp-rules'
import { isNative } from '@/lib/platform'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

export interface OfferingRules {
  text: string | null
  file: CampRulesFileLink | null
}

const RULES_OF: Record<EnrollmentKind, string> = {
  COURSE: 'regulamentul cursului',
  CAMP: 'regulamentul taberei',
  ACTIVITY: 'regulamentul activității',
}

const linkClass =
  'text-primary focus-visible:outline-ring rounded-sm font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2'

const openerClass = `${linkClass} inline-flex min-h-11 shrink-0 items-center gap-1.5 font-semibold`

function openFileNatively(event: MouseEvent<HTMLAnchorElement>, url: string) {
  if (!isNative()) return
  event.preventDefault()
  void Browser.open({ url })
}

export function CheckoutRulesConsent({
  kind,
  title,
  rules,
  checked,
  onCheckedChange,
}: {
  kind: EnrollmentKind
  title: string
  rules: OfferingRules | undefined
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const label = RULES_OF[kind]
  const file = rules?.file ?? null
  const text = rules?.text ?? null
  const present = Boolean(file || text)

  return (
    <div className="space-y-3">
      {present && (
        <div className="border-border flex items-center gap-3 rounded-xl border p-3">
          <FileText className="text-muted-foreground size-5 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold first-letter:uppercase">{label}</p>
            <p className="text-muted-foreground truncate">
              {file
                ? `${campRulesFileKindLabel(file.contentType)} · ${formatCampRulesFileSize(file.sizeBytes)}`
                : 'Text scris de organizator'}
            </p>
          </div>
          {file ? (
            <a
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Deschide ${label}: ${file.name}`}
              title={file.name}
              className={openerClass}
              onClick={(event) => openFileNatively(event, file.url)}
            >
              <ExternalLink className="size-4" aria-hidden="true" />
              Deschide
            </a>
          ) : (
            <button
              type="button"
              aria-label={`Citește ${label}`}
              className={openerClass}
              onClick={() => setOpen(true)}
            >
              Citește
            </button>
          )}
        </div>
      )}
      <label className="flex cursor-pointer items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="accent-primary focus-visible:outline-ring mt-0.5 size-4 shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2"
          checked={checked}
          onChange={(e) => onCheckedChange(e.target.checked)}
        />
        <span>
          Confirm suma finală în lei și accept {present ? `${label} și ` : ''}
          {isNative() ? (
            <Link to="/termeni" className={linkClass}>
              termenii și condițiile
            </Link>
          ) : (
            <a href="/termeni" target="_blank" rel="noopener noreferrer" className={linkClass}>
              termenii și condițiile
            </a>
          )}
          .
        </span>
      </label>
      {text && (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" className="mx-auto max-w-lg rounded-t-2xl">
            <SheetHeader>
              <SheetTitle className="first-letter:uppercase">{label}</SheetTitle>
              <SheetDescription>{title}</SheetDescription>
            </SheetHeader>
            <p className="text-muted-foreground max-h-96 overflow-y-auto px-4 pb-6 text-sm leading-relaxed whitespace-pre-wrap">
              {text}
            </p>
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}
