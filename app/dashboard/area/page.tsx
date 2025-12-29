'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { ProfileSidebar } from '@/components/ProfileSidebar';
import { Loading } from '@/components/ui/loading';
import { Alert } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { ChevronRight, Bell, User } from 'lucide-react';

interface AreaSummary {
    name: string;
    spv_name: string;
    user_id: string;
    total_input: number;
    total_pending: number;
    total_rejected: number;
    total_closed: number;
    target: number;
}

interface DailyData {
    total_input: number;
    total_pending: number;
    total_rejected: number;
    total_closed: number;
    promotor_active: number;
    promotor_empty: number;
    date_formatted: string;
}

export default function ManagerDashboardPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [areas, setAreas] = useState<AreaSummary[]>([]);
    const [dailyData, setDailyData] = useState<DailyData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Time Gone
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const currentDay = now.getDate();
    const timeGonePercent = Math.round((currentDay / daysInMonth) * 100);
    const todayFormatted = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' });

    useEffect(() => {
        if (user) fetchData();
    }, [user]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const supabase = createClient();
            const [monthlyRes, dailyRes] = await Promise.all([
                supabase.functions.invoke('dashboard-manager'),
                supabase.functions.invoke('dashboard-manager-daily')
            ]);

            if (monthlyRes.error) throw monthlyRes.error;
            setAreas(monthlyRes.data?.areas || []);

            if (dailyRes.data) {
                setDailyData({
                    total_input: dailyRes.data.totals?.total_input || 0,
                    total_pending: dailyRes.data.totals?.total_pending || 0,
                    total_rejected: dailyRes.data.totals?.total_rejected || 0,
                    total_closed: dailyRes.data.totals?.total_closed || 0,
                    promotor_active: dailyRes.data.promotor_stats?.active || 0,
                    promotor_empty: dailyRes.data.promotor_stats?.empty || 0,
                    date_formatted: dailyRes.data.date_formatted || '',
                });
            }
        } catch (err) {
            console.error(err);
            setError('Gagal memuat data');
        } finally {
            setLoading(false);
        }
    };

    const totals = areas.reduce((acc, a) => ({
        total_input: acc.total_input + a.total_input,
        total_pending: acc.total_pending + a.total_pending,
        total_rejected: acc.total_rejected + a.total_rejected,
        total_closed: acc.total_closed + a.total_closed,
        target: acc.target + a.target,
    }), { total_input: 0, total_pending: 0, total_rejected: 0, total_closed: 0, target: 0 });

    const totalPercent = totals.target > 0 ? Math.round((totals.total_input / totals.target) * 100) : 0;

    const isUnderperform = (m: AreaSummary): boolean => {
        const t = m.target || 0;
        const i = m.total_input || 0;
        if (t === 0) return true;
        return (i / t) * 100 < timeGonePercent;
    };

    const getStatusColor = (pct: number) => {
        if (pct >= 80) return 'text-emerald-500';
        if (pct >= 60) return 'text-amber-500';
        return 'text-red-500';
    };

    const getStatusBg = (pct: number) => {
        if (pct >= 80) return 'bg-emerald-500';
        if (pct >= 60) return 'bg-amber-500';
        return 'bg-red-500';
    };

    // Get user initials
    const getInitials = (name: string) => name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'U';

    if (loading) return <DashboardLayout><Loading message="Memuat dashboard..." /></DashboardLayout>;
    if (error) return <DashboardLayout><Alert type="error" message={error} /></DashboardLayout>;

    return (
        <DashboardLayout allowedRoles={['manager']}>
            <div className="min-h-screen bg-background pb-24">
                {/* Unified Header Banner */}
                <div className="relative w-full bg-primary pb-8 pt-4 px-5 rounded-b-[2rem] shadow-lg overflow-hidden">
                    {/* Abstract Decoration */}
                    <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 bg-blue-400 opacity-10 rounded-full blur-2xl pointer-events-none" />

                    {/* Top Bar */}
                    <div className="relative z-10 flex items-center justify-between mb-6">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="flex items-center gap-3"
                        >
                            <div className="h-12 w-12 rounded-full bg-white/20 border-2 border-white/20 shadow-md flex items-center justify-center text-white font-bold">
                                {user?.name ? getInitials(user.name) : <User className="w-6 h-6" />}
                            </div>
                            <div className="flex flex-col text-left">
                                <span className="text-blue-100 text-xs font-medium uppercase tracking-wider">Area Manager</span>
                                <span className="text-white text-lg font-bold leading-tight">{user?.name || 'Manager'}</span>
                            </div>
                        </button>
                    </div>

                    {/* Date & Time Status Row */}
                    <div className="relative z-10 flex flex-col gap-3">
                        <div className="flex justify-between items-end text-white">
                            <div>
                                <div className="text-blue-200 text-xs font-semibold mb-1">HARI INI</div>
                                <div className="text-2xl font-bold tracking-tight">{todayFormatted}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-blue-200 text-xs font-semibold mb-1">TIME GONE</div>
                                <div className="text-xl font-bold">{timeGonePercent}%</div>
                            </div>
                        </div>
                        {/* Time Progress Bar */}
                        <div className="w-full h-2 bg-black/20 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-blue-300 to-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                                style={{ width: `${timeGonePercent}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Main Content Container */}
                <div className="flex-1 px-5 -mt-6 relative z-20 flex flex-col gap-5">


                    {/* Progress Hari Ini (Donut) - Paling Atas sesuai request */}
                    <button
                        onClick={() => router.push('/dashboard/area/daily')}
                        className="bg-card rounded-2xl shadow-xl p-5 border border-border text-left hover:border-primary/30 transition-all"
                    >
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-foreground text-lg font-bold flex items-center gap-2">
                                📊 Progress Hari Ini
                            </h3>
                            <ChevronRight className="w-5 h-5 text-muted-foreground" />
                        </div>

                        {dailyData && (
                            <div className="flex flex-col items-center">
                                {/* Donut Chart */}
                                <div className="relative w-48 h-48 mb-6">
                                    <div className="absolute inset-0 rounded-full border-[16px] border-muted" />
                                    <div
                                        className="absolute inset-0 rounded-full"
                                        style={{
                                            background: `conic-gradient(hsl(var(--primary)) 0% ${totalPercent}%, transparent ${totalPercent}% 100%)`,
                                            mask: 'radial-gradient(farthest-side, transparent calc(100% - 16px), #fff calc(100% - 16px))',
                                            WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 16px), #fff calc(100% - 16px))',
                                        }}
                                    />
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Total Input</span>
                                        <span className="text-foreground text-3xl font-extrabold tracking-tight mt-1">{dailyData.total_input}</span>
                                        <span className="text-primary text-sm font-bold mt-1 bg-primary/10 px-2 py-0.5 rounded">{totalPercent}% TGT</span>
                                    </div>
                                </div>

                                {/* Metrics Breakdown Pills */}
                                <div className="grid grid-cols-3 gap-3 w-full">
                                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                                        <span className="text-emerald-500 text-xs font-bold mb-1 uppercase">Closing</span>
                                        <span className="text-foreground font-bold text-lg">{dailyData.total_closed}</span>
                                    </div>
                                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                                        <span className="text-amber-500 text-xs font-bold mb-1 uppercase">Pending</span>
                                        <span className="text-foreground font-bold text-lg">{dailyData.total_pending}</span>
                                    </div>
                                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                                        <span className="text-red-500 text-xs font-bold mb-1 uppercase">Reject</span>
                                        <span className="text-foreground font-bold text-lg">{dailyData.total_rejected}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </button>

                    {/* Target Bulanan Card - Sesuai request di posisi kedua */}
                    <div className="bg-card border border-border rounded-2xl p-5 shadow-xl">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-xl">🎯</span>
                            <h3 className="font-bold text-foreground">TARGET BULAN INI</h3>
                        </div>

                        <div className="flex justify-between items-end mb-3">
                            <div>
                                <span className="text-4xl font-bold text-primary">{totals.total_input}</span>
                                <span className="text-muted-foreground text-lg"> / {totals.target}</span>
                            </div>
                            <div className={cn(
                                "text-2xl font-bold",
                                totalPercent >= 100 ? 'text-emerald-500' :
                                    totalPercent >= timeGonePercent ? 'text-amber-500' : 'text-red-500'
                            )}>
                                {totalPercent}%
                            </div>
                        </div>

                        <div className="w-full bg-muted rounded-full h-3 overflow-hidden mb-4">
                            <div
                                className={cn(
                                    "h-full rounded-full transition-all duration-500",
                                    totalPercent >= 100 ? 'bg-emerald-500' :
                                        totalPercent >= timeGonePercent ? 'bg-amber-500' : 'bg-red-500'
                                )}
                                style={{ width: `${Math.min(totalPercent, 100)}%` }}
                            />
                        </div>

                        {/* Stats Grid 4 Kolom ala SPV */}
                        <div className="grid grid-cols-4 gap-2">
                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2 text-center">
                                <div className="text-emerald-600 text-lg font-bold">{totals.total_closed}</div>
                                <div className="text-[10px] text-emerald-600 font-medium">CLOSING</div>
                            </div>
                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2 text-center">
                                <div className="text-amber-600 text-lg font-bold">{totals.total_pending}</div>
                                <div className="text-[10px] text-amber-600 font-medium">PENDING</div>
                            </div>
                            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-2 text-center">
                                <div className="text-red-600 text-lg font-bold">{totals.total_rejected}</div>
                                <div className="text-[10px] text-red-600 font-medium">REJECT</div>
                            </div>
                            <div className="bg-primary/10 border border-primary/20 rounded-xl p-2 text-center">
                                <div className="text-primary text-lg font-bold">{totals.total_closed}</div>
                                <div className="text-[10px] text-primary font-medium">ACC</div>
                            </div>
                        </div>
                    </div>

                    {/* Area Performance List - Posisi Ketiga */}
                    <div>
                        <div className="flex items-center justify-between mb-3 px-1">
                            <h3 className="text-foreground text-lg font-bold uppercase tracking-tight">Performa Per Area</h3>
                            <button
                                onClick={() => router.push('/dashboard/area/performance')}
                                className="text-primary text-xs font-bold hover:underline"
                            >
                                DETAIL TIM →
                            </button>
                        </div>

                        {areas.length === 0 ? (
                            <div className="text-center text-muted-foreground py-10 bg-card rounded-2xl border border-border dashed">
                                Belum ada data area
                            </div>
                        ) : (
                            <div className="bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
                                <div className="divide-y divide-border">
                                    {areas.map((area, idx) => {
                                        const pct = area.target > 0 ? Math.round((area.total_input / area.target) * 100) : 0;
                                        const gap = Math.max(0, area.target - area.total_input);

                                        return (
                                            <div
                                                key={idx}
                                                className="px-5 py-4 group hover:bg-muted/30 transition-all cursor-pointer"
                                                onClick={() => router.push('/dashboard/area/performance')}
                                            >
                                                {/* Row 1: Area Name & Pencapaian */}
                                                <div className="flex justify-between items-start mb-3">
                                                    <div>
                                                        <h4 className="text-lg font-bold text-foreground leading-tight">{area.name}</h4>
                                                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{area.spv_name}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className={cn(
                                                            "text-2xl font-bold",
                                                            pct >= 100 ? 'text-emerald-500' :
                                                                pct >= timeGonePercent ? 'text-amber-500' : 'text-red-500'
                                                        )}>
                                                            {pct}%
                                                        </div>
                                                        <p className="text-[10px] text-muted-foreground font-semibold uppercase">Pencapaian</p>
                                                    </div>
                                                </div>

                                                {/* Row 2: Stats */}
                                                <div className="flex justify-between items-center text-xs mb-2">
                                                    <div className="flex gap-4">
                                                        <span className="text-muted-foreground">
                                                            Input: <span className="font-bold text-primary">{area.total_input}</span>
                                                        </span>
                                                        <span className="text-muted-foreground">
                                                            Target: <span className="font-bold text-foreground">{area.target}</span>
                                                        </span>
                                                    </div>
                                                    {gap > 0 ? (
                                                        <span className="text-red-500 font-bold">Gap: -{gap}</span>
                                                    ) : (
                                                        <span className="text-emerald-500 font-bold">✓ DONE</span>
                                                    )}
                                                </div>

                                                {/* Row 3: Progress Bar */}
                                                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                                                    <div
                                                        className={cn(
                                                            "h-full rounded-full transition-all duration-500",
                                                            pct >= 100 ? 'bg-emerald-500' :
                                                                pct >= timeGonePercent ? 'bg-amber-500' : 'bg-red-500'
                                                        )}
                                                        style={{ width: `${Math.min(pct, 100)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>


                    {/* Bottom Spacer */}
                    <div className="h-10" />
                </div>

                {/* Profile Sidebar */}
                <ProfileSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            </div>
        </DashboardLayout>
    );
}
