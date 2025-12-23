'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { ProfileSidebar } from '@/components/ProfileSidebar';
import { Loading } from '@/components/ui/loading';
import { Alert } from '@/components/ui/alert';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, ChevronRight, AlertTriangle, User, TrendingDown, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Member {
    user_id: string;
    name: string;
    role: string;
    total_input: number;
    total_pending: number;
    total_rejected: number;
    total_closed: number;
    target: number;
    area?: string;
    spv_name?: string;
    sator_name?: string;
}

type TabLevel = 'area' | 'sator' | 'promotor';
type ViewMode = 'all' | 'underperform';

export default function ManagerPerformancePage() {
    const { user } = useAuth();
    const [viewMode, setViewMode] = useState<ViewMode>('all');
    const [activeTab, setActiveTab] = useState<TabLevel>('area');
    const [areas, setAreas] = useState<Member[]>([]);
    const [sators, setSators] = useState<Member[]>([]);
    const [promotors, setPromotors] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const [selectedArea, setSelectedArea] = useState<Member | null>(null);
    const [selectedSator, setSelectedSator] = useState<Member | null>(null);

    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const currentDay = now.getDate();
    const timeGonePercent = Math.round((currentDay / daysInMonth) * 100);
    const todayFormatted = now.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

    // Get user initials
    const getInitials = (name: string) => name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'U';

    // Get first name only for table display
    const getFirstName = (name: string) => name?.split(' ')[0] || name;

    useEffect(() => {
        if (user) fetchData();
    }, [user]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const supabase = createClient();
            const { data, error: fnError } = await supabase.functions.invoke('dashboard-manager');

            if (fnError) throw fnError;

            setAreas(data?.areas || []);
            setSators(data?.sators || []);
            setPromotors(data?.promotors || []);
        } catch (err) {
            console.error(err);
            setError('Gagal memuat data');
        } finally {
            setLoading(false);
        }
    };

    const isUnderperform = (m: Member): boolean => {
        const t = m.target || 0;
        const i = m.total_input || 0;
        if (t === 0) return i === 0;
        return (i / t) * 100 < timeGonePercent;
    };

    const handleAreaClick = (area: Member) => {
        setSelectedArea(area);
        setSelectedSator(null);
        setActiveTab('sator');
    };

    const handleSatorClick = (sator: Member) => {
        setSelectedSator(sator);
        setActiveTab('promotor');
    };

    // Count underperformers
    const underAreaCount = areas.filter(isUnderperform).length;
    const underSatorCount = sators.filter(isUnderperform).length;
    const underPromotorCount = promotors.filter(isUnderperform).length;
    const totalUnderCount = underAreaCount + underSatorCount + underPromotorCount;

    // Filter data based on viewMode and selections
    const getFilteredData = () => {
        let areaData = areas;
        let satorData = sators;
        let promotorData = promotors;

        // Apply underperform filter if needed
        if (viewMode === 'underperform') {
            areaData = areas.filter(isUnderperform);
            satorData = sators.filter(isUnderperform);
            promotorData = promotors.filter(isUnderperform);
        }

        // Apply drill-down filters
        if (selectedArea) {
            satorData = satorData.filter(s => s.area === selectedArea.name);
            promotorData = promotorData.filter(p => p.area === selectedArea.name);
        }
        if (selectedSator) {
            promotorData = promotorData.filter(p => p.sator_name === selectedSator.name);
        }

        return { areaData, satorData, promotorData };
    };

    const { areaData, satorData, promotorData } = getFilteredData();
    const currentData = activeTab === 'area' ? areaData : activeTab === 'sator' ? satorData : promotorData;

    const getPercentColor = (pct: number) => {
        if (pct >= 80) return 'text-emerald-500';
        if (pct >= 50) return 'text-primary';
        return 'text-red-500';
    };

    if (loading) return <DashboardLayout><Loading message="Memuat data..." /></DashboardLayout>;
    if (error) return <DashboardLayout><Alert type="error" message={error} /></DashboardLayout>;

    return (
        <DashboardLayout allowedRoles={['manager']}>
            <div className="min-h-screen bg-background flex flex-col">
                {/* TopAppBar */}
                <div className="sticky top-0 z-30 bg-background border-b border-border">
                    <div className="flex items-center p-4 justify-between">
                        <button
                            onClick={() => window.history.back()}
                            className="flex items-center justify-center h-10 w-10 rounded-full hover:bg-muted transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <h2 className="text-foreground text-base font-bold flex-1 text-center">Tim Performance</h2>
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm"
                        >
                            {user?.name ? getInitials(user.name) : <User className="w-5 h-5" />}
                        </button>
                    </div>
                </div>

                {/* Master View Mode Tabs */}
                <div className="px-4 pt-4 pb-2">
                    <div className="flex w-full rounded-xl bg-muted p-1.5 gap-1">
                        <button
                            onClick={() => { setViewMode('all'); setSelectedArea(null); setSelectedSator(null); setActiveTab('area'); }}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all",
                                viewMode === 'all' ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <Users className="w-4 h-4" />
                            All Data
                        </button>
                        <button
                            onClick={() => { setViewMode('underperform'); setSelectedArea(null); setSelectedSator(null); setActiveTab('area'); }}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all",
                                viewMode === 'underperform' ? "bg-red-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <TrendingDown className="w-4 h-4" />
                            Underperform
                            {totalUnderCount > 0 && (
                                <span className={cn(
                                    "px-1.5 py-0.5 rounded-full text-xs font-bold",
                                    viewMode === 'underperform' ? "bg-white/20 text-white" : "bg-red-500/20 text-red-500"
                                )}>
                                    {totalUnderCount}
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                {/* Underperform Quick Stats (only shown in underperform mode) */}
                {viewMode === 'underperform' && (
                    <div className="flex gap-3 overflow-x-auto px-4 py-2">
                        <div className="flex min-w-[90px] flex-col gap-0.5 rounded-xl p-3 bg-card border border-border shadow-sm">
                            <p className="text-muted-foreground text-[10px] font-bold uppercase">Area</p>
                            <p className="text-foreground text-xl font-bold">{underAreaCount}</p>
                        </div>
                        <div className="flex min-w-[90px] flex-col gap-0.5 rounded-xl p-3 bg-card border border-border shadow-sm">
                            <p className="text-muted-foreground text-[10px] font-bold uppercase">Sator</p>
                            <p className="text-foreground text-xl font-bold">{underSatorCount}</p>
                        </div>
                        <div className="flex min-w-[90px] flex-col gap-0.5 rounded-xl p-3 bg-card border border-border shadow-sm">
                            <p className="text-muted-foreground text-[10px] font-bold uppercase">Promotor</p>
                            <p className="text-foreground text-xl font-bold">{underPromotorCount}</p>
                        </div>
                    </div>
                )}

                {/* Breadcrumbs (only shown when drilling down) */}
                {(selectedArea || selectedSator) && (
                    <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto border-b border-border">
                        <button
                            onClick={() => { setSelectedArea(null); setSelectedSator(null); setActiveTab('area'); }}
                            className="flex h-7 items-center justify-center rounded-full px-3 text-xs font-medium bg-card text-muted-foreground hover:bg-muted shrink-0"
                        >
                            All
                        </button>
                        {selectedArea && (
                            <>
                                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                                <button
                                    onClick={() => { setSelectedSator(null); setActiveTab('sator'); }}
                                    className={cn(
                                        "flex h-7 items-center justify-center rounded-full px-3 text-xs font-medium shrink-0",
                                        !selectedSator ? "bg-primary/20 text-primary border border-primary/30" : "bg-card text-muted-foreground hover:bg-muted"
                                    )}
                                >
                                    {selectedArea.name}
                                </button>
                            </>
                        )}
                        {selectedSator && (
                            <>
                                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                                <span className="flex h-7 items-center justify-center rounded-full bg-primary/20 text-primary border border-primary/30 px-3 text-xs font-medium shrink-0">
                                    {getFirstName(selectedSator.name)}
                                </span>
                            </>
                        )}
                    </div>
                )}

                {/* Level Filter Tabs */}
                <div className="px-4 py-3">
                    <div className="flex h-9 w-full items-center justify-center rounded-lg bg-muted p-1">
                        {['area', 'sator', 'promotor'].map((tab) => (
                            <label key={tab} className="flex-1 cursor-pointer h-full">
                                <input
                                    type="radio"
                                    name="view_level"
                                    value={tab}
                                    checked={activeTab === tab}
                                    onChange={() => {
                                        if (tab === 'area') { setSelectedArea(null); setSelectedSator(null); }
                                        setActiveTab(tab as TabLevel);
                                    }}
                                    className="sr-only"
                                />
                                <div className={cn(
                                    "flex items-center justify-center h-full rounded-md text-xs font-bold uppercase tracking-wide transition-all",
                                    activeTab === tab ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                                )}>
                                    {tab}
                                </div>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Performance Table */}
                <div className="flex-1 overflow-x-auto px-4 pb-24">
                    {currentData.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-4 text-center bg-card rounded-xl border border-border">
                            <div className={cn("p-6 rounded-full", viewMode === 'underperform' ? "bg-emerald-500/10" : "bg-muted")}>
                                <span className="text-4xl">{viewMode === 'underperform' ? '🎉' : '📭'}</span>
                            </div>
                            <div>
                                <h3 className="text-lg font-bold">{viewMode === 'underperform' ? 'All Clear!' : 'Tidak ada data'}</h3>
                                <p className="text-muted-foreground text-sm">
                                    {viewMode === 'underperform' ? 'Tidak ada yang underperform!' : 'Data belum tersedia'}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
                            <table className="w-full text-xs">
                                <thead className="bg-muted/50">
                                    <tr>
                                        <th className="sticky left-0 z-10 bg-muted/50 py-2 pl-3 pr-2 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border">
                                            Nama
                                        </th>
                                        <th className="whitespace-nowrap px-1.5 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border">TGT</th>
                                        <th className="whitespace-nowrap px-1.5 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border">INP</th>
                                        <th className="whitespace-nowrap px-1.5 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border">%</th>
                                        {viewMode === 'underperform' && (
                                            <th className="whitespace-nowrap px-1.5 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border">GAP</th>
                                        )}
                                        {viewMode === 'all' && (
                                            <>
                                                <th className="whitespace-nowrap px-1.5 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border">CLS</th>
                                                <th className="whitespace-nowrap px-1.5 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border">PND</th>
                                            </>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {currentData.map((m, i) => {
                                        const pct = m.target > 0 ? Math.round((m.total_input / m.target) * 100) : 0;
                                        const gap = m.target - m.total_input;
                                        const under = isUnderperform(m);
                                        return (
                                            <tr
                                                key={i}
                                                className={cn(
                                                    "group cursor-pointer transition-colors",
                                                    under ? "bg-red-500/10 hover:bg-red-500/15" : "hover:bg-muted/50"
                                                )}
                                                onClick={() => {
                                                    if (activeTab === 'area') handleAreaClick(m);
                                                    else if (activeTab === 'sator') handleSatorClick(m);
                                                }}
                                            >
                                                <td className="sticky left-0 z-10 bg-background py-2 pl-3 pr-2 font-medium text-xs group-hover:bg-muted/50">
                                                    <div className="flex items-center gap-1.5">
                                                        {under && <AlertTriangle className="w-3 h-3 text-red-500 shrink-0" />}
                                                        <span className="truncate">{getFirstName(m.name)}</span>
                                                    </div>
                                                </td>
                                                <td className="whitespace-nowrap px-1.5 py-2 text-right text-muted-foreground font-mono text-[11px]">{m.target || 0}</td>
                                                <td className="whitespace-nowrap px-1.5 py-2 text-right text-muted-foreground font-mono text-[11px]">{m.total_input}</td>
                                                <td className={cn("whitespace-nowrap px-1.5 py-2 text-right font-bold font-mono text-[11px]", getPercentColor(pct))}>{pct}%</td>
                                                {viewMode === 'underperform' && (
                                                    <td className="whitespace-nowrap px-1.5 py-2 text-right text-red-500 font-bold font-mono text-[11px]">-{gap}</td>
                                                )}
                                                {viewMode === 'all' && (
                                                    <>
                                                        <td className="whitespace-nowrap px-1.5 py-2 text-right text-muted-foreground font-mono text-[11px]">{m.total_closed}</td>
                                                        <td className="whitespace-nowrap px-1.5 py-2 text-right text-muted-foreground font-mono text-[11px]">{m.total_pending}</td>
                                                    </>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Footer hint */}
                    {currentData.length > 0 && (
                        <div className="mt-4 text-center">
                            <p className="text-xs text-muted-foreground">Tap baris untuk drill-down</p>
                        </div>
                    )}
                </div>

                {/* Profile Sidebar */}
                <ProfileSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            </div>
        </DashboardLayout>
    );
}
