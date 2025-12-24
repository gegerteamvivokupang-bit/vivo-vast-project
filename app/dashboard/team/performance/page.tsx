'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import SpvHeader from '@/components/SpvHeader';
import { Loading } from '@/components/ui/loading';
import { Alert } from '@/components/ui/alert';
import { createClient } from '@/lib/supabase/client';

// ============================================
// INTERFACES
// ============================================
interface Promotor {
    user_id: string;
    name: string;
    total_input: number;
    total_pending: number;
    total_rejected: number;
    total_closed: number;
    target: number;
    sator_id?: string;
    sator_name?: string;
}

interface Sator {
    user_id: string;
    name: string;
    promotors: Promotor[];
    total_input: number;
    total_closed: number;
    total_pending: number;
    total_rejected: number;
    target: number;
}

interface MonthlyData {
    sators: Sator[];
    allPromotors: Promotor[];
    totals: {
        target: number;
        total_input: number;
        total_closed: number;
        total_pending: number;
        total_rejected: number;
    };
}

type MainTab = 'performance' | 'underperform';

// ============================================
// HELPER FUNCTIONS
// ============================================
const getMonthName = (month: number): string => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    return months[month];
};

// ============================================
// MAIN COMPONENT
// ============================================
export default function TeamPerformancePage() {
    const { user } = useAuth();
    const [data, setData] = useState<MonthlyData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Tab states
    const [mainTab, setMainTab] = useState<MainTab>('performance');

    // Filter states
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const now = new Date();
        return { year: now.getFullYear(), month: now.getMonth() };
    });
    const [selectedSator, setSelectedSator] = useState<string>('all');

    // Get month label
    const monthLabel = `${getMonthName(selectedMonth.month)} ${selectedMonth.year}`;

    // Time Gone Calculation
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const currentDay = now.getDate();
    const timeGonePercent = Math.round((currentDay / daysInMonth) * 100);

    // ============================================
    // DATA FETCHING
    // ============================================
    useEffect(() => {
        if (user) fetchData();
    }, [user, selectedMonth]);

    const fetchData = async () => {
        setLoading(true);
        setError(null);

        try {
            const supabase = createClient();

            // Format month for API
            const monthStr = `${selectedMonth.year}-${String(selectedMonth.month + 1).padStart(2, '0')}`;

            const { data: result, error: fnError } = await supabase.functions.invoke('dashboard-team-monthly', {
                body: { userId: user?.id, month: monthStr }
            });

            if (fnError) throw fnError;

            // Handle new response format: { subordinates: [...], spvTarget: number }
            const rawData = result?.subordinates || [];

            // Separate SATORs and direct promotors
            const satorsRaw = rawData.filter((m: any) => m.role === 'sator');
            const directPromotors = rawData.filter((m: any) => m.role === 'promotor');

            // Build SATOR list with their promotors - PARALLEL for better performance
            const satorPromises = satorsRaw.map(async (sator: any) => {
                const { data: satorSubs } = await supabase.functions.invoke('dashboard-team-monthly', {
                    body: { userId: sator.user_id, month: monthStr }
                });

                // Handle new response format
                const satorSubData = satorSubs?.subordinates || [];
                const promotors = satorSubData
                    .filter((m: any) => m.role === 'promotor')
                    .map((p: any) => ({
                        user_id: p.user_id,
                        name: p.name,
                        total_input: p.total_input || 0,
                        total_pending: p.total_pending || 0,
                        total_rejected: p.total_rejected || 0,
                        total_closed: p.total_closed || 0,
                        target: p.target || 0,
                        sator_id: sator.user_id,
                        sator_name: sator.name,
                    }));

                return {
                    user_id: sator.user_id,
                    name: sator.name,
                    promotors,
                    total_input: promotors.reduce((sum: number, p: Promotor) => sum + p.total_input, 0),
                    total_closed: promotors.reduce((sum: number, p: Promotor) => sum + p.total_closed, 0),
                    total_pending: promotors.reduce((sum: number, p: Promotor) => sum + p.total_pending, 0),
                    total_rejected: promotors.reduce((sum: number, p: Promotor) => sum + p.total_rejected, 0),
                    target: promotors.reduce((sum: number, p: Promotor) => sum + p.target, 0),
                };
            });

            const sators: Sator[] = await Promise.all(satorPromises);

            // Collect all promotors for underperform view
            let allPromotors: Promotor[] = [];

            // If SPV has direct promotors, add as "self" SATOR
            if (directPromotors.length > 0 && user) {
                const selfPromotors = directPromotors.map((p: any) => ({
                    user_id: p.user_id,
                    name: p.name,
                    total_input: p.total_input || 0,
                    total_pending: p.total_pending || 0,
                    total_rejected: p.total_rejected || 0,
                    total_closed: p.total_closed || 0,
                    target: p.target || 0,
                    sator_id: user.id,
                    sator_name: user.name,
                }));

                sators.unshift({
                    user_id: user.id,
                    name: `${user.name}`,
                    promotors: selfPromotors,
                    total_input: selfPromotors.reduce((sum: number, p: Promotor) => sum + p.total_input, 0),
                    total_closed: selfPromotors.reduce((sum: number, p: Promotor) => sum + p.total_closed, 0),
                    total_pending: selfPromotors.reduce((sum: number, p: Promotor) => sum + p.total_pending, 0),
                    total_rejected: selfPromotors.reduce((sum: number, p: Promotor) => sum + p.total_rejected, 0),
                    target: selfPromotors.reduce((sum: number, p: Promotor) => sum + p.target, 0),
                });

                allPromotors = [...selfPromotors];
            }

            // Add all promotors from sators
            sators.forEach(s => {
                if (s.user_id !== user?.id) { // Avoid duplicating direct promotors
                    allPromotors = [...allPromotors, ...s.promotors];
                }
            });

            // Calculate totals
            const totals = {
                target: sators.reduce((sum, s) => sum + s.target, 0),
                total_input: sators.reduce((sum, s) => sum + s.total_input, 0),
                total_closed: sators.reduce((sum, s) => sum + s.total_closed, 0),
                total_pending: sators.reduce((sum, s) => sum + s.total_pending, 0),
                total_rejected: sators.reduce((sum, s) => sum + s.total_rejected, 0),
            };

            setData({ sators, allPromotors, totals });

        } catch (err) {
            console.error(err);
            setError('Gagal memuat data');
        } finally {
            setLoading(false);
        }
    };

    // ============================================
    // MONTH NAVIGATION
    // ============================================
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

        // Don't go beyond current month
        if (selectedYearMonth >= currentYearMonth) return;

        setSelectedMonth(prev => {
            if (prev.month === 11) {
                return { year: prev.year + 1, month: 0 };
            }
            return { ...prev, month: prev.month + 1 };
        });
    };

    const isCurrentMonth = useMemo(() => {
        return selectedMonth.year === now.getFullYear() && selectedMonth.month === now.getMonth();
    }, [selectedMonth]);

    // ============================================
    // UNDERPERFORM LOGIC
    // ============================================
    const isUnderperform = (p: Promotor): boolean => {
        const target = p.target || 0;
        const input = p.total_input || 0;
        if (target === 0) return true; // No target = underperform
        const inputPercent = (input / target) * 100;
        return inputPercent < timeGonePercent;
    };

    const getInputPercent = (p: Promotor): number => {
        if (!p.target || p.target === 0) return 0;
        return Math.round((p.total_input / p.target) * 100);
    };

    // ============================================
    // FILTERED DATA
    // ============================================
    const filteredSators = useMemo(() => {
        if (!data) return [];
        if (selectedSator === 'all') return data.sators;
        return data.sators.filter(s => s.user_id === selectedSator);
    }, [data, selectedSator]);

    const underperformPromotors = useMemo(() => {
        if (!data) return [];
        return data.allPromotors.filter(isUnderperform);
    }, [data, timeGonePercent]);

    const filteredUnderperform = useMemo(() => {
        if (selectedSator === 'all') return underperformPromotors;
        return underperformPromotors.filter(p => p.sator_id === selectedSator);
    }, [underperformPromotors, selectedSator]);

    const getUnderperformCount = (satorId: string) => {
        return underperformPromotors.filter(p => p.sator_id === satorId).length;
    };

    const displayTotals = useMemo(() => {
        if (!data) return { target: 0, total_input: 0, total_closed: 0, total_pending: 0, total_rejected: 0 };
        if (selectedSator === 'all') return data.totals;

        const sator = data.sators.find(s => s.user_id === selectedSator);
        if (!sator) return data.totals;

        return {
            target: sator.target,
            total_input: sator.total_input,
            total_closed: sator.total_closed,
            total_pending: sator.total_pending,
            total_rejected: sator.total_rejected,
        };
    }, [data, selectedSator]);

    const achievementPercent = displayTotals.target > 0
        ? Math.round((displayTotals.total_input / displayTotals.target) * 100)
        : 0;

    // ============================================
    // RENDER
    // ============================================
    if (loading) {
        return (
            <DashboardLayout>
                <Loading message="Memuat data..." />
            </DashboardLayout>
        );
    }

    if (error) {
        return (
            <DashboardLayout>
                <Alert type="error" message={error} />
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout allowedRoles={['spv', 'sator']}>
            <div className="min-h-screen bg-background pb-24">

                {/* Header */}
                <SpvHeader
                    title="TIM"
                    subtitle="Performance & Underperform"
                    icon="👥"
                />

                <div className="p-3 space-y-3">

                    {/* Main Tabs: Performance / Underperform */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setMainTab('performance')}
                            className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all ${mainTab === 'performance'
                                ? 'bg-primary text-primary-foreground shadow-md'
                                : 'bg-card text-muted-foreground shadow-md hover:bg-muted'
                                }`}
                        >
                            <div className="flex items-center justify-center gap-2">
                                <span>📊</span>
                                <span>Performance</span>
                            </div>
                            <div className={`text-xs ${mainTab === 'performance' ? 'text-primary-foreground/80' : 'text-primary'}`}>
                                {data?.allPromotors.length || 0} promotor
                            </div>
                        </button>
                        <button
                            onClick={() => setMainTab('underperform')}
                            className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all ${mainTab === 'underperform'
                                ? 'bg-destructive text-primary-foreground shadow-md'
                                : 'bg-card text-muted-foreground shadow-md hover:bg-muted'
                                }`}
                        >
                            <div className="flex items-center justify-center gap-2">
                                <span>📉</span>
                                <span>Underperform</span>
                            </div>
                            <div className={`text-xs ${mainTab === 'underperform' ? 'text-primary-foreground/80' : 'text-destructive'}`}>
                                {underperformPromotors.length} orang
                            </div>
                        </button>
                    </div>

                    {/* Month Filter */}
                    <div className="bg-card rounded-xl shadow-md p-3 flex items-center justify-between">
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
                            <div className="text-xs text-muted-foreground">
                                Time Gone: <span className="font-semibold text-primary">{timeGonePercent}%</span>
                            </div>
                        </div>

                        <button
                            onClick={goToNextMonth}
                            disabled={isCurrentMonth}
                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isCurrentMonth
                                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                                : 'bg-muted text-muted-foreground hover:bg-muted active:scale-95'
                                }`}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>

                    {/* SATOR Filter Buttons */}
                    {data && data.sators.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {/* All Button */}
                            <button
                                onClick={() => setSelectedSator('all')}
                                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${selectedSator === 'all'
                                    ? 'bg-primary text-primary-foreground shadow-md'
                                    : 'bg-card text-muted-foreground shadow-md hover:bg-muted'
                                    }`}
                            >
                                <div>Semua</div>
                                <div className={`text-[10px] ${selectedSator === 'all' ? 'text-primary-foreground/80' : mainTab === 'underperform' ? 'text-destructive' : 'text-primary'}`}>
                                    {mainTab === 'performance' ? data.totals.total_input : underperformPromotors.length}
                                </div>
                            </button>

                            {/* SATOR Buttons */}
                            {data.sators.map((sator) => {
                                const shortName = sator.name.split(' ')[0].toUpperCase();
                                const underCount = getUnderperformCount(sator.user_id);

                                // In underperform tab, hide sators with 0 underperform
                                if (mainTab === 'underperform' && underCount === 0) return null;

                                return (
                                    <button
                                        key={sator.user_id}
                                        onClick={() => setSelectedSator(sator.user_id)}
                                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${selectedSator === sator.user_id
                                            ? 'bg-primary text-primary-foreground shadow-md'
                                            : 'bg-card text-muted-foreground shadow-md hover:bg-muted'
                                            }`}
                                    >
                                        <div>{shortName}</div>
                                        <div className={`text-[10px] ${selectedSator === sator.user_id ? 'text-primary-foreground/80' : mainTab === 'underperform' ? 'text-destructive' : 'text-primary'}`}>
                                            {mainTab === 'performance' ? sator.total_input : underCount}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* ============================================ */}
                    {/* PERFORMANCE TAB CONTENT */}
                    {/* ============================================ */}
                    {mainTab === 'performance' && (
                        <>
                            {/* Summary Card */}
                            <div className="bg-primary rounded-xl p-4 shadow-md text-primary-foreground">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <p className="text-primary-foreground/80 text-xs uppercase tracking-wide">Total Input</p>
                                        <p className="text-3xl font-bold">{displayTotals.total_input}</p>
                                        <p className="text-primary-foreground/80 text-xs">dari target {displayTotals.target}</p>
                                    </div>
                                    <div className="text-right">
                                        <div className={`text-2xl font-bold ${achievementPercent >= 100 ? 'text-success' : achievementPercent >= timeGonePercent ? 'text-warning' : 'text-destructive/80'}`}>
                                            {achievementPercent}%
                                        </div>
                                        <p className="text-primary-foreground/80 text-xs">Capaian</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <div className="bg-card/10 rounded-xl p-2">
                                        <div className="font-bold text-lg">{displayTotals.total_closed}</div>
                                        <div className="text-primary-foreground/80 text-[10px]">CLOSING</div>
                                    </div>
                                    <div className="bg-card/10 rounded-xl p-2">
                                        <div className="font-bold text-lg">{displayTotals.total_pending}</div>
                                        <div className="text-primary-foreground/80 text-[10px]">PENDING</div>
                                    </div>
                                    <div className="bg-card/10 rounded-xl p-2">
                                        <div className="font-bold text-lg">{displayTotals.total_rejected}</div>
                                        <div className="text-primary-foreground/80 text-[10px]">REJECT</div>
                                    </div>
                                </div>
                            </div>

                            {/* SATOR Groups with Promotors */}
                            {filteredSators.length === 0 ? (
                                <div className="bg-card rounded-xl p-8 text-center shadow-md">
                                    <div className="text-4xl mb-2">📭</div>
                                    <p className="text-muted-foreground">Tidak ada data</p>
                                </div>
                            ) : (
                                filteredSators.map((sator) => (
                                    <div key={sator.user_id} className="bg-card rounded-xl shadow-md overflow-hidden">
                                        {/* SATOR Header */}
                                        <div className="bg-primary/10 px-4 py-3 flex justify-between items-center">
                                            <div>
                                                <span className="font-semibold text-foreground">{sator.name}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="bg-primary text-primary-foreground px-2 py-0.5 rounded-full text-sm font-bold">
                                                    {sator.total_input}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Promotor List */}
                                        <div className="divide-y divide-border">
                                            {sator.promotors.length === 0 ? (
                                                <div className="p-4 text-center text-muted-foreground text-sm">
                                                    Tidak ada promotor
                                                </div>
                                            ) : (
                                                sator.promotors.map((p) => {
                                                    const pct = getInputPercent(p);
                                                    const isUnder = isUnderperform(p);
                                                    return (
                                                        <div
                                                            key={p.user_id}
                                                            className={`px-4 py-3 ${isUnder ? 'bg-destructive/5' : ''}`}
                                                        >
                                                            {/* Row 1: Nama & Total Input */}
                                                            <div className="flex justify-between items-center mb-2">
                                                                <span className="text-sm font-semibold text-foreground truncate">
                                                                    {p.name}
                                                                </span>
                                                                <span className={`text-lg font-bold ${isUnder ? 'text-destructive' : 'text-primary'}`}>
                                                                    {p.total_input}
                                                                </span>
                                                            </div>

                                                            {/* Row 2: Detail stats */}
                                                            <div className="flex justify-between items-center text-xs">
                                                                <div className="flex gap-3">
                                                                    <span className="text-success">
                                                                        <span className="font-medium">{p.total_closed}</span> ACC
                                                                    </span>
                                                                    <span className="text-warning">
                                                                        <span className="font-medium">{p.total_pending}</span> Pnd
                                                                    </span>
                                                                    <span className="text-destructive">
                                                                        <span className="font-medium">{p.total_rejected}</span> Rej
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-muted-foreground">
                                                                        Tgt: {p.target}
                                                                    </span>
                                                                    <span className={`font-semibold ${pct >= timeGonePercent ? 'text-success' : 'text-destructive'}`}>
                                                                        {pct}%
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </>
                    )}

                    {/* ============================================ */}
                    {/* UNDERPERFORM TAB CONTENT */}
                    {/* ============================================ */}
                    {mainTab === 'underperform' && (
                        <>
                            {/* Time Gone Card */}
                            <div className="bg-destructive rounded-xl p-4 shadow-md">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-primary-foreground/80 text-sm">TIME GONE</span>
                                    <span className="text-3xl font-bold text-primary-foreground">{timeGonePercent}%</span>
                                </div>
                                <div className="w-full bg-card/30 rounded-full h-2 overflow-hidden">
                                    <div className="bg-card h-full rounded-full" style={{ width: `${timeGonePercent}%` }}></div>
                                </div>
                                <div className="mt-3 flex justify-between items-center">
                                    <span className="text-primary-foreground/80 text-xs">Rule: INPUT% &lt; TIME GONE%</span>
                                    <span className="bg-card/20 px-3 py-1 rounded-full text-primary-foreground text-sm font-bold">
                                        {filteredUnderperform.length} Underperform
                                    </span>
                                </div>
                            </div>

                            {/* Underperform Promotor Table */}
                            {filteredUnderperform.length === 0 ? (
                                <div className="bg-card rounded-xl shadow-md p-8 text-center">
                                    <div className="text-5xl mb-3">🎉</div>
                                    <h3 className="text-lg font-bold text-success mb-1">Semua On Track!</h3>
                                    <p className="text-sm text-muted-foreground">Tidak ada yang underperform</p>
                                </div>
                            ) : (
                                <div className="bg-card rounded-xl shadow-md overflow-hidden">
                                    <div className="bg-destructive px-4 py-2 flex justify-between items-center">
                                        <span className="text-primary-foreground font-medium text-sm">Promotor Underperform</span>
                                        <span className="text-primary-foreground/80 text-xs">{filteredUnderperform.length} orang</span>
                                    </div>

                                    {/* Table */}
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead className="bg-muted/50">
                                                <tr>
                                                    <th className="sticky left-0 z-10 bg-muted/50 py-2 pl-3 pr-2 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border">Nama</th>
                                                    <th className="whitespace-nowrap px-1.5 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border">TGT</th>
                                                    <th className="whitespace-nowrap px-1.5 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border">INP</th>
                                                    <th className="whitespace-nowrap px-1.5 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border">%</th>
                                                    <th className="whitespace-nowrap px-1.5 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border">GAP</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border">
                                                {filteredUnderperform.map((p) => {
                                                    const pct = getInputPercent(p);
                                                    const gap = Math.max(0, (p.target || 0) - p.total_input);
                                                    const firstName = p.name.split(' ')[0];
                                                    return (
                                                        <tr key={p.user_id} className="bg-red-500/10 hover:bg-red-500/15">
                                                            <td className="sticky left-0 z-10 bg-background py-2 pl-3 pr-2 font-medium text-xs">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="w-3 h-3 text-red-500">⚠️</span>
                                                                    <span className="truncate">{firstName}</span>
                                                                </div>
                                                                {selectedSator === 'all' && p.sator_name && (
                                                                    <div className="text-[10px] text-muted-foreground mt-0.5">{p.sator_name.split(' ')[0]}</div>
                                                                )}
                                                            </td>
                                                            <td className="whitespace-nowrap px-1.5 py-2 text-right text-muted-foreground font-mono text-[11px]">{p.target || 0}</td>
                                                            <td className="whitespace-nowrap px-1.5 py-2 text-right text-muted-foreground font-mono text-[11px]">{p.total_input}</td>
                                                            <td className="whitespace-nowrap px-1.5 py-2 text-right text-red-500 font-bold font-mono text-[11px]">{pct}%</td>
                                                            <td className="whitespace-nowrap px-1.5 py-2 text-right text-red-500 font-bold font-mono text-[11px]">-{gap}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                </div>
            </div>
        </DashboardLayout>
    );
}
