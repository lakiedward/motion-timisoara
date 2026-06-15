import { useNavigate } from 'react-router-dom'

import { useAuth } from '@/lib/auth-context'
import { signOut } from '@/api/auth'
import { Button } from '@/components/ui/button'

export default function AccountPlaceholder() {
  const { user, refresh } = useAuth()
  const navigate = useNavigate()

  const onLogout = async () => {
    await signOut()
    await refresh()
    navigate('/')
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-3xl font-extrabold text-foreground">Contul meu</h1>
      <p className="text-muted-foreground mt-2">
        Bine ai venit, {user?.name}! Dashboard-ul complet vine în Faza 5.
      </p>
      <div className="bg-card shadow-card mt-6 space-y-2 rounded-3xl border p-6 text-sm">
        <div>
          <span className="text-muted-foreground">Email:</span> {user?.email}
        </div>
        <div>
          <span className="text-muted-foreground">Rol:</span> {user?.role}
        </div>
        <div>
          <span className="text-muted-foreground">Telefon:</span> {user?.phone || '—'}
        </div>
      </div>
      <Button variant="outline" className="mt-6" onClick={onLogout}>
        Deconectare
      </Button>
    </main>
  )
}
