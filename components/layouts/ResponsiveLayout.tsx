'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useResponsive } from '@/hooks/useResponsive';
import { redirect } from 'next/navigation';
import { Loading } from '@/components/ui/loading';
import { DesktopSidebar } from '@/components/DesktopSidebar';
import BottomNav from '@/components/BottomNav';
import { cn } from '@/lib/utils';

interface ResponsiveLayoutProps {
    children: React.ReactNode;
    allowedRoles?: string[];
    showBottomNav?: boolean;
    className?: string;
}

/**
 * ResponsiveLayout - Layout yang menyesuaikan berdasarkan ukuran layar
 * - Desktop (>1024px): Sidebar di kiri, content di kanan
 * - Tablet/Mobile: Hamburger menu + Bottom Nav
 */
export function ResponsiveLayout({
    children,
    allowedRoles = ['manager', 'admin'],
    showBottomNav = true,
    className,
}: ResponsiveLayoutProps) {
    const { user, loading } = useAuth();
    const { isDesktop } = useResponsive();

    if (loading) {
        return <Loading message="Memuat..." />;
    }

    if (!user) {
        redirect('/login');
    }

    // Role-based access control
    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
        redirect('/unauthorized');
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Sidebar for desktop, Hamburger for mobile */}
            <DesktopSidebar />

            {/* Main Content Area */}
            <main
                className={cn(
                    "min-h-screen transition-all",
                    isDesktop ? "ml-64" : "pt-16", // Add left margin on desktop, top padding on mobile (for hamburger header)
                    !isDesktop && showBottomNav ? "pb-20" : "", // Bottom padding for mobile nav
                    className
                )}
            >
                {children}
            </main>

            {/* Bottom Nav only on mobile/tablet */}
            {!isDesktop && showBottomNav && <BottomNav />}
        </div>
    );
}

export default ResponsiveLayout;
