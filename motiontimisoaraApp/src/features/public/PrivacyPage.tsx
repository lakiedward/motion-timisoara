import { LegalPage } from './legal/LegalPage'
import { GDPR_SECTIONS } from './privacy/gdpr-sections'
import { LOCATION_SECTIONS } from './privacy/location-sections'

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Confidențialitate"
      intro="Ce date folosește Motion România, de ce, cine le vede, cât timp le păstrăm și ce drepturi ai, inclusiv pentru funcția „Locația antrenorului”."
      version="1.1"
      updated="26 octombrie 2026"
      sections={[...GDPR_SECTIONS, ...LOCATION_SECTIONS]}
      introSurfaceKey="manual:section:titlu:c4dd45e2-2ea9-411d-b99a-ab791e595ab7"
    />
  )
}
