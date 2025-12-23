'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Loading } from '@/components/ui/loading';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';

interface PromotorData {
    promoter_user_id: string;
    promoter_name: string;
    employee_id: string;
    total_input: number;
    total_approved: number;
    total_pending: number;
    total_rejected: number;
    total_closed: number;
    total_closing_direct: number;
    total_closing_followup: number;
    target: number;
}

interface StoreDetail {
    store: {
        id: string;
        name: string;
        total_input: number;
        total_approved: number;
        total_pending: number;
        total_rejected: number;
        total_closed: number;
        total_closing_direct: number;
        total_closing_followup: number;
        target: number;
    };
    promotors: PromotorData[];
}

// Helper untuk generate list bulan
const getMonthOptions = () => {
    const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const currentYear = new Date().getFullYear();
    const options = [];

    for (let i = 0; i < 12; i++) {
        const date = new Date(currentYear, new Date().getMonth() - i, 1);
        const monthIndex = date.getMonth();
        const year = date.getFullYear();
        options.push({
            value: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
            label: `${months[monthIndex]} ${year}`
        });
    }
    return options;
};

export default function StoreDetailPage() {
    const { user } = useAuth();
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const storeId = params.storeId as string;

    const [data, setData] = useState<StoreDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filter state
    const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const [selectedMonth, setSelectedMonth] = useState(searchParams.get('month') || currentMonth);
    const [showFilter, setShowFilter] = useState(false);
    const monthOptions = getMonthOptions();

    useEffect(() => {
        if (user && storeId) {
            fetchStoreDetail();
        }
    }, [user, storeId, selectedMonth]);

    const fetchStoreDetail = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/dashboard/store/${storeId}?month=${selectedMonth}`);
            if (!response.ok) {
                throw new Error('Failed to fetch store detail');
            }
            const result = await response.json();
            setData(result);
        } catch (err) {
            console.error('Store detail fetch error:', err);
            setError(err instanceof Error ? err.message : 'Failed to load store detail');
        } finally {
            setLoading(false);
        }
    };

    // Get label bulan yang dipilih
    const selectedMonthLabel = monthOptions.find(m => m.value === selectedMonth)?.label || 'Bulan ini';

    if (loading) {
        return (
            <DashboardLayout requiredRole={['spv', 'sator', 'manager', 'admin']}>
                <Loading message="Memuat detail toko..." />
            </DashboardLayout>
        );
    }

    if (error || !data) {
        return (
            <DashboardLayout requiredRole={['spv', 'sator', 'manager', 'admin']}>
                <div className="p-4">
                    <Alert type="error" message={error || 'Data tidak ditemukan'} />
                    <button
                        onClick={() => router.back()}
                        className="mt-4 text-primary text-sm font-medium"
                    >
                        &larr; Kembali
                    </button>
                </div>
            </DashboardLayout>
        );
    }

    const { store, promotors } = data;
    const progress = store.target > 0 ? Math.round((store.total_input / store.target) * 100) : 0;

    return (
        <DashboardLayout requiredRole={['spv', 'sator', 'manager', 'admin']}>
            <div className="min-h-screen bg-background">
                {/* Header with Back Button */}
                <div className="bg-primary pt-4 pb-8 px-4 rounded-b-3xl shadow-md">
                    {/* Back Button */}
                    <button
                        onClick={() => router.back()}
                        className="mb-4 flex items-center gap-2 text-primary-foreground/80 hover:text-primary-foreground transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        <span className="text-sm font-medium">Kembali</span>
                    </button>

                    {/* Store Info */}
                    <div className="text-center mb-4">
                        <div className="w-16 h-16 bg-card/20 backdrop-blur-sm rounded-xl flex items-center justify-center mx-auto mb-3 shadow-md">
                            <span className="text-3xl">🏪</span>
                        </div>
                        <h1 className="text-primary-foreground font-bold text-xl mb-1">{store.name}</h1>
                        <p className="text-primary-foreground/70 text-sm">{promotors.length} Promotor aktif</p>
                    </div>

                    {/* Month Filter Button */}
                    <button
                        onClick={() => setShowFilter(!showFilter)}
                        className="w-full mb-4 bg-card/10 backdrop-blur-sm rounded-xl px-4 py-2.5 flex items-center justify-between text-primary-foreground hover:bg-card/20 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-sm font-medium">{selectedMonthLabel}</span>
                        </div>
                        <svg className={`w-4 h-4 transition-transform ${showFilter ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    {/* Month Filter Dropdown */}
                    {showFilter && (
                        <div className="mb-4 bg-card rounded-xl shadow-md max-h-48 overflow-y-auto">
                            {monthOptions.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => {
                                        setSelectedMonth(option.value);
                                        setShowFilter(false);
                                    }}
                                    className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${
                                        selectedMonth === option.value
                                            ? 'bg-primary/10 text-primary font-medium'
                                            : 'text-foreground hover:bg-muted'
                                    }`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Stats Row */}
                    <div className="grid grid-cols-4 gap-2 bg-card/10 backdrop-blur-sm rounded-xl p-3">
                        <div className="text-center">
                            <div className="text-primary-foreground text-lg font-bold">{store.total_input}</div>
                            <div className="text-primary-foreground/60 text-xs">Input</div>
                        </div>
                        <div className="text-center border-l border-white/20">
                            <div className="text-primary-foreground text-lg font-bold">{store.total_pending}</div>
                            <div className="text-primary-foreground/60 text-xs">Pending</div>
                        </div>
                        <div className="text-center border-l border-white/20">
                            <div className="text-primary-foreground text-lg font-bold">{store.total_rejected}</div>
                            <div className="text-primary-foreground/60 text-xs">Reject</div>
                        </div>
                        <div className="text-center border-l border-white/20">
                            <div className="text-primary-foreground text-lg font-bold">{store.total_closed}</div>
                            <div className="text-primary-foreground/60 text-xs">Closing</div>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="px-4 pt-6 pb-24">
                    {/* Promotor List Header */}
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-semibold text-foreground">Daftar Promotor</h3>
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                            {promotors.length} orang
                        </span>
                    </div>

                    <div className="space-y-3">
                    {promotors.length === 0 ? (
                        <Alert type="info" message="Belum ada promotor di toko ini" />
                    ) : (
                        promotors
                            .sort((a, b) => b.total_input - a.total_input)
                            .map((promotor, index) => {
                                const promotorProgress = promotor.target > 0
                                    ? Math.round((promotor.total_input / promotor.target) * 100)
                                    : 0;

                                return (
                                    <div key={promotor.promoter_user_id || index} className="bg-card rounded-xl shadow-md p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold text-lg">
                                                    {promotor.promoter_name[0]?.toUpperCase() || 'P'}
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-foreground">
                                                        {promotor.promoter_name}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {promotor.total_input} / {promotor.target || 0} ({promotorProgress}%)
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-2xl font-bold text-primary">
                                                    {promotor.total_input}
                                                </div>
                                                <div className="text-xs text-muted-foreground">pengajuan</div>
                                            </div>
                                        </div>

                                        {/* Progress bar */}
                                        {promotor.target > 0 && (
                                            <div className="mb-3">
                                                <div className="w-full bg-muted rounded-full h-2">
                                                    <div
                                                        className="bg-primary h-full rounded-full transition-all"
                                                        style={{ width: `${Math.min(promotorProgress, 100)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-4 gap-2 text-center text-xs border-t border-border pt-3">
                                            <div>
                                                <div className="text-muted-foreground">Pengajuan</div>
                                                <div className="font-bold text-primary">{promotor.total_input}</div>
                                            </div>
                                            <div>
                                                <div className="text-muted-foreground">Pending</div>
                                                <div className="font-bold text-warning">{promotor.total_pending}</div>
                                            </div>
                                            <div>
                                                <div className="text-muted-foreground">Reject</div>
                                                <div className="font-bold text-destructive">{promotor.total_rejected}</div>
                                            </div>
                                            <div>
                                                <div className="text-muted-foreground">Closing</div>
                                                <div className="font-bold text-success">{promotor.total_closed}</div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                    )}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
