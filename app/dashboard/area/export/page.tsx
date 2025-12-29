'use client';

import { useEffect, useState, useRef, Fragment } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { ProfileSidebar } from '@/components/ProfileSidebar';
import { Loading } from '@/components/ui/loading';
import { Alert } from '@/components/ui/alert';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Download, FileSpreadsheet, Image, User, Eye, Check } from 'lucide-react';
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

    const areaTableRef = useRef<HTMLDivElement>(null);
    const satorTableRef = useRef<HTMLDivElement>(null);
    const spcTableRef = useRef<HTMLDivElement>(null);
    const previewRef = useRef<HTMLDivElement>(null);
    const reportRef = useRef<HTMLDivElement>(null);

    const [includePerformance, setIncludePerformance] = useState(true);
    const [includeUnderperform, setIncludeUnderperform] = useState(false);
    const [includeSpcData, setIncludeSpcData] = useState(false);
    const [exportFormat, setExportFormat] = useState<'excel' | 'png'>('excel');
    const [showPreview, setShowPreview] = useState(false);

    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const currentDay = now.getDate();
    const timeGonePercent = Math.round((currentDay / daysInMonth) * 100);
    const periodLabel = now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }).toUpperCase();

    const totalGlobalInput = areas.reduce((acc, a) => acc + (a.total_input || 0), 0);
    const totalGlobalTarget = areas.reduce((acc, a) => acc + (a.target || 0), 0);

    // Get user initials
    const getInitials = (name: string) => name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'U';

    useEffect(() => {
        if (user) fetchData();
    }, [user]);

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
                supabase.functions.invoke('dashboard-manager'),
                supabase.functions.invoke('dashboard-manager-daily')
            ]);

            if (monthlyResponse.error) throw monthlyResponse.error;

            const monthlyData = monthlyResponse.data;
            const dailyData = dailyResponse.data;

            // Build daily data maps untuk quick lookup
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

            // Merge daily data ke monthly data - AREAS
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

            // Merge daily data ke monthly data - SATORS
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

            // Merge daily data ke monthly data - PROMOTORS
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

            // Fetch SPC data (monthly + daily) - Manager always has access to SPC
            const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

            // Fetch SPC monthly and daily in parallel
            const [spcMonthlyResponse, spcDailyResponse] = await Promise.all([
                supabase.functions.invoke('dashboard-spc-monthly', {
                    body: { userId: user?.id, month: monthStr }
                }),
                supabase.functions.invoke('dashboard-spc-daily', {
                    body: { userId: user?.id }
                })
            ]);

            const spcData = spcMonthlyResponse.data;
            const spcDailyData = spcDailyResponse.data;

            // Build SPC daily map untuk quick lookup (include promotors)
            const spcDailyMap = new Map<string, { total_input: number; total_closed: number; total_pending: number; total_rejected: number; promotors?: any[] }>();
            if (spcDailyData?.success && spcDailyData?.stores) {
                spcDailyData.stores.forEach((store: any) => {
                    spcDailyMap.set(store.store_id, {
                        total_input: store.total_input || 0,
                        total_closed: store.total_closed || 0,
                        total_pending: store.total_pending || 0,
                        total_rejected: store.total_rejected || 0,
                        promotors: store.promotors || []
                    });
                });
            }

            if (!spcMonthlyResponse.error && spcData?.success) {
                const stores = spcData.stores || [];

                // Langsung pakai promotors dari Edge Function yang sudah lengkap
                const storesWithDaily = stores.map((store: any) => {
                    const dailyStore = spcDailyMap.get(store.store_id);

                    // Merge daily data ke promotors dari Edge Function
                    const promotorsWithDaily = (store.promotors || []).map((p: any) => ({
                        ...p,
                        daily_input: dailyStore?.promotors?.find((dp: any) => dp.user_id === p.user_id)?.total_input || 0,
                        daily_closed: dailyStore?.promotors?.find((dp: any) => dp.user_id === p.user_id)?.total_closed || 0,
                        daily_pending: dailyStore?.promotors?.find((dp: any) => dp.user_id === p.user_id)?.total_pending || 0,
                        daily_rejected: dailyStore?.promotors?.find((dp: any) => dp.user_id === p.user_id)?.total_rejected || 0
                    }));

                    return {
                        ...store,
                        daily_input: dailyStore?.total_input || 0,
                        daily_closed: dailyStore?.total_closed || 0,
                        daily_pending: dailyStore?.total_pending || 0,
                        daily_rejected: dailyStore?.total_rejected || 0,
                        promotors: promotorsWithDaily
                    };
                });

                setSpcStores(storesWithDaily);
                setSpcTotals(spcData.totals || { input: 0, closed: 0, pending: 0, rejected: 0, target: 0 });
            }
        } catch (err) {
            console.error(err);
            setError('Gagal memuat data');
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            const dateStr = new Date().toISOString().slice(0, 10);

            if (exportFormat === 'excel') {
                const wb = XLSX.utils.book_new();

                if (includePerformance) {
                    // Format: daily/total/target (contoh: 3/10/50)
                    const areaData = areas.map(m => {
                        const pct = m.target > 0 ? Math.round((m.total_input / m.target) * 100) : 0;
                        return {
                            AREA: m.name,
                            'INPUT (H/T/TGT)': `${m.daily_input || 0}/${m.total_input}/${m.target}`,
                            'CAPAIAN_%': pct,
                            'CLOSING (H/T)': `${m.daily_closed || 0}/${m.total_closed}`,
                            'PENDING (H/T)': `${m.daily_pending || 0}/${m.total_pending}`,
                            'REJECT (H/T)': `${m.daily_rejected || 0}/${m.total_rejected}`,
                            STATUS: isUnderperform(m) ? 'UNDERPERFORM' : 'OK'
                        };
                    });
                    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(areaData), 'AREA_SUMMARY');

                    const satorData = sators.map(m => {
                        const pct = m.target > 0 ? Math.round((m.total_input / m.target) * 100) : 0;
                        return {
                            AREA: m.area,
                            SATOR: m.name,
                            'INPUT (H/T/TGT)': `${m.daily_input || 0}/${m.total_input}/${m.target}`,
                            'CAPAIAN_%': pct,
                            'CLOSING (H/T)': `${m.daily_closed || 0}/${m.total_closed}`,
                            'PENDING (H/T)': `${m.daily_pending || 0}/${m.total_pending}`,
                            'REJECT (H/T)': `${m.daily_rejected || 0}/${m.total_rejected}`,
                            STATUS: isUnderperform(m) ? 'UNDERPERFORM' : 'OK'
                        };
                    });
                    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(satorData), 'SATOR_DETAIL');

                    const promotorData = promotors.map(m => {
                        const pct = m.target > 0 ? Math.round((m.total_input / m.target) * 100) : 0;
                        return {
                            AREA: m.area,
                            SATOR: m.sator_name,
                            PROMOTOR: m.name,
                            'INPUT (H/T/TGT)': `${m.daily_input || 0}/${m.total_input}/${m.target}`,
                            'CAPAIAN_%': pct,
                            'CLOSING (H/T)': `${m.daily_closed || 0}/${m.total_closed}`,
                            'PENDING (H/T)': `${m.daily_pending || 0}/${m.total_pending}`,
                            'REJECT (H/T)': `${m.daily_rejected || 0}/${m.total_rejected}`,
                            STATUS: isUnderperform(m) ? 'UNDERPERFORM' : 'OK'
                        };
                    });
                    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(promotorData), 'PROMOTOR_DETAIL');
                }

                if (includeUnderperform) {
                    // Format underperform dengan daily/total/target
                    const underData = [
                        ...areas.filter(isUnderperform).map(m => ({
                            Level: 'AREA',
                            Nama: m.name,
                            'INPUT (H/T/TGT)': `${m.daily_input || 0}/${m.total_input}/${m.target}`,
                            'CLOSING (H/T)': `${m.daily_closed || 0}/${m.total_closed}`,
                            'PENDING (H/T)': `${m.daily_pending || 0}/${m.total_pending}`,
                            'REJECT (H/T)': `${m.daily_rejected || 0}/${m.total_rejected}`,
                            GAP: m.target - m.total_input
                        })),
                        ...sators.filter(isUnderperform).map(m => ({
                            Level: 'SATOR',
                            Nama: m.name,
                            Area: m.area,
                            'INPUT (H/T/TGT)': `${m.daily_input || 0}/${m.total_input}/${m.target}`,
                            'CLOSING (H/T)': `${m.daily_closed || 0}/${m.total_closed}`,
                            'PENDING (H/T)': `${m.daily_pending || 0}/${m.total_pending}`,
                            'REJECT (H/T)': `${m.daily_rejected || 0}/${m.total_rejected}`,
                            GAP: m.target - m.total_input
                        })),
                        ...promotors.filter(isUnderperform).map(m => ({
                            Level: 'PROMOTOR',
                            Nama: m.name,
                            Area: m.area,
                            'INPUT (H/T/TGT)': `${m.daily_input || 0}/${m.total_input}/${m.target}`,
                            'CLOSING (H/T)': `${m.daily_closed || 0}/${m.total_closed}`,
                            'PENDING (H/T)': `${m.daily_pending || 0}/${m.total_pending}`,
                            'REJECT (H/T)': `${m.daily_rejected || 0}/${m.total_rejected}`,
                            GAP: m.target - m.total_input
                        })),
                    ];
                    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(underData), 'UNDERPERFORM');
                }



                // SPC Data - Format: daily/total/target
                if (includeSpcData && spcStores.length > 0) {
                    const spcExportData = spcStores.map(s => {
                        const pct = s.target > 0 ? Math.round((s.total_input / s.target) * 100) : 0;
                        return {
                            TOKO: s.store_name,
                            'INPUT (H/T/TGT)': `${s.daily_input || 0}/${s.total_input}/${s.target}`,
                            'CAPAIAN_%': pct,
                            'CLOSING (H/T)': `${s.daily_closed || 0}/${s.total_closed}`,
                            'PENDING (H/T)': `${s.daily_pending || 0}/${s.total_pending}`,
                            'REJECT (H/T)': `${s.daily_rejected || 0}/${s.total_rejected}`,
                            STATUS: isUnderperform(s) ? 'UNDERPERFORM' : 'OK',
                            'JUMLAH_PROMOTOR': s.promotors?.length || 0
                        };
                    });
                    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(spcExportData), 'SPC_PERFORMANCE');

                    const spcPromotorDetail: any[] = [];
                    spcStores.forEach(store => {
                        if (store.promotors && store.promotors.length > 0) {
                            store.promotors.forEach(promotor => {
                                const promotorPct = promotor.target && promotor.target > 0
                                    ? Math.round((promotor.total_input / promotor.target) * 100)
                                    : 0;
                                spcPromotorDetail.push({
                                    TOKO: store.store_name,
                                    PROMOTOR: promotor.name,
                                    TARGET: promotor.target || 0,
                                    'INPUT (H/T)': `${promotor.daily_input || 0}/${promotor.total_input}`,
                                    'CAPAIAN_%': promotorPct,
                                    'CLOSING (H/T)': `${promotor.daily_closed || 0}/${promotor.total_closed}`,
                                    'PENDING (H/T)': `${promotor.daily_pending || 0}/${promotor.total_pending}`,
                                    'REJECT (H/T)': `${promotor.daily_rejected || 0}/${promotor.total_rejected}`
                                });
                            });
                        } else {
                            spcPromotorDetail.push({
                                TOKO: store.store_name,
                                PROMOTOR: '(Tidak ada promotor)',
                                TARGET: 0,
                                'INPUT (H/T)': '0/0',
                                'CAPAIAN_%': 0,
                                'CLOSING (H/T)': '0/0',
                                'PENDING (H/T)': '0/0',
                                'REJECT (H/T)': '0/0'
                            });
                        }
                    });
                    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(spcPromotorDetail), 'SPC_PROMOTOR_DETAIL');


                    const spcSummary = [
                        { Label: 'HEADER', Value: 'SPC GRUP' },
                        { Label: 'AREA', Value: 'TIMOR-SUMBA' },
                        { Label: 'MANAGER AREA', Value: user?.name || 'N/A' },
                        { Label: 'TANGGAL', Value: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) },
                        { Label: '', Value: '' },
                        { Label: 'PERIODE', Value: periodLabel },
                        { Label: 'TIME GONE', Value: `${timeGonePercent}%` },
                        { Label: 'TOTAL TOKO SPC', Value: spcStores.length },
                        { Label: 'TOTAL TARGET', Value: spcTotals.target },
                        { Label: 'TOTAL INPUT', Value: spcTotals.input },
                        { Label: 'TOTAL CLOSING', Value: spcTotals.closed },
                        { Label: 'CAPAIAN', Value: spcTotals.target > 0 ? `${Math.round((spcTotals.input / spcTotals.target) * 100)}%` : '-' },
                    ];
                    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(spcSummary), 'SPC_SUMMARY');
                }

                XLSX.writeFile(wb, `Laporan_Manager_${dateStr}.xlsx`);
            }

            if (exportFormat === 'png') {
                const downloadImage = async (ref: React.RefObject<HTMLDivElement | null>, filename: string) => {
                    if (!ref.current) return;
                    const canvas = await html2canvas(ref.current, {
                        backgroundColor: '#ffffff',
                        scale: 2,
                        logging: false,
                        useCORS: true,
                        allowTaint: true,
                        removeContainer: true
                    });
                    const link = document.createElement('a');
                    link.download = filename;
                    link.href = canvas.toDataURL('image/png');
                    link.click();
                };

                // Download Tim Performance (Area + Sator)
                if ((includePerformance || includeUnderperform) && reportRef.current) {
                    await downloadImage(reportRef, `Laporan_Tim_Manager_${dateStr}.png`);
                }

                // Download SPC if selected
                if (includeSpcData && spcStores.length > 0 && spcTableRef.current) {
                    // Small delay between downloads
                    await new Promise(resolve => setTimeout(resolve, 500));
                    await downloadImage(spcTableRef, `Laporan_SPC_Manager_${dateStr}.png`);
                }
            }
        } catch (err) {
            console.error(err);
            alert('Gagal export');
        } finally {
            setExporting(false);
        }
    };

    if (loading) return <DashboardLayout><Loading message="Memuat data..." /></DashboardLayout>;
    if (error) return <DashboardLayout><Alert type="error" message={error} /></DashboardLayout>;

    const spcUnderperformCount = spcStores.filter(isUnderperform).length;

    return (
        <DashboardLayout allowedRoles={['manager']}>
            <div className="min-h-screen bg-background pb-32">

                {/* 1. Header Banner Premium */}
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

                    {/* A. SUMBER DATA (Selection Cards) */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-black text-muted-foreground uppercase tracking-widest pl-1">1. Pilih Sumber Data</h3>
                        <div className="grid grid-cols-1 gap-2">
                            {[
                                { id: 'perf', label: 'Performance', sub: 'Ringkasan Area & Sator', state: includePerformance, set: setIncludePerformance, icon: '📊' },
                                { id: 'under', label: 'Underperform', sub: 'Daftar Unit di bawah Target', state: includeUnderperform, set: setIncludeUnderperform, icon: '📉' },
                                { id: 'spc', label: 'SPC - Data Toko', sub: `${spcStores.length} Toko Grup SPC`, state: includeSpcData, set: setIncludeSpcData, icon: '🏪', accent: 'purple' },
                            ].map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => item.set(!item.state)}
                                    className={cn(
                                        "flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left",
                                        item.state
                                            ? item.accent === 'purple' ? "border-purple-500 bg-purple-50" : "border-primary bg-primary/5"
                                            : "border-border bg-card hover:border-muted-foreground/30"
                                    )}
                                >
                                    <div className={cn(
                                        "w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-sm",
                                        item.state ? "bg-white" : "bg-muted"
                                    )}>
                                        {item.icon}
                                    </div>
                                    <div className="flex-1">
                                        <div className={cn("font-bold text-base", item.state ? "text-foreground" : "text-muted-foreground")}>{item.label}</div>
                                        <div className="text-[11px] text-muted-foreground font-medium">{item.sub}</div>
                                    </div>
                                    <div className={cn(
                                        "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                                        item.state ? item.accent === 'purple' ? "bg-purple-500 border-purple-500" : "bg-primary border-primary" : "border-muted"
                                    )}>
                                        {item.state && <Check className="w-3 h-3 text-white stroke-[4]" />}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* B. FORMAT FILE (Selector) */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-black text-muted-foreground uppercase tracking-widest pl-1">2. Pilih Format</h3>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { id: 'excel', label: 'EXCEL (.xlsx)', icon: FileSpreadsheet, sub: 'Data Terstruktur' },
                                { id: 'png', label: 'IMAGE (.png)', icon: Image, sub: 'Preview Visual' },
                            ].map((fmt) => (
                                <button
                                    key={fmt.id}
                                    onClick={() => setExportFormat(fmt.id as 'excel' | 'png')}
                                    className={cn(
                                        "flex flex-col items-center p-5 rounded-2xl border-2 transition-all",
                                        exportFormat === fmt.id ? "border-primary bg-primary/5 ring-4 ring-primary/10" : "border-border bg-card hover:bg-muted"
                                    )}
                                >
                                    <fmt.icon className={cn("w-10 h-10 mb-3", exportFormat === fmt.id ? "text-primary" : "text-muted-foreground")} />
                                    <span className={cn("text-xs font-black", exportFormat === fmt.id ? "text-primary" : "text-muted-foreground")}>{fmt.label}</span>
                                    <span className="text-[9px] text-muted-foreground font-bold mt-1 uppercase">{fmt.sub}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* C. PREVIEW & SUMMARY */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between pl-1">
                            <h3 className="text-sm font-black text-muted-foreground uppercase tracking-widest">3. Ringkasan & Preview</h3>
                            <button
                                onClick={() => setShowPreview(!showPreview)}
                                className="text-[10px] font-bold text-primary flex items-center gap-1 hover:underline outline-none"
                            >
                                <Eye className="w-3 h-3" /> {showPreview ? 'SEMBUNYIKAN' : 'LIHAT PREVIEW'}
                            </button>
                        </div>

                        <div ref={previewRef} className="bg-card rounded-2xl border border-border overflow-hidden shadow-inner bg-white">
                            {/* Summary Totals */}
                            <div className="grid grid-cols-3 gap-0 border-b border-border/50">
                                <div className="text-center py-5">
                                    <div className="text-xl font-black text-foreground">{areas.length}</div>
                                    <div className="text-[9px] font-bold text-muted-foreground uppercase">Area</div>
                                </div>
                                <div className="text-center py-5 border-x border-border/50">
                                    <div className="text-xl font-black text-foreground">{sators.length}</div>
                                    <div className="text-[9px] font-bold text-muted-foreground uppercase">Sator</div>
                                </div>
                                <div className="text-center py-5">
                                    <div className="text-xl font-black text-foreground">{promotors.length}</div>
                                    <div className="text-[9px] font-bold text-muted-foreground uppercase">Promotor</div>
                                </div>
                            </div>

                            {/* Detailed Live Preview Table - Dynamic based on selection */}
                            {showPreview && (
                                <div className="animate-in fade-in slide-in-from-top-2 duration-300 divide-y divide-border/50">
                                    {/* Data Performance (Area) Preview - Format: H/T/TGT */}
                                    {includePerformance && (
                                        <div className="bg-white/50">
                                            <div className="bg-primary/5 px-4 py-2 flex justify-between items-center border-b border-primary/10">
                                                <span className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-1.5"><div className="w-1 h-3 bg-primary rounded-full" /> Performance Area</span>
                                                <span className="text-[9px] font-bold text-muted-foreground uppercase">H/T/TGT</span>
                                            </div>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-[10px]">
                                                    <thead className="bg-muted/30">
                                                        <tr>
                                                            <th className="px-3 py-1.5 text-left font-bold text-muted-foreground">AREA</th>
                                                            <th className="px-2 py-1.5 text-center font-bold text-muted-foreground">INPUT</th>
                                                            <th className="px-2 py-1.5 text-center font-bold text-muted-foreground">CLO</th>
                                                            <th className="px-2 py-1.5 text-center font-bold text-muted-foreground">PND</th>
                                                            <th className="px-2 py-1.5 text-center font-bold text-muted-foreground">REJ</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-border/30">
                                                        {areas.slice(0, 3).map((a, i) => (
                                                            <tr key={i} className="hover:bg-muted/10">
                                                                <td className="px-3 py-2 font-bold text-foreground">{a.name}</td>
                                                                <td className="px-2 py-2 text-center font-mono text-primary font-bold">{a.daily_input || 0}/{a.total_input}/{a.target}</td>
                                                                <td className="px-2 py-2 text-center font-mono text-emerald-600">{a.daily_closed || 0}/{a.total_closed}</td>
                                                                <td className="px-2 py-2 text-center font-mono text-amber-600">{a.daily_pending || 0}/{a.total_pending}</td>
                                                                <td className="px-2 py-2 text-center font-mono text-red-500">{a.daily_rejected || 0}/{a.total_rejected}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    {/* Underperform Preview - Format: H/T/TGT */}
                                    {includeUnderperform && (
                                        <div className="bg-red-50/30">
                                            <div className="bg-red-500/10 px-4 py-2 flex justify-between items-center border-b border-red-200/50">
                                                <span className="text-[10px] font-black text-red-600 uppercase tracking-widest flex items-center gap-1.5"><div className="w-1 h-3 bg-red-500 rounded-full" /> Underperform</span>
                                                <span className="text-[9px] font-bold text-red-500 uppercase">H/T/TGT</span>
                                            </div>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-[10px]">
                                                    <thead className="bg-red-100/50">
                                                        <tr>
                                                            <th className="px-3 py-1.5 text-left font-bold text-red-700">SATOR</th>
                                                            <th className="px-2 py-1.5 text-center font-bold text-red-700">INPUT</th>
                                                            <th className="px-2 py-1.5 text-center font-bold text-red-700">GAP</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-red-100">
                                                        {sators.filter(isUnderperform).slice(0, 3).map((s, i) => {
                                                            const gap = s.target - s.total_input;
                                                            return (
                                                                <tr key={i} className="hover:bg-red-500/5">
                                                                    <td className="px-3 py-2 font-bold text-red-900">{s.name}</td>
                                                                    <td className="px-2 py-2 text-center font-mono text-red-600 font-bold">{s.daily_input || 0}/{s.total_input}/{s.target}</td>
                                                                    <td className="px-2 py-2 text-center font-black text-red-500">{gap}</td>
                                                                </tr>
                                                            );
                                                        })}
                                                        {sators.filter(isUnderperform).length === 0 && (
                                                            <tr><td colSpan={3} className="px-4 py-4 text-center text-[9px] font-bold text-emerald-600">SEMUA UNIT ON-TRACK!</td></tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}



                                    {/* SPC Data Preview - dengan Header Standar + Detail Promotor */}
                                    {includeSpcData && (
                                        <div className="bg-purple-50/30">
                                            {/* Header SPC */}
                                            <div className="bg-purple-700 px-4 py-3 text-white">
                                                <div className="text-[11px] font-black uppercase tracking-widest mb-1">SPC GRUP</div>
                                                <div className="text-[9px] space-y-0.5">
                                                    <div>AREA: TIMOR-SUMBA</div>
                                                    <div>MANAGER: {user?.name || 'N/A'}</div>
                                                    <div>TANGGAL: {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
                                                </div>
                                            </div>

                                            {/* Tabel Toko */}
                                            <div className="bg-purple-500/10 px-4 py-2 border-b border-purple-200/50">
                                                <span className="text-[10px] font-black text-purple-700 uppercase tracking-widest">Performance Toko ({spcStores.length})</span>
                                            </div>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-[10px]">
                                                    <thead className="bg-purple-100/50">
                                                        <tr>
                                                            <th className="px-3 py-1.5 text-left font-bold text-purple-700">TOKO</th>
                                                            <th className="px-2 py-1.5 text-center font-bold text-purple-700">TGT</th>
                                                            <th className="px-2 py-1.5 text-center font-bold text-purple-700">INPUT</th>
                                                            <th className="px-2 py-1.5 text-center font-bold text-purple-700">%</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-purple-100">
                                                        {spcStores.slice(0, 3).map((s, i) => {
                                                            const pct = s.target > 0 ? Math.round((s.total_input / s.target) * 100) : 0;
                                                            return (
                                                                <tr key={i} className="hover:bg-purple-500/5">
                                                                    <td className="px-3 py-2 font-bold text-purple-900">{s.store_name}</td>
                                                                    <td className="px-2 py-2 text-center font-mono text-purple-600">{s.target}</td>
                                                                    <td className="px-2 py-2 text-center font-mono text-purple-600 font-bold">{s.daily_input || 0}/{s.total_input}</td>
                                                                    <td className={cn("px-2 py-2 text-center font-bold", pct >= timeGonePercent ? "text-emerald-600" : "text-red-500")}>{pct}%</td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>

                                            {/* Detail Promotor */}
                                            <div className="bg-purple-400/10 px-4 py-2 border-b border-purple-200/50 border-t">
                                                <span className="text-[10px] font-black text-purple-700 uppercase tracking-widest">Detail Promotor (Sample)</span>
                                            </div>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-[9px]">
                                                    <thead className="bg-purple-200/50">
                                                        <tr>
                                                            <th className="px-2 py-1 text-left font-bold text-purple-700">TOKO</th>
                                                            <th className="px-2 py-1 text-left font-bold text-purple-700">PROMOTOR</th>
                                                            <th className="px-2 py-1 text-center font-bold text-purple-700">TGT</th>
                                                            <th className="px-2 py-1 text-center font-bold text-purple-700">INPUT</th>
                                                            <th className="px-2 py-1 text-center font-bold text-purple-700">%</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-purple-100">
                                                        {spcStores.slice(0, 2).map((store, storeIdx) => {
                                                            if (!store.promotors || store.promotors.length === 0) {
                                                                return (
                                                                    <tr key={`st-${storeIdx}`} className="bg-yellow-50">
                                                                        <td className="px-2 py-1.5 text-purple-600">{store.store_name}</td>
                                                                        <td colSpan={4} className="px-2 py-1.5 text-center italic text-gray-500">(Tidak ada promotor)</td>
                                                                    </tr>
                                                                );
                                                            }
                                                            return store.promotors.slice(0, 2).map((promotor, promIdx) => {
                                                                const promPct = promotor.target && promotor.target > 0 ? Math.round((promotor.total_input / promotor.target) * 100) : 0;
                                                                return (
                                                                    <tr key={`${storeIdx}-${promIdx}`} className="hover:bg-purple-500/5">
                                                                        <td className="px-2 py-1.5 text-purple-600 text-[8px]">{promIdx === 0 ? store.store_name : ''}</td>
                                                                        <td className="px-2 py-1.5 font-bold text-purple-900">{promotor.name}</td>
                                                                        <td className="px-2 py-1.5 text-center font-mono text-purple-600">{promotor.target || 0}</td>
                                                                        <td className="px-2 py-1.5 text-center font-mono text-purple-700 font-bold">{promotor.daily_input || 0}/{promotor.total_input}</td>
                                                                        <td className={cn("px-2 py-1.5 text-center font-bold", promPct >= timeGonePercent ? "text-emerald-600" : "text-red-500")}>{promPct}%</td>
                                                                    </tr>
                                                                );
                                                            });
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                            <div className="px-4 py-2 bg-purple-50 border-t border-purple-200/50">
                                                <p className="text-[8px] text-purple-600 italic">Preview terbatas. Download untuk data lengkap.</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Empty Selection Handler */}
                                    {!includePerformance && !includeUnderperform && !includeSpcData && (
                                        <div className="p-8 text-center bg-muted/10">
                                            <div className="text-[10px] font-bold text-muted-foreground italic uppercase flex flex-col items-center gap-2">
                                                <div className="w-8 h-8 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center text-lg">?</div>
                                                Pilih sumber data untuk melihat preview
                                            </div>
                                        </div>
                                    )}

                                    <div className="p-3 bg-white/50 text-center border-t border-border/50">
                                        <p className="text-[9px] font-bold text-muted-foreground leading-tight italic">
                                            Preview menunjukkan sampel data terbatas agar tetap ringan.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                </div>

                {/* SIMPLE PNG TEMPLATE - Format H/T/TGT */}
                <div style={{ position: 'absolute', left: '-9999px', pointerEvents: 'none' }}>
                    <div ref={reportRef} style={{ width: '800px', padding: '24px', backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }}>

                        {/* Header */}
                        <div style={{ borderBottom: '3px solid #1e293b', paddingBottom: '16px', marginBottom: '20px' }}>
                            <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>
                                {includeSpcData && !includePerformance && !includeUnderperform ? 'SPC GRUP' : 'LAPORAN MANAGER AREA'}
                            </h1>
                            {includeSpcData && !includePerformance && !includeUnderperform && (
                                <div style={{ fontSize: '13px', color: '#7c3aed', margin: '8px 0 0 0', fontWeight: 'bold' }}>
                                    <div>AREA: TIMOR-SUMBA</div>
                                    <div>MANAGER AREA: {user?.name || 'N/A'}</div>
                                </div>
                            )}
                            <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>
                                {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} | Periode: {periodLabel}
                            </p>
                            <p style={{ fontSize: '11px', color: '#94a3b8', margin: '4px 0 0 0' }}>
                                Format: Hari Ini / Total Bulan{includeSpcData ? '' : ' / Target'}
                            </p>
                        </div>

                        {/* Performance Area Table */}
                        {includePerformance && areas.length > 0 && (
                            <div style={{ marginBottom: '24px' }}>
                                <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e293b', marginBottom: '8px', borderLeft: '4px solid #3b82f6', paddingLeft: '8px' }}>PERFORMANCE AREA</h2>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#1e293b', color: '#ffffff' }}>
                                            <th style={{ padding: '8px', textAlign: 'left', fontWeight: 'bold' }}>AREA</th>
                                            <th style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>INPUT (H/T/TGT)</th>
                                            <th style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>CLOSING</th>
                                            <th style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>PENDING</th>
                                            <th style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>REJECT</th>
                                            <th style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>%</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {areas.map((a, i) => {
                                            const pct = a.target > 0 ? Math.round((a.total_input / a.target) * 100) : 0;
                                            return (
                                                <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#ffffff' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                                    <td style={{ padding: '8px', fontWeight: 'bold', color: '#1e293b' }}>{a.name}</td>
                                                    <td style={{ padding: '8px', textAlign: 'center', fontFamily: 'monospace', color: '#3b82f6', fontWeight: 'bold' }}>{a.daily_input || 0}/{a.total_input}/{a.target}</td>
                                                    <td style={{ padding: '8px', textAlign: 'center', fontFamily: 'monospace', color: '#10b981' }}>{a.daily_closed || 0}/{a.total_closed}</td>
                                                    <td style={{ padding: '8px', textAlign: 'center', fontFamily: 'monospace', color: '#f59e0b' }}>{a.daily_pending || 0}/{a.total_pending}</td>
                                                    <td style={{ padding: '8px', textAlign: 'center', fontFamily: 'monospace', color: '#ef4444' }}>{a.daily_rejected || 0}/{a.total_rejected}</td>
                                                    <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', color: pct >= timeGonePercent ? '#10b981' : '#ef4444' }}>{pct}%</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Performance Sator Table */}
                        {includePerformance && sators.length > 0 && (
                            <div style={{ marginBottom: '24px' }}>
                                <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e293b', marginBottom: '8px', borderLeft: '4px solid #8b5cf6', paddingLeft: '8px' }}>DETAIL SATOR</h2>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#1e293b', color: '#ffffff' }}>
                                            <th style={{ padding: '6px', textAlign: 'left', fontWeight: 'bold' }}>AREA</th>
                                            <th style={{ padding: '6px', textAlign: 'left', fontWeight: 'bold' }}>SATOR</th>
                                            <th style={{ padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>INPUT (H/T/TGT)</th>
                                            <th style={{ padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>CLO</th>
                                            <th style={{ padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>PND</th>
                                            <th style={{ padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>REJ</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sators.slice(0, 15).map((s, i) => (
                                            <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#ffffff' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                                <td style={{ padding: '6px', color: '#64748b', fontSize: '10px' }}>{s.area}</td>
                                                <td style={{ padding: '6px', fontWeight: 'bold', color: '#1e293b' }}>{s.name}</td>
                                                <td style={{ padding: '6px', textAlign: 'center', fontFamily: 'monospace', color: '#3b82f6', fontWeight: 'bold' }}>{s.daily_input || 0}/{s.total_input}/{s.target}</td>
                                                <td style={{ padding: '6px', textAlign: 'center', fontFamily: 'monospace', color: '#10b981' }}>{s.daily_closed || 0}/{s.total_closed}</td>
                                                <td style={{ padding: '6px', textAlign: 'center', fontFamily: 'monospace', color: '#f59e0b' }}>{s.daily_pending || 0}/{s.total_pending}</td>
                                                <td style={{ padding: '6px', textAlign: 'center', fontFamily: 'monospace', color: '#ef4444' }}>{s.daily_rejected || 0}/{s.total_rejected}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {sators.length > 15 && <p style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>... dan {sators.length - 15} sator lainnya</p>}
                            </div>
                        )}

                        {/* Underperform List */}
                        {includeUnderperform && (
                            <div style={{ marginBottom: '24px' }}>
                                <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#dc2626', marginBottom: '8px', borderLeft: '4px solid #dc2626', paddingLeft: '8px' }}>UNDERPERFORM ({`< ${timeGonePercent}%`})</h2>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}>
                                            <th style={{ padding: '6px', textAlign: 'left', fontWeight: 'bold' }}>LEVEL</th>
                                            <th style={{ padding: '6px', textAlign: 'left', fontWeight: 'bold' }}>NAMA</th>
                                            <th style={{ padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>INPUT (H/T/TGT)</th>
                                            <th style={{ padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>GAP</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[...sators.filter(isUnderperform).slice(0, 10)].map((s, i) => (
                                            <tr key={i} style={{ backgroundColor: '#fff', borderBottom: '1px solid #fecaca' }}>
                                                <td style={{ padding: '6px', color: '#dc2626', fontSize: '10px' }}>SATOR</td>
                                                <td style={{ padding: '6px', fontWeight: 'bold', color: '#1e293b' }}>{s.name}</td>
                                                <td style={{ padding: '6px', textAlign: 'center', fontFamily: 'monospace', color: '#dc2626', fontWeight: 'bold' }}>{s.daily_input || 0}/{s.total_input}/{s.target}</td>
                                                <td style={{ padding: '6px', textAlign: 'center', fontWeight: 'bold', color: '#dc2626' }}>{s.target - s.total_input}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* SPC Data */}
                        {includeSpcData && spcStores.length > 0 && (
                            <div style={{ marginBottom: '24px', pageBreakInside: 'avoid' }}>
                                {/* Tabel Toko */}
                                <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#7c3aed', marginBottom: '8px', borderLeft: '4px solid #7c3aed', paddingLeft: '8px' }}>
                                    PERFORMANCE TOKO ({spcStores.length} Toko)
                                </h3>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '20px' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#7c3aed', color: '#ffffff' }}>
                                            <th style={{ padding: '6px', textAlign: 'left', fontWeight: 'bold' }}>TOKO</th>
                                            <th style={{ padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>TARGET</th>
                                            <th style={{ padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>INPUT (H/T)</th>
                                            <th style={{ padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>%</th>
                                            <th style={{ padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>CLO</th>
                                            <th style={{ padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>PND</th>
                                            <th style={{ padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>REJ</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {spcStores.map((s, i) => {
                                            const pct = s.target > 0 ? Math.round((s.total_input / s.target) * 100) : 0;
                                            return (
                                                <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#ffffff' : '#faf5ff', borderBottom: '1px solid #e9d5ff' }}>
                                                    <td style={{ padding: '6px', fontWeight: 'bold', color: '#1e293b' }}>{s.store_name}</td>
                                                    <td style={{ padding: '6px', textAlign: 'center', fontFamily: 'monospace', color: '#64748b' }}>{s.target}</td>
                                                    <td style={{ padding: '6px', textAlign: 'center', fontFamily: 'monospace', color: '#7c3aed', fontWeight: 'bold' }}>{s.daily_input || 0}/{s.total_input}</td>
                                                    <td style={{ padding: '6px', textAlign: 'center', fontWeight: 'bold', color: pct >= timeGonePercent ? '#10b981' : '#ef4444' }}>{pct}%</td>
                                                    <td style={{ padding: '6px', textAlign: 'center', fontFamily: 'monospace', color: '#10b981' }}>{s.daily_closed || 0}/{s.total_closed}</td>
                                                    <td style={{ padding: '6px', textAlign: 'center', fontFamily: 'monospace', color: '#f59e0b' }}>{s.daily_pending || 0}/{s.total_pending}</td>
                                                    <td style={{ padding: '6px', textAlign: 'center', fontFamily: 'monospace', color: '#ef4444' }}>{s.daily_rejected || 0}/{s.total_rejected}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>

                                {/* Detail Per Promotor */}
                                <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#7c3aed', marginBottom: '8px', borderLeft: '4px solid #7c3aed', paddingLeft: '8px' }}>
                                    DETAIL PER PROMOTOR
                                </h3>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#a78bfa', color: '#ffffff' }}>
                                            <th style={{ padding: '5px', textAlign: 'left', fontWeight: 'bold' }}>TOKO</th>
                                            <th style={{ padding: '5px', textAlign: 'left', fontWeight: 'bold' }}>PROMOTOR</th>
                                            <th style={{ padding: '5px', textAlign: 'center', fontWeight: 'bold' }}>TARGET</th>
                                            <th style={{ padding: '5px', textAlign: 'center', fontWeight: 'bold' }}>INPUT (H/T)</th>
                                            <th style={{ padding: '5px', textAlign: 'center', fontWeight: 'bold' }}>%</th>
                                            <th style={{ padding: '5px', textAlign: 'center', fontWeight: 'bold' }}>CLO</th>
                                            <th style={{ padding: '5px', textAlign: 'center', fontWeight: 'bold' }}>PND</th>
                                            <th style={{ padding: '5px', textAlign: 'center', fontWeight: 'bold' }}>REJ</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {spcStores.map((store, storeIdx) => {
                                            if (!store.promotors || store.promotors.length === 0) {
                                                return (
                                                    <tr key={`store-${storeIdx}`} style={{ backgroundColor: storeIdx % 2 === 0 ? '#fefce8' : '#fef9c3', borderBottom: '1px solid #fde047' }}>
                                                        <td style={{ padding: '5px', color: '#78716c', fontSize: '9px' }}>{store.store_name}</td>
                                                        <td colSpan={7} style={{ padding: '5px', textAlign: 'center', fontStyle: 'italic', color: '#78716c' }}>(Tidak ada promotor)</td>
                                                    </tr>
                                                );
                                            }
                                            return store.promotors.map((promotor, promIdx) => {
                                                const promotorPct = promotor.target && promotor.target > 0 ? Math.round((promotor.total_input / promotor.target) * 100) : 0;
                                                return (
                                                    <tr key={`${storeIdx}-${promIdx}`} style={{ backgroundColor: storeIdx % 2 === 0 ? '#ffffff' : '#faf5ff', borderBottom: '1px solid #e9d5ff' }}>
                                                        <td style={{ padding: '5px', color: '#64748b', fontSize: '9px' }}>{promIdx === 0 ? store.store_name : ''}</td>
                                                        <td style={{ padding: '5px', fontWeight: 'bold', color: '#1e293b' }}>{promotor.name}</td>
                                                        <td style={{ padding: '5px', textAlign: 'center', fontFamily: 'monospace', color: '#64748b' }}>{promotor.target || 0}</td>
                                                        <td style={{ padding: '5px', textAlign: 'center', fontFamily: 'monospace', color: '#7c3aed', fontWeight: 'bold' }}>{promotor.daily_input || 0}/{promotor.total_input}</td>
                                                        <td style={{ padding: '5px', textAlign: 'center', fontWeight: 'bold', color: promotorPct >= timeGonePercent ? '#10b981' : '#ef4444' }}>{promotorPct}%</td>
                                                        <td style={{ padding: '5px', textAlign: 'center', fontFamily: 'monospace', color: '#10b981' }}>{promotor.daily_closed || 0}/{promotor.total_closed || 0}</td>
                                                        <td style={{ padding: '5px', textAlign: 'center', fontFamily: 'monospace', color: '#f59e0b' }}>{promotor.daily_pending || 0}/{promotor.total_pending || 0}</td>
                                                        <td style={{ padding: '5px', textAlign: 'center', fontFamily: 'monospace', color: '#ef4444' }}>{promotor.daily_rejected || 0}/{promotor.total_rejected || 0}</td>
                                                    </tr>
                                                );
                                            });
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Footer */}
                        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px', marginTop: '20px' }}>
                            <p style={{ fontSize: '10px', color: '#94a3b8', margin: 0 }}>Generated by SMARA System | Time Gone: {timeGonePercent}%</p>
                        </div>
                    </div>
                </div>

                {/* 3. Sticky Action Bottom - Positioned above floating nav */}
                <div className="fixed bottom-[82px] left-0 right-0 px-5 z-40">
                    <button
                        onClick={handleExport}
                        disabled={exporting || (!includePerformance && !includeUnderperform && !includeSpcData)}
                        className={cn(
                            "w-full h-16 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-[0_8px_30px_rgb(0,0,0,0.12)] active:scale-[0.97]",
                            exporting
                                ? "bg-muted text-muted-foreground"
                                : "bg-primary text-white hover:shadow-primary/20"
                        )}
                    >
                        {exporting ? (
                            <div className="flex items-center gap-2">
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span className="font-bold">SEDANG PROSES...</span>
                            </div>
                        ) : (
                            <>
                                <Download className="w-6 h-6 stroke-[3]" />
                                <span className="text-lg font-black tracking-widest uppercase">TARIK LAPORAN</span>
                            </>
                        )}
                    </button>
                </div>

                <ProfileSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            </div>

            {/* PNG TEMPLATE - SPC (Hidden, separate for split export) */}
            {spcStores.length > 0 && (
                <div style={{ position: 'absolute', left: '-9999px', pointerEvents: 'none' }}>
                    <div ref={spcTableRef} style={{ width: '800px', padding: '24px', backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }}>
                        {/* Header SPC */}
                        <div style={{ borderBottom: '3px solid #7c3aed', paddingBottom: '16px', marginBottom: '20px' }}>
                            <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#7c3aed', margin: 0 }}>SPC GRUP - PERFORMANCE TOKO</h1>
                            <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>
                                {user?.name} | {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} | Periode: {periodLabel}
                            </p>
                            <p style={{ fontSize: '11px', color: '#94a3b8', margin: '4px 0 0 0' }}>Format: Hari Ini / Total Bulan / Target | Time Gone: {timeGonePercent}%</p>
                        </div>

                        {/* Tabel Toko */}
                        <div style={{ marginBottom: '24px' }}>
                            <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#7c3aed', marginBottom: '8px', borderLeft: '4px solid #7c3aed', paddingLeft: '8px' }}>PERFORMANCE TOKO ({spcStores.length} Toko)</h2>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#7c3aed', color: '#ffffff' }}>
                                        <th style={{ padding: '6px', textAlign: 'left', fontWeight: 'bold' }}>TOKO</th>
                                        <th style={{ padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>TGT</th>
                                        <th style={{ padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>INPUT (H/T)</th>
                                        <th style={{ padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>%</th>
                                        <th style={{ padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>CLO (H/T)</th>
                                        <th style={{ padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>PND (H/T)</th>
                                        <th style={{ padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>REJ (H/T)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {spcStores.map((s, i) => {
                                        const pct = s.target > 0 ? Math.round((s.total_input / s.target) * 100) : 0;
                                        return (
                                            <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#ffffff' : '#faf5ff', borderBottom: '1px solid #e9d5ff' }}>
                                                <td style={{ padding: '6px', fontWeight: 'bold', color: '#1e293b' }}>{s.store_name}</td>
                                                <td style={{ padding: '6px', textAlign: 'center', fontFamily: 'monospace', color: '#64748b' }}>{s.target}</td>
                                                <td style={{ padding: '6px', textAlign: 'center', fontFamily: 'monospace', color: '#7c3aed', fontWeight: 'bold' }}>{s.daily_input || 0}/{s.total_input}</td>
                                                <td style={{ padding: '6px', textAlign: 'center', fontWeight: 'bold', color: pct >= timeGonePercent ? '#10b981' : '#ef4444' }}>{pct}%</td>
                                                <td style={{ padding: '6px', textAlign: 'center', fontFamily: 'monospace', color: '#10b981' }}>{s.daily_closed || 0}/{s.total_closed}</td>
                                                <td style={{ padding: '6px', textAlign: 'center', fontFamily: 'monospace', color: '#f59e0b' }}>{s.daily_pending || 0}/{s.total_pending}</td>
                                                <td style={{ padding: '6px', textAlign: 'center', fontFamily: 'monospace', color: '#ef4444' }}>{s.daily_rejected || 0}/{s.total_rejected}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Detail Per Promotor */}
                        <div style={{ marginBottom: '24px' }}>
                            <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#7c3aed', marginBottom: '8px', borderLeft: '4px solid #7c3aed', paddingLeft: '8px' }}>DETAIL PER PROMOTOR</h2>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#a78bfa', color: '#ffffff' }}>
                                        <th style={{ padding: '5px', textAlign: 'left', fontWeight: 'bold' }}>TOKO</th>
                                        <th style={{ padding: '5px', textAlign: 'left', fontWeight: 'bold' }}>PROMOTOR</th>
                                        <th style={{ padding: '5px', textAlign: 'center', fontWeight: 'bold' }}>TGT</th>
                                        <th style={{ padding: '5px', textAlign: 'center', fontWeight: 'bold' }}>INPUT (H/T)</th>
                                        <th style={{ padding: '5px', textAlign: 'center', fontWeight: 'bold' }}>%</th>
                                        <th style={{ padding: '5px', textAlign: 'center', fontWeight: 'bold' }}>CLO (H/T)</th>
                                        <th style={{ padding: '5px', textAlign: 'center', fontWeight: 'bold' }}>PND (H/T)</th>
                                        <th style={{ padding: '5px', textAlign: 'center', fontWeight: 'bold' }}>REJ (H/T)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {spcStores.map((store, storeIdx) => {
                                        if (!store.promotors || store.promotors.length === 0) {
                                            return (
                                                <tr key={`store-${storeIdx}`} style={{ backgroundColor: storeIdx % 2 === 0 ? '#fefce8' : '#fef9c3', borderBottom: '1px solid #fde047' }}>
                                                    <td style={{ padding: '5px', color: '#78716c', fontSize: '9px' }}>{store.store_name}</td>
                                                    <td colSpan={7} style={{ padding: '5px', textAlign: 'center', fontStyle: 'italic', color: '#78716c' }}>(Tidak ada promotor)</td>
                                                </tr>
                                            );
                                        }
                                        return store.promotors.map((promotor, promIdx) => {
                                            const promotorPct = promotor.target && promotor.target > 0 ? Math.round((promotor.total_input / promotor.target) * 100) : 0;
                                            return (
                                                <tr key={`${storeIdx}-${promIdx}`} style={{ backgroundColor: storeIdx % 2 === 0 ? '#ffffff' : '#faf5ff', borderBottom: '1px solid #e9d5ff' }}>
                                                    <td style={{ padding: '5px', color: '#64748b', fontSize: '9px' }}>{promIdx === 0 ? store.store_name : ''}</td>
                                                    <td style={{ padding: '5px', fontWeight: 'bold', color: '#1e293b' }}>{promotor.name}</td>
                                                    <td style={{ padding: '5px', textAlign: 'center', fontFamily: 'monospace', color: '#64748b' }}>{promotor.target || 0}</td>
                                                    <td style={{ padding: '5px', textAlign: 'center', fontFamily: 'monospace', color: '#7c3aed', fontWeight: 'bold' }}>{promotor.daily_input || 0}/{promotor.total_input}</td>
                                                    <td style={{ padding: '5px', textAlign: 'center', fontWeight: 'bold', color: promotorPct >= timeGonePercent ? '#10b981' : '#ef4444' }}>{promotorPct}%</td>
                                                    <td style={{ padding: '5px', textAlign: 'center', fontFamily: 'monospace', color: '#10b981' }}>{promotor.daily_closed || 0}/{promotor.total_closed || 0}</td>
                                                    <td style={{ padding: '5px', textAlign: 'center', fontFamily: 'monospace', color: '#f59e0b' }}>{promotor.daily_pending || 0}/{promotor.total_pending || 0}</td>
                                                    <td style={{ padding: '5px', textAlign: 'center', fontFamily: 'monospace', color: '#ef4444' }}>{promotor.daily_rejected || 0}/{promotor.total_rejected || 0}</td>
                                                </tr>
                                            );
                                        });
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Footer */}
                        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px', marginTop: '20px' }}>
                            <p style={{ fontSize: '10px', color: '#94a3b8', margin: 0 }}>Generated by SMARA System | Time Gone: {timeGonePercent}%</p>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
}
