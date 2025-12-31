'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useResponsive } from '@/hooks/useResponsive';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
    LayoutDashboard,
    TrendingUp,
    TrendingDown,
    Calendar,
    Target,
    FileDown,
    Users,
    Store,
    Settings,
    LogOut,
    Menu,
    X,
} from 'lucide-react';
import { useState } from 'react';

interface SidebarItem {
    label: string;
    href: string;
    icon: React.ReactNode;
}

const managerMenuItems: SidebarItem[] = [
    { label: 'Dashboard', href: '/dashboard/area', icon: <LayoutDashboard className="w-5 h-5" /> },
    { label: 'Performance', href: '/dashboard/area/performance', icon: <TrendingUp className="w-5 h-5" /> },
    { label: 'Underperform', href: '/dashboard/area/underperform', icon: <TrendingDown className="w-5 h-5" /> },
    { label: 'Harian', href: '/dashboard/area/daily', icon: <Calendar className="w-5 h-5" /> },
    { label: 'Export', href: '/dashboard/area/export', icon: <FileDown className="w-5 h-5" /> },
];

const adminMenuItems: SidebarItem[] = [
    { label: 'Dashboard', href: '/admin', icon: <LayoutDashboard className="w-5 h-5" /> },
    { label: 'Users', href: '/admin/users', icon: <Users className="w-5 h-5" /> },
    { label: 'Stores', href: '/admin/stores', icon: <Store className="w-5 h-5" /> },
    { label: 'Targets', href: '/admin/targets', icon: <Target className="w-5 h-5" /> },
    { label: 'Export', href: '/admin/export', icon: <FileDown className="w-5 h-5" /> },
];

interface DesktopSidebarProps {
    className?: string;
}

export function DesktopSidebar({ className }: DesktopSidebarProps) {
    const { user, signOut } = useAuth();
    const pathname = usePathname();
    const { isDesktop } = useResponsive();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    if (!user) return null;

    // Determine menu items based on role
    const menuItems = user.role === 'admin' ? adminMenuItems : managerMenuItems;

    // For mobile/tablet - show hamburger menu
    if (!isDesktop) {
        return (
            <>
                {/* Mobile Header with Hamburger */}
                <div className="fixed top-0 left-0 right-0 z-40 bg-card border-b border-border px-4 py-3 flex items-center justify-between lg:hidden">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setMobileMenuOpen(true)}
                            className="p-2 rounded-lg hover:bg-muted"
                        >
                            <Menu className="w-6 h-6" />
                        </button>
                        <div>
                            <h1 className="font-bold text-foreground">VAST Finance</h1>
                            <p className="text-xs text-muted-foreground">{user.name}</p>
                        </div>
                    </div>
                </div>

                {/* Mobile Slide-out Menu */}
                {mobileMenuOpen && (
                    <div className="fixed inset-0 z-50 lg:hidden">
                        <div
                            className="absolute inset-0 bg-black/50"
                            onClick={() => setMobileMenuOpen(false)}
                        />
                        <div className="absolute left-0 top-0 bottom-0 w-72 bg-card shadow-xl animate-in slide-in-from-left">
                            <div className="p-4 border-b border-border flex items-center justify-between">
                                <div>
                                    <h2 className="font-bold text-lg text-foreground">VAST Finance</h2>
                                    <p className="text-sm text-muted-foreground">{user.role.toUpperCase()}</p>
                                </div>
                                <button
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="p-2 rounded-lg hover:bg-muted"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <nav className="p-4 space-y-1">
                                {menuItems.map((item) => (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => setMobileMenuOpen(false)}
                                        className={cn(
                                            "flex items-center gap-3 px-4 py-3 rounded-xl transition-colors",
                                            pathname === item.href
                                                ? "bg-primary text-primary-foreground"
                                                : "hover:bg-muted text-foreground"
                                        )}
                                    >
                                        {item.icon}
                                        <span className="font-medium">{item.label}</span>
                                    </Link>
                                ))}
                            </nav>

                            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border">
                                <button
                                    onClick={() => signOut()}
                                    className="flex items-center gap-3 px-4 py-3 rounded-xl w-full text-destructive hover:bg-destructive/10 transition-colors"
                                >
                                    <LogOut className="w-5 h-5" />
                                    <span className="font-medium">Logout</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </>
        );
    }

    // Desktop Sidebar
    return (
        <aside className={cn(
            "fixed left-0 top-0 bottom-0 w-64 bg-card border-r border-border flex flex-col z-40",
            className
        )}>
            {/* Logo/Brand */}
            <div className="p-6 border-b border-border">
                <h1 className="text-xl font-bold text-primary">VAST Finance</h1>
                <p className="text-sm text-muted-foreground mt-1">{user.role.toUpperCase()} Dashboard</p>
            </div>

            {/* User Info */}
            <div className="px-6 py-4 bg-muted/50">
                <p className="font-semibold text-foreground">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.email || user.phone}</p>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                {menuItems.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                            "flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
                            pathname === item.href
                                ? "bg-primary text-primary-foreground shadow-md"
                                : "hover:bg-muted text-foreground"
                        )}
                    >
                        {item.icon}
                        <span className="font-medium">{item.label}</span>
                    </Link>
                ))}
            </nav>

            {/* Logout */}
            <div className="p-4 border-t border-border">
                <button
                    onClick={() => signOut()}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl w-full text-destructive hover:bg-destructive/10 transition-colors"
                >
                    <LogOut className="w-5 h-5" />
                    <span className="font-medium">Logout</span>
                </button>
            </div>
        </aside>
    );
}

export default DesktopSidebar;
