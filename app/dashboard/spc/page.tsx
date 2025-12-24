'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { ProfileSidebar } from '@/components/ProfileSidebar';
import { Loading } from '@/components/ui/loading';
import { Alert } from '@/components/ui/alert';
import { createClient } from '@/lib/supabase/client';
import { Bell, User, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StoreData {
    store_id: string;
    store_name: string;
    store_code: string;
    target?: number;
    total_input: number;
    total_closed: number;
    total_pending: number;
    total_rejected: number;
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

    // View mode: daily or monthly
    const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('monthly');

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

    if (!user || !canAccessSPC(user)) {
        return <DashboardLayout><Loading message="Memeriksa akses..." /></DashboardLayout>;
    }

    if (loading) return <DashboardLayout><Loading message="Memuat data SPC..." /></DashboardLayout>;
    if (error) return <DashboardLayout><Alert type="error" message={error} /></DashboardLayout>;

    return (
        <DashboardLayout>
            <div className="min-h-screen bg-background pb-24">

                {/* Header Banner */}
                <div className="relative w-full bg-gradient-to-br from-purple-600 to-indigo-700 pb-8 pt-4 px-5 rounded-b-[2rem] shadow-lg overflow-hidden">
                    <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 bg-purple-400 opacity-10 rounded-full blur-2xl pointer-events-none" />

                    {/* Top Bar */}
                    <div className="relative z-10 flex items-center justify-between mb-6">
                        <button onClick={() => setSidebarOpen(true)} className="flex items-center gap-3">
                            <div className="h-12 w-12 rounded-full bg-white/20 border-2 border-white/20 shadow-md flex items-center justify-center text-white font-bold">
                                {user?.name ? getInitials(user.name) : <User className="w-6 h-6" />}
                            </div>
                            <div className="flex flex-col text-left">
                                <span className="text-purple-200 text-xs font-medium uppercase tracking-wider">SPC DASHBOARD</span>
                                <span className="text-white text-lg font-bold leading-tight">{user?.name || 'User'}</span>
                            </div>
                        </button>
                        <div className="flex items-center gap-2">
                            <button className="flex items-center justify-center h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white">
                                <Bell className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* View Mode Toggle */}
                    <div className="relative z-10 flex gap-2 mb-4">
                        <button
                            onClick={() => setViewMode('daily')}
                            className={cn(
                                "flex-1 py-2 rounded-xl font-semibold text-sm transition-all",
                                viewMode === 'daily'
                                    ? 'bg-white text-purple-700 shadow-md'
                                    : 'bg-white/20 text-white/80 hover:bg-white/30'
                            )}
                        >
                            HARIAN
                        </button>
                        <button
                            onClick={() => setViewMode('monthly')}
                            className={cn(
                                "flex-1 py-2 rounded-xl font-semibold text-sm transition-all",
                                viewMode === 'monthly'
                                    ? 'bg-white text-purple-700 shadow-md'
                                    : 'bg-white/20 text-white/80 hover:bg-white/30'
                            )}
                        >
                            BULANAN
                        </button>
                    </div>

                    {/* Stats Row */}
                    <div className="relative z-10 flex justify-between items-end text-white">
                        <div>
                            <div className="text-purple-200 text-xs font-semibold mb-1">TOKO SPC</div>
                            <div className="text-2xl font-bold tracking-tight">{stores.length} Toko</div>
                        </div>
                        {viewMode === 'monthly' && (
                            <div className="text-right">
                                <div className="text-purple-200 text-xs font-semibold mb-1">TIME GONE</div>
                                <div className="text-xl font-bold">{timeGonePercent}%</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 px-5 -mt-6 relative z-20 flex flex-col gap-4">

                    {/* Date Navigation */}
                    <div className="bg-card border border-border rounded-2xl shadow-xl p-3 flex items-center justify-between">
                        <button
                            onClick={goToPrev}
                            className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-muted active:scale-95 transition-all"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>

                        <div className="text-center flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            <div className="text-lg font-bold text-foreground">{getDisplayLabel()}</div>
                        </div>

                        <button
                            onClick={goToNext}
                            disabled={isAtCurrent()}
                            className={cn(
                                "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                                isAtCurrent()
                                    ? 'bg-muted text-muted-foreground/50 cursor-not-allowed'
                                    : 'bg-muted text-muted-foreground hover:bg-muted active:scale-95'
                            )}
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>

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

                    {/* Store List */}
                    {stores.length === 0 ? (
                        <div className="bg-card border border-border rounded-2xl shadow-xl p-8 text-center">
                            <div className="text-5xl mb-3">🏪</div>
                            <h3 className="text-lg font-bold text-foreground mb-1">Tidak ada data</h3>
                            <p className="text-sm text-muted-foreground">
                                Belum ada data untuk {viewMode === 'daily' ? 'tanggal' : 'bulan'} ini
                            </p>
                        </div>
                    ) : (
                        <div className="bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
                            <div className="px-4 py-2 flex justify-between items-center bg-gradient-to-r from-purple-500 to-indigo-500">
                                <span className="text-white font-medium text-sm">DAFTAR TOKO SPC</span>
                                <span className="text-white/80 text-xs">{stores.length} toko</span>
                            </div>

                            <div className="divide-y divide-border">
                                {stores.map((store) => {
                                    const pct = getPercent(store);
                                    const under = isUnderperform(store);

                                    return (
                                        <div key={store.store_id} className="px-4 py-3">
                                            {/* Row 1: Nama & Input */}
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="font-semibold text-foreground">{store.store_name}</span>
                                                <span className={cn(
                                                    "text-xl font-bold",
                                                    viewMode === 'monthly' && under ? 'text-red-500' : 'text-primary'
                                                )}>
                                                    {store.total_input}
                                                </span>
                                            </div>

                                            {/* Row 2: Stats */}
                                            <div className="flex justify-between items-center text-xs mb-2">
                                                <div className="flex gap-3">
                                                    {viewMode === 'monthly' && (
                                                        <>
                                                            <span className="text-muted-foreground">
                                                                Target: <span className="font-medium">{store.target || '-'}</span>
                                                            </span>
                                                            <span className={pct >= timeGonePercent ? 'text-emerald-500' : 'text-red-500'}>
                                                                {pct}%
                                                            </span>
                                                        </>
                                                    )}
                                                    <span className="text-muted-foreground">{store.store_code}</span>
                                                </div>
                                            </div>

                                            {/* Row 3: Detail */}
                                            <div className="flex gap-3 text-xs mb-2">
                                                <span className="text-emerald-500">{store.total_closed} ACC</span>
                                                <span className="text-amber-500">{store.total_pending} Pnd</span>
                                                <span className="text-red-500">{store.total_rejected} Rej</span>
                                            </div>

                                            {/* Progress Bar (monthly only) */}
                                            {viewMode === 'monthly' && (
                                                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                                                    <div
                                                        className={cn(
                                                            "h-full rounded-full",
                                                            under ? 'bg-red-500' : 'bg-emerald-500'
                                                        )}
                                                        style={{ width: `${Math.min(pct, 100)}%` }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Bottom Spacer */}
                    <div className="h-10" />
                </div>

                {/* Profile Sidebar */}
                <ProfileSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            </div>
        </DashboardLayout>
    );
}
