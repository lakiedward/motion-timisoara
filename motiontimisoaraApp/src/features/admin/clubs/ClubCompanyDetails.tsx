import { BadgeCheck, CircleAlert, Phone } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import type { AdminClub } from '@/api/admin'

type Company = Pick<
  AdminClub,
  'phone' | 'company_cui' | 'company_name' | 'company_address' | 'company_reg_number'
>

function present(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function ClubCompanyDetails({ club }: { club: Company }) {
  const cui = present(club.company_cui)
  const name = present(club.company_name)
  const address = present(club.company_address)
  const regNumber = present(club.company_reg_number)
  const phone = present(club.phone)

  return (
    <span className="mt-2 flex flex-col items-start gap-1 text-sm">
      {cui && name ? (
        <>
          <Badge variant="success">
            <BadgeCheck aria-hidden="true" /> Verificat la ANAF
          </Badge>
          <span className="text-foreground font-medium break-words">{name}</span>
          <span className="text-muted-foreground break-words">
            CUI {cui}
            {regNumber && ` · ${regNumber}`}
          </span>
          {address && <span className="text-muted-foreground break-words">{address}</span>}
        </>
      ) : cui ? (
        <>
          <Badge variant="highlight">
            <CircleAlert aria-hidden="true" /> Neverificat la ANAF
          </Badge>
          <span className="text-muted-foreground break-words">
            CUI {cui}. ANAF nu a răspuns la înscriere: verifică firma înainte să aprobi.
          </span>
        </>
      ) : (
        <span className="text-muted-foreground">Fără CUI: club înscris înainte de verificare.</span>
      )}
      {phone && (
        <a
          href={`tel:${phone}`}
          className="text-primary min-h-touch-target inline-flex items-center gap-1.5 font-medium lg:min-h-0"
        >
          <Phone aria-hidden="true" className="size-4" /> {phone}
        </a>
      )}
    </span>
  )
}
