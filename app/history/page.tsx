'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Loading } from '@/components/ui/loading';
import { Alert } from '@/components/ui/alert';
import BottomSheetSelect from '@/components/ui/BottomSheetSelect';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency, formatDateWithYear } from '@/lib/utils/format';

interface MonthlyStats {
    total_input: number;
    total_closed: number;
    total_pending: number;
    total_reject: number;
    total_closing_direct: number;
    total_closing_followup: number;
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
    created_at: string;
}

// Bulan cutoff: Desember 2025 ke depan tampilkan detail
const DETAIL_CUTOFF_MONTH = '2025-12';

export default function HistoryPage() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [userStoreName, setUserStoreName] = useState<string>('');
    const [selectedMonth, setSelectedMonth] = useState<string>('');
    const [monthlyStats, setMonthlyStats] = useState<MonthlyStats>({
        total_input: 0, total_closed: 0, total_pending: 0,
        total_reject: 0, total_closing_direct: 0, total_closing_followup: 0
    });
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [showDetail, setShowDetail] = useState(false);
    const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);

    // Check apakah bulan >= Desember 2025 (tampilkan detail)
    const isDetailMonth = (monthStr: string) => {
        return monthStr >= DETAIL_CUTOFF_MONTH;
    };

    const generateMonthOptions = () => {
        const months = [];
        const now = new Date();
        for (let i = 0; i < 12; i++) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthStr = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
            months.push(monthStr);
        }
        return months;
    };

    const monthOptions = generateMonthOptions();

    useEffect(() => {
        if (user) {
            const now = new Date();
            const currentMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
            setSelectedMonth(currentMonth);
            fetchUserStore();
        }
    }, [user]);

    useEffect(() => {
        if (user && selectedMonth) {
            if (isDetailMonth(selectedMonth)) {
                fetchDetailedSubmissions();
            } else {
                fetchMonthlyStats();
            }
        }
    }, [selectedMonth, user]);

    const fetchUserStore = async () => {
        try {
            const supabase = createClient();
            if (user?.id) {
                const { data: hierarchyData } = await supabase
                    .from('hierarchy')
                    .select('stores(name)')
                    .eq('user_id', user.id)
                    .single();
                if (hierarchyData?.stores) {
                    setUserStoreName((hierarchyData.stores as any).name || '');
                }
            }
        } catch (err) {
            console.error('Fetch user store error:', err);
        }
    };

    const fetchMonthlyStats = async () => {
        if (!user?.id) return;
        setLoading(true);
        setError(null);
        setSubmissions([]);
        try {
            const supabase = createClient();
            const { data: result, error: fetchError } = await supabase.functions.invoke(
                'promotor-history',
                { body: { userId: user.id, month: selectedMonth, type: 'monthly' } }
            );
            if (fetchError) throw new Error('Gagal memuat data: ' + fetchError.message);
            if (result?.success && result.data) {
                const data = result.data;
                const totalReject = data.total_rejected !== undefined
                    ? data.total_rejected
                    : (data.total_input || 0) - (data.total_closed || 0) - (data.total_pending || 0);

                setMonthlyStats({
                    total_input: data.total_input || 0,
                    total_closed: data.total_closed || 0,
                    total_pending: data.total_pending || 0,
                    total_reject: totalReject > 0 ? totalReject : 0,
                    total_closing_direct: data.total_closing_direct || 0,
                    total_closing_followup: data.total_closing_followup || 0
                });
            } else {
                setMonthlyStats({ total_input: 0, total_closed: 0, total_pending: 0, total_reject: 0, total_closing_direct: 0, total_closing_followup: 0 });
            }
        } catch (err) {
            console.error('Fetch stats error:', err);
            setError(err instanceof Error ? err.message : 'Gagal memuat data');
        } finally {
            setLoading(false);
        }
    };

    const fetchDetailedSubmissions = async () => {
        if (!user?.id) return;
        setLoading(true);
        setError(null);
        try {
            const supabase = createClient();
            const { data: result, error: fetchError } = await supabase.functions.invoke(
                'submission-list',
                { body: { userId: user.id, month: selectedMonth } }
            );
            if (fetchError) throw new Error('Gagal memuat data: ' + fetchError.message);
            if (result?.success) {
                const data = result.data || [];
                setSubmissions(data);
                const stats = {
                    total_input: data.length,
                    total_closed: data.filter((s: Submission) => s.status?.toLowerCase() === 'acc').length,
                    total_pending: data.filter((s: Submission) => s.status?.toLowerCase() === 'pending').length,
                    total_reject: data.filter((s: Submission) => s.status?.toLowerCase() === 'reject').length,
                    total_closing_direct: 0,
                    total_closing_followup: 0
                };
                setMonthlyStats(stats);
            } else {
                throw new Error(result?.message || 'Gagal memuat data');
            }
        } catch (err) {
            console.error('Fetch submissions error:', err);
            setError(err instanceof Error ? err.message : 'Gagal memuat data');
        } finally {
            setLoading(false);
        }
    };

    const formatMonth = (monthStr: string) => {
        const [year, month] = monthStr.split('-');
        const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        return monthNames[parseInt(month) - 1] + ' ' + year;
    };

    const getStatusBadge = (status: string) => {
        const s = status?.toLowerCase();
        if (s === 'acc') {
            return <span className="px-2 py-1 bg-success/10 text-success text-xs font-semibold rounded-full">ACC</span>;
        } else if (s === 'pending') {
            return <span className="px-2 py-1 bg-warning/10 text-warning text-xs font-semibold rounded-full">PENDING</span>;
        } else {
            return <span className="px-2 py-1 bg-destructive/10 text-destructive text-xs font-semibold rounded-full">REJECT</span>;
        }
    };

    const openDetail = (submission: Submission) => {
        setSelectedSubmission(submission);
        setShowDetail(true);
    };

    if (loading && !selectedMonth) {
        return (<DashboardLayout requiredRole="promotor"><Loading message="Memuat history..." /></DashboardLayout>);
    }

    const showDetailView = isDetailMonth(selectedMonth);

    return (
        <DashboardLayout requiredRole="promotor">
            <div className="min-h-screen bg-background p-4 pb-32">
                <div className="bg-primary rounded-xl p-4 mb-6 shadow-md">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 bg-card/20 rounded-full flex items-center justify-center"><span className="text-2xl">👤</span></div>
                        <div className="flex-1">
                            <h2 className="text-primary-foreground font-bold text-lg">{user?.name || 'Promotor'}</h2>
                            <div className="flex items-center gap-1 text-primary-foreground/80 text-sm"><span>📍</span><span>{userStoreName || 'Toko belum diset'}</span></div>
                        </div>
                    </div>
                    <div className="bg-card/10 rounded-xl px-3 py-2"><p className="text-primary-foreground/90 text-sm font-medium">{showDetailView ? '📋 Riwayat Pengajuan' : '📊 Rekap Bulanan'}</p></div>
                </div>

                {error && <Alert type="error" message={error} className="mb-4" />}

                <Card className="mb-4">
                    <CardContent className="p-4">
                        <BottomSheetSelect label="Pilih Bulan" placeholder="Pilih Bulan" icon="📅" value={selectedMonth} onChange={setSelectedMonth} options={monthOptions.map((month) => ({ value: month, label: formatMonth(month) }))} />
                    </CardContent>
                </Card>

                {/* Stats Summary */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                    <Card className="text-center">
                        <CardContent className="p-3">
                            <div className="text-2xl font-bold text-primary">{monthlyStats.total_input}</div>
                            <div className="text-xs text-muted-foreground">Total Input</div>
                        </CardContent>
                    </Card>
                    <Card className="text-center">
                        <CardContent className="p-3">
                            <div className="text-2xl font-bold text-destructive">{monthlyStats.total_reject}</div>
                            <div className="text-xs text-muted-foreground">Total Reject</div>
                        </CardContent>
                    </Card>
                    <Card className="text-center">
                        <CardContent className="p-3">
                            <div className="text-2xl font-bold text-success">{monthlyStats.total_closed}</div>
                            <div className="text-xs text-muted-foreground">ACC</div>
                        </CardContent>
                    </Card>
                    <Card className="text-center">
                        <CardContent className="p-3">
                            <div className="text-2xl font-bold text-warning">{monthlyStats.total_pending}</div>
                            <div className="text-xs text-muted-foreground">Pending</div>
                        </CardContent>
                    </Card>
                </div>

                {loading ? (
                    <Card>
                        <CardContent className="p-6 text-center">
                            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                            <p className="text-muted-foreground">Memuat data...</p>
                        </CardContent>
                    </Card>
                ) : showDetailView ? (
                    <div className="space-y-3">
                        {submissions.length === 0 ? (
                            <Card>
                                <CardContent className="p-8 text-center">
                                    <div className="text-4xl mb-3">📭</div>
                                    <h3 className="font-semibold text-foreground mb-1">Belum Ada Data</h3>
                                    <p className="text-sm text-muted-foreground">Tidak ada pengajuan di bulan {formatMonth(selectedMonth)}</p>
                                </CardContent>
                            </Card>
                        ) : (
                            submissions.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => openDetail(item)}
                                    className="w-full"
                                >
                                    <Card className="hover:shadow-md transition-shadow">
                                        <CardContent className="p-4 text-left">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <h3 className="font-bold text-foreground">{item.customer_name}</h3>
                                                    <p className="text-sm text-muted-foreground">{item.customer_phone}</p>
                                                </div>
                                                {getStatusBadge(item.status)}
                                            </div>
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-muted-foreground">{formatDateWithYear(item.sale_date)}</span>
                                                <span className="text-foreground font-medium">{formatCurrency(item.limit_amount)}</span>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </button>
                            ))
                        )}
                    </div>
                ) : (
                    <>
                        <Card className="mb-4">
                            <CardContent className="p-5">
                                <h3 className="text-sm font-semibold text-foreground mb-4">Rekap {formatMonth(selectedMonth)}</h3>
                                <div className="bg-primary rounded-xl p-4 mb-4 text-primary-foreground">
                                    <div className="flex items-center justify-between">
                                        <div><p className="text-sm opacity-90">Total Pengajuan</p><p className="text-3xl font-bold">{monthlyStats.total_input}</p></div>
                                        <span className="text-4xl">📥</span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-3 mb-4">
                                    <div className="bg-success/10 rounded-xl p-3 text-center border border-success/20">
                                        <div className="text-2xl font-bold text-success">{monthlyStats.total_closed}</div>
                                        <div className="text-xs text-success">ACC</div>
                                    </div>
                                    <div className="bg-warning/10 rounded-xl p-3 text-center border border-warning/20">
                                        <div className="text-2xl font-bold text-warning">{monthlyStats.total_pending}</div>
                                        <div className="text-xs text-warning">Pending</div>
                                    </div>
                                    <div className="bg-destructive/10 rounded-xl p-3 text-center border border-destructive/20">
                                        <div className="text-2xl font-bold text-destructive">{monthlyStats.total_reject}</div>
                                        <div className="text-xs text-destructive">Reject</div>
                                    </div>
                                </div>
                                <div className="border-t border-border pt-4">
                                    <p className="text-xs text-muted-foreground mb-3">Detail Closing</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-primary/10 rounded-xl p-3 text-center">
                                            <div className="text-xl font-bold text-primary">{monthlyStats.total_closing_direct}</div>
                                            <div className="text-xs text-primary">Direct</div>
                                        </div>
                                        <div className="bg-primary/20 rounded-xl p-3 text-center">
                                            <div className="text-xl font-bold text-primary">{monthlyStats.total_closing_followup}</div>
                                            <div className="text-xs text-primary">Follow-up</div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        {monthlyStats.total_input === 0 && (
                            <Card>
                                <CardContent className="p-6 text-center">
                                    <div className="text-4xl mb-3">📭</div>
                                    <h3 className="font-semibold text-foreground mb-1">Belum Ada Data</h3>
                                    <p className="text-sm text-muted-foreground">Tidak ada pengajuan di bulan {formatMonth(selectedMonth)}</p>
                                </CardContent>
                            </Card>
                        )}
                    </>
                )}

                {/* Detail Modal */}
                {showDetail && selectedSubmission && (
                    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
                        <div className="bg-card w-full max-w-lg rounded-t-3xl max-h-[90vh] overflow-y-auto">
                            <div className="sticky top-0 bg-card border-b border-border p-4 flex justify-between items-center">
                                <h2 className="text-lg font-bold text-foreground">Detail Pengajuan</h2>
                                <button onClick={() => setShowDetail(false)} className="p-2 hover:bg-muted rounded-full">
                                    <span className="text-xl text-muted-foreground">&times;</span>
                                </button>
                            </div>
                            <div className="p-4 space-y-4 pb-10">
                                <div className="flex justify-center">
                                    <div className={cn(
                                        "px-4 py-2 rounded-full text-sm font-bold",
                                        selectedSubmission.status?.toLowerCase() === 'acc' ? 'bg-success/10 text-success' :
                                        selectedSubmission.status?.toLowerCase() === 'pending' ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'
                                    )}>
                                        {selectedSubmission.status?.toUpperCase()}
                                    </div>
                                </div>
                                <div className="bg-muted rounded-xl p-4">
                                    <h3 className="text-sm font-semibold text-muted-foreground mb-2">👤 Data Customer</h3>
                                    <div className="space-y-2">
                                        <div className="flex justify-between"><span className="text-muted-foreground">Nama</span><span className="font-medium text-foreground">{selectedSubmission.customer_name}</span></div>
                                        <div className="flex justify-between"><span className="text-muted-foreground">No. HP</span><span className="font-medium text-foreground">{selectedSubmission.customer_phone}</span></div>
                                        <div className="flex justify-between"><span className="text-muted-foreground">Pekerjaan</span><span className="font-medium text-foreground">{selectedSubmission.pekerjaan || '-'}</span></div>
                                        <div className="flex justify-between"><span className="text-muted-foreground">Penghasilan</span><span className="font-medium text-foreground">{formatCurrency(selectedSubmission.penghasilan)}</span></div>
                                        <div className="flex justify-between"><span className="text-muted-foreground">NPWP</span><span className="font-medium text-foreground">{selectedSubmission.has_npwp ? 'Ya' : 'Tidak'}</span></div>
                                    </div>
                                </div>
                                <div className="bg-muted rounded-xl p-4">
                                    <h3 className="text-sm font-semibold text-muted-foreground mb-2">💰 Data Kredit</h3>
                                    <div className="space-y-2">
                                        <div className="flex justify-between"><span className="text-muted-foreground">Tanggal</span><span className="font-medium text-foreground">{formatDateWithYear(selectedSubmission.sale_date)}</span></div>
                                        <div className="flex justify-between"><span className="text-muted-foreground">Limit</span><span className="font-medium text-foreground">{formatCurrency(selectedSubmission.limit_amount)}</span></div>
                                        <div className="flex justify-between"><span className="text-muted-foreground">DP</span><span className="font-medium text-foreground">{formatCurrency(selectedSubmission.dp_amount)}</span></div>
                                        <div className="flex justify-between"><span className="text-muted-foreground">Tenor</span><span className="font-medium text-foreground">{selectedSubmission.tenor ? selectedSubmission.tenor + ' Bulan' : '-'}</span></div>
                                    </div>
                                </div>
                                {selectedSubmission.image_urls && selectedSubmission.image_urls.length > 0 && (
                                    <div className="bg-muted rounded-xl p-4">
                                        <h3 className="text-sm font-semibold text-muted-foreground mb-2">📸 Foto Dokumentasi</h3>
                                        <div className="grid grid-cols-2 gap-2">
                                            {selectedSubmission.image_urls.map((url, index) => (
                                                <a key={index} href={url} target="_blank" rel="noopener noreferrer" className="aspect-square rounded-xl overflow-hidden bg-muted">
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
