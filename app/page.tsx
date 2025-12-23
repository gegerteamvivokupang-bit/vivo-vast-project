// VAST FINANCE - Home Page
// Auto-redirect ke login atau role-based dashboard
// Sesuai docs/AUTH_LOGIN_FLOW.md Step 4

'use client'

import { useAuth } from '@/contexts/AuthContext'
import { redirect } from 'next/navigation'
import { Loading } from '@/components/ui/loading'
import { getHomePathForRole } from '@/config/navigation'

export default function HomePage() {
  const { user, loading } = useAuth()

  if (loading) {
    return <Loading />
  }

  if (!user) {
    redirect('/login')
  }

  // AUTH_LOGIN_FLOW.md Step 4: Role-based redirect (dari config)
  redirect(getHomePathForRole(user.role))
}
