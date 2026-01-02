'use client';

import { useEffect, useState, useRef, Fragment } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { ProfileSidebar } from '@/components/ProfileSidebar';
import { Loading } from '@/components/ui/loading';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Download, FileSpreadsheet, Image, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';

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
    sator_name?: string;
    // Daily data
    daily_input?: number;
    daily_closed?: number;
    daily_pending?: number;
    daily_rejected?: number;
}

interface StoreData {
    store_id: string;
    store_name: string;
    store_code: string;
    target: number;
    total_input: number;
    total_closed: number;
    total_pending: number;
    total_rejected: number;
    // Daily data
    daily_input?: number;
    daily_closed?: number;
    daily_pending?: number;
    daily_rejected?: number;
    promotors?: {
        user_id: string;
        name: string;
        target?: number;
        total_input: number;
        total_closed: number;
        total_pending: number;
        total_rejected: number;
        daily_input?: number;
        daily_closed?: number;
        daily_pending?: number;
        daily_rejected?: number;
    }[];
}

// Interface untuk daily data dari dashboard-manager-daily
interface DailyPromotor {
    user_id: string;
    name: string;
    total_input: number;
    total_closed: number;
    total_pending: number;
    total_rejected: number;
}

interface DailySator {
    user_id: string;
    name: string;
    total_input: number;
    total_closed: number;
    total_pending: number;
    total_rejected: number;
    promotors: DailyPromotor[];
}

interface DailyArea {
    user_id: string;
    area_name: string;
    spv_name: string;
    total_input: number;
    total_closed: number;
    total_pending: number;
    total_rejected: number;
    sators: DailySator[];
}

export default function ManagerExportPage() {
    const { user } = useAuth();
    const [areas, setAreas] = useState<Member[]>([]);
    const [sators, setSators] = useState<Member[]>([]);
    const [promotors, setPromotors] = useState<Member[]>([]);
    const [spcStores, setSpcStores] = useState<StoreData[]>([]);
    const [spcTotals, setSpcTotals] = useState({ input: 0, closed: 0, pending: 0, rejected: 0, target: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Refs for PNG Export
    const areaTableRef = useRef<HTMLDivElement>(null);
    const satorTableRef = useRef<HTMLDivElement>(null);
    const promotorTableRef = useRef<HTMLDivElement>(null);
    const spcTableRef = useRef<HTMLDivElement>(null);

    // Export Options State
    const [includePerformance, setIncludePerformance] = useState(false);
    const [includeUnderperform, setIncludeUnderperform] = useState(false);
    const [includeSpcData, setIncludeSpcData] = useState(false);
    const [exportFormat, setExportFormat] = useState<'excel' | 'png'>('excel');

    // Time Gone & Month Selection
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);

    const selectedDate = new Date(`${selectedMonth}-01`);
    const isCurrentMonth = selectedMonth === currentMonthStr;
    const daysInSelectedMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();
    const dayProgress = isCurrentMonth ? now.getDate() : daysInSelectedMonth;
    const timeGonePercent = Math.round((dayProgress / daysInSelectedMonth) * 100);
    const periodLabel = selectedDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }).toUpperCase();

    const totalGlobalInput = areas.reduce((acc, a) => acc + (a.total_input || 0), 0);

    const getInitials = (name: string) => name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'U';

    useEffect(() => {
        if (user) fetchData();
    }, [user, selectedMonth]);

    const isUnderperform = (m: Member | StoreData): boolean => {
        const t = m.target || 0;
        const i = m.total_input || 0;
        if (t === 0) return i === 0;
        return (i / t) * 100 < timeGonePercent;
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const supabase = createClient();

            // Fetch manager area data (monthly) dan daily data secara paralel
            const [monthlyResponse, dailyResponse] = await Promise.all([
                supabase.functions.invoke('dashboard-manager', {
                    body: { userId: user?.id, month: selectedMonth }
                }),
                supabase.functions.invoke('dashboard-manager-daily', {
                    body: { userId: user?.id, date: mayUseDaily(selectedMonth) ? undefined : `${selectedMonth}-01` }
                })
            ]);

            if (monthlyResponse.error) throw monthlyResponse.error;

            const monthlyData = monthlyResponse.data;
            const dailyData = dailyResponse.data;

            // Build daily data maps
            const dailyAreaMap = new Map<string, DailyArea>();
            const dailySatorMap = new Map<string, { total_input: number; total_closed: number; total_pending: number; total_rejected: number }>();
            const dailyPromotorMap = new Map<string, { total_input: number; total_closed: number; total_pending: number; total_rejected: number }>();

            if (dailyData?.areas) {
                (dailyData.areas as DailyArea[]).forEach((area: DailyArea) => {
                    dailyAreaMap.set(area.user_id, area);
                    area.sators?.forEach((sator: DailySator) => {
                        dailySatorMap.set(sator.user_id, {
                            total_input: sator.total_input,
                            total_closed: sator.total_closed,
                            total_pending: sator.total_pending,
                            total_rejected: sator.total_rejected
                        });
                        sator.promotors?.forEach((promotor: DailyPromotor) => {
                            dailyPromotorMap.set(promotor.user_id, {
                                total_input: promotor.total_input,
                                total_closed: promotor.total_closed,
                                total_pending: promotor.total_pending,
                                total_rejected: promotor.total_rejected
                            });
                        });
                    });
                });
            }

            // Sync Monthly with Daily
            const areasWithDaily = (monthlyData?.areas || []).map((area: Member) => {
                const dailyArea = dailyAreaMap.get(area.user_id);
                return {
                    ...area,
                    daily_input: dailyArea?.total_input || 0,
                    daily_closed: dailyArea?.total_closed || 0,
                    daily_pending: dailyArea?.total_pending || 0,
                    daily_rejected: dailyArea?.total_rejected || 0
                };
            });

            const satorsWithDaily = (monthlyData?.sators || []).map((sator: Member) => {
                const dailySator = dailySatorMap.get(sator.user_id);
                return {
                    ...sator,
                    daily_input: dailySator?.total_input || 0,
                    daily_closed: dailySator?.total_closed || 0,
                    daily_pending: dailySator?.total_pending || 0,
                    daily_rejected: dailySator?.total_rejected || 0
                };
            });

            const promotorsWithDaily = (monthlyData?.promotors || []).map((promotor: Member) => {
                const dailyPromotor = dailyPromotorMap.get(promotor.user_id);
                return {
                    ...promotor,
                    daily_input: dailyPromotor?.total_input || 0,
                    daily_closed: dailyPromotor?.total_closed || 0,
                    daily_pending: dailyPromotor?.total_pending || 0,
                    daily_rejected: dailyPromotor?.total_rejected || 0
                };
            });

            setAreas(areasWithDaily);
            setSators(satorsWithDaily);
            setPromotors(promotorsWithDaily);

            // Fetch SPC Data
            const [spcMonthlyResponse, spcDailyResponse] = await Promise.all([
                supabase.functions.invoke('dashboard-spc-monthly', {
                    body: { userId: user?.id, month: selectedMonth }
                }),
                supabase.functions.invoke('dashboard-spc-daily', {
                    body: { userId: user?.id }
                })
            ]);

            const spcData = spcMonthlyResponse.data;
            const spcDaily = spcDailyResponse.data;

            const spcDailyMap = new Map<string, any>();
            if (spcDaily?.success && spcDaily?.stores) {
                spcDaily.stores.forEach((s: any) => spcDailyMap.set(s.store_id, s));
            }

            if (!spcMonthlyResponse.error && spcData?.success) {
                const stores = spcData.stores || [];
                const storesWithDaily = stores.map((store: any) => {
                    const daily = spcDailyMap.get(store.store_id);
                    const spcProms = (store.promotors || []).map((p: any) => ({
                        ...p,
                        daily_input: daily?.promotors?.find((dp: any) => dp.user_id === p.user_id)?.total_input || 0,
                        daily_closed: daily?.promotors?.find((dp: any) => dp.user_id === p.user_id)?.total_closed || 0,
                        daily_pending: daily?.promotors?.find((dp: any) => dp.user_id === p.user_id)?.total_pending || 0,
                        daily_rejected: daily?.promotors?.find((dp: any) => dp.user_id === p.user_id)?.total_rejected || 0
                    }));
                    return {
                        ...store,
                        daily_input: daily?.total_input || 0,
                        daily_closed: daily?.total_closed || 0,
                        daily_pending: daily?.total_pending || 0,
                        daily_rejected: daily?.total_rejected || 0,
                        promotors: spcProms
                    };
                });
                setSpcStores(storesWithDaily);
                setSpcTotals(spcData.totals || { input: 0, closed: 0, target: 0, pending: 0, rejected: 0 });
            }

        } catch (err) {
            console.error(err);
            setError('Gagal memuat data');
        } finally {
            setLoading(false);
        }
    };

    const mayUseDaily = (m: string) => {
        const d = new Date();
        const cm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        return m === cm;
    }

    const handleExport = async (forcedFormat: 'excel' | 'png', incPerf: boolean, incSpc: boolean, imgType?: 'area' | 'promotor' | 'spc') => {
        setExporting(true);
        try {
            if (forcedFormat === 'excel') {
                const wb = XLSX.utils.book_new();

                // 1. AREA SUMMARY
                if (incPerf) {
                    const areaSheet = areas.map(a => {
                        const pct = a.target > 0 ? Math.round((a.total_input / a.target) * 100) : 0;
                        return {
                            AREA: a.name,
                            MANAGER: a.role,
                            TARGET: a.target,
                            INPUT: a.total_input,
                            CAPAIAN: `${pct}%`,
                            CLOSING: a.total_closed,
                            PENDING: a.total_pending,
                            REJECT: a.total_rejected,
                        };
                    });
                    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(areaSheet), 'AREA_SUMMARY');

                    // 2. SATOR DETAIL
                    const satorSheet = sators.map(s => {
                        const pct = s.target > 0 ? Math.round((s.total_input / s.target) * 100) : 0;
                        return {
                            AREA: s.area,
                            SATOR: s.name,
                            TARGET: s.target,
                            INPUT: s.total_input,
                            CAPAIAN: `${pct}%`,
                            CLOSING: s.total_closed,
                            PENDING: s.total_pending,
                            REJECT: s.total_rejected,
                            STATUS: isUnderperform(s) ? 'UNDERPERFORM' : 'ON TRACK'
                        };
                    });
                    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(satorSheet), 'SATOR_DETAIL');

                    // 3. PROMOTOR LIST
                    const promotorSheet = promotors.map(p => {
                        const pct = p.target > 0 ? Math.round((p.total_input / p.target) * 100) : 0;
                        return {
                            AREA: p.area,
                            SATOR: p.sator_name,
                            PROMOTOR: p.name,
                            TARGET: p.target,
                            INPUT: p.total_input,
                            CAPAIAN: `${pct}%`,
                            CLOSING: p.total_closed,
                            PENDING: p.total_pending,
                            REJECT: p.total_rejected
                        };
                    });
                    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(promotorSheet), 'PROMOTOR_LIST');
                }

                // 4. SPC DATA
                if (incSpc && spcStores.length > 0) {
                    const spcSheet = spcStores.map(s => ({
                        TOKO: s.store_name,
                        TARGET: s.target,
                        INPUT: s.total_input,
                        CLOSING: s.total_closed,
                        PENDING: s.total_pending,
                        REJECT: s.total_rejected,
                        JUMLAH_PROMOTOR: s.promotors?.length || 0
                    }));
                    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(spcSheet), 'SPC_STORES');
                }

                XLSX.writeFile(wb, `Laporan_Manager_${periodLabel.replace(/ /g, '_')}.xlsx`);
            }

            if (forcedFormat === 'png') {
                const downloadImage = async (ref: React.RefObject<HTMLDivElement | null>, filename: string) => {
                    if (!ref.current) return;
                    try {
                        const canvas = await html2canvas(ref.current, {
                            backgroundColor: '#ffffff',
                            scale: 2,
                            logging: false,
                            useCORS: true,
                            allowTaint: true
                        });
                        const link = document.createElement('a');
                        link.download = filename;
                        link.href = canvas.toDataURL('image/png');
                        link.click();
                        await new Promise(resolve => setTimeout(resolve, 800));
                    } catch (e) {
                        console.error("Error creating image:", e);
                    }
                };

                if (imgType === 'area') {
                    if (areaTableRef.current) await downloadImage(areaTableRef, `MGR_Area_Summary_${selectedMonth}.png`);
                    if (satorTableRef.current) await downloadImage(satorTableRef, `MGR_Sator_Detail_${selectedMonth}.png`);
                } else if (imgType === 'promotor') {
                    if (promotorTableRef.current) await downloadImage(promotorTableRef, `MGR_Promotor_List_${selectedMonth}.png`);
                } else if (imgType === 'spc') {
                    if (spcTableRef.current) await downloadImage(spcTableRef, `MGR_SPC_Data_${selectedMonth}.png`);
                }
            }
        } catch (error) {
            console.error(error);
            setError('Gagal export data');
        } finally {
            setExporting(false);
        }
    };

    if (loading) return (
        <DashboardLayout allowedRoles={['manager']}>
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
                <div className="text-muted-foreground font-medium animate-pulse">Memuat data manager...</div>
            </div>
        </DashboardLayout>
    );

    if (error) return (
        <DashboardLayout allowedRoles={['manager']}>
            <div className="p-8 text-center text-red-500 font-bold bg-red-50 rounded-xl m-8 border border-red-100">
                {error}
            </div>
        </DashboardLayout>
    );

    const hasSpcAccess = true; // Manager always has access

    return (
        <DashboardLayout allowedRoles={['manager']}>
            <div className="min-h-screen bg-background pb-32">
                {/* 1. Header Banner */}
                <div className="relative w-full bg-primary pb-12 pt-6 px-5 rounded-b-[2.5rem] shadow-xl overflow-hidden">
                    <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl" />
                    <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 bg-blue-400 opacity-10 rounded-full blur-2xl" />

                    <div className="relative z-10 flex items-center justify-between mb-8">
                        <button onClick={() => window.history.back()} className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all">
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <h2 className="text-white text-base font-bold uppercase tracking-widest">Download Center</h2>
                        <button onClick={() => setSidebarOpen(true)} className="h-10 w-10 rounded-full bg-white/20 border-2 border-white/20 flex items-center justify-center text-white font-bold text-sm">
                            {user?.name ? getInitials(user.name) : <User className="w-5 h-5" />}
                        </button>
                    </div>

                    <div className="relative z-10 text-white">
                        <h1 className="text-3xl font-black mb-1">Export Laporan</h1>
                        <p className="text-blue-100/80 text-sm font-medium">Tarik data kinerja tim periode {periodLabel}</p>
                    </div>
                </div>

                {/* 2. Content Container */}
                <div className="px-5 -mt-6 relative z-20 space-y-6">

                    {/* A. MONTH SELECTOR & STATS */}
                    <div className="bg-card rounded-2xl border border-border p-5 shadow-sm space-y-4 bg-white">
                        {/* Month Selector */}
                        <div className="flex items-center justify-between bg-muted/30 p-2 rounded-xl border border-border/50">
                            <button
                                onClick={() => {
                                    const d = new Date(`${selectedMonth}-01`);
                                    d.setMonth(d.getMonth() - 1);
                                    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                                }}
                                className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white hover:shadow-sm transition-all text-muted-foreground"
                            >
                                <span className="text-xl">◀</span>
                            </button>

                            <div className="text-center">
                                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">PERIODE LAPORAN</div>
                                <div className="text-lg font-black text-primary">{periodLabel}</div>
                            </div>

                            <button
                                onClick={() => {
                                    if (isCurrentMonth) return;
                                    const d = new Date(`${selectedMonth}-01`);
                                    d.setMonth(d.getMonth() + 1);
                                    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                                }}
                                disabled={isCurrentMonth}
                                className={cn(
                                    "w-10 h-10 flex items-center justify-center rounded-lg transition-all",
                                    isCurrentMonth ? "opacity-30 cursor-not-allowed" : "hover:bg-white hover:shadow-sm text-muted-foreground"
                                )}
                            >
                                <span className="text-xl">▶</span>
                            </button>
                        </div>

                        {/* Quick Stats Grid */}
                        <div className="grid grid-cols-4 gap-2">
                            <div className="bg-blue-50/50 p-2 rounded-xl border border-blue-100/50 text-center">
                                <div className="text-[9px] font-bold text-blue-600/70 uppercase">Total SPV</div>
                                <div className="text-lg font-black text-blue-700">{areas.length}</div>
                            </div>
                            <div className="bg-indigo-50/50 p-2 rounded-xl border border-indigo-100/50 text-center">
                                <div className="text-[9px] font-bold text-indigo-600/70 uppercase">Sator</div>
                                <div className="text-lg font-black text-indigo-700">{sators.length}</div>
                            </div>
                            <div className="bg-violet-50/50 p-2 rounded-xl border border-violet-100/50 text-center">
                                <div className="text-[9px] font-bold text-violet-600/70 uppercase">Promotor</div>
                                <div className="text-lg font-black text-violet-700">{promotors.length}</div>
                            </div>
                            <div className="bg-emerald-50/50 p-2 rounded-xl border border-emerald-100/50 text-center">
                                <div className="text-[9px] font-bold text-emerald-600/70 uppercase">Input</div>
                                <div className="text-lg font-black text-emerald-700">{totalGlobalInput}</div>
                            </div>
                        </div>
                    </div>

                    {/* B. ACTION BUTTONS */}
                    <div className="space-y-3 pb-32">
                        <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-2">Format Export</h3>

                        {/* 1. EXCEL FULL */}
                        <button
                            disabled={loading || exporting}
                            onClick={async () => {
                                setExportFormat('excel');
                                setIncludePerformance(true);
                                setIncludeUnderperform(true);
                                setIncludeSpcData(true);
                                handleExport('excel', true, true);
                            }}
                            className="w-full relative overflow-hidden group bg-[#107c41] hover:bg-[#0c6b37] text-white p-4 rounded-2xl shadow-lg shadow-emerald-900/10 transition-all border-b-4 border-[#095c2e] active:border-b-0 active:translate-y-1"
                        >
                            <div className="flex items-center justify-between relative z-10">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                                        <FileSpreadsheet className="w-6 h-6" />
                                    </div>
                                    <div className="text-left">
                                        <div className="font-black text-base">DOWNLOAD EXCEL</div>
                                        <div className="text-[10px] font-medium text-white/80">Laporan Lengkap (Area, Sator, Promotor, SPC)</div>
                                    </div>
                                </div>
                                <Download className="w-5 h-5 opacity-50 group-hover:opacity-100 transition-opacity" />
                            </div>
                        </button>

                        {/* 2. AREA SUMMARY IMAGE */}
                        <button
                            disabled={loading || exporting}
                            onClick={async () => {
                                setExportFormat('png');
                                setIncludePerformance(true);
                                handleExport('png', true, false, 'area');
                            }}
                            className="w-full bg-white hover:bg-slate-50 text-slate-800 p-4 rounded-2xl border-2 border-slate-200 shadow-sm transition-all flex items-center justify-between group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600">
                                    <Image className="w-5 h-5" />
                                </div>
                                <div className="text-left">
                                    <div className="font-bold text-sm">GAMBAR SUMMARY AREA</div>
                                    <div className="text-[10px] text-slate-500">Ringkasan Performa SPV & Sator</div>
                                </div>
                            </div>
                            <Download className="w-4 h-4 text-slate-400 group-hover:text-primary transition-colors" />
                        </button>

                        {/* 3. PROMOTOR IMAGE */}
                        <button
                            disabled={loading || exporting}
                            onClick={async () => {
                                setExportFormat('png');
                                setIncludePerformance(true);
                                handleExport('png', true, false, 'promotor');
                            }}
                            className="w-full bg-white hover:bg-slate-50 text-slate-800 p-4 rounded-2xl border-2 border-slate-200 shadow-sm transition-all flex items-center justify-between group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center text-violet-600">
                                    <Image className="w-5 h-5" />
                                </div>
                                <div className="text-left">
                                    <div className="font-bold text-sm">GAMBAR DETAIL PROMOTOR</div>
                                    <div className="text-[10px] text-slate-500">Daftar Lengkap Promotor</div>
                                </div>
                            </div>
                            <Download className="w-4 h-4 text-slate-400 group-hover:text-primary transition-colors" />
                        </button>

                        {/* 4. SPC IMAGE */}
                        {hasSpcAccess && (
                            <button
                                disabled={loading || exporting}
                                onClick={async () => {
                                    setExportFormat('png');
                                    setIncludeSpcData(true);
                                    handleExport('png', false, true, 'spc');
                                }}
                                className="w-full bg-white hover:bg-slate-50 text-slate-800 p-4 rounded-2xl border-2 border-slate-200 shadow-sm transition-all flex items-center justify-between group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600">
                                        <Image className="w-5 h-5" />
                                    </div>
                                    <div className="text-left">
                                        <div className="font-bold text-sm">GAMBAR SPC STORE</div>
                                        <div className="text-[10px] text-slate-500">Performa Toko & Promotor SPC</div>
                                    </div>
                                </div>
                                <Download className="w-4 h-4 text-slate-400 group-hover:text-primary transition-colors" />
                            </button>
                        )}
                    </div>
                </div>

                <ProfileSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            </div>

            {/* HIDDEN TEMPLATES FOR PNG EXPORT */}
            <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
                {/* 1. AREA & SATOR SUMMARY */}
                <div ref={areaTableRef} style={{ width: '800px', padding: '32px', backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }}>
                    <div style={{ borderBottom: '4px solid #1e293b', paddingBottom: '16px', marginBottom: '24px' }}>
                        <h1 style={{ fontSize: '32px', fontWeight: '900', color: '#1e293b', margin: 0, letterSpacing: '-0.5px' }}>LAPORAN MANAGER AREA</h1>
                        <p style={{ fontSize: '14px', color: '#64748b', margin: '8px 0 0 0', fontWeight: 'bold' }}>
                            {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} | Periode: {periodLabel}
                        </p>
                        <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0 0' }}>Data: {areas.length} SPV | {sators.length} Sator | {promotors.length} Promotor</p>
                    </div>

                    {/* SPV Table */}
                    <div style={{ marginBottom: '32px' }}>
                        <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#3b82f6', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ width: '6px', height: '24px', backgroundColor: '#3b82f6', display: 'block', borderRadius: '4px' }}></span>
                            PERFORMA SUPERVISOR (AREA)
                        </h2>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#1e293b', color: '#ffffff' }}>
                                    <th style={{ padding: '10px', textAlign: 'left' }}>AREA / SPV</th>
                                    <th style={{ padding: '10px', textAlign: 'center' }}>TARGET</th>
                                    <th style={{ padding: '10px', textAlign: 'center' }}>INPUT</th>
                                    <th style={{ padding: '10px', textAlign: 'center' }}>%</th>
                                    <th style={{ padding: '10px', textAlign: 'center' }}>CLO</th>
                                    <th style={{ padding: '10px', textAlign: 'center' }}>PND</th>
                                    <th style={{ padding: '10px', textAlign: 'center' }}>REJ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {areas.map((a, i) => {
                                    const pct = a.target > 0 ? Math.round((a.total_input / a.target) * 100) : 0;
                                    return (
                                        <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                            <td style={{ padding: '10px', fontWeight: 'bold' }}>{a.name}</td>
                                            <td style={{ padding: '10px', textAlign: 'center', color: '#64748b' }}>{a.target}</td>
                                            <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold', color: '#3b82f6' }}>{a.total_input}</td>
                                            <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold', color: pct >= timeGonePercent ? '#10b981' : '#ef4444' }}>{pct}%</td>
                                            <td style={{ padding: '10px', textAlign: 'center', color: '#10b981' }}>{a.total_closed}</td>
                                            <td style={{ padding: '10px', textAlign: 'center', color: '#f59e0b' }}>{a.total_pending}</td>
                                            <td style={{ padding: '10px', textAlign: 'center', color: '#ef4444' }}>{a.total_rejected}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 2. SATOR DETAIL */}
                <div ref={satorTableRef} style={{ width: '800px', padding: '32px', backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }}>
                    <div style={{ borderBottom: '4px solid #8b5cf6', paddingBottom: '16px', marginBottom: '24px' }}>
                        <h1 style={{ fontSize: '28px', fontWeight: '900', color: '#8b5cf6', margin: 0 }}>DETAIL SALES COORDINATOR (SATOR)</h1>
                        <p style={{ fontSize: '14px', color: '#64748b', margin: '8px 0 0 0' }}>Periode: {periodLabel}</p>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#5b21b6', color: '#ffffff' }}>
                                <th style={{ padding: '8px', textAlign: 'left' }}>NO</th>
                                <th style={{ padding: '8px', textAlign: 'left' }}>SATOR</th>
                                <th style={{ padding: '8px', textAlign: 'left' }}>AREA</th>
                                <th style={{ padding: '8px', textAlign: 'center' }}>TARGET</th>
                                <th style={{ padding: '8px', textAlign: 'center' }}>INPUT</th>
                                <th style={{ padding: '8px', textAlign: 'center' }}>%</th>
                                <th style={{ padding: '8px', textAlign: 'center' }}>CLO</th>
                                <th style={{ padding: '8px', textAlign: 'center' }}>PND</th>
                                <th style={{ padding: '8px', textAlign: 'center' }}>REJ</th>
                                <th style={{ padding: '8px', textAlign: 'center' }}>STATUS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sators.map((s, i) => {
                                const pct = s.target > 0 ? Math.round((s.total_input / s.target) * 100) : 0;
                                const isOk = pct >= timeGonePercent;
                                return (
                                    <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#f5f3ff', borderBottom: '1px solid #ddd6fe' }}>
                                        <td style={{ padding: '8px', textAlign: 'left', color: '#64748b' }}>{i + 1}</td>
                                        <td style={{ padding: '8px', fontWeight: 'bold' }}>{s.name}</td>
                                        <td style={{ padding: '8px', color: '#64748b' }}>{s.area}</td>
                                        <td style={{ padding: '8px', textAlign: 'center' }}>{s.target}</td>
                                        <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', color: '#7c3aed' }}>{s.total_input}</td>
                                        <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', color: isOk ? '#10b981' : '#ef4444' }}>{pct}%</td>
                                        <td style={{ padding: '8px', textAlign: 'center', color: '#10b981' }}>{s.total_closed}</td>
                                        <td style={{ padding: '8px', textAlign: 'center', color: '#f59e0b' }}>{s.total_pending}</td>
                                        <td style={{ padding: '8px', textAlign: 'center', color: '#ef4444' }}>{s.total_rejected}</td>
                                        <td style={{ padding: '8px', textAlign: 'center' }}>
                                            <span style={{
                                                padding: '2px 8px',
                                                borderRadius: '99px',
                                                fontSize: '10px',
                                                fontWeight: 'bold',
                                                backgroundColor: isOk ? '#dcfce7' : '#fee2e2',
                                                color: isOk ? '#166534' : '#991b1b'
                                            }}>
                                                {isOk ? 'ON TRACK' : 'UNDERPERFORM'}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* 3. PROMOTOR LIST */}
                <div ref={promotorTableRef} style={{ width: '800px', padding: '32px', backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }}>
                    <div style={{ borderBottom: '4px solid #ec4899', paddingBottom: '16px', marginBottom: '24px' }}>
                        <h1 style={{ fontSize: '28px', fontWeight: '900', color: '#ec4899', margin: 0 }}>DETAIL PROMOTOR</h1>
                        <p style={{ fontSize: '14px', color: '#64748b', margin: '8px 0 0 0' }}>Periode: {periodLabel}</p>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#be185d', color: '#ffffff' }}>
                                <th style={{ padding: '6px', textAlign: 'left' }}>NAMA</th>
                                <th style={{ padding: '6px', textAlign: 'left' }}>SATOR</th>
                                <th style={{ padding: '6px', textAlign: 'center' }}>TGT</th>
                                <th style={{ padding: '6px', textAlign: 'center' }}>IN</th>
                                <th style={{ padding: '6px', textAlign: 'center' }}>%</th>
                                <th style={{ padding: '6px', textAlign: 'center' }}>CLO</th>
                                <th style={{ padding: '6px', textAlign: 'center' }}>PEND</th>
                                <th style={{ padding: '6px', textAlign: 'center' }}>REJ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {promotors.map((p, i) => {
                                const pct = p.target > 0 ? Math.round((p.total_input / p.target) * 100) : 0;
                                return (
                                    <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#fdf2f8', borderBottom: '1px solid #fbcfe8' }}>
                                        <td style={{ padding: '6px', fontWeight: 'bold', color: '#1e293b' }}>{p.name}</td>
                                        <td style={{ padding: '6px', color: '#64748b', fontSize: '10px' }}>{p.sator_name}</td>
                                        <td style={{ padding: '6px', textAlign: 'center', color: '#64748b' }}>{p.target}</td>
                                        <td style={{ padding: '6px', textAlign: 'center', fontWeight: 'bold', color: '#db2777' }}>{p.total_input}</td>
                                        <td style={{ padding: '6px', textAlign: 'center', fontWeight: 'bold', color: pct >= timeGonePercent ? '#10b981' : '#ef4444' }}>{pct}%</td>
                                        <td style={{ padding: '6px', textAlign: 'center', color: '#10b981' }}>{p.total_closed}</td>
                                        <td style={{ padding: '6px', textAlign: 'center', color: '#f59e0b' }}>{p.total_pending}</td>
                                        <td style={{ padding: '6px', textAlign: 'center', color: '#ef4444' }}>{p.total_rejected}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* 4. SPC DATA */}
                <div ref={spcTableRef} style={{ width: '800px', padding: '32px', backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }}>
                    <div style={{ borderBottom: '4px solid #7c3aed', paddingBottom: '16px', marginBottom: '24px' }}>
                        <h1 style={{ fontSize: '28px', fontWeight: '900', color: '#7c3aed', margin: 0 }}>DATA TOKO STRATEGIS (SPC)</h1>
                        <p style={{ fontSize: '14px', color: '#64748b', margin: '8px 0 0 0' }}>Periode: {periodLabel}</p>
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#7c3aed', marginBottom: '8px' }}>PERFORMA TOKO ({spcStores.length})</h2>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#6d28d9', color: '#ffffff' }}>
                                    <th style={{ padding: '8px', textAlign: 'left' }}>NAMA TOKO</th>
                                    <th style={{ padding: '8px', textAlign: 'center' }}>TARGET</th>
                                    <th style={{ padding: '8px', textAlign: 'center' }}>INPUT</th>
                                    <th style={{ padding: '8px', textAlign: 'center' }}>%</th>
                                    <th style={{ padding: '8px', textAlign: 'center' }}>CLO</th>
                                    <th style={{ padding: '8px', textAlign: 'center' }}>PND</th>
                                    <th style={{ padding: '8px', textAlign: 'center' }}>REJ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {spcStores.map((s, i) => {
                                    const pct = s.target > 0 ? Math.round((s.total_input / s.target) * 100) : 0;
                                    return (
                                        <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#f5f3ff', borderBottom: '1px solid #ddd6fe' }}>
                                            <td style={{ padding: '8px', fontWeight: 'bold', color: '#1e293b' }}>{s.store_name}</td>
                                            <td style={{ padding: '8px', textAlign: 'center', color: '#64748b' }}>{s.target}</td>
                                            <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', color: '#7c3aed' }}>{s.total_input}</td>
                                            <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', color: pct >= timeGonePercent ? '#10b981' : '#ef4444' }}>{pct}%</td>
                                            <td style={{ padding: '8px', textAlign: 'center', color: '#10b981' }}>{s.total_closed}</td>
                                            <td style={{ padding: '8px', textAlign: 'center', color: '#f59e0b' }}>{s.total_pending}</td>
                                            <td style={{ padding: '8px', textAlign: 'center', color: '#ef4444' }}>{s.total_rejected}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

        </DashboardLayout>
    );
};
