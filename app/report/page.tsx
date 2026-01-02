'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Loading } from '@/components/ui/loading';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface LeaderboardItem {
    id: string;
    name: string;
    target: number;
    daily_input: number;
    total_input: number;
    daily_closed: number;
    total_closed: number;
    daily_pending: number;
    total_pending: number;
    daily_rejected: number;
    total_rejected: number;
}

interface ReportData {
    date: string;
    supervisor: string;
    leaderboard: LeaderboardItem[];
    totals: {
        target: number;
        daily_input: number;
        total_input: number;
        daily_closed: number;
        total_closed: number;
        daily_pending: number;
        total_pending: number;
        daily_rejected: number;
        total_rejected: number;
    };
}

const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
};

const formatDateShort = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
};

const formatFirstName = (fullName: string) => {
    const firstName = fullName.trim().split(' ')[0];
    return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
};

export default function ReportPage() {
    const { user } = useAuth();
    const tableRef = useRef<HTMLDivElement>(null);
    const [data, setData] = useState<ReportData | null>(null);
    const [initialLoading, setInitialLoading] = useState(true);
    const [fetching, setFetching] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [saving, setSaving] = useState(false);

    const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Makassar',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date());

    const [selectedDate, setSelectedDate] = useState(today);
    const isFirstLoad = useRef(true);

    useEffect(() => {
        if (user) {
            fetchReportData(isFirstLoad.current);
            isFirstLoad.current = false;
        }
    }, [user, selectedDate]);

    const fetchReportData = async (isInitial = false) => {
        if (isInitial) setInitialLoading(true);
        else setFetching(true);
        setError(null);

        try {
            const url = `/api/report/daily?date=${selectedDate}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to fetch report data');
            const result = await response.json();
            setData(result);
        } catch (err) {
            console.error('Report fetch error:', err);
            setError(err instanceof Error ? err.message : 'Failed to load report');
        } finally {
            setInitialLoading(false);
            setFetching(false);
        }
    };

    const changeDate = (days: number) => {
        const current = new Date(selectedDate + 'T00:00:00');
        current.setDate(current.getDate() + days);
        // FIX: Use WITA timezone instead of UTC toISOString
        const newDate = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Makassar',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(current);
        setSelectedDate(newDate);
    };

    const getRankEmoji = (index: number) => {
        if (index === 0) return '🥇';
        if (index === 1) return '🥈';
        if (index === 2) return '🥉';
        return `${index + 1}.`;
    };

    const generateWAText = () => {
        if (!data) return '';
        const periodLabel = formatDateShort(data.date || selectedDate);

        let text = `📊 *LAPORAN TIM*\n`;
        text += `📅 ${periodLabel}\n`;
        text += `👤 ${data.supervisor}\n\n`;

        if (data.leaderboard.length === 0) {
            text += `_Belum ada data_\n`;
        } else {
            text += `🏆 *LEADERBOARD:*\n`;
            data.leaderboard.forEach((item, index) => {
                const emoji = getRankEmoji(index);
                text += `${emoji} *${formatFirstName(item.name)}*: ${item.daily_input}/${item.total_input}/${item.target}\n`;
            });
        }

        text += `\n══════════════════\n`;
        text += `📈 *TOTAL TIM*\n`;
        text += `📥 Input (H/T): ${data.totals.daily_input}/${data.totals.total_input}\n`;
        text += `🎯 Target: ${data.totals.target}\n`;
        text += `✅ Closing: ${data.totals.total_closed}\n`;
        text += `⏳ Pending: ${data.totals.total_pending}\n`;
        text += `❌ Reject: ${data.totals.total_rejected}`;

        return text;
    };

    const copyToClipboard = async () => {
        const text = generateWAText();
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
            alert('Gagal copy. Coba lagi.');
        }
    };

    const saveAsImage = async () => {
        if (!tableRef.current) return;
        setSaving(true);
        try {
            const html2canvas = (await import('html2canvas')).default;
            const canvas = await html2canvas(tableRef.current, { backgroundColor: '#ffffff', scale: 2 });
            const filename = `laporan-tim-${selectedDate}.png`;
            const link = document.createElement('a');
            link.download = filename;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (err) {
            console.error('Failed to save image:', err);
            alert('Gagal simpan gambar. Coba lagi.');
        } finally {
            setSaving(false);
        }
    };

    if (initialLoading) {
        return (
            <DashboardLayout requiredRole={['spv', 'sator', 'manager', 'admin']}>
                <Loading message="Memuat laporan..." />
            </DashboardLayout>
        );
    }

    if (error && !data) {
        return (
            <DashboardLayout requiredRole={['spv', 'sator', 'manager', 'admin']}>
                <div className="p-4">
                    <Alert type="error" message={error} />
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout requiredRole={['spv', 'sator', 'manager', 'admin']}>
            <div className="min-h-screen bg-background pb-24">
                {/* Header */}
                <div className="bg-warning pt-4 pb-5 px-4 rounded-b-3xl shadow-md">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-11 h-11 bg-card/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow">
                            <span className="text-xl">📊</span>
                        </div>
                        <div>
                            <h1 className="text-primary-foreground font-bold text-base">
                                Laporan Tim
                            </h1>
                            <p className="text-primary-foreground/60 text-xs">{data?.supervisor}</p>
                        </div>
                    </div>

                    {/* Date Navigation */}
                    <div className="flex items-center justify-between bg-card/10 backdrop-blur-sm rounded-xl p-2">
                        <button
                            onClick={() => changeDate(-1)}
                            className="w-9 h-9 flex items-center justify-center text-primary-foreground hover:bg-card/10 rounded-xl transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <div className="text-center">
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                max={today}
                                className="bg-transparent text-primary-foreground text-sm font-medium text-center cursor-pointer [color-scheme:dark]"
                            />
                            <p className="text-primary-foreground/50 text-[10px]">{formatDate(selectedDate)}</p>
                        </div>
                        <button
                            onClick={() => changeDate(1)}
                            disabled={selectedDate >= today}
                            className="w-9 h-9 flex items-center justify-center text-primary-foreground hover:bg-card/10 rounded-xl transition-colors disabled:opacity-30"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="px-4 pt-4">
                    {/* Table for Image Export */}
                    <Card ref={tableRef} className="overflow-hidden">
                        {/* Table Header */}
                        <div style={{ backgroundColor: '#f59e0b', padding: '12px 16px' }}>
                            <div>
                                <h2 style={{ color: 'white', fontWeight: 'bold', fontSize: '14px', margin: 0 }}>{data?.supervisor || '-'}</h2>
                                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', margin: '2px 0 0 0' }}>
                                    {formatDateShort(data?.date || selectedDate)}
                                </p>
                            </div>
                        </div>

                        {/* Table - Format H/T/TGT */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-muted border-b">
                                    <tr>
                                        <th className="px-3 py-2 text-left text-muted-foreground font-semibold w-8">#</th>
                                        <th className="px-3 py-2 text-left text-muted-foreground font-semibold">Nama</th>
                                        <th className="px-2 py-2 text-center text-primary font-semibold">INPUT (H/T/TGT)</th>
                                        <th className="px-2 py-2 text-center text-success font-semibold w-12">CLO</th>
                                        <th className="px-2 py-2 text-center text-warning font-semibold w-12">PND</th>
                                        <th className="px-2 py-2 text-center text-destructive font-semibold w-12">REJ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {fetching ? (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-8 text-center">
                                                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                                                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                    <span>Memuat data...</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : data?.leaderboard.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                                                Belum ada data untuk tanggal ini
                                            </td>
                                        </tr>
                                    ) : (
                                        data?.leaderboard.map((item, index) => (
                                            <tr key={item.id} className={index % 2 === 0 ? 'bg-card' : 'bg-muted'}>
                                                <td className="px-3 py-2 text-center">
                                                    <span className={index < 3 ? 'text-base' : 'text-muted-foreground text-xs'}>
                                                        {getRankEmoji(index)}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 font-medium text-foreground truncate max-w-[120px]">
                                                    {formatFirstName(item.name)}
                                                </td>
                                                <td className="px-2 py-2 text-center font-bold text-primary font-mono text-xs">
                                                    {item.daily_input}/{item.total_input}/{item.target || '-'}
                                                </td>
                                                <td className="px-2 py-2 text-center font-bold text-success font-mono text-xs">
                                                    {item.daily_closed}/{item.total_closed}
                                                </td>
                                                <td className="px-2 py-2 text-center font-bold text-warning font-mono text-xs">
                                                    {item.daily_pending}/{item.total_pending}
                                                </td>
                                                <td className="px-2 py-2 text-center font-bold text-destructive font-mono text-xs">
                                                    {item.daily_rejected}/{item.total_rejected}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                                {!fetching && data && data.leaderboard.length > 0 && (
                                    <tfoot className="bg-muted border-t-2 border-border">
                                        <tr>
                                            <td className="px-3 py-2" colSpan={2}>
                                                <span className="font-bold text-foreground">TOTAL</span>
                                            </td>
                                            <td className="px-2 py-2 text-center font-bold text-primary font-mono text-xs">
                                                {data.totals.daily_input}/{data.totals.total_input}/{data.totals.target || '-'}
                                            </td>
                                            <td className="px-2 py-2 text-center font-bold text-success font-mono text-xs">
                                                {data.totals.daily_closed}/{data.totals.total_closed}
                                            </td>
                                            <td className="px-2 py-2 text-center font-bold text-warning font-mono text-xs">
                                                {data.totals.daily_pending}/{data.totals.total_pending}
                                            </td>
                                            <td className="px-2 py-2 text-center font-bold text-destructive font-mono text-xs">
                                                {data.totals.daily_rejected}/{data.totals.total_rejected}
                                            </td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>

                        {/* Footer for image */}
                        <div className="bg-muted px-4 py-2 border-t text-center">
                            <p className="text-muted-foreground text-xs">Format: Hari Ini / Total Bulan / Target</p>
                        </div>
                    </Card>

                    {/* Action Buttons */}
                    <div className="flex gap-3 mt-4">
                        <Button
                            onClick={copyToClipboard}
                            variant={copied ? "success" : "outline"}
                            className="flex-1"
                        >
                            {copied ? '✓ Tersalin!' : '📋 Copy WA'}
                        </Button>
                        <Button
                            onClick={saveAsImage}
                            disabled={saving}
                            loading={saving}
                            variant="outline"
                            className="flex-1"
                        >
                            📸 Simpan Gambar
                        </Button>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
