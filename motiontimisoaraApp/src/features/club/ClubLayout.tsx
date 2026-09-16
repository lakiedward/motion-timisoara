import { PortalLayout } from '@/layout/PortalLayout'
import { clubNavigation } from '@/layout/navigation'

export default function ClubLayout() {
  return <PortalLayout nav={clubNavigation} roleLabel="Club" profileTo="/club/profile" />
}
