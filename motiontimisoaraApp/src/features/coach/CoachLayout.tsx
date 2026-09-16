import { PortalLayout } from '@/layout/PortalLayout'
import { coachNavigation } from '@/layout/navigation'

export default function CoachLayout() {
  return <PortalLayout nav={coachNavigation} roleLabel="Antrenor" profileTo="/coach/profile" />
}
