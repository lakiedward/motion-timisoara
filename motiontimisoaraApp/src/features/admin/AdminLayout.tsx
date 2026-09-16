import { PortalLayout } from '@/layout/PortalLayout'
import { adminNavigation } from '@/layout/navigation'

export default function AdminLayout() {
  return <PortalLayout nav={adminNavigation} roleLabel="Administrare" />
}
