// VAST FINANCE - Unauthorized Page
// 403 error page untuk role-based access violations

'use client'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'

export default function UnauthorizedPage() {
  const router = useRouter()
  const { user, signOut } = useAuth()

  async function handleLogout() {
    await signOut()
    router.push('/login')
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6 bg-background">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-muted-foreground/30">403</h1>
        <p className="mt-4 text-xl font-semibold text-foreground">
          Akses Ditolak
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Anda tidak memiliki izin untuk mengakses halaman ini.
        </p>
        {user && (
          <p className="mt-2 text-sm text-muted-foreground">
            Role Anda:{' '}
            <span className="font-medium uppercase">{user.role}</span>
          </p>
        )}
        <div className="mt-8 flex flex-col gap-3">
          <Button variant="secondary" onClick={() => router.back()}>
            Kembali
          </Button>
          <Button variant="default" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </div>
    </div>
  )
}
