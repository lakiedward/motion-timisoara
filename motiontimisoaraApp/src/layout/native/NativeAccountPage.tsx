import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Compass, LogOut, UserRound } from 'lucide-react'

import { signOut } from '@/api/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/lib/auth-context'
import { accountGroups, informationNavigation } from './navigation-model'
import { NativeLinkGroup } from './NativeLinkGroup'

export default function NativeAccountPage() {
  const { user, loading, profileError, refresh } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function logout() {
    setBusy(true)
    setError(null)
    try {
      const result = await signOut()
      if (result.error) throw result.error
      navigate('/cont', { replace: true })
    } catch {
      setError('Nu te-am putut deconecta. Încearcă din nou.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      <h1 className="font-display text-2xl font-bold">Contul meu</h1>
      {loading ? (
        <Skeleton className="h-24 rounded-xl" role="status" aria-label="Se încarcă profilul" />
      ) : profileError ? (
        <Card>
          <CardContent className="space-y-3">
            <p role="alert">{profileError}</p>
            <Button onClick={() => void refresh()}>Reîncearcă</Button>
          </CardContent>
        </Card>
      ) : user ? (
        <>
          <Card>
            <CardContent className="flex items-center gap-3">
              <UserRound className="text-primary size-6 shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <p className="break-words font-semibold">{user.name}</p>
                <p className="text-muted-foreground break-all text-sm">{user.email}</p>
              </div>
            </CardContent>
          </Card>
          {accountGroups(user.role).map((group) => (
            <NativeLinkGroup key={group.title} {...group} />
          ))}
        </>
      ) : (
        <Card>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Intră în cont pentru copii, înscrieri și anunțuri.
            </p>
            <Button asChild className="min-h-11 w-full">
              <Link to="/login">Autentificare</Link>
            </Button>
            <Button asChild variant="outline" className="min-h-11 w-full">
              <Link to="/signup">Creează cont</Link>
            </Button>
          </CardContent>
        </Card>
      )}
      <NativeLinkGroup
        title="Descoperă"
        items={[{ to: '/exploreaza', label: 'Explorează Motion', icon: Compass }]}
      />
      <NativeLinkGroup title="Informații" items={informationNavigation} />
      {user && !loading && (
        <div className="space-y-3">
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <Button
            variant="outline"
            className="text-destructive min-h-11 w-full"
            disabled={busy}
            onClick={() => void logout()}
          >
            <LogOut aria-hidden="true" />
            {busy ? 'Se deconectează…' : 'Deconectare'}
          </Button>
        </div>
      )}
    </div>
  )
}
