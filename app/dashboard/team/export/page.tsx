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

function getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

interface TeamMember {
    user_id: string;
    name: string;
    role: string;
    total_input: number;
    total_pending: number;
    total_rejected: number;
    total_closed: number;
    target?: number;
    isSelf?: boolean;
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
        user_id?: string;
        name: string;
        target?: number;
        total_input: number;
        total_closed?: number;
        total_pending?: number;
        total_rejected?: number;
        daily_input?: number;
        daily_closed?: number;
        daily_pending?: number;
        daily_rejected?: number;
    }[];
}

// Interface untuk daily data
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

// Whitelist akses SPC (hardcoded)
const SPC_WHITELIST = [
    { role: 'manager' },
    { name: 'Gery', role: 'spv' },
    { name: 'Andri', role: 'sator' }
];

function canAccessSPC(user: { name?: string; role?: string } | null): boolean {
    if (!user) return false;
    for (const allowed of SPC_WHITELIST) {
        if (!allowed.name && allowed.role === user.role) return true;
        if (allowed.name && allowed.role) {
            const userName = user.name?.toLowerCase() || '';
            if (userName.includes(allowed.name.toLowerCase()) && user.role === allowed.role) return true;
        }
    }
    return false;
}

export default function ExportPage() {
    const { user } = useAuth();
    const [sators, setSators] = useState<TeamMember[]>([]);
    const [allPromotors, setAllPromotors] = useState<TeamMember[]>([]);
    const [spcStores, setSpcStores] = useState<StoreData[]>([]);
    const [spcTotals, setSpcTotals] = useState({ input: 0, closed: 0, pending: 0, rejected: 0, target: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);
    const [hasSpcAccess, setHasSpcAccess] = useState(false);

    // Refs untuk tabel terpisah
    const satorTableRef = useRef<HTMLDivElement>(null);
    const promotorTableRef = useRef<HTMLDivElement>(null);
    const spcTableRef = useRef<HTMLDivElement>(null);

    // UI States
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const [exportFormat, setExportFormat] = useState<'excel' | 'png'>('excel');

    // Data selection states
    const [includeTeamPerformance, setIncludeTeamPerformance] = useState(true);
    const [includeTeamUnderperform, setIncludeTeamUnderperform] = useState(true);
    const [includeSpcData, setIncludeSpcData] = useState(false);



    // Time Gone
    // Time Gone & Month Selection
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);

    // Calculate time gone based on selected month
    const selectedDate = new Date(`${selectedMonth}-01`);
    const isCurrentMonth = selectedMonth === currentMonthStr;
    const daysInSelectedMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();
    // If selected month is current month, use current day, else use total days
    const dayProgress = isCurrentMonth ? now.getDate() : daysInSelectedMonth;
    const timeGonePercent = Math.round((dayProgress / daysInSelectedMonth) * 100);

    const periodLabel = selectedDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }).toUpperCase();


    useEffect(() => {
        if (user) {
            setHasSpcAccess(canAccessSPC(user));
            fetchData();
        }
    }, [user, selectedMonth]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const supabase = createClient();

            // Fetch team data (monthly + daily) secara paralel
            // Note: dashboard-team-daily might need selectedDate too if we want daily details for that month
            // But usually daily is for "today". Creating history daily view is complex. 
            // For export purpose, we mainly need monthly cumulative data for that month.
            // If API supports it, pass selectedMonth.

            const [monthlyResponse, dailyResponse] = await Promise.all([
                supabase.functions.invoke('dashboard-team-monthly', {
                    body: { userId: user?.id, month: selectedMonth }
                }),
                supabase.functions.invoke('dashboard-team-daily', {
                    body: { userId: user?.id, date: isCurrentMonth ? undefined : `${selectedMonth}-01` }
                    // If not current month, what does daily mean? 
                    // Usually "daily" returns today's data. 
                    // For historical export, "Input Hari Ini" might be irrelevant or 0.
                    // But we keep it as is or pass date if backend supports it.
                })
            ]);

            if (monthlyResponse.error) throw monthlyResponse.error;


            const directData: TeamMember[] = monthlyResponse.data?.subordinates || [];
            const dailyData = dailyResponse.data;

            // Build daily data maps untuk quick lookup
            const dailySatorMap = new Map<string, { total_input: number; total_closed: number; total_pending: number; total_rejected: number }>();
            const dailyPromotorMap = new Map<string, { total_input: number; total_closed: number; total_pending: number; total_rejected: number }>();

            if (dailyData?.sators) {
                (dailyData.sators as DailySator[]).forEach((sator: DailySator) => {
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
            }
            // Also check direct promotors from daily data
            if (dailyData?.direct_promotors) {
                dailyData.direct_promotors.forEach((p: DailyPromotor) => {
                    dailyPromotorMap.set(p.user_id, {
                        total_input: p.total_input,
                        total_closed: p.total_closed,
                        total_pending: p.total_pending,
                        total_rejected: p.total_rejected
                    });
                });
            }

            const satorListFromData = directData.filter((m: TeamMember) => m.role === 'sator');
            const directPromotors = directData.filter((m: TeamMember) => m.role === 'promotor');

            // Merge daily data ke sator list
            let satorList: TeamMember[] = satorListFromData.map(s => {
                const daily = dailySatorMap.get(s.user_id);
                return {
                    ...s,
                    daily_input: daily?.total_input || 0,
                    daily_closed: daily?.total_closed || 0,
                    daily_pending: daily?.total_pending || 0,
                    daily_rejected: daily?.total_rejected || 0
                };
            });

            // Merge daily data ke direct promotors
            const directPromotorsWithDaily = directPromotors.map(p => {
                const daily = dailyPromotorMap.get(p.user_id);
                return {
                    ...p,
                    daily_input: daily?.total_input || 0,
                    daily_closed: daily?.total_closed || 0,
                    daily_pending: daily?.total_pending || 0,
                    daily_rejected: daily?.total_rejected || 0
                };
            });

            if (directPromotorsWithDaily.length > 0 && user) {
                const selfAsSator: TeamMember = {
                    user_id: user.id,
                    name: user.name,
                    role: 'sator',
                    total_input: directPromotorsWithDaily.reduce((sum, p) => sum + (p.total_input || 0), 0),
                    total_pending: directPromotorsWithDaily.reduce((sum, p) => sum + (p.total_pending || 0), 0),
                    total_rejected: directPromotorsWithDaily.reduce((sum, p) => sum + (p.total_rejected || 0), 0),
                    total_closed: directPromotorsWithDaily.reduce((sum, p) => sum + (p.total_closed || 0), 0),
                    target: directPromotorsWithDaily.reduce((sum, p) => sum + (p.target || 0), 0),
                    daily_input: directPromotorsWithDaily.reduce((sum, p) => sum + (p.daily_input || 0), 0),
                    daily_closed: directPromotorsWithDaily.reduce((sum, p) => sum + (p.daily_closed || 0), 0),
                    daily_pending: directPromotorsWithDaily.reduce((sum, p) => sum + (p.daily_pending || 0), 0),
                    daily_rejected: directPromotorsWithDaily.reduce((sum, p) => sum + (p.daily_rejected || 0), 0),
                    isSelf: true
                };
                satorList.push(selfAsSator);
            }

            setSators(satorList);


            // Get complete promotor list from daily data (includes hierarchy)
            let promotorList: TeamMember[] = [...directPromotorsWithDaily];

            // Add promotors from sators using daily data as reference
            if (dailyData?.sators) {
                for (const dailySator of dailyData.sators as DailySator[]) {
                    // Fetch monthly data for this sator to get complete promotor info
                    // (fetch even if no daily data, as they may have monthly data)
                    const { data: satorMonthlyData } = await supabase.functions.invoke('dashboard-team-monthly', {
                        body: { userId: dailySator.user_id }
                    });

                    const satorSubData = satorMonthlyData?.subordinates || [];
                    const satorPromotors = satorSubData
                        .filter((m: TeamMember) => m.role === 'promotor')
                        .map((p: TeamMember) => {
                            const daily = dailyPromotorMap.get(p.user_id);
                            return {
                                ...p,
                                daily_input: daily?.total_input || 0,
                                daily_closed: daily?.total_closed || 0,
                                daily_pending: daily?.total_pending || 0,
                                daily_rejected: daily?.total_rejected || 0
                            };
                        });

                    promotorList = [...promotorList, ...satorPromotors];
                }
            }

            setAllPromotors(promotorList);


            // Fetch SPC data (monthly + daily) if user has access
            if (canAccessSPC(user)) {
                const monthStr = selectedMonth;

                // Fetch SPC monthly and daily in parallel
                const [spcMonthlyResponse, spcDailyResponse] = await Promise.all([
                    supabase.functions.invoke('dashboard-spc-monthly', { body: { userId: user?.id, month: monthStr } }),
                    supabase.functions.invoke('dashboard-spc-daily', { body: { userId: user?.id } })
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
            }

        } catch (err) {
            setError('Gagal memuat data');
        } finally {
            setLoading(false);
        }
    };

    const isUnderperform = (m: TeamMember | StoreData): boolean => {
        const target = ('target' in m) ? (m.target || 0) : 0;
        const input = m.total_input || 0;
        if (target === 0) return true;
        return (input / target) * 100 < timeGonePercent;
    };

    const handleExport = async (fmt: 'excel' | 'png', incTeam: boolean, incUnder: boolean, incSpc: boolean) => {
        setExporting(true);
        try {
            const dateStr = new Date().toISOString().slice(0, 10);
            const userName = user?.name?.replace(/\s+/g, '_') || 'SPV';

            // EXCEL EXPORT
            if (fmt === 'excel') {
                const wb = XLSX.utils.book_new();

                // Team Performance - Format: H/T/TGT (Hari Ini / Total / Target)
                if (incTeam) {
                    const satorData = sators.map(m => {
                        const pct = m.target ? Math.round((m.total_input / m.target) * 100) : 0;
                        return {
                            NAMA: m.name,
                            'INPUT (H/T/TGT)': `${m.daily_input || 0}/${m.total_input}/${m.target || 0}`,
                            'CAPAIAN_%': pct,
                            'CLOSING (H/T)': `${m.daily_closed || 0}/${m.total_closed}`,
                            'PENDING (H/T)': `${m.daily_pending || 0}/${m.total_pending}`,
                            'REJECT (H/T)': `${m.daily_rejected || 0}/${m.total_rejected}`,
                            STATUS: isUnderperform(m) ? 'UNDERPERFORM' : 'OK'
                        };
                    });
                    if (satorData.length > 0) {
                        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(satorData), "TIM_SATOR");
                    }

                    const promotorData = allPromotors.map(m => {
                        const pct = m.target ? Math.round((m.total_input / m.target) * 100) : 0;
                        return {
                            NAMA: m.name,
                            'INPUT (H/T/TGT)': `${m.daily_input || 0}/${m.total_input}/${m.target || 0}`,
                            'CAPAIAN_%': pct,
                            'CLOSING (H/T)': `${m.daily_closed || 0}/${m.total_closed}`,
                            'PENDING (H/T)': `${m.daily_pending || 0}/${m.total_pending}`,
                            'REJECT (H/T)': `${m.daily_rejected || 0}/${m.total_rejected}`,
                            STATUS: isUnderperform(m) ? 'UNDERPERFORM' : 'OK'
                        };
                    });
                    if (promotorData.length > 0) {
                        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(promotorData), "TIM_PROMOTOR");
                    }
                }

                // Team Underperform - Format: H/T/TGT
                if (incUnder) {
                    const underData = [
                        ...sators.filter(isUnderperform).map(m => ({
                            NAMA: m.name,
                            ROLE: 'SATOR',
                            'INPUT (H/T/TGT)': `${m.daily_input || 0}/${m.total_input}/${m.target || 0}`,
                            'CLOSING (H/T)': `${m.daily_closed || 0}/${m.total_closed}`,
                            'PENDING (H/T)': `${m.daily_pending || 0}/${m.total_pending}`,
                            'REJECT (H/T)': `${m.daily_rejected || 0}/${m.total_rejected}`,
                            GAP: (m.target || 0) - m.total_input
                        })),
                        ...allPromotors.filter(isUnderperform).map(m => ({
                            NAMA: m.name,
                            ROLE: 'PROMOTOR',
                            'INPUT (H/T/TGT)': `${m.daily_input || 0}/${m.total_input}/${m.target || 0}`,
                            'CLOSING (H/T)': `${m.daily_closed || 0}/${m.total_closed}`,
                            'PENDING (H/T)': `${m.daily_pending || 0}/${m.total_pending}`,
                            'REJECT (H/T)': `${m.daily_rejected || 0}/${m.total_rejected}`,
                            GAP: (m.target || 0) - m.total_input
                        })),
                    ];
                    if (underData.length > 0) {
                        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(underData), "TIM_UNDERPERFORM");
                    }
                }


                // SPC Data - Format: H/T/TGT
                if (incSpc && hasSpcAccess && spcStores.length > 0) {
                    // Sheet 1: SPC Performance (Toko)
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

                    // Sheet 2: SPC Detail Promotor (dengan target)
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

                    // Sheet 3: SPC Summary dengan Header Standar
                    const today = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
                    const managerName = user?.role === 'manager' ? user.name : (user?.name || 'N/A');

                    const spcSummary = [
                        { Label: 'HEADER', Value: 'SPC GRUP' },
                        { Label: 'AREA', Value: 'TIMOR-SUMBA' },
                        { Label: 'MANAGER AREA', Value: managerName },
                        { Label: 'TANGGAL', Value: today },
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

                XLSX.writeFile(wb, `Laporan_${userName}_${dateStr}.xlsx`);
            }

            // PNG EXPORT - Download multiple images
            if (fmt === 'png') {
                const downloadImage = async (ref: React.RefObject<HTMLDivElement | null>, filename: string) => {
                    if (!ref.current) return;
                    try {
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
                        // Small delay to ensure browser handles download
                        await new Promise(resolve => setTimeout(resolve, 800));
                    } catch (e) {
                        console.error('Error generating image:', e);
                    }
                };

                // 1. Download Sator Performance
                if (incTeam && satorTableRef.current && sators.length > 0) {
                    await downloadImage(satorTableRef, `SPV_Sator_Month_${periodLabel.replace(/\s/g, '_')}.png`);
                }

                // 2. Download Promotor Performance (Separate Image)
                if (incTeam && promotorTableRef.current && allPromotors.length > 0) {
                    await downloadImage(promotorTableRef, `SPV_Promotor_Month_${periodLabel.replace(/\s/g, '_')}.png`);
                }

                // 3. Download SPC if selected
                if (incSpc && hasSpcAccess && spcStores.length > 0 && spcTableRef.current) {
                    await downloadImage(spcTableRef, `SPV_SPC_Month_${periodLabel.replace(/\s/g, '_')}.png`);
                }
            }

        } catch (err) {
            console.error(err);
            alert('Gagal export data');
        } finally {
            setExporting(false);
        }
    };

    if (loading) return <DashboardLayout allowedRoles={['spv', 'sator']}><Loading message="Memuat data..." /></DashboardLayout>;

    if (error) return (
        <DashboardLayout allowedRoles={['spv', 'sator']}>
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="text-red-500 font-bold bg-red-50 px-6 py-4 rounded-xl border border-red-100 shadow-sm">
                    {error}
                </div>
            </div>
        </DashboardLayout>
    );

    const underperformCount = sators.filter(isUnderperform).length + allPromotors.filter(isUnderperform).length;
    const totalInput = allPromotors.reduce((s, m) => s + m.total_input, 0);
    const totalClosing = allPromotors.reduce((s, m) => s + m.total_closed, 0);
    const spcUnderperformCount = spcStores.filter(isUnderperform).length;

    return (
        <DashboardLayout allowedRoles={['spv', 'sator']}>
            <ProfileSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

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

                {/* 2. Simple Content - Just Month + Action Buttons */}
                <div className="px-5 -mt-6 relative z-20 space-y-5">

                    {/* Month Selector */}
                    <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <button
                                onClick={() => {
                                    const [year, month] = selectedMonth.split('-').map(Number);
                                    const prev = new Date(year, month - 2, 1);
                                    setSelectedMonth(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`);
                                }}
                                className="h-12 w-12 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-all"
                            >
                                <ArrowLeft className="w-6 h-6 text-foreground" />
                            </button>
                            <div className="text-center">
                                <div className="text-xl font-black text-foreground">{periodLabel}</div>
                                {!isCurrentMonth && (
                                    <div className="text-xs text-amber-600 font-medium mt-1">⏰ Data bulan lalu</div>
                                )}
                            </div>
                            <button
                                onClick={() => {
                                    const [year, month] = selectedMonth.split('-').map(Number);
                                    const next = new Date(year, month, 1);
                                    const nextStr = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
                                    if (nextStr <= currentMonthStr) {
                                        setSelectedMonth(nextStr);
                                    }
                                }}
                                disabled={isCurrentMonth}
                                className={cn(
                                    "h-12 w-12 rounded-full flex items-center justify-center transition-all",
                                    isCurrentMonth ? "bg-muted/30 cursor-not-allowed" : "bg-muted hover:bg-muted/80"
                                )}
                            >
                                <ArrowLeft className={cn("w-6 h-6 rotate-180", isCurrentMonth ? "text-muted-foreground/30" : "text-foreground")} />
                            </button>
                        </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
                        <div className="grid grid-cols-3 divide-x divide-border">
                            <div className="text-center px-2">
                                <div className="text-2xl font-black text-foreground">{sators.length}</div>
                                <div className="text-[10px] font-bold text-muted-foreground uppercase">Sator</div>
                            </div>
                            <div className="text-center px-2">
                                <div className="text-2xl font-black text-foreground">{allPromotors.length}</div>
                                <div className="text-[10px] font-bold text-muted-foreground uppercase">Promotor</div>
                            </div>
                            <div className="text-center px-2">
                                <div className="text-2xl font-black text-primary">{totalInput}</div>
                                <div className="text-[10px] font-bold text-muted-foreground uppercase">Input</div>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons - Simple & Clear */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-black text-muted-foreground uppercase tracking-widest pl-1">Download Laporan</h3>

                        {/* Excel Button */}
                        <button
                            onClick={() => { setExportFormat('excel'); setIncludeTeamPerformance(true); setIncludeTeamUnderperform(true); setIncludeSpcData(true); handleExport('excel', true, true, true); }}
                            disabled={exporting}
                            className="w-full flex items-center gap-4 p-5 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-2xl text-white shadow-lg hover:shadow-xl transition-all active:scale-[0.98]"
                        >
                            <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center">
                                <FileSpreadsheet className="w-7 h-7" />
                            </div>
                            <div className="flex-1 text-left">
                                <div className="font-black text-lg">DOWNLOAD EXCEL</div>
                                <div className="text-emerald-100 text-sm">Semua data lengkap .xlsx</div>
                            </div>
                        </button>

                        {/* Image Button */}
                        <button
                            onClick={() => { setExportFormat('png'); setIncludeTeamPerformance(true); setIncludeTeamUnderperform(false); setIncludeSpcData(false); handleExport('png', true, false, false); }}
                            disabled={exporting}
                            className="w-full flex items-center gap-4 p-5 bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl text-white shadow-lg hover:shadow-xl transition-all active:scale-[0.98]"
                        >
                            <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center">
                                <Image className="w-7 h-7" />
                            </div>
                            <div className="flex-1 text-left">
                                <div className="font-black text-lg">GAMBAR TIM</div>
                                <div className="text-blue-100 text-sm">Laporan kinerja tim .png</div>
                            </div>
                        </button>

                        {/* SPC Image Button */}
                        {hasSpcAccess && (
                            <button
                                onClick={() => { setExportFormat('png'); setIncludeTeamPerformance(false); setIncludeTeamUnderperform(false); setIncludeSpcData(true); handleExport('png', false, false, true); }}
                                disabled={exporting || spcStores.length === 0}
                                className={cn(
                                    "w-full flex items-center gap-4 p-5 rounded-2xl shadow-lg transition-all active:scale-[0.98]",
                                    spcStores.length === 0
                                        ? "bg-muted text-muted-foreground"
                                        : "bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:shadow-xl"
                                )}
                            >
                                <div className={cn("w-14 h-14 rounded-xl flex items-center justify-center", spcStores.length === 0 ? "bg-muted-foreground/10" : "bg-white/20")}>
                                    <span className="text-3xl">🏪</span>
                                </div>
                                <div className="flex-1 text-left">
                                    <div className="font-black text-lg">GAMBAR SPC</div>
                                    <div className={spcStores.length === 0 ? "text-muted-foreground text-sm" : "text-purple-100 text-sm"}>
                                        {spcStores.length > 0 ? `Laporan ${spcStores.length} toko SPC .png` : 'Belum ada data SPC'}
                                    </div>
                                </div>
                            </button>
                        )}
                    </div>

                    {/* Loading Indicator */}
                    {exporting && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                            <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-4 shadow-2xl">
                                <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                                <div className="font-bold text-foreground">Memproses laporan...</div>
                            </div>
                        </div>
                    )}

                </div>




            </div>

            {/* PNG TEMPLATE - SATOR ONLY (Hidden) */}
            <div style={{ position: 'absolute', left: '-9999px', pointerEvents: 'none' }}>
                <div ref={satorTableRef} style={{ width: '800px', padding: '24px', backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }}>
                    <div style={{ borderBottom: '3px solid #1e293b', paddingBottom: '16px', marginBottom: '20px' }}>
                        <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>PERFORMA TIM - SATOR</h1>
                        <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>
                            {user?.name} | {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} | Periode: {periodLabel}
                        </p>
                    </div>

                    {includeTeamPerformance && sators.length > 0 && (
                        <div>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#1e293b', color: '#ffffff' }}>
                                        <th style={{ padding: '8px', textAlign: 'left', fontWeight: 'bold' }}>NAMA SATOR</th>
                                        <th style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>INPUT (H/T/TGT)</th>
                                        <th style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>CLOSING</th>
                                        <th style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>PENDING</th>
                                        <th style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>REJECT</th>
                                        <th style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>%</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sators.map((s, i) => {
                                        const pct = s.target ? Math.round((s.total_input / s.target) * 100) : 0;
                                        return (
                                            <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#ffffff' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                                <td style={{ padding: '8px', fontWeight: 'bold', color: '#1e293b' }}>{s.name}</td>
                                                <td style={{ padding: '8px', textAlign: 'center', fontFamily: 'monospace', color: '#3b82f6', fontWeight: 'bold' }}>{s.daily_input || 0}/{s.total_input}/{s.target || 0}</td>
                                                <td style={{ padding: '8px', textAlign: 'center', fontFamily: 'monospace', color: '#10b981' }}>{s.daily_closed || 0}/{s.total_closed}</td>
                                                <td style={{ padding: '8px', textAlign: 'center', fontFamily: 'monospace', color: '#f59e0b' }}>{s.daily_pending || 0}/{s.total_pending}</td>
                                                <td style={{ padding: '8px', textAlign: 'center', fontFamily: 'monospace', color: '#ef4444' }}>{s.daily_rejected || 0}/{s.total_rejected}</td>
                                                <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', color: pct >= timeGonePercent ? '#10b981' : '#ef4444' }}>{pct}%</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* PNG TEMPLATE - PROMOTOR ONLY (Hidden) */}
            <div style={{ position: 'absolute', left: '-9999px', pointerEvents: 'none' }}>
                <div ref={promotorTableRef} style={{ width: '800px', padding: '24px', backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }}>
                    <div style={{ borderBottom: '3px solid #7c3aed', paddingBottom: '16px', marginBottom: '20px' }}>
                        <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#7c3aed', margin: 0 }}>PERFORMA TIM - PROMOTOR ({allPromotors.length})</h1>
                        <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>
                            {user?.name} | {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} | Periode: {periodLabel}
                        </p>
                    </div>

                    {includeTeamPerformance && allPromotors.length > 0 && (
                        <div>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#7c3aed', color: '#ffffff' }}>
                                        <th style={{ padding: '6px', textAlign: 'left', fontWeight: 'bold' }}>NAMA PROMOTOR</th>
                                        <th style={{ padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>INPUT (H/T/TGT)</th>
                                        <th style={{ padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>%</th>
                                        <th style={{ padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>CLO</th>
                                        <th style={{ padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>PND</th>
                                        <th style={{ padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>REJ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {allPromotors.map((p, i) => {
                                        const pct = p.target ? Math.round((p.total_input / p.target) * 100) : 0;
                                        return (
                                            <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#ffffff' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                                <td style={{ padding: '6px', fontWeight: 'bold', color: '#1e293b' }}>{p.name}</td>
                                                <td style={{ padding: '6px', textAlign: 'center', fontFamily: 'monospace', color: '#3b82f6', fontWeight: 'bold' }}>{p.daily_input || 0}/{p.total_input}/{p.target || 0}</td>
                                                <td style={{ padding: '6px', textAlign: 'center', fontWeight: 'bold', color: pct >= timeGonePercent ? '#10b981' : '#ef4444' }}>{pct}%</td>
                                                <td style={{ padding: '6px', textAlign: 'center', fontFamily: 'monospace', color: '#10b981' }}>{p.daily_closed || 0}/{p.total_closed}</td>
                                                <td style={{ padding: '6px', textAlign: 'center', fontFamily: 'monospace', color: '#f59e0b' }}>{p.daily_pending || 0}/{p.total_pending}</td>
                                                <td style={{ padding: '6px', textAlign: 'center', fontFamily: 'monospace', color: '#ef4444' }}>{p.daily_rejected || 0}/{p.total_rejected}</td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                            {/* Underperform Table Attached if needed, or separate? For now separate in Excel, combined here if requested, but user asked for simple split. I will add Underperform List to Promotor Image if needed, but let's keep it simple focused on Performance list as per request "Sator Performance and Promotor Performance" */}
                        </div>
                    )}
                </div>
            </div>

            {/* PNG TEMPLATE - SPC (Hidden, separate for split export) */}
            {
                hasSpcAccess && spcStores.length > 0 && (
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


                        </div>
                    </div>
                )
            }
        </DashboardLayout >
    );
}
