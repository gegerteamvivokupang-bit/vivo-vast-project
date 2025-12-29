// VAST FINANCE - Navigation Configuration
// Setiap role punya menu berbeda sesuai kebutuhan bisnis

import { UserRole } from '@/types/database.types'

export interface NavItem {
    key: string
    label: string
    icon: string  // Emoji icon
    path: string
    description?: string
}

// Konfigurasi navigasi per role
// Mudah di-extend tanpa ubah component
export const NAV_CONFIG: Record<UserRole, NavItem[]> = {
    // ============================================
    // PROMOTOR - Sales person di lapangan
    // Fokus: INPUT data dan lihat PERFORMA SENDIRI
    // ============================================
    promotor: [
        {
            key: 'home',
            label: 'Home',
            icon: '🏠',
            path: '/dashboard/promotor',
            description: 'Dashboard pribadi'
        },
        {
            key: 'input',
            label: 'Input',
            icon: '➕',
            path: '/input',
            description: 'Input pengajuan baru'
        },
        {
            key: 'pending',
            label: 'Pending',
            icon: '⏳',
            path: '/pending',
            description: 'Follow-up pending'
        },
        {
            key: 'history',
            label: 'History',
            icon: '📋',
            path: '/history',
            description: 'Riwayat pengajuan'
        },
        {
            key: 'profile',
            label: 'Profile',
            icon: '👤',
            path: '/profile',
            description: 'Profil & logout'
        }
    ],

    // ============================================
    // SPV (Supervisor) - 5 Menu Utama
    // Dashboard, Harian, Tim, SPC, Export
    // ============================================
    spv: [
        {
            key: 'dashboard',
            label: 'Home',
            icon: '🏠',
            path: '/dashboard/team',
            description: 'Ringkasan Area'
        },
        {
            key: 'daily',
            label: 'Harian',
            icon: '📊',
            path: '/dashboard/team/daily',
            description: 'Progress Hari Ini'
        },
        {
            key: 'tim',
            label: 'Tim',
            icon: '👥',
            path: '/dashboard/team/performance',
            description: 'Performance & Underperform'
        },

        {
            key: 'export',
            label: 'Export',
            icon: '📤',
            path: '/dashboard/team/export',
            description: 'Laporan Data'
        }
    ],

    // ============================================
    // SATOR (Satuan Toko) - Koordinator per toko
    // Fokus: MONITOR toko, mirip SPV tapi level toko
    // Note: SPC menu akan ditambahkan secara dinamis untuk SATOR Andri
    // ============================================
    sator: [
        {
            key: 'home',
            label: 'Home',
            icon: '🏠',
            path: '/dashboard/team',
            description: 'Dashboard tim toko'
        },
        {
            key: 'daily',
            label: 'Harian',
            icon: '📅',
            path: '/dashboard/team/daily',
            description: 'Progress Hari Ini'
        },
        {
            key: 'store',
            label: 'Tim',
            icon: '👥',
            path: '/dashboard/store',
            description: 'Performance Promotor'
        },
        {
            key: 'report',
            label: 'Report',
            icon: '📋',
            path: '/report',
            description: 'Laporan toko'
        }
    ],

    // ============================================
    // MANAGER - Manager area
    // Fokus: BIG PICTURE seluruh area
    // Menu: Dashboard, Tim, SPC, Export
    // ============================================
    manager: [
        {
            key: 'dashboard',
            label: 'Dashboard',
            icon: '🏠',
            path: '/dashboard/area',
            description: 'Overview semua AREA'
        },
        {
            key: 'daily',
            label: 'Harian',
            icon: '📊',
            path: '/dashboard/area/daily',
            description: 'Progress Hari Ini'
        },
        {
            key: 'performance',
            label: 'Tim',
            icon: '👥',
            path: '/dashboard/area/performance',
            description: 'Performance & Underperform'
        },
        {
            key: 'spc',
            label: 'SPC',
            icon: '🏪',
            path: '/dashboard/spc',
            description: 'Toko SPC Grup'
        },
        {
            key: 'export',
            label: 'Export',
            icon: '📤',
            path: '/dashboard/area/export',
            description: 'Laporan lengkap'
        }
    ],

    // ============================================
    // ADMIN - System administrator
    // Fokus: KONFIGURASI dan KONTROL sistem
    // ============================================
    admin: [
        {
            key: 'home',
            label: 'Dashboard',
            icon: '📊',
            path: '/admin',
            description: 'Overview sistem'
        },
        {
            key: 'users',
            label: 'Users',
            icon: '👥',
            path: '/admin/users',
            description: 'Kelola user'
        },
        {
            key: 'export',
            label: 'Export',
            icon: '📥',
            path: '/admin/export',
            description: 'Download Data'
        },
        {
            key: 'profile',
            label: 'Profile',
            icon: '👤',
            path: '/profile',
            description: 'Profil & logout'
        }
    ]
}

// Helper: Get nav items untuk role tertentu
export function getNavItemsForRole(role: UserRole): NavItem[] {
    return NAV_CONFIG[role] || NAV_CONFIG.promotor
}

// Helper: Get home path untuk role tertentu (untuk redirect setelah login)
export function getHomePathForRole(role: UserRole): string {
    const navItems = getNavItemsForRole(role)
    const homeItem = navItems.find(item => item.key === 'home' || item.key === 'dashboard')
    return homeItem?.path || '/dashboard/promotor'
}
