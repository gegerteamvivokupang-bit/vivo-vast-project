'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { ProfileSidebar } from '@/components/ProfileSidebar';
import { Loading } from '@/components/ui/loading';
import { Alert } from '@/components/ui/alert';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, TrendingDown, User } from 'lucide-react';
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
}

type TabLevel = 'area' | 'sator' | 'promotor';

export default function ManagerUnderperformPage() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<TabLevel>('area');
    const [areas, setAreas] = useState<Member[]>([]);
    const [sators, setSators] = useState<Member[]>([]);
    const [promotors, setPromotors] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const currentDay = now.getDate();
    const timeGonePercent = Math.round((currentDay / daysInMonth) * 100);
    const todayFormatted = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });

    // Get user initials
    const getInitials = (name: string) => name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'U';

    useEffect(() => {
        if (user) fetchData();
    }, [user]);

    const isUnderperform = (m: Member): boolean => {
        const t = m.target || 0;
        const i = m.total_input || 0;
        if (t === 0) return i === 0;
        return (i / t) * 100 < timeGonePercent;
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const supabase = createClient();
            const { data, error: fnError } = await supabase.functions.invoke('dashboard-manager');

            if (fnError) throw fnError;

            // Filter only underperformers
            setAreas((data?.areas || []).filter(isUnderperform));
            setSators((data?.sators || []).filter(isUnderperform));
            setPromotors((data?.promotors || []).filter(isUnderperform));
        } catch (err) {
            console.error(err);
            setError('Gagal memuat data');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <DashboardLayout><Loading message="Memuat data..." /></DashboardLayout>;
    if (error) return <DashboardLayout><Alert type="error" message={error} /></DashboardLayout>;

    const currentData = activeTab === 'area' ? areas : activeTab === 'sator' ? sators : promotors;

    return (
        <DashboardLayout allowedRoles={['manager']}>
            <div className="min-h-screen bg-background flex flex-col">
                {/* TopAppBar */}
                <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border">
                    <div className="flex items-center p-4 justify-between">
                        <button
                            onClick={() => window.history.back()}
                            className="flex items-center justify-center h-10 w-10 rounded-full hover:bg-muted transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <h2 className="text-foreground text-base font-bold flex-1 text-center uppercase">Manager Area | Underperform</h2>
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm"
                        >
                            {user?.name ? getInitials(user.name) : <User className="w-5 h-5" />}
                        </button>
                    </div>
                </div>

                {/* Date Headline */}
                <div className="px-4 py-3">
                    <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-1">Date</p>
                    <h3 className="text-foreground text-xl font-bold">{todayFormatted}</h3>
                </div>

                {/* Stats Summary Cards */}
                <div className="flex gap-3 overflow-x-auto px-4 py-3 pb-2">
                    <div className="flex min-w-[120px] flex-1 flex-col gap-1 rounded-xl p-4 bg-card border border-border shadow-sm relative overflow-hidden">
                        <div className="absolute right-2 top-2 opacity-10">
                            <TrendingDown className="w-8 h-8 text-alert" />
                        </div>
                        <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Area</p>
                        <div className="flex items-end gap-2">
                            <p className="text-foreground text-2xl font-bold">{areas.length}</p>
                            {areas.length > 0 && (
                                <span className="text-alert text-xs font-medium mb-1 bg-alert/10 px-1.5 py-0.5 rounded">Under</span>
                            )}
                        </div>
                    </div>
                    <div className="flex min-w-[120px] flex-1 flex-col gap-1 rounded-xl p-4 bg-card border border-border shadow-sm relative overflow-hidden">
                        <div className="absolute right-2 top-2 opacity-10">
                            <TrendingDown className="w-8 h-8 text-alert" />
                        </div>
                        <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Sator</p>
                        <div className="flex items-end gap-2">
                            <p className="text-foreground text-2xl font-bold">{sators.length}</p>
                            {sators.length > 0 && (
                                <span className="text-alert text-xs font-medium mb-1 bg-alert/10 px-1.5 py-0.5 rounded">Under</span>
                            )}
                        </div>
                    </div>
                    <div className="flex min-w-[120px] flex-1 flex-col gap-1 rounded-xl p-4 bg-card border border-border shadow-sm relative overflow-hidden">
                        <div className="absolute right-2 top-2 opacity-10">
                            <TrendingDown className="w-8 h-8 text-alert" />
                        </div>
                        <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Promotor</p>
                        <div className="flex items-end gap-2">
                            <p className="text-foreground text-2xl font-bold">{promotors.length}</p>
                            {promotors.length > 0 && (
                                <span className="text-alert text-xs font-medium mb-1 bg-alert/10 px-1.5 py-0.5 rounded">Under</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Segmented Control */}
                <div className="px-4 py-2 sticky top-[65px] z-20 bg-background pb-4">
                    <div className="flex w-full rounded-lg bg-muted p-1">
                        {['area', 'sator', 'promotor'].map((tab) => (
                            <label key={tab} className="flex-1 cursor-pointer">
                                <input
                                    type="radio"
                                    name="view-filter"
                                    value={tab}
                                    checked={activeTab === tab}
                                    onChange={() => setActiveTab(tab as TabLevel)}
                                    className="sr-only"
                                />
                                <div className={cn(
                                    "flex items-center justify-center rounded-md py-1.5 text-sm font-medium transition-all",
                                    activeTab === tab ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"
                                )}>
                                    {tab.toUpperCase()}
                                </div>
                            </label>
                        ))}
                    </div>
                </div>

                {/* List Section */}
                <div className="flex-1 flex flex-col gap-3 px-4 pb-24">
                    {currentData.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
                            <div className="bg-emerald-500/10 p-6 rounded-full">
                                <span className="text-4xl">🎉</span>
                            </div>
                            <div>
                                <h3 className="text-lg font-bold">All Clear!</h3>
                                <p className="text-muted-foreground">Tidak ada yang underperform!</p>
                            </div>
                        </div>
                    ) : (
                        currentData.map((m, i) => {
                            const pct = m.target > 0 ? Math.round((m.total_input / m.target) * 100) : 0;
                            const gap = m.target - m.total_input;

                            return (
                                <div
                                    key={i}
                                    className="flex flex-col gap-3 rounded-xl border border-alert/30 bg-alert-bg p-4 relative overflow-hidden"
                                >
                                    {/* Red sidebar accent */}
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-alert" />

                                    <div className="flex items-start justify-between gap-4 pl-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-full bg-primary/20 border-2 border-alert flex items-center justify-center text-foreground font-bold text-sm">
                                                {getInitials(m.name)}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-base">{m.name}</h4>
                                                {m.area && <p className="text-muted-foreground text-xs mt-0.5">Area: {m.area}</p>}
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className="text-alert font-bold text-lg">-{gap} GAP</span>
                                            <div className="flex items-center gap-1 text-alert text-xs font-medium bg-black/10 px-1.5 py-0.5 rounded">
                                                <TrendingDown className="w-3 h-3" />
                                                {pct}%
                                            </div>
                                        </div>
                                    </div>

                                    {/* Metrics Grid */}
                                    <div className="grid grid-cols-2 gap-2 pl-2 border-t border-alert/20 pt-3 mt-1">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-semibold text-muted-foreground uppercase">Target (TGT)</span>
                                            <span className="font-mono font-medium">{m.target || 0}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-semibold text-muted-foreground uppercase">Input (INP)</span>
                                            <span className="font-mono font-medium">{m.total_input}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}

                    {currentData.length > 0 && (
                        <div className="mt-4 flex justify-center">
                            <p className="text-xs text-muted-foreground">End of list</p>
                        </div>
                    )}
                </div>

                {/* Profile Sidebar */}
                <ProfileSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            </div>
        </DashboardLayout>
    );
}
