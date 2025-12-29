'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { ProfileSidebar } from '@/components/ProfileSidebar';
import { Loading } from '@/components/ui/loading';
import { Alert } from '@/components/ui/alert';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, ChevronRight, AlertTriangle, User, TrendingDown, Users, Calendar, Check, X } from 'lucide-react';
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
type ViewMode = 'all' | 'ontrack' | 'underperform';

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
    const [showMonthPicker, setShowMonthPicker] = useState(false);

    const [selectedArea, setSelectedArea] = useState<Member | null>(null);
    const [selectedSator, setSelectedSator] = useState<Member | null>(null);

    // Month filter
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [selectedMonth, setSelectedMonth] = useState(currentMonth);

    // Generate last 3 months options
    const monthOptions = Array.from({ length: 3 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
        return { value, label };
    });

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
    }, [user, selectedMonth]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const supabase = createClient();
            const { data, error: fnError } = await supabase.functions.invoke('dashboard-manager', {
                body: { month: selectedMonth }
            });

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
        // Jika tidak ada input sama sekali = underperform
        if (m.total_input === 0) return true;
        // Jika ada target, cek pencapaian vs time gone
        if (m.target > 0) {
            return (m.total_input / m.target) * 100 < timeGonePercent;
        }
        // Jika tidak ada target tapi ada input = on track
        return false;
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

        // Apply filter based on viewMode
        if (viewMode === 'underperform') {
            areaData = areas.filter(isUnderperform);
            satorData = sators.filter(isUnderperform);
            promotorData = promotors.filter(isUnderperform);
        } else if (viewMode === 'ontrack') {
            areaData = areas.filter(m => !isUnderperform(m));
            satorData = sators.filter(m => !isUnderperform(m));
            promotorData = promotors.filter(m => !isUnderperform(m));
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

                {/* Month Filter - Custom Button */}
                <div className="px-4 pt-3 pb-1">
                    <button
                        onClick={() => setShowMonthPicker(true)}
                        className="w-full flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 shadow-sm"
                    >
                        <Calendar className="w-5 h-5 text-primary shrink-0" />
                        <span className="flex-1 text-left text-foreground text-sm font-bold">
                            {monthOptions.find(o => o.value === selectedMonth)?.label || 'Pilih Bulan'}
                        </span>
                        <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                </div>

                {/* Bottom Sheet Month Picker */}
                {showMonthPicker && (
                    <div className="fixed inset-0 z-50 flex items-end justify-center">
                        {/* Backdrop */}
                        <div
                            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                            onClick={() => setShowMonthPicker(false)}
                        />
                        {/* Sheet */}
                        <div className="relative w-full max-w-lg bg-card rounded-t-3xl p-5 pb-24 mb-16 animate-in slide-in-from-bottom duration-300">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-foreground">Pilih Bulan</h3>
                                <button
                                    onClick={() => setShowMonthPicker(false)}
                                    className="p-2 rounded-full hover:bg-muted"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="space-y-2">
                                {monthOptions.map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => {
                                            setSelectedMonth(opt.value);
                                            setShowMonthPicker(false);
                                        }}
                                        className={cn(
                                            "w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors",
                                            selectedMonth === opt.value
                                                ? "bg-primary text-primary-foreground"
                                                : "bg-muted hover:bg-muted/80 text-foreground"
                                        )}
                                    >
                                        <span className="font-medium">{opt.label}</span>
                                        {selectedMonth === opt.value && <Check className="w-5 h-5" />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Master View Mode Tabs */}
                <div className="px-4 pt-4 pb-2">
                    <div className="flex w-full rounded-xl bg-muted p-1.5 gap-1">
                        <button
                            onClick={() => { setViewMode('all'); setSelectedArea(null); setSelectedSator(null); setActiveTab('area'); }}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-1 rounded-lg py-2 text-xs font-semibold transition-all",
                                viewMode === 'all' ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <Users className="w-3.5 h-3.5" />
                            All
                        </button>
                        <button
                            onClick={() => { setViewMode('ontrack'); setSelectedArea(null); setSelectedSator(null); setActiveTab('area'); }}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-1 rounded-lg py-2 text-xs font-semibold transition-all",
                                viewMode === 'ontrack' ? "bg-emerald-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            ✅ Track
                            <span className={cn(
                                "px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                                viewMode === 'ontrack' ? "bg-white/20 text-white" : "bg-emerald-500/20 text-emerald-500"
                            )}>
                                {areas.filter(m => !isUnderperform(m)).length + sators.filter(m => !isUnderperform(m)).length + promotors.filter(m => !isUnderperform(m)).length}
                            </span>
                        </button>
                        <button
                            onClick={() => { setViewMode('underperform'); setSelectedArea(null); setSelectedSator(null); setActiveTab('area'); }}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-1 rounded-lg py-2 text-xs font-semibold transition-all",
                                viewMode === 'underperform' ? "bg-red-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <TrendingDown className="w-3.5 h-3.5" />
                            Under
                            {totalUnderCount > 0 && (
                                <span className={cn(
                                    "px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                                    viewMode === 'underperform' ? "bg-white/20 text-white" : "bg-red-500/20 text-red-500"
                                )}>
                                    {totalUnderCount}
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                {/* Quick Stats Cards - tampil di kedua mode */}
                <div className="flex gap-3 overflow-x-auto px-4 py-2">
                    <div className={cn(
                        "flex min-w-[90px] flex-col gap-0.5 rounded-xl p-3 border shadow-sm",
                        viewMode === 'underperform' ? "bg-red-50 border-red-200" : "bg-card border-border"
                    )}>
                        <p className="text-muted-foreground text-[10px] font-bold uppercase">Area</p>
                        <p className={cn("text-xl font-bold", viewMode === 'underperform' ? "text-red-600" : "text-foreground")}>
                            {viewMode === 'underperform' ? underAreaCount : areas.length}
                        </p>
                    </div>
                    <div className={cn(
                        "flex min-w-[90px] flex-col gap-0.5 rounded-xl p-3 border shadow-sm",
                        viewMode === 'underperform' ? "bg-red-50 border-red-200" : "bg-card border-border"
                    )}>
                        <p className="text-muted-foreground text-[10px] font-bold uppercase">Sator</p>
                        <p className={cn("text-xl font-bold", viewMode === 'underperform' ? "text-red-600" : "text-foreground")}>
                            {viewMode === 'underperform' ? underSatorCount : sators.length}
                        </p>
                    </div>
                    <div className={cn(
                        "flex min-w-[90px] flex-col gap-0.5 rounded-xl p-3 border shadow-sm",
                        viewMode === 'underperform' ? "bg-red-50 border-red-200" : "bg-card border-border"
                    )}>
                        <p className="text-muted-foreground text-[10px] font-bold uppercase">Promotor</p>
                        <p className={cn("text-xl font-bold", viewMode === 'underperform' ? "text-red-600" : "text-foreground")}>
                            {viewMode === 'underperform' ? underPromotorCount : promotors.length}
                        </p>
                    </div>
                </div>

                {/* Breadcrumbs / Drill-down Path */}
                {(selectedArea || selectedSator) && (
                    <div className="flex items-center gap-1.5 px-4 py-2 overflow-x-auto bg-muted/30 border-b border-border no-scrollbar mt-1">
                        <button
                            onClick={() => { setSelectedArea(null); setSelectedSator(null); setActiveTab('area'); }}
                            className="bg-background border border-border px-2.5 py-1 rounded-lg text-[10px] font-bold text-muted-foreground hover:text-primary transition-colors uppercase"
                        >
                            TIM
                        </button>

                        {selectedArea && (
                            <>
                                <ChevronRight className="w-3 h-3 text-muted-foreground" />
                                <button
                                    onClick={() => { setSelectedSator(null); setActiveTab('sator'); }}
                                    className={cn(
                                        "bg-background border px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-colors max-w-[100px] truncate",
                                        !selectedSator ? "border-primary/30 text-primary bg-primary/5" : "border-border text-muted-foreground hover:text-primary"
                                    )}
                                >
                                    {selectedArea.name}
                                </button>
                            </>
                        )}

                        {selectedSator && (
                            <>
                                <ChevronRight className="w-3 h-3 text-muted-foreground" />
                                <div className="bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-lg text-[10px] font-bold text-primary uppercase max-w-[100px] truncate">
                                    {selectedSator.name}
                                </div>
                            </>
                        )}

                        <button
                            onClick={() => { setSelectedArea(null); setSelectedSator(null); setActiveTab('area'); }}
                            className="ml-auto p-1 text-muted-foreground hover:text-destructive transition-colors"
                            title="Reset All Filters"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}

                {/* Level Filter Tabs */}
                <div className="px-4 py-3">
                    <div className="flex h-10 w-full items-center justify-center rounded-xl bg-muted p-1.5 gap-1">
                        {[
                            { key: 'area', label: 'AREA' },
                            { key: 'sator', label: 'SATOR' },
                            { key: 'promotor', label: 'PROMOTOR' }
                        ].map((tab) => (
                            <label key={tab.key} className="flex-1 cursor-pointer h-full">
                                <input
                                    type="radio"
                                    name="view_level"
                                    value={tab.key}
                                    checked={activeTab === tab.key}
                                    onChange={() => {
                                        if (tab.key === 'area') { setSelectedArea(null); setSelectedSator(null); }
                                        setActiveTab(tab.key as TabLevel);
                                    }}
                                    className="sr-only"
                                />
                                <div className={cn(
                                    "flex items-center justify-center h-full rounded-lg text-xs font-bold tracking-wide transition-all",
                                    activeTab === tab.key ? "bg-card text-foreground shadow-md" : "text-muted-foreground hover:text-foreground"
                                )}>
                                    {tab.label}
                                </div>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Performance Table */}
                <div className="flex-1 overflow-x-auto px-4 pb-24">
                    {currentData.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-4 text-center bg-card rounded-xl border border-border">
                            <div className={cn(
                                "p-6 rounded-full",
                                viewMode === 'underperform' ? "bg-emerald-500/10" :
                                    viewMode === 'ontrack' ? "bg-red-500/10" : "bg-muted"
                            )}>
                                <span className="text-4xl">
                                    {viewMode === 'underperform' ? '🎉' : viewMode === 'ontrack' ? '😔' : '📭'}
                                </span>
                            </div>
                            <div>
                                <h3 className={cn(
                                    "text-lg font-bold",
                                    viewMode === 'underperform' ? "text-emerald-600" :
                                        viewMode === 'ontrack' ? "text-red-600" : "text-foreground"
                                )}>
                                    {viewMode === 'underperform' ? 'Semua On Track! 🎉' :
                                        viewMode === 'ontrack' ? 'Semua Underperform!' :
                                            'Tidak ada data'}
                                </h3>
                                <p className="text-muted-foreground text-sm mt-1">
                                    {viewMode === 'underperform' ? 'Tidak ada tim yang underperform saat ini' :
                                        viewMode === 'ontrack' ? 'Belum ada tim yang mencapai target. Semangat!' :
                                            'Data belum tersedia untuk periode ini'}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
                            <table className="w-full text-xs">
                                <thead className="bg-muted/50 border-b border-border">
                                    <tr>
                                        <th className="sticky left-0 z-10 bg-muted/50 py-3 pl-4 pr-2 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                                            Area
                                        </th>
                                        <th className="px-2 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pencapaian</th>
                                        {viewMode === 'underperform' ? (
                                            <th className="px-1.5 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">GAP</th>
                                        ) : (
                                            <>
                                                <th className="px-1 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">CLS</th>
                                                <th className="px-1 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">PND</th>
                                                <th className="px-1 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">REJ</th>
                                            </>
                                        )}
                                        <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">%</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {[...currentData]
                                        .sort((a, b) => {
                                            if (viewMode === 'underperform') return (b.target - b.total_input) - (a.target - a.total_input);
                                            return b.total_input - a.total_input;
                                        })
                                        .map((m, i) => {
                                            const pct = m.target > 0 ? Math.round((m.total_input / m.target) * 100) : 0;
                                            const gap = Math.max(0, m.target - m.total_input);
                                            const under = isUnderperform(m);

                                            return (
                                                <tr
                                                    key={i}
                                                    className={cn(
                                                        "group cursor-pointer transition-colors",
                                                        under && viewMode === 'underperform' ? "bg-red-500/5 hover:bg-red-500/10" : "hover:bg-muted/30"
                                                    )}
                                                    onClick={() => {
                                                        if (activeTab === 'area') handleAreaClick(m);
                                                        else if (activeTab === 'sator') handleSatorClick(m);
                                                    }}
                                                >
                                                    <td className="sticky left-0 z-10 bg-background group-hover:bg-muted/10 py-3 pl-4 pr-2">
                                                        <div className="flex items-center gap-2">
                                                            {under && viewMode === 'underperform' && <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />}
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="font-bold text-foreground truncate">{getFirstName(m.name)}</span>
                                                                {(activeTab === 'sator' || activeTab === 'promotor') && (
                                                                    <span className="text-[9px] text-muted-foreground font-bold uppercase truncate">{m.area || m.sator_name}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-2 py-3 text-center">
                                                        <div className="font-bold text-foreground">{m.total_input}</div>
                                                        <div className="text-[9px] text-muted-foreground">dari {m.target || 0}</div>
                                                    </td>
                                                    {viewMode === 'underperform' ? (
                                                        <td className="px-1.5 py-3 text-center">
                                                            <div className={cn(
                                                                "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black",
                                                                gap >= 10 ? "bg-red-500 text-white" : "bg-red-100 text-red-600"
                                                            )}>
                                                                -{gap}
                                                            </div>
                                                        </td>
                                                    ) : (
                                                        <>
                                                            <td className="px-1 py-3 text-center font-bold text-[11px] text-emerald-500">{m.total_closed}</td>
                                                            <td className="px-1 py-3 text-center font-bold text-[11px] text-amber-500">{m.total_pending}</td>
                                                            <td className="px-1 py-3 text-center font-bold text-[11px] text-red-500">{m.total_rejected}</td>
                                                        </>
                                                    )}
                                                    <td className="px-4 py-3 text-right">
                                                        <div className={cn("font-black text-[11px]", getPercentColor(pct))}>{pct}%</div>
                                                        <div className="mt-1 w-12 ml-auto bg-muted rounded-full h-1 overflow-hidden">
                                                            <div
                                                                className={cn("h-full rounded-full transition-all", pct >= 100 ? 'bg-emerald-500' : pct >= timeGonePercent ? 'bg-amber-500' : 'bg-red-500')}
                                                                style={{ width: `${Math.min(pct, 100)}%` }}
                                                            />
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                </tbody>
                            </table>
                        </div>
                    )}


                </div>

                {/* Profile Sidebar */}
                <ProfileSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            </div>
        </DashboardLayout>
    );
}
