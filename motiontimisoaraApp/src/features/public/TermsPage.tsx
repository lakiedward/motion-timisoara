import { LegalPage } from './legal/LegalPage'
import {
  TERMS_INTRO,
  TERMS_INTRO_SURFACE_KEY,
  TERMS_SECTIONS,
  TERMS_UPDATED,
  TERMS_VERSION,
} from './terms/terms-sections'

export default function TermsPage() {
  return (
    <LegalPage
      title="Termeni și condiții"
      intro={TERMS_INTRO}
      version={TERMS_VERSION}
      updated={TERMS_UPDATED}
      sections={TERMS_SECTIONS}
      introSurfaceKey={TERMS_INTRO_SURFACE_KEY}
    />
  )
}
