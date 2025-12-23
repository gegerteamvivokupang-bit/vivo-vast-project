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
        target: acc.target + a.target,
    }), { total_input: 0, target: 0 });

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
                        <button className="flex items-center justify-center h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white">
                            <Bell className="w-5 h-5" />
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
                <div className="flex-1 px-5 -mt-6 relative z-20 flex flex-col gap-6">
                    {/* Hero Metric Card (Progress Hari Ini) */}
                    <button
                        onClick={() => router.push('/dashboard/area/daily')}
                        className="bg-card rounded-2xl shadow-xl p-5 border border-border text-left"
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
                                <div className="flex flex-wrap justify-center gap-3 w-full">
                                    <div className="flex-1 min-w-[90px] bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                                        <span className="text-emerald-500 text-xs font-bold mb-1">Closing</span>
                                        <span className="text-foreground font-bold text-lg">{dailyData.total_closed}</span>
                                    </div>
                                    <div className="flex-1 min-w-[90px] bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                                        <span className="text-amber-500 text-xs font-bold mb-1">Pending</span>
                                        <span className="text-foreground font-bold text-lg">{dailyData.total_pending}</span>
                                    </div>
                                    <div className="flex-1 min-w-[90px] bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                                        <span className="text-red-500 text-xs font-bold mb-1">Reject</span>
                                        <span className="text-foreground font-bold text-lg">{dailyData.total_rejected}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </button>

                    {/* Area Performance Grid */}
                    <div>
                        <div className="flex items-center justify-between mb-4 px-1">
                            <h3 className="text-foreground text-lg font-bold">Area Performance</h3>
                            <button
                                onClick={() => router.push('/dashboard/area/performance')}
                                className="text-primary text-sm font-semibold hover:underline"
                            >
                                View Detail
                            </button>
                        </div>

                        {areas.length === 0 ? (
                            <div className="text-center text-muted-foreground py-8 bg-card rounded-xl border border-border">
                                Tidak ada data AREA
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-4">
                                {areas.map((area, idx) => {
                                    const pct = area.target > 0 ? Math.round((area.total_input / area.target) * 100) : 0;

                                    return (
                                        <div
                                            key={idx}
                                            className="bg-card rounded-xl p-4 shadow-sm border border-border flex flex-col justify-between group cursor-pointer hover:border-primary/50 transition-all"
                                        >
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex flex-col">
                                                    <span className="text-foreground text-base font-bold">{area.name}</span>
                                                    <span className="text-muted-foreground text-xs">{area.spv_name}</span>
                                                </div>
                                            </div>

                                            {/* Target & Input */}
                                            <div className="flex items-baseline gap-2 mb-2">
                                                <span className="text-muted-foreground text-xs">TGT:</span>
                                                <span className="text-foreground text-sm font-semibold">{area.target || 0}</span>
                                                <span className="text-muted-foreground text-xs mx-1">•</span>
                                                <span className="text-muted-foreground text-xs">INP:</span>
                                                <span className="text-primary text-sm font-bold">{area.total_input}</span>
                                            </div>

                                            {/* Progress Bar */}
                                            <div className="mb-3">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className={cn("text-2xl font-bold", getStatusColor(pct))}>{pct}%</span>
                                                </div>
                                                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                                    <div className={cn("h-full rounded-full", getStatusBg(pct))} style={{ width: `${Math.min(pct, 100)}%` }} />
                                                </div>
                                            </div>

                                            {/* Metrics Pills */}
                                            <div className="flex gap-1.5 text-xs">
                                                <div className="flex-1 bg-emerald-500/10 rounded px-2 py-1 text-center">
                                                    <div className="font-bold text-emerald-500">{area.total_closed}</div>
                                                    <div className="text-[9px] text-muted-foreground">CLS</div>
                                                </div>
                                                <div className="flex-1 bg-amber-500/10 rounded px-2 py-1 text-center">
                                                    <div className="font-bold text-amber-500">{area.total_pending}</div>
                                                    <div className="text-[9px] text-muted-foreground">PND</div>
                                                </div>
                                                <div className="flex-1 bg-red-500/10 rounded px-2 py-1 text-center">
                                                    <div className="font-bold text-red-500">{area.total_rejected}</div>
                                                    <div className="text-[9px] text-muted-foreground">REJ</div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
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
