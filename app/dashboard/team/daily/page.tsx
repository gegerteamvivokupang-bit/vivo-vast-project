'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import SpvHeader from '@/components/SpvHeader';
import { Loading } from '@/components/ui/loading';
import { Alert } from '@/components/ui/alert';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// Shared Types
import { AggDailyPromoter, FinanceData } from '@/types/api.types';

// Utilities
import { parseSupabaseError, logError } from '@/lib/errors';
import { formatDateWITA, getCurrentDateWITA } from '@/lib/date-utils';
import { formatCurrency } from '@/lib/dashboard-logic';

interface SatorWithPromotors {
    user_id: string;
    name: string;
    promotor_ids: string[];
}

interface PromotorWithDetail extends AggDailyPromoter {
    promoter_name: string;
    sator_id?: string;
}

export default function SpvDailyPage() {
    const { user } = useAuth();
    const [promotors, setPromotors] = useState<PromotorWithDetail[]>([]);
    const [sators, setSators] = useState<SatorWithPromotors[]>([]);
    const [selectedSator, setSelectedSator] = useState<string>('all');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [areaName, setAreaName] = useState<string>('');

    // Modal states
    const [showModal, setShowModal] = useState(false);
    const [modalPromotor, setModalPromotor] = useState<PromotorWithDetail | null>(null);
    const [modalSubmissions, setModalSubmissions] = useState<FinanceData[]>([]);
    const [modalLoading, setModalLoading] = useState(false);

    // Detail modal
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedSubmission, setSelectedSubmission] = useState<FinanceData | null>(null);

    // Date filter
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

            // Get area name
            const { data: hierarchyData } = await supabase
                .from('hierarchy')
                .select('area')
                .eq('user_id', user?.id)
                .single();

            if (hierarchyData?.area) {
                setAreaName(hierarchyData.area);
            }

            // Fetch daily data from Edge Function (includes promotors and sators)
            const { data, error } = await supabase.functions.invoke('dashboard-team-daily', {
                body: { userId: user?.id, date: selectedDate }
            });

            if (error) throw error;

            // Handle response format
            const promotorsData = data?.promotors || data || [];
            const satorsData = data?.sators || [];

            // Set sators
            setSators(satorsData);

            // Sort promotors: active first (by input desc), then empty
            const sorted = promotorsData.sort((a: PromotorWithDetail, b: PromotorWithDetail) => {
                if (a.total_input === 0 && b.total_input > 0) return 1;
                if (a.total_input > 0 && b.total_input === 0) return -1;
                return b.total_input - a.total_input;
            });

            setPromotors(sorted);
        } catch (err) {
            const apiError = parseSupabaseError(err);
            logError(apiError, {
                userId: user?.id,
                page: 'spv-dashboard-daily',
                action: 'fetchData'
            });
            console.error('Error fetching daily data:', apiError);
            setError(apiError.message);
        } finally {
            setLoading(false);
        }
    };

    const openPromotorDetail = async (promotor: PromotorWithDetail) => {
        setModalPromotor(promotor);
        setModalLoading(true);
        setShowModal(true);

        try {
            const supabase = createClient();

            // Use Edge Function to bypass RLS
            const { data, error } = await supabase.functions.invoke('promotor-submissions', {
                body: {
                    promotorId: promotor.promoter_user_id,
                    date: selectedDate
                }
            });


            if (error) throw error;
            setModalSubmissions(data || []);
        } catch (err) {
            console.error('Fetch submissions error:', err);
            setModalSubmissions([]);
        } finally {
            setModalLoading(false);
        }
    };

    const openSubmissionDetail = (submission: FinanceData) => {
        setSelectedSubmission(submission);
        setShowDetailModal(true);
    };

    const getStatusBadge = (status: string) => {
        switch (status?.toLowerCase()) {
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

    // formatCurrency replaced by imported utility

    // Filter promotors by selected sator
    const filteredPromotors = selectedSator === 'all'
        ? promotors
        : promotors.filter(p => p.sator_id === selectedSator);

    // Calculate totals based on filtered promotors
    const totals = filteredPromotors.reduce((acc, p) => ({
        total_input: acc.total_input + p.total_input,
        total_closed: acc.total_closed + p.total_closed,
        total_pending: acc.total_pending + p.total_pending,
        total_rejected: acc.total_rejected + p.total_rejected,
    }), { total_input: 0, total_closed: 0, total_pending: 0, total_rejected: 0 });

    const activeCount = filteredPromotors.filter(p => p.total_input > 0).length;
    const emptyCount = filteredPromotors.filter(p => p.total_input === 0).length;

    // Get total input per sator for tabs
    const getSatorTotal = (satorId: string) => {
        return promotors
            .filter(p => p.sator_id === satorId)
            .reduce((sum, p) => sum + p.total_input, 0);
    };

    if (loading) return <DashboardLayout><Loading message="Memuat data..." /></DashboardLayout>;
    if (error) return <DashboardLayout><Alert type="error" message={error} /></DashboardLayout>;

    return (
        <DashboardLayout allowedRoles={['spv', 'sator']}>
            <div className="min-h-screen bg-background pb-24">

                <SpvHeader
                    title="PROGRESS HARIAN"
                    subtitle={selectedDateLabel}
                    icon="📊"
                    backUrl="/dashboard/team"
                />

                <div className="p-3">
                    {/* Date Filter Button */}
                    <button
                        onClick={() => setShowDatePicker(true)}
                        className="w-full flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 mb-3 shadow-sm active:scale-[0.98] transition-all"
                    >
                        <Calendar className="w-5 h-5 text-primary shrink-0" />
                        <span className="flex-1 text-left text-foreground text-sm font-bold">
                            {selectedDateLabel}
                        </span>
                        <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    {/* Bottom Sheet Date Picker */}
                    {showDatePicker && (
                        <div className="fixed inset-0 z-50 flex items-end justify-center">
                            {/* Backdrop */}
                            <div
                                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                                onClick={() => setShowDatePicker(false)}
                            />
                            {/* Sheet */}
                            <div className="relative w-full max-w-lg bg-card rounded-t-3xl p-5 pb-24 mb-16 animate-in slide-in-from-bottom duration-300">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-bold text-foreground">Pilih Tanggal</h3>
                                    <button
                                        onClick={() => setShowDatePicker(false)}
                                        className="p-2 rounded-full hover:bg-muted"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                                    {dateOptions.map(opt => (
                                        <button
                                            key={opt.value}
                                            onClick={() => {
                                                setSelectedDate(opt.value);
                                                setShowDatePicker(false);
                                            }}
                                            className={cn(
                                                "w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors",
                                                selectedDate === opt.value
                                                    ? "bg-primary text-primary-foreground"
                                                    : "bg-muted hover:bg-muted/80 text-foreground"
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

                    {/* Summary Card - Compact */}
                    <div className="bg-primary rounded-xl p-4 mb-3 shadow-md">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <p className="text-primary-foreground/80 text-[10px] uppercase tracking-wide">Input Hari Ini</p>
                                <p className="text-primary-foreground font-bold text-3xl">{totals.total_input}</p>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="text-center">
                                    <div className="text-primary-foreground font-bold text-lg">{totals.total_closed}</div>
                                    <div className="text-primary-foreground/80 text-[9px]">CLS</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-primary-foreground font-bold text-lg">{totals.total_pending}</div>
                                    <div className="text-primary-foreground/80 text-[9px]">PND</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-primary-foreground font-bold text-lg">{totals.total_rejected}</div>
                                    <div className="text-primary-foreground/80 text-[9px]">REJ</div>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3 text-xs">
                            <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-success"></div>
                                <span className="text-primary-foreground/80">{activeCount} aktif</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-destructive"></div>
                                <span className="text-primary-foreground/80">{emptyCount} kosong</span>
                            </div>
                        </div>
                    </div>

                    {/* Sator Tabs */}
                    {sators.length > 0 && (
                        <div className="grid grid-cols-3 gap-1.5 mb-3">
                            <button
                                onClick={() => setSelectedSator('all')}
                                className={`py-2 rounded-xl text-xs font-semibold transition-all ${selectedSator === 'all'
                                    ? 'bg-primary text-primary-foreground shadow-md'
                                    : 'bg-card text-muted-foreground shadow-md'
                                    }`}
                            >
                                <div>All</div>
                                <div className={`text-[10px] ${selectedSator === 'all' ? 'text-primary-foreground/80' : 'text-primary'}`}>
                                    {promotors.reduce((sum, p) => sum + p.total_input, 0)}
                                </div>
                            </button>
                            {sators.map((sator) => {
                                const shortName = sator.name.split(' ')[0].toUpperCase();
                                return (
                                    <button
                                        key={sator.user_id}
                                        onClick={() => setSelectedSator(sator.user_id)}
                                        className={`py-2 rounded-xl text-xs font-semibold transition-all ${selectedSator === sator.user_id
                                            ? 'bg-primary text-primary-foreground shadow-md'
                                            : 'bg-card text-muted-foreground shadow-md'
                                            }`}
                                    >
                                        <div>{shortName}</div>
                                        <div className={`text-[10px] ${selectedSator === sator.user_id ? 'text-primary-foreground/80' : 'text-primary'}`}>
                                            {getSatorTotal(sator.user_id)}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Promotor List */}
                    <div className="bg-card rounded-xl shadow-md overflow-hidden">
                        <div className="bg-primary px-3 py-2 flex justify-between items-center">
                            <span className="text-primary-foreground font-medium text-sm">Promotor</span>
                            <span className="text-primary-foreground/80 text-xs">{filteredPromotors.length} orang</span>
                        </div>

                        <div className="divide-y divide-border">
                            {filteredPromotors.map((p, idx) => {
                                const isEmpty = p.total_input === 0;
                                const hasReject = p.total_rejected > 0;
                                return (
                                    <button
                                        key={idx}
                                        onClick={() => openPromotorDetail(p)}
                                        className={`w-full text-left px-3 py-2.5 transition-all active:scale-[0.98] ${isEmpty
                                            ? 'bg-destructive/10'
                                            : hasReject
                                                ? 'bg-warning/10'
                                                : 'bg-card hover:bg-muted'
                                            }`}
                                    >
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isEmpty ? 'bg-destructive' : hasReject ? 'bg-warning' : 'bg-success'
                                                    }`}></div>
                                                <span className={`text-sm truncate ${isEmpty ? 'text-destructive' : 'text-foreground'}`}>
                                                    {p.promoter_name}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                {isEmpty ? (
                                                    <span className="text-[10px] text-destructive font-medium">KOSONG</span>
                                                ) : (
                                                    <>
                                                        <span className="text-[10px] text-muted-foreground">
                                                            {p.total_closed}c {p.total_pending}p {p.total_rejected}r
                                                        </span>
                                                        <span className="text-sm font-bold text-primary">{p.total_input}</span>
                                                    </>
                                                )}
                                                <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                </svg>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {promotors.length === 0 && (
                            <div className="p-8 text-center text-muted-foreground">Tidak ada data promotor</div>
                        )}
                    </div>
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
                                        <h3 className="font-semibold text-foreground">{modalPromotor.promoter_name}</h3>
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
            </div>
        </DashboardLayout>
    );
}
