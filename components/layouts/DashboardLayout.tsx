// VAST FINANCE - Dashboard Layout Component
// Wrapper untuk semua dashboard pages dengan auth check dan role-based access
// UPDATED: Responsive support - sidebar di desktop untuk manager/admin

'use client'

import BottomNav from '@/components/BottomNav'
import { DesktopSidebar } from '@/components/DesktopSidebar'
import { useAuth } from '@/contexts/AuthContext'
import { useResponsive } from '@/hooks/useResponsive'
import { redirect } from 'next/navigation'
import { Loading } from '@/components/ui/loading'
import { cn } from '@/lib/utils'

interface DashboardLayoutProps {
  children: React.ReactNode
  title?: string
  allowedRoles?: string[]
  requiredRole?: string | string[]
  className?: string
  showDesktopSidebar?: boolean // Enable sidebar on desktop for manager/admin
}

export default function DashboardLayout({
  children,
  title,
  allowedRoles,
  requiredRole,
  className,
  showDesktopSidebar = false,
}: DashboardLayoutProps) {
  const { user, loading } = useAuth()
  const { isDesktop } = useResponsive()

  if (loading) {
    return <Loading message="Memuat dashboard..." />
  }

  if (!user) {
    redirect('/login')
  }

  // Role-based access control - Only check if user has a valid role
  const rolesToCheck = allowedRoles || (requiredRole ? (Array.isArray(requiredRole) ? requiredRole : [requiredRole]) : [])

  // Only enforce role check if:
  // 1. We have roles to check
  // 2. User exists
  // 3. User has a valid role property
  if (rolesToCheck.length > 0 && user.role) {
    if (!rolesToCheck.includes(user.role)) {
      console.warn(`[DashboardLayout] Role mismatch - User role: ${user.role}, Allowed: ${rolesToCheck.join(', ')}`)
      redirect('/unauthorized')
    }
  }

  // Determine if sidebar should be shown (for manager/admin on desktop)
  const shouldShowSidebar = showDesktopSidebar && isDesktop && ['manager', 'admin'].includes(user.role)
  // BottomNav: Always show EXCEPT when desktop sidebar is active
  const shouldShowBottomNav = !(showDesktopSidebar && isDesktop && ['manager', 'admin'].includes(user.role))

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar for Manager/Admin */}
      {showDesktopSidebar && ['manager', 'admin'].includes(user.role) && (
        <DesktopSidebar />
      )}

      {/* Main Content */}
      <div className={cn(
        "min-h-screen",
        shouldShowSidebar ? "lg:ml-64" : "", // Add left margin on desktop when sidebar shown
        shouldShowBottomNav ? "pb-20" : "", // Bottom padding for mobile nav
        className
      )}>
        {title && (
          <header className="bg-card px-6 py-4 shadow-md border-b">
            <h1 className="text-xl font-bold text-foreground">{title}</h1>
            <p className="text-sm text-muted-foreground">{user.name}</p>
          </header>
        )}
        <main>{children}</main>
      </div>

      {/* Bottom Nav - only on mobile or for non-manager/admin */}
      {shouldShowBottomNav && <BottomNav />}
    </div>
  )
}
