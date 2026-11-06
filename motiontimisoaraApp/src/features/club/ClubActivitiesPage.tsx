import { useLocation } from 'react-router-dom'

import { ClubActivityForm } from './activity-form/ClubActivityForm'
import { ClubActivityList } from './activities/ClubActivityList'

export default function ClubActivitiesPage() {
  const { pathname } = useLocation()
  if (pathname.endsWith('/new') || pathname.endsWith('/edit')) return <ClubActivityForm />
  return <ClubActivityList />
}
