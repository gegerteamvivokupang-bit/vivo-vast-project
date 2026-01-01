'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import ManagerHeader from '@/components/ManagerHeader';
import { Loading } from '@/components/ui/loading';
import { Alert } from '@/components/ui/alert';
import { createClient } from '@/lib/supabase/client';
import { ChevronRight, Calendar, Check, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// Shared Types
import { AggDailyPromoter, FinanceData } from '@/types/api.types';

// Utilities
import { parseSupabaseError, logError } from '@/lib/errors';
import { formatDateWITA, getCurrentDateWITA } from '@/lib/date-utils';
import { formatCurrency } from '@/lib/dashboard-logic';

interface LocalPromotor extends AggDailyPromoter {
    user_id: string; // Compatibility with legacy API structure
    name: string;
    is_empty: boolean;
    has_reject: boolean;
}

interface LocalSator {
    user_id: string;
    name: string;
    total_input: number; // Aggregated manually or by DB
    promotors: LocalPromotor[];
}

interface LocalArea {
    user_id: string; // Area ID (usually SPV ID or Area ID)
    area_name: string;
    spv_name: string;
    total_input: number;
    total_closed: number;
    total_pending: number;
    total_rejected: number;
    sators: LocalSator[];
}

interface DailyDataDetail {
    date: string;
    date_formatted: string;
    totals: {
        total_input: number;
        total_closed: number;
        total_pending: number;
        total_rejected: number;
    };
    promotor_stats: {
        total: number;
        active: number;
        empty: number;
        with_reject: number;
    };
    areas: LocalArea[];
}

interface Submission {
    id: string;
    customer_name: string;
    customer_phone: string;
    sale_date: string;
    status: string;
    limit_amount: number;
    dp_amount: number;
    tenor: number;
    pekerjaan: string;
    penghasilan: number;
    has_npwp: boolean;
    image_urls: string[];
}

export default function ManagerDailyPage() {
    const { user } = useAuth();
    const [data, setData] = useState<DailyDataDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedArea, setSelectedArea] = useState<string>('all');

    // Modal state for promotor list
    const [showModal, setShowModal] = useState(false);
    const [modalPromotor, setModalPromotor] = useState<LocalPromotor | null>(null);
    const [modalSubmissions, setModalSubmissions] = useState<FinanceData[]>([]);
    const [modalLoading, setModalLoading] = useState(false);

    // Modal state for submission detail
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedSubmission, setSelectedSubmission] = useState<FinanceData | null>(null);

    // Date filter state
    const [showDatePicker, setShowDatePicker] = useState(false);
    const now = getCurrentDateWITA();
    const todayStr = formatDateWITA(now);
    const [selectedDate, setSelectedDate] = useState(todayStr);

    // Generate date options (last 30 days)
    const dateOptions = Array.from({ length: 30 }, (_, i) => {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const value = d.toISOString().split('T')[0];
        const label = i === 0 ? 'Hari Ini' : i === 1 ? 'Kemarin' : d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
        return { value, label };
    });

    const selectedDateLabel = dateOptions.find(d => d.value === selectedDate)?.label ||
        new Date(selectedDate).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });

    useEffect(() => {
        if (user) fetchData();
    }, [user, selectedDate]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const supabase = createClient();
            const { data: result, error: fnError } = await supabase.functions.invoke('dashboard-manager-daily', {
                body: { date: selectedDate }
            });

            if (fnError) throw fnError;
            setData(result);
        } catch (err) {
            const apiError = parseSupabaseError(err);
            logError(apiError, { userId: user?.id, page: 'manager-dashboard-daily', action: 'fetchData' });
            setError(apiError.message);
        } finally {
            setLoading(false);
        }
    };

    const openPromotorDetail = async (promotor: LocalPromotor) => {
        setModalPromotor(promotor);
        setShowModal(true);
        setModalLoading(true);
        setModalSubmissions([]);

        try {
            const supabase = createClient();

            // Get promotor ID (handle both field names)
            const promotorId = promotor.promoter_user_id || promotor.user_id;

            if (!promotorId) {
                console.error('Promotor ID not found');
                setModalSubmissions([]);
                return;
            }

            // Fetch submissions for this promotor on selected date
            const { data: submissions, error } = await supabase
                .from('vast_finance_data_new')
                .select('id, customer_name, customer_phone, sale_date, status, approval_status, transaction_status, limit_amount, dp_amount, tenor, pekerjaan, penghasilan, has_npwp, image_urls')
                .eq('created_by_user_id', promotorId)
                .eq('sale_date', selectedDate)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Transform status
            const transformed = (submissions || []).map((item: any) => {
                let displayStatus = item.status;
                if (item.approval_status === 'approved') {
                    displayStatus = item.transaction_status === 'closed' ? 'acc' : 'pending';
                } else if (item.approval_status === 'rejected') {
                    displayStatus = 'reject';
                }
                return { ...item, status: displayStatus };
            });

            setModalSubmissions(transformed);
        } catch (err) {
            console.error('Error fetching submissions:', err);
        } finally {
            setModalLoading(false);
        }
    };

    if (loading) return <DashboardLayout><Loading message="Memuat data harian..." /></DashboardLayout>;
    if (error) return <DashboardLayout><Alert type="error" message={error} /></DashboardLayout>;
    if (!data) return <DashboardLayout><Alert type="error" message="Data tidak tersedia" /></DashboardLayout>;

    // Filter by selected area only
    const getFilteredAreas = (): LocalArea[] => {
        if (selectedArea === 'all') return data.areas;
        return data.areas.filter(a => a.user_id === selectedArea);
    };

    const filteredAreas = getFilteredAreas();

    const getSelectedAreaStats = () => {
        if (selectedArea === 'all') return data.promotor_stats;
        const area = data.areas.find(a => a.user_id === selectedArea);
        if (!area) return data.promotor_stats;
        let total = 0, active = 0, empty = 0, withReject = 0;
        area.sators.forEach(s => {
            s.promotors.forEach(p => {
                total++;
                if (p.is_empty) empty++; else active++;
                if (p.has_reject) withReject++;
            });
        });
        return { total, active, empty, with_reject: withReject };
    };

    const selectedStats = getSelectedAreaStats();

    const getSelectedAreaTotals = () => {
        if (selectedArea === 'all') return data.totals;
        const area = data.areas.find(a => a.user_id === selectedArea);
        if (!area) return data.totals;
        return {
            total_input: area.total_input,
            total_closed: area.total_closed,
            total_pending: area.total_pending,
            total_rejected: area.total_rejected
        };
    };

    const selectedTotals = getSelectedAreaTotals();

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'acc':
                return <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/20 text-success">ACC</span>;
            case 'pending':
                return <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-warning/20 text-warning">PENDING</span>;
            case 'reject':
                return <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-destructive/20 text-destructive">REJECT</span>;
            default:
                return <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-foreground">{status}</span>;
        }
    };

    const openSubmissionDetail = (submission: FinanceData) => {
        setSelectedSubmission(submission);
        setShowDetailModal(true);
    };

    return (
        <DashboardLayout allowedRoles={['manager']}>
            <div className="min-h-screen bg-background pb-24">

                <ManagerHeader
                    title="PROGRESS HARIAN"
                    subtitle={selectedDateLabel}
                    backUrl="/dashboard/area"
                />

                <div className="p-3">
                    {/* Date Picker Button */}
                    <button
                        onClick={() => setShowDatePicker(true)}
                        className="w-full flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 mb-3 shadow-sm active:scale-[0.98] transition-all"
                    >
                        <Calendar className="w-5 h-5 text-primary shrink-0" />
                        <span className="flex-1 text-left text-foreground text-sm font-bold">{selectedDateLabel}</span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground rotate-90" />
                    </button>

                    {/* Bottom Sheet Date Picker */}
                    {showDatePicker && (
                        <div className="fixed inset-0 z-50 flex items-end justify-center">
                            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowDatePicker(false)} />
                            <div className="relative w-full max-w-lg bg-card rounded-t-3xl p-5 pb-8 animate-in slide-in-from-bottom">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-bold text-foreground">Pilih Tanggal</h3>
                                    <button onClick={() => setShowDatePicker(false)} className="p-2 rounded-full hover:bg-muted">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                                    {dateOptions.map(opt => (
                                        <button
                                            key={opt.value}
                                            onClick={() => { setSelectedDate(opt.value); setShowDatePicker(false); }}
                                            className={cn(
                                                "w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors",
                                                selectedDate === opt.value ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80 text-foreground"
                                            )}
                                        >
                                            <span className="font-medium">{opt.label}</span>
                                            {selectedDate === opt.value && <Check className="w-5 h-5" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Area Selection Tabs */}
                    <div className="grid grid-cols-4 gap-1.5 mb-3">
                        <button
                            onClick={() => setSelectedArea('all')}
                            className={`py-2 rounded-xl text-xs font-semibold transition-all ${selectedArea === 'all'
                                ? 'bg-primary text-primary-foreground shadow-md'
                                : 'bg-card text-muted-foreground shadow-md'
                                }`}
                        >
                            <div>All</div>
                            <div className={`text-[10px] ${selectedArea === 'all' ? 'text-primary-foreground/80' : 'text-primary'}`}>
                                {data.totals.total_input}
                            </div>
                        </button>
                        {data.areas.map((area) => {
                            const shortName = area.area_name.toLowerCase().includes('kupang') ? 'KPG'
                                : area.area_name.toLowerCase().includes('sumba') ? 'SMB'
                                    : area.area_name.toLowerCase().includes('kabupaten') ? 'Kab'
                                        : area.area_name.substring(0, 3).toUpperCase();
                            return (
                                <button
                                    key={area.user_id}
                                    onClick={() => setSelectedArea(area.user_id)}
                                    className={`py-2 rounded-xl text-xs font-semibold transition-all ${selectedArea === area.user_id
                                        ? 'bg-primary text-primary-foreground shadow-md'
                                        : 'bg-card text-muted-foreground shadow-md'
                                        }`}
                                >
                                    <div>{shortName}</div>
                                    <div className={`text-[10px] ${selectedArea === area.user_id ? 'text-primary-foreground/80' : 'text-primary'}`}>
                                        {area.total_input}
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* Summary Card - Compact */}
                    <div className="bg-primary rounded-xl p-4 mb-3 shadow-md">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <p className="text-primary-foreground/80 text-[10px] uppercase tracking-wide">Input Hari Ini</p>
                                <p className="text-primary-foreground font-bold text-3xl">{selectedTotals.total_input}</p>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="text-center">
                                    <div className="text-primary-foreground font-bold text-lg">{selectedTotals.total_closed}</div>
                                    <div className="text-primary-foreground/80 text-[9px]">CLS</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-primary-foreground font-bold text-lg">{selectedTotals.total_pending}</div>
                                    <div className="text-primary-foreground/80 text-[9px]">PND</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-primary-foreground font-bold text-lg">{selectedTotals.total_rejected}</div>
                                    <div className="text-primary-foreground/80 text-[9px]">REJ</div>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-4 text-[11px]">
                            <span className="text-success/80">{selectedStats.active} aktif</span>
                            <span className="text-destructive/80">{selectedStats.empty} kosong</span>
                        </div>
                    </div>

                    {/* Areas List */}
                    {filteredAreas.length === 0 ? (
                        <div className="bg-card rounded-2xl p-12 text-center shadow-xl border border-dashed border-border">
                            <div className="text-5xl mb-4">📭</div>
                            <h3 className="text-lg font-bold text-foreground">Belum ada data</h3>
                            <p className="text-muted-foreground text-sm mt-1">Data harian tidak ditemukan.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filteredAreas.map((area) => (
                                <div key={area.user_id} className="bg-card rounded-2xl shadow-xl overflow-hidden border border-border">
                                    {/* Area Header - Premium Style */}
                                    <div className="bg-primary px-5 py-4">
                                        <div className="flex justify-between items-center text-white">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Region Area</span>
                                                <span className="text-lg font-black">{area.area_name}</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-3xl font-black leading-none">{area.total_input}</span>
                                                <div className="text-[9px] font-bold uppercase opacity-80 mt-1">INPUT HARI INI</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Sators & Promotors Table-style List */}
                                    <div className="divide-y divide-border">
                                        {area.sators.map((sator) => (
                                            <div key={sator.user_id} className="p-0">
                                                {/* Sator Sub-Header - Bolder & Clearer */}
                                                <div className="bg-muted px-5 py-3 flex justify-between items-center border-b border-border shadow-sm">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-1 h-4 bg-primary rounded-full" />
                                                        <span className="text-[11px] font-black text-foreground uppercase tracking-widest">SATOR: {sator.name}</span>
                                                    </div>
                                                    <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-[10px] font-extrabold border border-primary/20">
                                                        {sator.total_input} TOTAL INPUT
                                                    </div>
                                                </div>

                                                {/* Promotors Rows */}
                                                <div className="divide-y divide-border/50">
                                                    {[...sator.promotors]
                                                        .sort((a, b) => b.total_input - a.total_input)
                                                        .map((promotor) => (
                                                            <div
                                                                key={promotor.user_id}
                                                                onClick={() => openPromotorDetail(promotor)}
                                                                className={cn(
                                                                    "px-5 py-4 flex items-center justify-between cursor-pointer transition-all hover:bg-muted/30 active:scale-[0.99]",
                                                                    promotor.is_empty ? "bg-red-50/20" : ""
                                                                )}
                                                            >
                                                                {/* Col 1: Name & Status */}
                                                                <div className="flex flex-col min-w-0 flex-1">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className={cn(
                                                                            "w-2 h-2 rounded-full shrink-0",
                                                                            promotor.is_empty ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" :
                                                                                promotor.has_reject ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" : "bg-emerald-500"
                                                                        )} />
                                                                        <span className={cn(
                                                                            "font-bold text-sm truncate",
                                                                            promotor.is_empty ? "text-red-600" : "text-foreground"
                                                                        )}>
                                                                            {promotor.name}
                                                                        </span>
                                                                    </div>
                                                                    <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider mt-0.5 pl-4">PROMOTOR</span>
                                                                </div>

                                                                {/* Col 2: Breakdown Grid (Small Icons) */}
                                                                {!promotor.is_empty && (
                                                                    <div className="flex items-center gap-3 px-4">
                                                                        <div className="flex flex-col items-center">
                                                                            <span className="text-[10px] font-bold text-emerald-500">{promotor.total_closed}</span>
                                                                            <span className="text-[8px] font-bold text-muted-foreground uppercase">CLS</span>
                                                                        </div>
                                                                        <div className="flex flex-col items-center">
                                                                            <span className="text-[10px] font-bold text-amber-500">{promotor.total_pending}</span>
                                                                            <span className="text-[8px] font-bold text-muted-foreground uppercase">PND</span>
                                                                        </div>
                                                                        <div className="flex flex-col items-center">
                                                                            <span className="text-[10px] font-bold text-red-500">{promotor.total_rejected}</span>
                                                                            <span className="text-[8px] font-bold text-muted-foreground uppercase">REJ</span>
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Col 3: Total & Chevron */}
                                                                <div className="flex items-center gap-3 text-right">
                                                                    <div className="flex flex-col items-end">
                                                                        <span className={cn(
                                                                            "text-xl font-black leading-none",
                                                                            promotor.is_empty ? "text-red-500 opacity-50" : "text-primary"
                                                                        )}>
                                                                            {promotor.total_input}
                                                                        </span>
                                                                        <span className="text-[8px] font-bold text-muted-foreground uppercase mt-1">TOTAL</span>
                                                                    </div>
                                                                    <ChevronRight className="w-4 h-4 text-muted-foreground opacity-30" />
                                                                </div>
                                                            </div>
                                                        ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                </div>

                {/* Modal Popup */}
                {showModal && modalPromotor && (
                    <div className="fixed inset-0 z-50 flex items-end justify-center">
                        {/* Backdrop */}
                        <div
                            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                            onClick={() => setShowModal(false)}
                        ></div>

                        {/* Modal Content */}
                        <div className="relative w-full max-w-lg bg-card rounded-t-2xl max-h-[80vh] overflow-hidden animate-slide-up">
                            {/* Handle */}
                            <div className="flex justify-center pt-2 pb-1">
                                <div className="w-10 h-1 bg-muted rounded-full"></div>
                            </div>

                            {/* Header */}
                            <div className="px-4 pb-3 border-b border-border">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-semibold text-foreground">{modalPromotor.name}</h3>
                                        <p className="text-xs text-muted-foreground">Pengajuan Hari Ini</p>
                                    </div>
                                    <button
                                        onClick={() => setShowModal(false)}
                                        className="p-1 hover:bg-muted rounded-full"
                                    >
                                        <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>

                                {/* Stats Summary */}
                                <div className="flex gap-3 mt-3">
                                    <div className="flex-1 bg-primary/10 rounded-xl p-2 text-center">
                                        <div className="text-primary font-bold">{modalPromotor.total_input}</div>
                                        <div className="text-[10px] text-primary">Input</div>
                                    </div>
                                    <div className="flex-1 bg-success/10 rounded-xl p-2 text-center">
                                        <div className="text-success font-bold">{modalPromotor.total_closed}</div>
                                        <div className="text-[10px] text-success">Closed</div>
                                    </div>
                                    <div className="flex-1 bg-warning/10 rounded-xl p-2 text-center">
                                        <div className="text-warning font-bold">{modalPromotor.total_pending}</div>
                                        <div className="text-[10px] text-warning">Pending</div>
                                    </div>
                                    <div className="flex-1 bg-destructive/10 rounded-xl p-2 text-center">
                                        <div className="text-destructive font-bold">{modalPromotor.total_rejected}</div>
                                        <div className="text-[10px] text-destructive">Reject</div>
                                    </div>
                                </div>
                            </div>

                            {/* Submissions List */}
                            <div className="overflow-y-auto max-h-[50vh] p-4">
                                {modalLoading ? (
                                    <div className="flex justify-center py-8">
                                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                    </div>
                                ) : modalSubmissions.length === 0 ? (
                                    <div className="text-center py-8">
                                        <div className="text-4xl mb-2">😴</div>
                                        <p className="text-muted-foreground text-sm">Belum ada pengajuan hari ini</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {modalSubmissions.map((sub, idx) => (
                                            <button
                                                key={sub.id}
                                                onClick={() => openSubmissionDetail(sub)}
                                                className="w-full text-left bg-muted rounded-xl p-3 border border-border hover:bg-muted transition-all active:scale-[0.98]"
                                            >
                                                <div className="flex justify-between items-start mb-1">
                                                    <div>
                                                        <span className="text-[10px] text-muted-foreground">#{idx + 1}</span>
                                                        <h4 className="text-sm font-medium text-foreground">{sub.customer_name}</h4>
                                                    </div>
                                                    {getStatusBadge(sub.status)}
                                                </div>
                                                <div className="flex gap-4 text-[11px] text-muted-foreground mb-2">
                                                    <span>{sub.customer_phone}</span>
                                                    <span>{formatCurrency(sub.limit_amount || 0)}</span>
                                                    <span>{sub.tenor} bln</span>
                                                </div>
                                                {/* Photo Thumbnails */}
                                                {sub.image_urls && sub.image_urls.length > 0 && (
                                                    <div className="flex gap-1.5 mt-2">
                                                        {sub.image_urls.slice(0, 3).map((url, imgIdx) => (
                                                            <div
                                                                key={imgIdx}
                                                                className="w-10 h-10 rounded-xl overflow-hidden border border-border"
                                                            >
                                                                <img
                                                                    src={url}
                                                                    alt={`Foto ${imgIdx + 1}`}
                                                                    className="w-full h-full object-cover"
                                                                />
                                                            </div>
                                                        ))}
                                                        {sub.image_urls.length > 3 && (
                                                            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-[10px] text-muted-foreground font-medium">
                                                                +{sub.image_urls.length - 3}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <style jsx>{`
                @keyframes slide-up {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
                .animate-slide-up {
                    animation: slide-up 0.3s ease-out;
                }
            `}</style>

            {/* Detail Submission Modal */}
            {showDetailModal && selectedSubmission && (
                <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-[60]">
                    <div className="bg-card w-full max-w-lg rounded-t-3xl max-h-[90vh] overflow-y-auto animate-slide-up">
                        {/* Header */}
                        <div className="sticky top-0 bg-card border-b border-border p-4 flex justify-between items-center">
                            <h2 className="text-lg font-bold text-foreground">Detail Pengajuan</h2>
                            <button
                                onClick={() => setShowDetailModal(false)}
                                className="p-2 hover:bg-muted rounded-full"
                            >
                                <span className="text-xl text-muted-foreground">&times;</span>
                            </button>
                        </div>

                        <div className="p-4 space-y-4 pb-10">
                            {/* Status Badge */}
                            <div className="flex justify-center">
                                <div className={`px-4 py-2 rounded-full text-sm font-bold ${selectedSubmission.status?.toLowerCase() === 'acc' ? 'bg-primary/20 text-success' :
                                    selectedSubmission.status?.toLowerCase() === 'pending' ? 'bg-warning/20 text-warning' : 'bg-destructive/20 text-destructive'
                                    }`}>
                                    {selectedSubmission.status?.toUpperCase()}
                                </div>
                            </div>

                            {/* Customer Data */}
                            <div className="bg-muted rounded-xl p-4">
                                <h3 className="text-sm font-semibold text-muted-foreground mb-2">👤 Data Customer</h3>
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Nama</span>
                                        <span className="font-medium text-foreground">{selectedSubmission.customer_name}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">No. HP</span>
                                        <span className="font-medium text-foreground">{selectedSubmission.customer_phone}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Pekerjaan</span>
                                        <span className="font-medium text-foreground">{selectedSubmission.pekerjaan || '-'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Penghasilan</span>
                                        <span className="font-medium text-foreground">{formatCurrency(selectedSubmission.penghasilan || 0)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">NPWP</span>
                                        <span className="font-medium text-foreground">{selectedSubmission.has_npwp ? 'Ya' : 'Tidak'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Credit Data */}
                            <div className="bg-muted rounded-xl p-4">
                                <h3 className="text-sm font-semibold text-muted-foreground mb-2">💰 Data Kredit</h3>
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Tanggal</span>
                                        <span className="font-medium text-foreground">{selectedSubmission.sale_date}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Limit</span>
                                        <span className="font-medium text-foreground">{formatCurrency(selectedSubmission.limit_amount || 0)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">DP</span>
                                        <span className="font-medium text-foreground">{formatCurrency(selectedSubmission.dp_amount || 0)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Tenor</span>
                                        <span className="font-medium text-foreground">{selectedSubmission.tenor ? selectedSubmission.tenor + ' Bulan' : '-'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Photos */}
                            {selectedSubmission.image_urls && selectedSubmission.image_urls.length > 0 && (
                                <div className="bg-muted rounded-xl p-4">
                                    <h3 className="text-sm font-semibold text-muted-foreground mb-2">📸 Foto Dokumentasi</h3>
                                    <div className="grid grid-cols-2 gap-2">
                                        {selectedSubmission.image_urls.map((url, index) => (
                                            <a
                                                key={index}
                                                href={url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="aspect-square rounded-xl overflow-hidden bg-muted"
                                            >
                                                <img src={url} alt={'Foto ' + (index + 1)} className="w-full h-full object-cover" />
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
}
