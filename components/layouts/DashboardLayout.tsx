// VAST FINANCE - Dashboard Layout Component
// Wrapper untuk semua dashboard pages dengan auth check dan role-based access

'use client'

import BottomNav from '@/components/BottomNav'
import { useAuth } from '@/contexts/AuthContext'
import { redirect } from 'next/navigation'
import { Loading } from '@/components/ui/loading'
import { cn } from '@/lib/utils'

interface DashboardLayoutProps {
  children: React.ReactNode
  title?: string
  allowedRoles?: string[]
  requiredRole?: string | string[]
  className?: string
}

export default function DashboardLayout({
  children,
  title,
  allowedRoles,
  requiredRole,
  className,
}: DashboardLayoutProps) {
  const { user, loading } = useAuth()

  if (loading) {
    return <Loading message="Memuat dashboard..." />
  }

  if (!user) {
    redirect('/login')
  }

  // Role-based access control
  const rolesToCheck = allowedRoles || (requiredRole ? (Array.isArray(requiredRole) ? requiredRole : [requiredRole]) : [])
  if (rolesToCheck.length > 0 && !rolesToCheck.includes(user.role)) {
    redirect('/unauthorized')
  }

  return (
    <div className={cn("min-h-screen pb-20 bg-background", className)}>
      {title && (
        <header className="bg-card px-6 py-4 shadow-md border-b">
          <h1 className="text-xl font-bold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">{user.name}</p>
        </header>
      )}
      <main>{children}</main>
      <BottomNav />
    </div>
  )
}
