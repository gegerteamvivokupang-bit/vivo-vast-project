'use client'

import { useAuth } from '@/contexts/AuthContext'
import { usePathname, useRouter } from 'next/navigation'
import { getNavItemsForRole, NavItem } from '@/config/navigation'
import { cn } from '@/lib/utils'
import { useConfirm } from '@/components/ui/confirm'

export default function BottomNav() {
  const { user, signOut } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const { confirm } = useConfirm()

  if (!user) return null

  // Whitelist SPC Access
  const canAccessSPC = (): boolean => {
    if (!user) return false
    // Manager area semua boleh akses SPC
    if (user.role === 'manager') return true
    // SPV Gery only
    if (user.role === 'spv' && user.name?.toLowerCase().includes('gery')) return true
    // SATOR Andri only
    if (user.role === 'sator' && user.name?.toLowerCase().includes('andri')) return true
    return false
  }

  // Get nav items untuk role
  let navItems = getNavItemsForRole(user.role)

  // Inject SPC menu untuk user yang di whitelist
  if (canAccessSPC()) {
    const spcMenuItem: NavItem = {
      key: 'spc',
      label: 'SPC',
      icon: '🏪',
      path: '/dashboard/spc',
      description: 'Toko SPC Grup'
    }

    // Untuk SATOR & SPV: insert SPC sebelum menu terakhir (Report/Export)
    if (user.role === 'sator' || user.role === 'spv') {
      navItems = [
        ...navItems.slice(0, navItems.length - 1),
        spcMenuItem,
        navItems[navItems.length - 1]
      ]
    }
    // Manager sudah ada SPC di config, skip
  }

  const handleNavClick = async (item: NavItem) => {
    if (item.key === 'profile' && pathname === '/profile') {
      const confirmed = await confirm({
        title: 'Logout',
        message: 'Yakin ingin keluar dari akun?',
        confirmText: 'Logout',
        cancelText: 'Batal',
        type: 'danger'
      })
      if (confirmed) {
        signOut()
      }
      return
    }
    router.push(item.path)
  }

  const isActive = (path: string): boolean => {
    return path === pathname
  }

  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[420px] z-50 px-5 pb-3">
      {/* Floating Navigation Bar with Blur - background behind becomes blurred */}
      <nav className="bg-card/80 backdrop-blur-xl rounded-2xl shadow-lg border border-border overflow-hidden">
        <div className="flex justify-around items-center">
          {navItems.map((item) => {
            const active = isActive(item.path)

            return (
              <button
                key={item.key}
                onClick={() => handleNavClick(item)}
                className={cn(
                  "relative flex-1 py-3 flex flex-col items-center gap-1 transition-all duration-200",
                  active && "bg-primary/10"
                )}
              >
                {/* Active top line indicator */}
                {active && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-0.5 bg-primary rounded-b-full" />
                )}

                {/* Icon */}
                <div className={cn(
                  "relative flex items-center justify-center transition-transform duration-200",
                  active ? "scale-110" : "scale-100"
                )}>
                  <span className="text-xl">
                    {item.icon}
                  </span>
                </div>

                {/* Label */}
                <span className={cn(
                  "text-[10px] font-medium transition-colors duration-200",
                  active
                    ? 'text-primary font-semibold'
                    : 'text-muted-foreground'
                )}>
                  {item.label}
                </span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
