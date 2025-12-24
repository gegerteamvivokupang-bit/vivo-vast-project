'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { ProfileSidebar } from '@/components/ProfileSidebar';
import { Loading } from '@/components/ui/loading';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { User, ChevronRight } from 'lucide-react';

interface MonthlySummary {
    target: number;
    input: number;
    closing: number;
    pending: number;
    rejected: number;
}

interface DailyData {
    total_input: number;
    total_pending: number;
    total_rejected: number;
    total_closed: number;
    promotor_active: number;
    promotor_empty: number;
}

interface SatorData {
    user_id: string;
    name: string;
    target: number;
    total_input: number;
    total_closed: number;
    total_pending: number;
    total_rejected: number;
}

interface PromotorData {
    user_id: string;
    name: string;
    target: number;
    total_input: number;
    total_closed: number;
    total_pending: number;
    total_rejected: number;
}

export default function SpvDashboardPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [summary, setSummary] = useState<MonthlySummary>({ target: 0, input: 0, closing: 0, pending: 0, rejected: 0 });
    const [dailyData, setDailyData] = useState<DailyData | null>(null);
    const [sators, setSators] = useState<SatorData[]>([]);
    const [promotors, setPromotors] = useState<PromotorData[]>([]);
    const [areaName, setAreaName] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const currentDay = now.getDate();
    const timeGonePercent = Math.round((currentDay / daysInMonth) * 100);
    const todayFormatted = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' });

    // Get user initials
    const getInitials = (name: string) => name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'U';

    useEffect(() => {
        if (user) fetchData();
    }, [user]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const supabase = createClient();
            const { data: hierarchyData } = await supabase
                .from('hierarchy')
                .select('area')
                .eq('user_id', user?.id)
                .single();

            if (hierarchyData?.area) setAreaName(hierarchyData.area);

            const [monthlyRes, dailyRes] = await Promise.all([
                supabase.functions.invoke('dashboard-team-monthly', { body: { userId: user?.id } }),
                supabase.functions.invoke('dashboard-team-daily', { body: { userId: user?.id } })
            ]);

            if (monthlyRes.error) throw monthlyRes.error;

            // Response format: { subordinates: [...], spvTarget: number }
            const responseData = monthlyRes.data || {};
            const monthlyData = responseData.subordinates || [];
            const spvAdminTarget = responseData.spvTarget || 0;

            // Use SPV's admin-assigned target, NOT sum of subordinate targets
            const totals = monthlyData.reduce((acc: MonthlySummary, m: any) => ({
                target: acc.target, // Keep the SPV's own target (set below)
                input: acc.input + (m.total_input || 0),
                closing: acc.closing + (m.total_closed || 0),
                pending: acc.pending + (m.total_pending || 0),
                rejected: acc.rejected + (m.total_rejected || 0),
            }), { target: spvAdminTarget, input: 0, closing: 0, pending: 0, rejected: 0 });
            setSummary(totals);

            const satorList: SatorData[] = monthlyData
                .filter((m: any) => m.role === 'sator')
                .map((m: any) => ({
                    user_id: m.user_id,
                    name: m.name,
                    target: m.target || 0,
                    total_input: m.total_input || 0,
                    total_closed: m.total_closed || 0,
                    total_pending: m.total_pending || 0,
                    total_rejected: m.total_rejected || 0,
                }));
            setSators(satorList);

            const promotorList: PromotorData[] = monthlyData
                .filter((m: any) => m.role === 'promotor')
                .map((m: any) => ({
                    user_id: m.user_id,
                    name: m.name,
                    target: m.target || 0,
                    total_input: m.total_input || 0,
                    total_closed: m.total_closed || 0,
                    total_pending: m.total_pending || 0,
                    total_rejected: m.total_rejected || 0,
                }));
            setPromotors(promotorList);

            if (dailyRes.data) {
                const dailyArr = Array.isArray(dailyRes.data) ? dailyRes.data : (dailyRes.data.promotors || []);
                const dailyTotals = dailyArr.reduce((acc: any, p: any) => ({
                    total_input: acc.total_input + (p.total_input || 0),
                    total_pending: acc.total_pending + (p.total_pending || 0),
                    total_rejected: acc.total_rejected + (p.total_rejected || 0),
                    total_closed: acc.total_closed + (p.total_closed || 0),
                }), { total_input: 0, total_pending: 0, total_rejected: 0, total_closed: 0 });

                const activeCount = dailyArr.filter((p: any) => (p.total_input || 0) > 0).length;
                const emptyCount = dailyArr.filter((p: any) => (p.total_input || 0) === 0).length;
                const totalPromotors = monthlyData.length;
                const promotorsWithDailyData = dailyArr.length;
                const promotorsNoData = totalPromotors - promotorsWithDailyData;

                setDailyData({
                    ...dailyTotals,
                    promotor_active: activeCount,
                    promotor_empty: emptyCount + promotorsNoData,
                });
            }
        } catch (err) {
            console.error(err);
            setError('Gagal memuat data');
        } finally {
            setLoading(false);
        }
    };

    const targetPercent = summary.target > 0 ? Math.round((summary.input / summary.target) * 100) : 0;

    if (loading) return <DashboardLayout><Loading message="Memuat dashboard..." /></DashboardLayout>;
    if (error) return <DashboardLayout><Alert type="error" message={error} /></DashboardLayout>;

    return (
        <DashboardLayout allowedRoles={['spv', 'sator']}>
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
                                <span className="text-blue-100 text-xs font-medium uppercase tracking-wider">
                                    {user?.role === 'sator' ? 'SATOR' : 'Supervisor'}
                                </span>
                                <span className="text-white text-lg font-bold leading-tight">{user?.name || 'User'}</span>
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
                <div className="flex-1 px-5 -mt-6 relative z-20 flex flex-col gap-4">
                    {/* Target Bulanan Card - Dengan Stats */}
                    <div className="bg-card border border-border rounded-2xl p-5 shadow-xl">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-xl">🎯</span>
                            <h3 className="font-bold text-foreground">TARGET BULAN INI</h3>
                        </div>

                        <div className="flex justify-between items-end mb-3">
                            <div>
                                <span className="text-4xl font-bold text-primary">{summary.input}</span>
                                <span className="text-muted-foreground text-lg"> / {summary.target}</span>
                            </div>
                            <div className={cn(
                                "text-2xl font-bold",
                                targetPercent >= 100 ? 'text-emerald-500' :
                                    targetPercent >= timeGonePercent ? 'text-amber-500' : 'text-red-500'
                            )}>
                                {targetPercent}%
                            </div>
                        </div>

                        <div className="w-full bg-muted rounded-full h-3 overflow-hidden mb-4">
                            <div
                                className={cn(
                                    "h-full rounded-full transition-all duration-500",
                                    targetPercent >= 100 ? 'bg-emerald-500' :
                                        targetPercent >= timeGonePercent ? 'bg-amber-500' : 'bg-red-500'
                                )}
                                style={{ width: `${Math.min(targetPercent, 100)}%` }}
                            />
                        </div>

                        {/* Stats Grid Inside Card */}
                        <div className="grid grid-cols-4 gap-2">
                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2 text-center">
                                <div className="text-emerald-600 text-lg font-bold">{summary.closing}</div>
                                <div className="text-[10px] text-emerald-600 font-medium">CLOSING</div>
                            </div>
                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2 text-center">
                                <div className="text-amber-600 text-lg font-bold">{summary.pending}</div>
                                <div className="text-[10px] text-amber-600 font-medium">PENDING</div>
                            </div>
                            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-2 text-center">
                                <div className="text-red-600 text-lg font-bold">{summary.rejected}</div>
                                <div className="text-[10px] text-red-600 font-medium">REJECT</div>
                            </div>
                            <div className="bg-primary/10 border border-primary/20 rounded-xl p-2 text-center">
                                <div className="text-primary text-lg font-bold">{summary.closing}</div>
                                <div className="text-[10px] text-primary font-medium">ACC</div>
                            </div>
                        </div>

                        {summary.target > summary.input && (
                            <div className="mt-3 text-center text-sm text-red-500">
                                Kurang <span className="font-bold">{summary.target - summary.input}</span> lagi
                            </div>
                        )}
                    </div>

                    {/* Daily Progress Card - Clickable */}
                    {dailyData && (
                        <button
                            onClick={() => router.push('/dashboard/team/daily')}
                            className="bg-card border border-border rounded-2xl p-5 shadow-xl text-left hover:border-primary/50 transition-all"
                        >
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-foreground text-lg font-bold flex items-center gap-2">
                                    📊 Progress Hari Ini
                                </h3>
                                <ChevronRight className="w-5 h-5 text-muted-foreground" />
                            </div>

                            <div className="flex items-center justify-between mb-4">
                                <div className="text-center">
                                    <div className="text-4xl font-bold text-primary">{dailyData.total_input}</div>
                                    <div className="text-xs text-muted-foreground">INPUT</div>
                                </div>
                                <div className="flex gap-2 text-sm">
                                    <span className="text-emerald-500">{dailyData.promotor_active} aktif</span>
                                    <span className="text-muted-foreground">•</span>
                                    <span className="text-red-500">{dailyData.promotor_empty} kosong</span>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <div className="flex-1 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
                                    <span className="text-emerald-500 text-xs font-bold">Closing</span>
                                    <div className="text-foreground font-bold text-lg">{dailyData.total_closed}</div>
                                </div>
                                <div className="flex-1 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center">
                                    <span className="text-amber-500 text-xs font-bold">Pending</span>
                                    <div className="text-foreground font-bold text-lg">{dailyData.total_pending}</div>
                                </div>
                                <div className="flex-1 bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
                                    <span className="text-red-500 text-xs font-bold">Reject</span>
                                    <div className="text-foreground font-bold text-lg">{dailyData.total_rejected}</div>
                                </div>
                            </div>
                        </button>
                    )}

                    {/* SATOR List Card - Only for SPV */}
                    {user?.role === 'spv' && sators.length > 0 && (
                        <div className="bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
                            <div className="bg-primary/10 px-4 py-3 flex items-center justify-between">
                                <h3 className="text-sm font-bold text-foreground uppercase">REKAP SATOR • {areaName || 'Area'}</h3>
                                <span className="text-muted-foreground text-xs">{sators.length} Sator</span>
                            </div>

                            <div className="divide-y divide-border">
                                {sators.map((s) => {
                                    const percent = s.target > 0 ? Math.round((s.total_input / s.target) * 100) : 0;
                                    const kurang = Math.max(0, s.target - s.total_input);
                                    return (
                                        <div key={s.user_id} className="px-4 py-3">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="font-semibold text-foreground">{s.name}</span>
                                                <span className="text-lg font-bold text-primary">{s.total_input}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-xs text-muted-foreground">
                                                <div className="flex gap-3">
                                                    <span>Target: <span className="font-medium text-foreground">{s.target}</span></span>
                                                    <span className={cn(
                                                        percent >= 100 ? 'text-emerald-500' : percent >= 50 ? 'text-amber-500' : 'text-red-500'
                                                    )}>
                                                        {percent}%
                                                    </span>
                                                </div>
                                                <span className="text-red-500">Kurang: <span className="font-medium">{kurang}</span></span>
                                            </div>
                                            <div className="mt-2 w-full bg-muted rounded-full h-2 overflow-hidden">
                                                <div
                                                    className={cn(
                                                        "h-full rounded-full transition-all",
                                                        percent >= 100 ? 'bg-emerald-500' : percent >= 50 ? 'bg-amber-500' : 'bg-red-500'
                                                    )}
                                                    style={{ width: `${Math.min(percent, 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}


                    {/* Bottom Spacer */}
                    <div className="h-10" />
                </div>

                {/* Profile Sidebar */}
                <ProfileSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            </div>
        </DashboardLayout>
    );
}
