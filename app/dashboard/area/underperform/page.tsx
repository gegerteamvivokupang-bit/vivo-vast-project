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

                {/* Table Section */}
                <div className="flex-1 px-4 pb-24">
                    {currentData.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-4 text-center bg-card rounded-2xl border border-dashed border-border">
                            <div className="bg-emerald-500/10 p-6 rounded-full">
                                <span className="text-4xl">🎉</span>
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-foreground">All Clear!</h3>
                                <p className="text-muted-foreground text-sm">Tidak ada yang underperform di level ini.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-card rounded-2xl border border-border shadow-xl overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-muted/50 border-b border-border">
                                            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Unit / Area</th>
                                            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-center">Input / TGT</th>
                                            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-center">GAP</th>
                                            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right">%</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {[...currentData]
                                            .sort((a, b) => (b.target - b.total_input) - (a.target - a.total_input))
                                            .map((m, i) => {
                                                const pct = m.target > 0 ? Math.round((m.total_input / m.target) * 100) : 0;
                                                const gap = Math.max(0, m.target - m.total_input);
                                                const isCritical = gap >= 10; // Contoh logic priority

                                                return (
                                                    <tr key={i} className="group hover:bg-muted/30 transition-colors">
                                                        <td className="px-4 py-4">
                                                            <div className="font-bold text-foreground leading-tight">{m.name}</div>
                                                            {m.area && <div className="text-[10px] text-muted-foreground font-medium uppercase mt-0.5">{m.area}</div>}
                                                        </td>
                                                        <td className="px-4 py-4 text-center">
                                                            <div className="text-sm font-bold text-foreground">{m.total_input}</div>
                                                            <div className="text-[10px] text-muted-foreground">dari {m.target}</div>
                                                        </td>
                                                        <td className="px-4 py-4 text-center">
                                                            <div className={cn(
                                                                "inline-flex items-center px-2 py-1 rounded-lg font-black text-sm",
                                                                isCritical ? "bg-red-500 text-white shadow-sm" : "bg-red-100 text-red-600"
                                                            )}>
                                                                -{gap}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-4 text-right">
                                                            <div className={cn(
                                                                "text-sm font-black",
                                                                pct < 30 ? "text-red-600" : "text-amber-600"
                                                            )}>
                                                                {pct}%
                                                            </div>
                                                            <div className="mt-1.5 w-16 ml-auto bg-muted rounded-full h-1 overflow-hidden">
                                                                <div
                                                                    className={cn("h-full rounded-full", pct < 30 ? "bg-red-500" : "bg-amber-500")}
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
                        </div>
                    )}
                </div>

                {/* Profile Sidebar */}
                <ProfileSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            </div>
        </DashboardLayout>
    );
}
