'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { ProfileSidebar } from '@/components/ProfileSidebar';
import { Loading } from '@/components/ui/loading';
import { Alert } from '@/components/ui/alert';
import { createClient } from '@/lib/supabase/client';
import { User, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import html2canvas from 'html2canvas';

interface PromotorData {
    user_id: string;
    name: string;
    target?: number;
    total_input: number;
    total_closed: number;
    total_pending: number;
    total_rejected: number;
}

interface StoreData {
    store_id: string;
    store_name: string;
    store_code: string;
    target?: number;
    total_input: number;
    total_closed: number;
    total_pending: number;
    total_rejected: number;
    promotors?: PromotorData[];
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

const getMonthName = (month: number): string => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    return months[month];
};

const formatDate = (date: Date): string => {
    return date.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
};

export default function SPCDashboardPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [stores, setStores] = useState<StoreData[]>([]);
    const [totals, setTotals] = useState({ input: 0, closed: 0, pending: 0, rejected: 0, target: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [exporting, setExporting] = useState(false);

    // Ref untuk PNG template
    const reportRef = useRef<HTMLDivElement>(null);

    // View mode: monthly only (no daily view)
    const [viewMode] = useState<'daily' | 'monthly'>('monthly');

    // Date selection
    const [selectedDate, setSelectedDate] = useState(() => {
        const now = new Date();
        return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
    });

    const [timeGonePercent, setTimeGonePercent] = useState(0);

    const now = new Date();
    const getInitials = (name: string) => name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'U';

    // Check access
    useEffect(() => {
        if (user && !canAccessSPC(user)) {
            router.push('/unauthorized');
        }
    }, [user, router]);

    useEffect(() => {
        if (user && canAccessSPC(user)) {
            fetchData();
        }
    }, [user, viewMode, selectedDate]);

    const fetchData = async () => {
        setLoading(true);
        setError(null);

        try {
            const supabase = createClient();

            if (viewMode === 'daily') {
                const dateStr = `${selectedDate.year}-${String(selectedDate.month + 1).padStart(2, '0')}-${String(selectedDate.day).padStart(2, '0')}`;
                const { data, error: fnError } = await supabase.functions.invoke('dashboard-spc-daily', {
                    body: { userId: user?.id, date: dateStr }
                });

                if (fnError) throw fnError;
                if (!data?.success) throw new Error(data?.message || 'Failed to fetch data');

                setStores(data.stores || []);
                setTotals(data.totals || { input: 0, closed: 0, pending: 0, rejected: 0 });

                // Time gone for daily - percentage of day passed (not really meaningful, use 100%)
                setTimeGonePercent(100);
            } else {
                const monthStr = `${selectedDate.year}-${String(selectedDate.month + 1).padStart(2, '0')}`;
                const { data, error: fnError } = await supabase.functions.invoke('dashboard-spc-monthly', {
                    body: { userId: user?.id, month: monthStr }
                });

                if (fnError) throw fnError;
                if (!data?.success) throw new Error(data?.message || 'Failed to fetch data');

                setStores(data.stores || []);
                setTotals(data.totals || { input: 0, closed: 0, pending: 0, rejected: 0, target: 0 });
                setTimeGonePercent(data.timeGonePercent || 100);
            }
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Gagal memuat data');
        } finally {
            setLoading(false);
        }
    };

    // Navigation functions
    const goToPrev = () => {
        if (viewMode === 'daily') {
            const newDate = new Date(selectedDate.year, selectedDate.month, selectedDate.day - 1);
            setSelectedDate({ year: newDate.getFullYear(), month: newDate.getMonth(), day: newDate.getDate() });
        } else {
            setSelectedDate(prev => {
                if (prev.month === 0) return { ...prev, year: prev.year - 1, month: 11 };
                return { ...prev, month: prev.month - 1 };
            });
        }
    };

    const goToNext = () => {
        if (viewMode === 'daily') {
            const current = new Date(selectedDate.year, selectedDate.month, selectedDate.day);
            if (current >= new Date(now.getFullYear(), now.getMonth(), now.getDate())) return;
            const newDate = new Date(selectedDate.year, selectedDate.month, selectedDate.day + 1);
            setSelectedDate({ year: newDate.getFullYear(), month: newDate.getMonth(), day: newDate.getDate() });
        } else {
            const currentYearMonth = now.getFullYear() * 12 + now.getMonth();
            const selectedYearMonth = selectedDate.year * 12 + selectedDate.month;
            if (selectedYearMonth >= currentYearMonth) return;
            setSelectedDate(prev => {
                if (prev.month === 11) return { ...prev, year: prev.year + 1, month: 0 };
                return { ...prev, month: prev.month + 1 };
            });
        }
    };

    const isAtCurrent = () => {
        if (viewMode === 'daily') {
            return selectedDate.year === now.getFullYear() &&
                selectedDate.month === now.getMonth() &&
                selectedDate.day === now.getDate();
        }
        return selectedDate.year === now.getFullYear() && selectedDate.month === now.getMonth();
    };

    const getDisplayLabel = () => {
        if (viewMode === 'daily') {
            const date = new Date(selectedDate.year, selectedDate.month, selectedDate.day);
            return formatDate(date);
        }
        return `${getMonthName(selectedDate.month)} ${selectedDate.year}`;
    };

    // Performance calculation
    const getPercent = (store: StoreData) => {
        if (viewMode === 'daily') return 0; // No target for daily
        const target = store.target || 0;
        return target > 0 ? Math.round((store.total_input / target) * 100) : 0;
    };

    const isUnderperform = (store: StoreData) => {
        if (viewMode === 'daily') return false;
        const target = store.target || 0;
        if (target === 0) return true;
        return getPercent(store) < timeGonePercent;
    };

    const totalPercent = totals.target > 0 ? Math.round((totals.input / totals.target) * 100) : 0;

    // Period label untuk export
    const periodLabel = viewMode === 'daily'
        ? `${selectedDate.day}/${selectedDate.month + 1}/${selectedDate.year}`
        : `${getMonthName(selectedDate.month).toUpperCase()} ${selectedDate.year}`;

    // Handle Export PNG
    const handleExportPNG = async () => {
        if (!reportRef.current || exporting) return;

        setExporting(true);
        try {
            const canvas = await html2canvas(reportRef.current, {
                backgroundColor: '#ffffff',
                scale: 2,
                logging: false,
                useCORS: true,
                allowTaint: true,
                removeContainer: true
            });
            const link = document.createElement('a');
            const dateStr = new Date().toISOString().slice(0, 10);
            link.download = `SPC_GRUP_${user?.name || 'Report'}_${dateStr}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (err) {
            console.error('Export error:', err);
            alert('Gagal export PNG');
        } finally {
            setExporting(false);
        }
    };

    if (!user || !canAccessSPC(user)) {
        return <DashboardLayout><Loading message="Memeriksa akses..." /></DashboardLayout>;
    }

    if (loading) return <DashboardLayout><Loading message="Memuat data SPC..." /></DashboardLayout>;
    if (error) return <DashboardLayout><Alert type="error" message={error} /></DashboardLayout>;

    return (
        <DashboardLayout>
            <div className="min-h-screen bg-background pb-24">

                {/* Unified Header Banner - Match Manager Area Format */}
                <div className="relative w-full bg-primary pb-8 pt-4 px-5 rounded-b-[2rem] shadow-lg overflow-hidden">
                    {/* Abstract Decoration */}
                    <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 bg-blue-400 opacity-10 rounded-full blur-2xl pointer-events-none" />

                    {/* Top Bar */}
                    <div className="relative z-10 flex items-center justify-between mb-6">
                        <button onClick={() => setSidebarOpen(true)} className="flex items-center gap-3">
                            <div className="h-12 w-12 rounded-full bg-white/20 border-2 border-white/20 shadow-md flex items-center justify-center text-white font-bold">
                                {user?.name ? getInitials(user.name) : <User className="w-6 h-6" />}
                            </div>
                            <div className="flex flex-col text-left">
                                <span className="text-blue-100 text-xs font-medium uppercase tracking-wider">SPC Toko Grup</span>
                                <span className="text-white text-lg font-bold leading-tight">{user?.name || 'User'}</span>
                            </div>
                        </button>

                        {/* Download PNG - HANYA untuk SATOR (Manager/SPV punya menu Export) */}
                        {user?.role === 'sator' && (
                            <button
                                onClick={handleExportPNG}
                                disabled={exporting || stores.length === 0}
                                className={cn(
                                    "flex items-center justify-center h-10 px-3 gap-2 rounded-full transition-colors text-white",
                                    exporting || stores.length === 0
                                        ? "bg-white/10 opacity-50"
                                        : "bg-white/10 hover:bg-white/20"
                                )}
                            >
                                {exporting ? (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <Download className="w-4 h-4" />
                                )}
                                <span className="text-xs font-semibold">Download Gambar</span>
                            </button>
                        )}
                    </div>

                    {/* Date & Time Status Row with Navigation */}
                    <div className="relative z-10 flex flex-col gap-3">
                        <div className="flex justify-between items-end text-white">
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={goToPrev}
                                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <div>
                                    <div className="text-blue-200 text-xs font-semibold mb-1">PERIODE</div>
                                    <div className="text-2xl font-bold tracking-tight">{getDisplayLabel()}</div>
                                </div>
                                <button
                                    onClick={goToNext}
                                    disabled={isAtCurrent()}
                                    className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                                        isAtCurrent()
                                            ? 'bg-white/5 opacity-50 cursor-not-allowed'
                                            : 'bg-white/10 hover:bg-white/20'
                                    )}
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
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

                    {/* Summary Card */}
                    <div className="bg-card border border-border rounded-2xl p-5 shadow-xl">
                        <div className="flex justify-between items-center mb-3">
                            <div>
                                <div className="text-muted-foreground text-xs">TOTAL INPUT</div>
                                <div className="text-primary text-3xl font-bold">{totals.input}</div>
                            </div>
                            {viewMode === 'monthly' && (
                                <div className="text-right">
                                    <div className="text-muted-foreground text-xs">TARGET</div>
                                    <div className="text-foreground text-xl font-bold">{totals.target}</div>
                                </div>
                            )}
                        </div>

                        {viewMode === 'monthly' && (
                            <>
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
                            </>
                        )}

                        {/* Quick Stats */}
                        <div className="grid grid-cols-4 gap-2 mt-4">
                            <div className="text-center p-2 bg-muted/50 rounded-lg">
                                <div className="text-lg font-bold text-primary">{totals.input}</div>
                                <div className="text-xs text-muted-foreground">Input</div>
                            </div>
                            <div className="text-center p-2 bg-muted/50 rounded-lg">
                                <div className="text-lg font-bold text-emerald-500">{totals.closed}</div>
                                <div className="text-xs text-muted-foreground">Closing</div>
                            </div>
                            <div className="text-center p-2 bg-muted/50 rounded-lg">
                                <div className="text-lg font-bold text-amber-500">{totals.pending}</div>
                                <div className="text-xs text-muted-foreground">Pending</div>
                            </div>
                            <div className="text-center p-2 bg-muted/50 rounded-lg">
                                <div className="text-lg font-bold text-red-500">{totals.rejected}</div>
                                <div className="text-xs text-muted-foreground">Reject</div>
                            </div>
                        </div>
                    </div>

                    {/* Store Table */}
                    {stores.length === 0 ? (
                        <div className="bg-card border border-border rounded-2xl shadow-xl p-8 text-center">
                            <div className="text-5xl mb-3">🏪</div>
                            <h3 className="text-lg font-bold text-foreground mb-1">Tidak ada data</h3>
                            <p className="text-sm text-muted-foreground">
                                Belum ada data untuk bulan ini
                            </p>
                        </div>
                    ) : (
                        <div className="bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
                            <div className="px-4 py-3 flex justify-between items-center bg-gradient-to-r from-purple-500 to-indigo-500">
                                <span className="text-white font-bold text-sm">DAFTAR TOKO SPC</span>
                                <span className="text-white/80 text-xs">{stores.length} toko</span>
                            </div>

                            {/* Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead className="bg-muted/50 border-b border-border">
                                        <tr>
                                            <th className="sticky left-0 z-10 bg-muted/50 py-2 pl-3 pr-1 text-left text-[9px] font-bold uppercase text-muted-foreground">
                                                Toko
                                            </th>
                                            <th className="px-1 py-2 text-center text-[9px] font-bold uppercase text-muted-foreground">
                                                Tgt
                                            </th>
                                            <th className="px-1 py-2 text-center text-[9px] font-bold uppercase text-muted-foreground">
                                                Inp
                                            </th>
                                            <th className="px-0.5 py-2 text-center text-[9px] font-bold uppercase text-emerald-500">
                                                C
                                            </th>
                                            <th className="px-0.5 py-2 text-center text-[9px] font-bold uppercase text-amber-500">
                                                P
                                            </th>
                                            <th className="px-0.5 py-2 text-center text-[9px] font-bold uppercase text-red-500">
                                                R
                                            </th>
                                            <th className="pr-3 pl-1 py-2 text-right text-[9px] font-bold uppercase text-muted-foreground">
                                                %
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {stores
                                            .sort((a, b) => b.total_input - a.total_input)
                                            .map((store) => {
                                                const pct = getPercent(store);
                                                const under = isUnderperform(store);

                                                return (
                                                    <tr
                                                        key={store.store_id}
                                                        className={cn(
                                                            "group transition-colors",
                                                            under ? "bg-red-500/5 hover:bg-red-500/10" : "hover:bg-muted/30"
                                                        )}
                                                    >
                                                        <td className="sticky left-0 z-10 bg-background group-hover:bg-muted/10 py-2 pl-3 pr-1">
                                                            <div className="flex items-center gap-1">
                                                                {under && <div className="w-1 h-1 rounded-full bg-red-500 shrink-0" />}
                                                                <div className="flex flex-col min-w-0">
                                                                    <span className="font-bold text-foreground text-[11px] truncate">{store.store_name}</span>
                                                                    <span className="text-[8px] text-muted-foreground truncate">{store.store_code}</span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-1 py-2 text-center">
                                                            <div className="font-semibold text-[10px]">{store.target || 0}</div>
                                                        </td>
                                                        <td className="px-1 py-2 text-center">
                                                            <div className={cn(
                                                                "font-bold text-[11px]",
                                                                under ? 'text-red-500' : 'text-primary'
                                                            )}>{store.total_input}</div>
                                                        </td>
                                                        <td className="px-0.5 py-2 text-center font-semibold text-[10px] text-emerald-500">
                                                            {store.total_closed}
                                                        </td>
                                                        <td className="px-0.5 py-2 text-center font-semibold text-[10px] text-amber-500">
                                                            {store.total_pending}
                                                        </td>
                                                        <td className="px-0.5 py-2 text-center font-semibold text-[10px] text-red-500">
                                                            {store.total_rejected}
                                                        </td>
                                                        <td className="pr-3 pl-1 py-2 text-right">
                                                            <div className={cn(
                                                                "font-black text-[11px]",
                                                                pct >= 100 ? 'text-emerald-500' :
                                                                    pct >= timeGonePercent ? 'text-primary' : 'text-red-500'
                                                            )}>{pct}%</div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Bottom Spacer */}
                    <div className="h-10" />
                </div>

                {/* Profile Sidebar */}
                <ProfileSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            </div>

            {/* Hidden PNG Template for Export */}
            <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
                <div ref={reportRef} style={{ width: '600px', padding: '24px', backgroundColor: '#ffffff', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                    {/* Header SPC */}
                    <div style={{ marginBottom: '24px' }}>
                        <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#7c3aed', margin: '0 0 8px 0' }}>SPC GRUP</h1>
                        <div style={{ fontSize: '13px', color: '#374151', lineHeight: '1.6' }}>
                            <div><strong>AREA:</strong> TIMOR-SUMBA</div>
                            <div><strong>PERIODE:</strong> {periodLabel}</div>
                        </div>
                        <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '8px' }}>
                            {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })} | Time Gone: {timeGonePercent}%
                        </div>
                    </div>

                    {/* Table Performance Toko */}
                    <div style={{ marginBottom: '24px' }}>
                        <div style={{ backgroundColor: '#7c3aed', color: '#ffffff', padding: '10px 16px', fontSize: '13px', fontWeight: 'bold', borderRadius: '8px 8px 0 0' }}>
                            PERFORMANCE TOKO ({stores.length} Toko)
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f3e8ff' }}>
                                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 'bold', color: '#6b21a8', borderBottom: '2px solid #c4b5fd' }}>TOKO</th>
                                    <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 'bold', color: '#6b21a8', borderBottom: '2px solid #c4b5fd' }}>TARGET</th>
                                    <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 'bold', color: '#6b21a8', borderBottom: '2px solid #c4b5fd' }}>INPUT (H/T)</th>
                                    <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 'bold', color: '#6b21a8', borderBottom: '2px solid #c4b5fd' }}>%</th>
                                    <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 'bold', color: '#059669', borderBottom: '2px solid #c4b5fd' }}>CLO</th>
                                    <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 'bold', color: '#d97706', borderBottom: '2px solid #c4b5fd' }}>PND</th>
                                    <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 'bold', color: '#dc2626', borderBottom: '2px solid #c4b5fd' }}>REJ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stores.map((store, idx) => {
                                    const pct = getPercent(store);
                                    return (
                                        <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#faf5ff' }}>
                                            <td style={{ padding: '8px 12px', fontWeight: '600', color: '#581c87', borderBottom: '1px solid #e9d5ff' }}>{store.store_name}</td>
                                            <td style={{ padding: '8px', textAlign: 'center', fontFamily: 'monospace', color: '#7c3aed', borderBottom: '1px solid #e9d5ff' }}>{store.target || 0}</td>
                                            <td style={{ padding: '8px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 'bold', color: '#7c3aed', borderBottom: '1px solid #e9d5ff' }}>0/{store.total_input}</td>
                                            <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', color: pct >= timeGonePercent ? '#059669' : '#dc2626', borderBottom: '1px solid #e9d5ff' }}>{pct}%</td>
                                            <td style={{ padding: '8px', textAlign: 'center', fontFamily: 'monospace', color: '#059669', borderBottom: '1px solid #e9d5ff' }}>0/{store.total_closed}</td>
                                            <td style={{ padding: '8px', textAlign: 'center', fontFamily: 'monospace', color: '#d97706', borderBottom: '1px solid #e9d5ff' }}>0/{store.total_pending}</td>
                                            <td style={{ padding: '8px', textAlign: 'center', fontFamily: 'monospace', color: '#dc2626', borderBottom: '1px solid #e9d5ff' }}>0/{store.total_rejected}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Table Detail Per Promotor */}
                    <div style={{ marginBottom: '24px' }}>
                        <div style={{ backgroundColor: '#6b21a8', color: '#ffffff', padding: '10px 16px', fontSize: '13px', fontWeight: 'bold', borderRadius: '8px 8px 0 0' }}>
                            DETAIL PER PROMOTOR
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#ede9fe' }}>
                                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 'bold', color: '#581c87', borderBottom: '2px solid #c4b5fd' }}>TOKO</th>
                                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 'bold', color: '#581c87', borderBottom: '2px solid #c4b5fd' }}>PROMOTOR</th>
                                    <th style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', color: '#581c87', borderBottom: '2px solid #c4b5fd' }}>TARGET</th>
                                    <th style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', color: '#581c87', borderBottom: '2px solid #c4b5fd' }}>INPUT (H/T)</th>
                                    <th style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', color: '#581c87', borderBottom: '2px solid #c4b5fd' }}>%</th>
                                    <th style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', color: '#059669', borderBottom: '2px solid #c4b5fd' }}>CLO</th>
                                    <th style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', color: '#d97706', borderBottom: '2px solid #c4b5fd' }}>PND</th>
                                    <th style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', color: '#dc2626', borderBottom: '2px solid #c4b5fd' }}>REJ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stores.map((store, storeIdx) => {
                                    if (!store.promotors || store.promotors.length === 0) {
                                        return (
                                            <tr key={`st-${storeIdx}`} style={{ backgroundColor: '#fefce8' }}>
                                                <td style={{ padding: '6px 12px', color: '#7c3aed', borderBottom: '1px solid #e9d5ff' }}>{store.store_name}</td>
                                                <td colSpan={7} style={{ padding: '6px 12px', textAlign: 'center', fontStyle: 'italic', color: '#9ca3af', borderBottom: '1px solid #e9d5ff' }}>(Tidak ada promotor)</td>
                                            </tr>
                                        );
                                    }
                                    return store.promotors.map((promotor, promIdx) => {
                                        const promPct = promotor.target && promotor.target > 0 ? Math.round((promotor.total_input / promotor.target) * 100) : 0;
                                        return (
                                            <tr key={`${storeIdx}-${promIdx}`} style={{ backgroundColor: storeIdx % 2 === 0 ? '#ffffff' : '#faf5ff' }}>
                                                <td style={{ padding: '6px 12px', color: '#7c3aed', fontSize: '9px', borderBottom: '1px solid #e9d5ff' }}>{promIdx === 0 ? store.store_name : ''}</td>
                                                <td style={{ padding: '6px 12px', fontWeight: 'bold', color: '#581c87', borderBottom: '1px solid #e9d5ff' }}>{promotor.name}</td>
                                                <td style={{ padding: '6px 8px', textAlign: 'center', fontFamily: 'monospace', color: '#7c3aed', borderBottom: '1px solid #e9d5ff' }}>{promotor.target || 0}</td>
                                                <td style={{ padding: '6px 8px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 'bold', color: '#7c3aed', borderBottom: '1px solid #e9d5ff' }}>0/{promotor.total_input}</td>
                                                <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 'bold', color: promPct >= timeGonePercent ? '#059669' : '#dc2626', borderBottom: '1px solid #e9d5ff' }}>{promPct}%</td>
                                                <td style={{ padding: '6px 8px', textAlign: 'center', fontFamily: 'monospace', color: '#059669', borderBottom: '1px solid #e9d5ff' }}>0/{promotor.total_closed}</td>
                                                <td style={{ padding: '6px 8px', textAlign: 'center', fontFamily: 'monospace', color: '#d97706', borderBottom: '1px solid #e9d5ff' }}>0/{promotor.total_pending}</td>
                                                <td style={{ padding: '6px 8px', textAlign: 'center', fontFamily: 'monospace', color: '#dc2626', borderBottom: '1px solid #e9d5ff' }}>0/{promotor.total_rejected}</td>
                                            </tr>
                                        );
                                    });
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
