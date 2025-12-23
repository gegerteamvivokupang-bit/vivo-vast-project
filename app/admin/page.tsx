'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import { Card, CardContent } from '@/components/ui/card'
import { getAdminStats } from '@/app/actions/admin'

interface AdminStats {
    totalUsers: number
    activeUsers: number
    totalPromotor: number
    totalSator: number
    totalSpv: number
    totalStores: number
    totalTransactions: number
    totalAcc: number
    totalPending: number
}

export default function AdminDashboardPage() {
    const { user } = useAuth()
    const [stats, setStats] = useState<AdminStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        async function loadStats() {
            const res = await getAdminStats()
            if (res.success && res.data) {
                setStats(res.data)
            } else {
                setError(res.message || 'Gagal memuat data')
            }
            setLoading(false)
        }
        loadStats()
    }, [])

    return (
        <DashboardLayout requiredRole="admin">
            <div className="min-h-screen bg-background p-4 pb-24">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Administrator: {user?.name || user?.email}
                    </p>
                </div>

                {/* Error State */}
                {error && (
                    <Card className="mb-4 border-destructive">
                        <CardContent className="p-4 text-destructive">
                            {error}
                        </CardContent>
                    </Card>
                )}

                {/* Stats Cards */}
                {loading ? (
                    <div className="grid grid-cols-2 gap-3 mb-6">
                        {[1, 2, 3, 4].map(i => (
                            <Card key={i} className="animate-pulse">
                                <CardContent className="p-4 h-20 bg-muted/50" />
                            </Card>
                        ))}
                    </div>
                ) : stats && (
                    <div className="grid grid-cols-2 gap-3 mb-6">
                        <Card>
                            <CardContent className="p-4">
                                <div className="text-2xl font-bold text-primary">{stats.totalUsers}</div>
                                <div className="text-xs text-muted-foreground">Total User</div>
                                <div className="text-xs text-green-600">{stats.activeUsers} aktif</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="text-2xl font-bold text-primary">{stats.totalStores}</div>
                                <div className="text-xs text-muted-foreground">Total Toko</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="text-2xl font-bold text-primary">{stats.totalPromotor}</div>
                                <div className="text-xs text-muted-foreground">Promotor</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="text-2xl font-bold text-primary">{stats.totalTransactions}</div>
                                <div className="text-xs text-muted-foreground">Transaksi</div>
                                <div className="text-xs">
                                    <span className="text-green-600">{stats.totalAcc} ACC</span>
                                    {' / '}
                                    <span className="text-yellow-600">{stats.totalPending} Pending</span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Menu Admin */}
                <div className="mb-4">
                    <h3 className="text-sm font-semibold text-foreground mb-3">Menu Admin</h3>
                    <div className="space-y-3">
                        {/* User Management */}
                        <Link href="/admin/users" className="block">
                            <Card className="hover:bg-muted/50 transition-colors">
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-xl">
                                            <span>U</span>
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-semibold text-foreground">User Management</div>
                                            <div className="text-xs text-muted-foreground">Kelola Promotor, Sator, SPV</div>
                                        </div>
                                        <span className="text-muted-foreground">{'>'}</span>
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>

                        {/* Store Management */}
                        <Link href="/admin/stores" className="block">
                            <Card className="hover:bg-muted/50 transition-colors">
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center text-xl">
                                            <span>S</span>
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-semibold text-foreground">Store Management</div>
                                            <div className="text-xs text-muted-foreground">Kelola data toko</div>
                                        </div>
                                        <span className="text-muted-foreground">{'>'}</span>
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>

                        {/* Data Export */}
                        <Link href="/admin/export" className="block">
                            <Card className="hover:bg-muted/50 transition-colors">
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center text-xl">
                                            <span>E</span>
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-semibold text-foreground">Data Export</div>
                                            <div className="text-xs text-muted-foreground">Download data Excel</div>
                                        </div>
                                        <span className="text-muted-foreground">{'>'}</span>
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>

                        {/* Target Management */}
                        <Link href="/admin/targets" className="block">
                            <Card className="hover:bg-muted/50 transition-colors border-2 border-primary/20">
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center text-xl">
                                            🎯
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-semibold text-foreground">Target Management</div>
                                            <div className="text-xs text-muted-foreground">Set target SPV, Sator, Promotor</div>
                                        </div>
                                        <span className="text-muted-foreground">{'>'}</span>
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    </div>
                </div>

                {/* Info Card */}
                <Card className="bg-muted/30">
                    <CardContent className="p-4">
                        <h4 className="font-semibold text-sm mb-2">Catatan Admin</h4>
                        <ul className="text-xs text-muted-foreground space-y-1">
                            <li>- Admin dapat mengelola data master (Users, Stores)</li>
                            <li>- Admin dapat mengatur target untuk SPV, Sator, dan Promotor</li>
                            <li>- Admin TIDAK dapat input sales langsung</li>
                            <li>- Semua aksi admin dicatat dalam audit log</li>
                        </ul>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    )
}
