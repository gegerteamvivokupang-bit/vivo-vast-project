'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { ProfileSidebar } from '@/components/ProfileSidebar';
import { Loading } from '@/components/ui/loading';
import { Alert } from '@/components/ui/alert';
import { createClient } from '@/lib/supabase/client';
import { Bell, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Promotor {
    user_id: string;
    name: string;
    total_input: number;
    total_pending: number;
    total_rejected: number;
    total_closed: number;
    target: number;
}

interface FetchResult {
    promotors: Promotor[];
    callerTarget: number;
}

const getMonthName = (month: number): string => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    return months[month];
};

export default function StorePerformancePage() {
    const { user } = useAuth();
    const [promotors, setPromotors] = useState<Promotor[]>([]);
    const [satorTarget, setSatorTarget] = useState<number>(0);  // SATOR's admin-assigned target
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'perform' | 'under'>('perform');
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Month navigation
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const now = new Date();
        return { year: now.getFullYear(), month: now.getMonth() };
    });

    const monthLabel = `${getMonthName(selectedMonth.month)} ${selectedMonth.year}`;

    // Time Gone Calculation
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const currentDay = now.getDate();
    const timeGonePercent = Math.round((currentDay / daysInMonth) * 100);
    const todayFormatted = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' });

    // Get user initials
    const getInitials = (name: string) => name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'U';

    useEffect(() => {
        if (user) fetchData();
    }, [user, selectedMonth]);

    const fetchData = async () => {
        setLoading(true);
        setError(null);

        try {
            const supabase = createClient();
            const monthStr = `${selectedMonth.year}-${String(selectedMonth.month + 1).padStart(2, '0')}`;

            const { data, error: fnError } = await supabase.functions.invoke('dashboard-team-monthly', {
                body: { userId: user?.id, month: monthStr }
            });

            if (fnError) throw fnError;

            // Handle new response format: { subordinates: [...], callerTarget: number }
            const subordinates = data?.subordinates || [];
            const callerTarget = data?.callerTarget || data?.spvTarget || 0;  // SATOR's admin-assigned target

            const promotorList: Promotor[] = subordinates
                .filter((m: any) => m.role === 'promotor')
                .map((m: any) => ({
                    user_id: m.user_id,
                    name: m.name,
                    total_input: m.total_input || 0,
                    total_pending: m.total_pending || 0,
                    total_rejected: m.total_rejected || 0,
                    total_closed: m.total_closed || 0,
                    target: m.target || 0,
                }));

            setPromotors(promotorList);
            setSatorTarget(callerTarget);  // Set SATOR's admin-assigned target
        } catch (err) {
            console.error(err);
            setError('Gagal memuat data');
        } finally {
            setLoading(false);
        }
    };

    // Month navigation
    const goToPrevMonth = () => {
        setSelectedMonth(prev => {
            if (prev.month === 0) {
                return { year: prev.year - 1, month: 11 };
            }
            return { ...prev, month: prev.month - 1 };
        });
    };

    const goToNextMonth = () => {
        const currentYearMonth = now.getFullYear() * 12 + now.getMonth();
        const selectedYearMonth = selectedMonth.year * 12 + selectedMonth.month;
        if (selectedYearMonth >= currentYearMonth) return;

        setSelectedMonth(prev => {
            if (prev.month === 11) {
                return { year: prev.year + 1, month: 0 };
            }
            return { ...prev, month: prev.month + 1 };
        });
    };

    const isCurrentMonth = selectedMonth.year === now.getFullYear() && selectedMonth.month === now.getMonth();

    // Calculate performance
    const getPercent = (p: Promotor) => p.target > 0 ? Math.round((p.total_input / p.target) * 100) : 0;
    const isUnderperform = (p: Promotor) => {
        if (p.target === 0) return true;
        return getPercent(p) < timeGonePercent;
    };

    const performPromotors = promotors.filter(p => !isUnderperform(p));
    const underPromotors = promotors.filter(p => isUnderperform(p));
    const displayList = activeTab === 'perform' ? performPromotors : underPromotors;

    // Totals - use SATOR's admin-assigned target, NOT sum of promotor targets
    const totals = promotors.reduce((acc, p) => ({
        input: acc.input + p.total_input,
        closed: acc.closed + p.total_closed,
        pending: acc.pending + p.total_pending,
        rejected: acc.rejected + p.total_rejected,
    }), { input: 0, closed: 0, pending: 0, rejected: 0 });

    // Use SATOR's admin-assigned target
    const totalTarget = satorTarget;
    const totalPercent = totalTarget > 0 ? Math.round((totals.input / totalTarget) * 100) : 0;

    if (loading) return <DashboardLayout><Loading message="Memuat data..." /></DashboardLayout>;
    if (error) return <DashboardLayout><Alert type="error" message={error} /></DashboardLayout>;

    return (
        <DashboardLayout allowedRoles={['sator', 'spv', 'manager', 'admin']}>
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
                                    {user?.role === 'sator' ? 'SATOR' : user?.role === 'spv' ? 'Supervisor' : user?.role?.toUpperCase()}
                                </span>
                                <span className="text-white text-lg font-bold leading-tight">{user?.name || 'User'}</span>
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
                                <div className="text-blue-200 text-xs font-semibold mb-1">PERFORMANCE</div>
                                <div className="text-2xl font-bold tracking-tight">{monthLabel}</div>
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

                {/* Main Content */}
                <div className="flex-1 px-5 -mt-6 relative z-20 flex flex-col gap-4">

                    {/* Month Navigation */}
                    <div className="bg-card border border-border rounded-2xl shadow-xl p-3 flex items-center justify-between">
                        <button
                            onClick={goToPrevMonth}
                            className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-muted active:scale-95 transition-all"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>

                        <div className="text-center">
                            <div className="text-lg font-bold text-foreground">{monthLabel}</div>
                            <div className="text-xs text-muted-foreground">Tap panah untuk ganti bulan</div>
                        </div>

                        <button
                            onClick={goToNextMonth}
                            disabled={isCurrentMonth}
                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                                isCurrentMonth
                                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                                    : 'bg-muted text-muted-foreground hover:bg-muted active:scale-95'
                            }`}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>

                    {/* Summary Card */}
                    <div className="bg-card border border-border rounded-2xl p-5 shadow-xl">
                        <div className="flex justify-between items-center mb-3">
                            <div>
                                <div className="text-muted-foreground text-xs">TOTAL INPUT</div>
                                <div className="text-primary text-3xl font-bold">{totals.input}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-muted-foreground text-xs">TARGET</div>
                                <div className="text-foreground text-xl font-bold">{totalTarget}</div>
                            </div>
                        </div>
                        <div className="w-full bg-muted rounded-full h-3 overflow-hidden mb-2">
                            <div
                                className={cn(
                                    "h-full rounded-full",
                                    totalPercent >= 100 ? 'bg-emerald-500' :
                                    totalPercent >= timeGonePercent ? 'bg-amber-500' : 'bg-red-500'
                                )}
                                style={{ width: `${Math.min(totalPercent, 100)}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Capaian: <span className={cn(
                                "font-semibold",
                                totalPercent >= 100 ? 'text-emerald-500' :
                                totalPercent >= timeGonePercent ? 'text-amber-500' : 'text-red-500'
                            )}>{totalPercent}%</span></span>
                            <span>Time Gone: <span className="font-semibold text-primary">{timeGonePercent}%</span></span>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setActiveTab('perform')}
                            className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all ${
                                activeTab === 'perform'
                                    ? 'bg-primary text-primary-foreground shadow-md'
                                    : 'bg-card text-muted-foreground shadow-md border border-border'
                            }`}
                        >
                            <div className="flex items-center justify-center gap-2">
                                <span>📊</span>
                                <span>On Track</span>
                            </div>
                            <div className={`text-xs ${activeTab === 'perform' ? 'text-emerald-300' : 'text-emerald-500'}`}>
                                {performPromotors.length} orang
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('under')}
                            className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all ${
                                activeTab === 'under'
                                    ? 'bg-destructive text-primary-foreground shadow-md'
                                    : 'bg-card text-muted-foreground shadow-md border border-border'
                            }`}
                        >
                            <div className="flex items-center justify-center gap-2">
                                <span>📉</span>
                                <span>Underperform</span>
                            </div>
                            <div className={`text-xs ${activeTab === 'under' ? 'text-red-200' : 'text-red-500'}`}>
                                {underPromotors.length} orang
                            </div>
                        </button>
                    </div>

                    {/* Promotor List */}
                    {displayList.length === 0 ? (
                        <div className="bg-card border border-border rounded-2xl shadow-xl p-8 text-center">
                            <div className="text-5xl mb-3">{activeTab === 'perform' ? '😔' : '🎉'}</div>
                            <h3 className="text-lg font-bold text-foreground mb-1">
                                {activeTab === 'perform' ? 'Tidak ada yang on track' : 'Semua On Track!'}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                {activeTab === 'perform' ? 'Semua promotor underperform' : 'Tidak ada yang underperform'}
                            </p>
                        </div>
                    ) : (
                        <div className="bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
                            <div className={`px-4 py-2 flex justify-between items-center ${
                                activeTab === 'perform' ? 'bg-emerald-500' : 'bg-red-500'
                            }`}>
                                <span className="text-white font-medium text-sm">
                                    {activeTab === 'perform' ? 'Promotor On Track' : 'Promotor Underperform'}
                                </span>
                                <span className="text-white/80 text-xs">
                                    {displayList.length} orang
                                </span>
                            </div>

                            <div className="divide-y divide-border">
                                {displayList.map((p) => {
                                    const pct = getPercent(p);
                                    const kurang = Math.max(0, p.target - p.total_input);

                                    return (
                                        <div key={p.user_id} className="px-4 py-3">
                                            {/* Row 1: Nama & Input */}
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="font-semibold text-foreground">{p.name}</span>
                                                <span className={`text-xl font-bold ${activeTab === 'perform' ? 'text-emerald-500' : 'text-red-500'}`}>
                                                    {p.total_input}
                                                </span>
                                            </div>

                                            {/* Row 2: Stats */}
                                            <div className="flex justify-between items-center text-xs mb-2">
                                                <div className="flex gap-3">
                                                    <span className="text-muted-foreground">
                                                        Target: <span className="font-medium">{p.target || '-'}</span>
                                                    </span>
                                                    <span className={pct >= timeGonePercent ? 'text-emerald-500' : 'text-red-500'}>
                                                        {pct}%
                                                    </span>
                                                </div>
                                                <span className="text-red-500 font-medium">
                                                    Kurang: {kurang}
                                                </span>
                                            </div>

                                            {/* Row 3: Detail */}
                                            <div className="flex gap-3 text-xs mb-2">
                                                <span className="text-emerald-500">{p.total_closed} ACC</span>
                                                <span className="text-amber-500">{p.total_pending} Pnd</span>
                                                <span className="text-red-500">{p.total_rejected} Rej</span>
                                            </div>

                                            {/* Progress Bar */}
                                            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${activeTab === 'perform' ? 'bg-emerald-500' : 'bg-red-500'}`}
                                                    style={{ width: `${Math.min(pct, 100)}%` }}
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
