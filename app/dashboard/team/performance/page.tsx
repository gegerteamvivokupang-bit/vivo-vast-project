'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import SpvHeader from '@/components/SpvHeader';
import { Loading } from '@/components/ui/loading';
import { Alert } from '@/components/ui/alert';
import { createClient } from '@/lib/supabase/client';

// Shared types
import { PromotorData } from '@/types/api.types';

// Utilities
import { parseSupabaseError, logError } from '@/lib/errors';
import {
    calculateAchievement,
    isUnderperform as checkUnderperform,
    calculateTimeGone
} from '@/lib/dashboard-logic';

// ============================================
// INTERFACES
// ============================================
interface Sator {
    user_id: string;
    name: string;
    promotors: PromotorData[];
    total_input: number;
    total_closed: number;
    total_pending: number;
    total_rejected: number;
    target: number;
}

interface MonthlyData {
    sators: Sator[];
    allPromotors: PromotorData[];
    totals: {
        target: number;
        total_input: number;
        total_closed: number;
        total_pending: number;
        total_rejected: number;
    };
}

type MainTab = 'allteam' | 'ontrack' | 'underperform';

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
    const [mainTab, setMainTab] = useState<MainTab>('allteam');

    // Filter states
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const now = new Date();
        return { year: now.getFullYear(), month: now.getMonth() };
    });
    const [selectedSator, setSelectedSator] = useState<string>('all');

    // Get month label
    const monthLabel = `${getMonthName(selectedMonth.month)} ${selectedMonth.year}`;

    // Time Gone Calculation - Use centralized logic
    const now = new Date();
    const timeGonePercent = calculateTimeGone(now);

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
            const directPromotors = rawData.filter((m: any) => m.role === 'promotor');

            // Filter out caller from satorsRaw if they have direct promotors
            // to avoid duplication (they'll be added as "self" SATOR below)
            const satorsRaw = rawData
                .filter((m: any) => m.role === 'sator')
                .filter((m: any) => !(directPromotors.length > 0 && m.user_id === user?.id));

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
                    total_input: promotors.reduce((sum: number, p: PromotorData) => sum + p.total_input, 0),
                    total_closed: promotors.reduce((sum: number, p: PromotorData) => sum + p.total_closed, 0),
                    total_pending: promotors.reduce((sum: number, p: PromotorData) => sum + p.total_pending, 0),
                    total_rejected: promotors.reduce((sum: number, p: PromotorData) => sum + p.total_rejected, 0),
                    target: promotors.reduce((sum: number, p: PromotorData) => sum + p.target, 0),
                };
            });

            const sators: Sator[] = await Promise.all(satorPromises);

            // Collect all promotors for underperform view
            let allPromotors: PromotorData[] = [];

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
                    total_input: selfPromotors.reduce((sum: number, p: PromotorData) => sum + p.total_input, 0),
                    total_closed: selfPromotors.reduce((sum: number, p: PromotorData) => sum + p.total_closed, 0),
                    total_pending: selfPromotors.reduce((sum: number, p: PromotorData) => sum + p.total_pending, 0),
                    total_rejected: selfPromotors.reduce((sum: number, p: PromotorData) => sum + p.total_rejected, 0),
                    target: selfPromotors.reduce((sum: number, p: PromotorData) => sum + p.target, 0),
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
            const apiError = parseSupabaseError(err);
            logError(apiError, {
                userId: user?.id,
                page: 'team-performance',
                action: 'fetchData'
            });
            console.error('Error loading performance data:', apiError);
            setError(apiError.message);
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
    // ONTRACK & UNDERPERFORM LOGIC
    // Using centralized utilities
    // ============================================
    const isUnderperform = (p: PromotorData): boolean => {
        return checkUnderperform(p, timeGonePercent);
    };

    const getInputPercent = (p: PromotorData): number => {
        return calculateAchievement(p.total_input, p.target);
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

    const onTrackPromotors = useMemo(() => {
        if (!data) return [];
        return data.allPromotors.filter(p => !isUnderperform(p));
    }, [data, timeGonePercent]);

    const filteredUnderperform = useMemo(() => {
        if (selectedSator === 'all') return underperformPromotors;
        return underperformPromotors.filter(p => p.sator_id === selectedSator);
    }, [underperformPromotors, selectedSator]);

    const filteredOnTrack = useMemo(() => {
        if (selectedSator === 'all') return onTrackPromotors;
        return onTrackPromotors.filter(p => p.sator_id === selectedSator);
    }, [onTrackPromotors, selectedSator]);

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
                    subtitle="All Team • On Track • Underperform"
                    icon="👥"
                />

                <div className="p-3 space-y-3">

                    {/* Main Tabs: AllTeam / OnTrack / Underperform */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setMainTab('allteam')}
                            className={`flex-1 py-2.5 rounded-xl font-semibold text-xs transition-all ${mainTab === 'allteam'
                                ? 'bg-primary text-primary-foreground shadow-md'
                                : 'bg-card text-muted-foreground shadow-md hover:bg-muted'
                                }`}
                        >
                            <div className="flex items-center justify-center gap-1">
                                <span>👥</span>
                                <span>All Team</span>
                            </div>
                            <div className={`text-[10px] ${mainTab === 'allteam' ? 'text-primary-foreground/80' : 'text-primary'}`}>
                                {data?.allPromotors.length || 0}
                            </div>
                        </button>
                        <button
                            onClick={() => setMainTab('ontrack')}
                            className={`flex-1 py-2.5 rounded-xl font-semibold text-xs transition-all ${mainTab === 'ontrack'
                                ? 'bg-emerald-500 text-white shadow-md'
                                : 'bg-card text-muted-foreground shadow-md hover:bg-muted'
                                }`}
                        >
                            <div className="flex items-center justify-center gap-1">
                                <span>✅</span>
                                <span>On Track</span>
                            </div>
                            <div className={`text-[10px] ${mainTab === 'ontrack' ? 'text-white/80' : 'text-emerald-500'}`}>
                                {onTrackPromotors.length}
                            </div>
                        </button>
                        <button
                            onClick={() => setMainTab('underperform')}
                            className={`flex-1 py-2.5 rounded-xl font-semibold text-xs transition-all ${mainTab === 'underperform'
                                ? 'bg-destructive text-primary-foreground shadow-md'
                                : 'bg-card text-muted-foreground shadow-md hover:bg-muted'
                                }`}
                        >
                            <div className="flex items-center justify-center gap-1">
                                <span>📉</span>
                                <span>Underperform</span>
                            </div>
                            <div className={`text-[10px] ${mainTab === 'underperform' ? 'text-primary-foreground/80' : 'text-destructive'}`}>
                                {underperformPromotors.length}
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
                                <div className={`text-[10px] ${selectedSator === 'all' ? 'text-primary-foreground/80' : mainTab === 'underperform' ? 'text-destructive' : mainTab === 'ontrack' ? 'text-emerald-500' : 'text-primary'}`}>
                                    {mainTab === 'allteam' ? data.totals.total_input : mainTab === 'ontrack' ? onTrackPromotors.length : underperformPromotors.length}
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
                                        <div className={`text-[10px] ${selectedSator === sator.user_id ? 'text-primary-foreground/80' : mainTab === 'underperform' ? 'text-destructive' : mainTab === 'ontrack' ? 'text-emerald-500' : 'text-primary'}`}>
                                            {mainTab === 'allteam' ? sator.total_input : mainTab === 'ontrack' ? sator.promotors.filter(p => !isUnderperform(p)).length : underCount}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* ============================================ */}
                    {/* ALL TEAM TAB CONTENT */}
                    {/* ============================================ */}
                    {mainTab === 'allteam' && (
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
                                        <p className="text-primary-foreground/80 text-xs">Pencapaian</p>
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
                                    <div key={sator.user_id} className="bg-card rounded-xl shadow-md overflow-hidden border border-border">
                                        {/* SATOR Header */}
                                        <div className="bg-primary px-4 py-2.5 flex justify-between items-center">
                                            <span className="font-bold text-primary-foreground text-sm">{sator.name}</span>
                                            <span className="bg-white/20 text-primary-foreground px-2.5 py-0.5 rounded-full text-xs font-bold">
                                                {sator.total_input} input
                                            </span>
                                        </div>

                                        {/* Promotor Table */}
                                        {sator.promotors.length === 0 ? (
                                            <div className="p-4 text-center text-muted-foreground text-sm">
                                                Tidak ada promotor
                                            </div>
                                        ) : (
                                            <table className="w-full text-xs">
                                                <thead className="bg-muted/50 border-b border-border">
                                                    <tr>
                                                        <th className="py-2 pl-3 pr-2 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Nama</th>
                                                        <th className="px-1 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Input</th>
                                                        <th className="px-1 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">CLS</th>
                                                        <th className="px-1 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">PND</th>
                                                        <th className="px-1 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">REJ</th>
                                                        <th className="px-2 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">%</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-border">
                                                    {sator.promotors.map((p) => {
                                                        const pct = getInputPercent(p);
                                                        const isUnder = isUnderperform(p);
                                                        return (
                                                            <tr key={p.user_id} className={`transition-colors ${isUnder ? 'bg-red-500/5 hover:bg-red-500/10' : 'hover:bg-muted/30'}`}>
                                                                <td className="py-2.5 pl-3 pr-2">
                                                                    <div className="flex items-center gap-1.5">
                                                                        {isUnder && <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />}
                                                                        <div className="flex flex-col min-w-0">
                                                                            <span className="font-bold text-foreground truncate">{p.name.split(' ')[0]}</span>
                                                                            {p.target === 0 ? (
                                                                                <span className="text-[9px] text-amber-600 font-medium">⚠️ No Target</span>
                                                                            ) : (
                                                                                <span className="text-[9px] text-muted-foreground">Tgt: {p.target}</span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="px-1 py-2.5 text-center font-bold text-foreground">{p.total_input}</td>
                                                                <td className="px-1 py-2.5 text-center font-bold text-[11px] text-emerald-500">{p.total_closed}</td>
                                                                <td className="px-1 py-2.5 text-center font-bold text-[11px] text-amber-500">{p.total_pending}</td>
                                                                <td className="px-1 py-2.5 text-center font-bold text-[11px] text-red-500">{p.total_rejected}</td>
                                                                <td className="px-2 py-2.5 text-right">
                                                                    <div className={`font-black text-[11px] ${pct >= 100 ? 'text-emerald-500' : pct >= timeGonePercent ? 'text-amber-500' : 'text-red-500'}`}>{pct}%</div>
                                                                    {p.target > 0 && (
                                                                        <div className="mt-1 w-10 ml-auto bg-muted rounded-full h-1 overflow-hidden">
                                                                            <div className={`h-full rounded-full ${pct >= 100 ? 'bg-emerald-500' : pct >= timeGonePercent ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                                                                        </div>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                ))
                            )}
                        </>
                    )}

                    {/* ============================================ */}
                    {/* ON TRACK TAB CONTENT */}
                    {/* ============================================ */}
                    {mainTab === 'ontrack' && (
                        <>
                            {/* Time Gone Card */}
                            <div className="bg-emerald-500 rounded-xl p-4 shadow-md">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-white/80 text-sm">TIME GONE</span>
                                    <span className="text-3xl font-bold text-white">{timeGonePercent}%</span>
                                </div>
                                <div className="w-full bg-white/30 rounded-full h-2 overflow-hidden">
                                    <div className="bg-white h-full rounded-full" style={{ width: `${timeGonePercent}%` }}></div>
                                </div>
                                <div className="mt-3 flex justify-end">
                                    <span className="bg-white/20 px-3 py-1 rounded-full text-white text-sm font-bold">
                                        {filteredOnTrack.length} On Track
                                    </span>
                                </div>
                            </div>

                            {/* OnTrack Promotor Table */}
                            {filteredOnTrack.length === 0 ? (
                                <div className="bg-card rounded-xl shadow-md p-8 text-center">
                                    <div className="text-5xl mb-3">😔</div>
                                    <h3 className="text-lg font-bold text-red-600 mb-1">Semua Underperform!</h3>
                                    <p className="text-sm text-muted-foreground">Belum ada promotor yang mencapai target. Semangat!</p>
                                </div>
                            ) : (
                                <div className="bg-card rounded-xl shadow-md overflow-hidden border border-border">
                                    <table className="w-full text-xs">
                                        <thead className="bg-emerald-500">
                                            <tr>
                                                <th className="py-2.5 pl-3 pr-2 text-left text-[10px] font-bold uppercase tracking-wider text-white">Promotor</th>
                                                <th className="px-1.5 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-white/80">Input</th>
                                                <th className="px-1 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-white/80">CLS</th>
                                                <th className="px-1 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-white/80">PND</th>
                                                <th className="px-1 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-white/80">REJ</th>
                                                <th className="px-2 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-white/80">%</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {filteredOnTrack.map((p) => {
                                                const pct = getInputPercent(p);
                                                return (
                                                    <tr key={p.user_id} className="transition-colors hover:bg-muted/30">
                                                        <td className="py-2.5 pl-3 pr-2">
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="font-bold text-foreground truncate">{p.name.split(' ')[0]}</span>
                                                                {p.target === 0 ? (
                                                                    <span className="text-[9px] text-amber-600 font-medium">⚠️ No Target</span>
                                                                ) : (
                                                                    <span className="text-[9px] text-muted-foreground">Target: {p.target}</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-1.5 py-2.5 text-center font-bold text-foreground">{p.total_input}</td>
                                                        <td className="px-1 py-2.5 text-center font-bold text-[11px] text-emerald-500">{p.total_closed}</td>
                                                        <td className="px-1 py-2.5 text-center font-bold text-[11px] text-amber-500">{p.total_pending}</td>
                                                        <td className="px-1 py-2.5 text-center font-bold text-[11px] text-red-500">{p.total_rejected}</td>
                                                        <td className="px-2 py-2.5 text-right">
                                                            <div className={`font-black text-[11px] ${pct >= 100 ? 'text-emerald-500' : pct >= timeGonePercent ? 'text-amber-500' : 'text-red-500'}`}>{pct}%</div>
                                                            {p.target > 0 && (
                                                                <div className="mt-1 w-10 ml-auto bg-muted rounded-full h-1 overflow-hidden">
                                                                    <div className={`h-full rounded-full ${pct >= 100 ? 'bg-emerald-500' : pct >= timeGonePercent ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
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
                                <div className="mt-3 flex justify-end">
                                    <span className="bg-card/20 px-3 py-1 rounded-full text-primary-foreground text-sm font-bold">
                                        {filteredUnderperform.length} Underperform
                                    </span>
                                </div>
                            </div>

                            {/* Underperform Promotor Table */}
                            {filteredUnderperform.length === 0 ? (
                                <div className="bg-card rounded-xl shadow-md p-8 text-center">
                                    <div className="text-5xl mb-3">🎉</div>
                                    <h3 className="text-lg font-bold text-emerald-600 mb-1">Semua On Track! 🎉</h3>
                                    <p className="text-sm text-muted-foreground">Tidak ada promotor yang underperform saat ini</p>
                                </div>
                            ) : (
                                <div className="bg-card rounded-xl shadow-md overflow-hidden border border-border">
                                    <table className="w-full text-xs">
                                        <thead className="bg-red-500">
                                            <tr>
                                                <th className="py-2.5 pl-3 pr-2 text-left text-[10px] font-bold uppercase tracking-wider text-white">Promotor</th>
                                                <th className="px-1.5 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-white/80">Input</th>
                                                <th className="px-1.5 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-white/80">GAP</th>
                                                <th className="px-2 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-white/80">%</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {filteredUnderperform.map((p) => {
                                                const pct = getInputPercent(p);
                                                const gap = Math.max(0, (p.target || 0) - p.total_input);
                                                return (
                                                    <tr key={p.user_id} className="bg-red-500/5 hover:bg-red-500/10 transition-colors">
                                                        <td className="py-2.5 pl-3 pr-2">
                                                            <div className="flex items-center gap-1.5">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                                                                <div className="flex flex-col min-w-0">
                                                                    <span className="font-bold text-foreground truncate">{p.name.split(' ')[0]}</span>
                                                                    {p.target === 0 ? (
                                                                        <span className="text-[9px] text-amber-600 font-medium">⚠️ No Target</span>
                                                                    ) : (
                                                                        <span className="text-[9px] text-muted-foreground">Target: {p.target}</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-1.5 py-2.5 text-center font-bold text-foreground">{p.total_input}</td>
                                                        <td className="px-1.5 py-2.5 text-center">
                                                            <div className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black ${gap >= 10 ? 'bg-red-500 text-white' : 'bg-red-100 text-red-600'}`}>
                                                                -{gap}
                                                            </div>
                                                        </td>
                                                        <td className="px-2 py-2.5 text-right">
                                                            <div className="font-black text-[11px] text-red-500">{pct}%</div>
                                                            {p.target > 0 && (
                                                                <div className="mt-1 w-10 ml-auto bg-muted rounded-full h-1 overflow-hidden">
                                                                    <div className="h-full rounded-full bg-red-500" style={{ width: `${Math.min(pct, 100)}%` }} />
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </>
                    )}

                </div>
            </div>
        </DashboardLayout>
    );
}
