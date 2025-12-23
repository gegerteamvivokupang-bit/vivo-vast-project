'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Loading } from '@/components/ui/loading';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type ReportType = 'daily' | 'monthly';

interface LeaderboardItem {
    id: string;
    name: string;
    target: number;
    input: number;
    acc: number;
    pending: number;
    reject: number;
}

interface ReportData {
    date?: string;
    month?: string;
    supervisor: string;
    leaderboard: LeaderboardItem[];
    totals: {
        target: number;
        input: number;
        acc: number;
        pending: number;
        reject: number;
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

const formatMonth = (monthStr: string) => {
    const parts = monthStr.split('-');
    const year = parts[0];
    const monthIndex = parseInt(parts[1], 10) - 1;
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return `${months[monthIndex]} ${year}`;
};

const formatMonthShort = (monthStr: string) => {
    const parts = monthStr.split('-');
    const year = parts[0];
    const monthIndex = parseInt(parts[1], 10) - 1;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    return `${months[monthIndex]} ${year}`;
};

const formatFirstName = (fullName: string) => {
    const firstName = fullName.trim().split(' ')[0];
    return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
};

const getDateRange = (monthStr: string, todayStr: string) => {
    const parts = monthStr.split('-');
    const year = parseInt(parts[0], 10);
    const monthIndex = parseInt(parts[1], 10) - 1;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const lastDayOfMonth = new Date(year, monthIndex + 1, 0).getDate();
    const todayParts = todayStr.split('-');
    const todayYear = parseInt(todayParts[0], 10);
    const todayMonth = parseInt(todayParts[1], 10) - 1;
    const todayDate = parseInt(todayParts[2], 10);

    let endDay: number;
    if (year === todayYear && monthIndex === todayMonth) {
        endDay = todayDate;
    } else {
        endDay = lastDayOfMonth;
    }
    return `1 - ${endDay} ${months[monthIndex]} ${year}`;
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
    const [activeTab, setActiveTab] = useState<ReportType>('daily');

    const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Makassar',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date());
    const currentMonth = today.substring(0, 7);

    const [selectedDate, setSelectedDate] = useState(today);
    const [selectedMonth, setSelectedMonth] = useState(currentMonth);
    const isFirstLoad = useRef(true);

    useEffect(() => {
        if (user) {
            fetchReportData(isFirstLoad.current);
            isFirstLoad.current = false;
        }
    }, [user, activeTab, selectedDate, selectedMonth]);

    const fetchReportData = async (isInitial = false) => {
        if (isInitial) setInitialLoading(true);
        else setFetching(true);
        setError(null);

        try {
            let url: string;
            if (activeTab === 'daily') {
                url = `/api/report/daily?date=${selectedDate}`;
            } else {
                url = `/api/report/monthly?month=${selectedMonth}`;
            }
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
        const newDate = current.toISOString().split('T')[0];
        setSelectedDate(newDate);
    };

    const changeMonth = (months: number) => {
        const [year, month] = selectedMonth.split('-').map(Number);
        const date = new Date(year, month - 1 + months, 1);
        const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        setSelectedMonth(newMonth);
    };

    const getRankEmoji = (index: number) => {
        if (index === 0) return '🥇';
        if (index === 1) return '🥈';
        if (index === 2) return '🥉';
        return `${index + 1}.`;
    };

    const generateWAText = () => {
        if (!data) return '';
        const isMonthly = activeTab === 'monthly';
        const periodLabel = isMonthly
            ? formatMonthShort(data.month || selectedMonth)
            : formatDateShort(data.date || selectedDate);

        let text = isMonthly ? `📊 *LAPORAN BULANAN*\n` : `📊 *LAPORAN HARIAN*\n`;
        text += `📅 ${periodLabel}\n`;
        text += `👤 ${data.supervisor}\n\n`;

        if (data.leaderboard.length === 0) {
            text += `_Belum ada data_\n`;
        } else {
            text += `🏆 *LEADERBOARD:*\n`;
            data.leaderboard.forEach((item, index) => {
                const emoji = getRankEmoji(index);
                let line = `${emoji} ${formatFirstName(item.name)} - ${item.input} input`;
                if (item.acc > 0 || item.reject > 0) {
                    const parts = [];
                    if (item.acc > 0) parts.push(`${item.acc} ACC`);
                    if (item.pending > 0) parts.push(`${item.pending} PND`);
                    if (item.reject > 0) parts.push(`${item.reject} REJ`);
                    line += ` (${parts.join(', ')})`;
                }
                text += line + '\n';
            });
        }
        text += `\n📈 *TOTAL:* ${data.totals.input} Input | ${data.totals.acc} ACC | ${data.totals.pending} Pending | ${data.totals.reject} Reject`;
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
            const filename = activeTab === 'daily'
                ? `laporan-harian-${selectedDate}.png`
                : `laporan-bulanan-${selectedMonth}.png`;
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
            <div className="min-h-screen bg-background">
                {/* Header */}
                <div className="bg-warning pt-4 pb-5 px-4 rounded-b-3xl shadow-md">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-11 h-11 bg-card/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow">
                            <span className="text-xl">📊</span>
                        </div>
                        <div>
                            <h1 className="text-primary-foreground font-bold text-base">
                                Laporan {activeTab === 'daily' ? 'Harian' : 'Bulanan'}
                            </h1>
                            <p className="text-primary-foreground/60 text-xs">{data?.supervisor}</p>
                        </div>
                    </div>

                    {/* Tab Switcher */}
                    <div className="flex gap-2 mb-3">
                        <button
                            onClick={() => setActiveTab('daily')}
                            className={cn(
                                "flex-1 py-2 rounded-xl text-sm font-medium transition-all",
                                activeTab === 'daily'
                                    ? 'bg-card text-warning'
                                    : 'bg-card/20 text-primary-foreground hover:bg-card/30'
                            )}
                        >
                            Harian
                        </button>
                        <button
                            onClick={() => setActiveTab('monthly')}
                            className={cn(
                                "flex-1 py-2 rounded-xl text-sm font-medium transition-all",
                                activeTab === 'monthly'
                                    ? 'bg-card text-warning'
                                    : 'bg-card/20 text-primary-foreground hover:bg-card/30'
                            )}
                        >
                            Bulanan
                        </button>
                    </div>

                    {/* Date/Month Navigation */}
                    <div className="flex items-center justify-between bg-card/10 backdrop-blur-sm rounded-xl p-2">
                        <button
                            onClick={() => activeTab === 'daily' ? changeDate(-1) : changeMonth(-1)}
                            className="w-9 h-9 flex items-center justify-center text-primary-foreground hover:bg-card/10 rounded-xl transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <div className="text-center">
                            {activeTab === 'daily' ? (
                                <>
                                    <input
                                        type="date"
                                        value={selectedDate}
                                        onChange={(e) => setSelectedDate(e.target.value)}
                                        max={today}
                                        className="bg-transparent text-primary-foreground text-sm font-medium text-center cursor-pointer [color-scheme:dark]"
                                    />
                                    <p className="text-primary-foreground/50 text-[10px]">{formatDate(selectedDate)}</p>
                                </>
                            ) : (
                                <>
                                    <input
                                        type="month"
                                        value={selectedMonth}
                                        onChange={(e) => setSelectedMonth(e.target.value)}
                                        max={currentMonth}
                                        className="bg-transparent text-primary-foreground text-sm font-medium text-center cursor-pointer [color-scheme:dark]"
                                    />
                                    <p className="text-primary-foreground/50 text-[10px]">{formatMonth(selectedMonth)}</p>
                                </>
                            )}
                        </div>
                        <button
                            onClick={() => activeTab === 'daily' ? changeDate(1) : changeMonth(1)}
                            disabled={activeTab === 'daily' ? selectedDate >= today : selectedMonth >= currentMonth}
                            className="w-9 h-9 flex items-center justify-center text-primary-foreground hover:bg-card/10 rounded-xl transition-colors disabled:opacity-30"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="px-4 pt-4 pb-24">
                    {/* Table for Image Export */}
                    <Card ref={tableRef} className="overflow-hidden">
                        {/* Table Header */}
                        <div className="bg-warning px-4 py-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-primary-foreground font-bold text-sm">{data?.supervisor || '-'}</h2>
                                    <p className="text-primary-foreground/70 text-xs">
                                        {activeTab === 'daily'
                                            ? formatDateShort(data?.date || selectedDate)
                                            : getDateRange(data?.month || selectedMonth, today)
                                        }
                                    </p>
                                </div>
                                <div className="text-right">
                                    <span className="bg-card/20 text-primary-foreground text-xs px-2 py-1 rounded-xl">
                                        {activeTab === 'daily' ? 'Harian' : 'Bulanan'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-muted border-b">
                                    <tr>
                                        <th className="px-3 py-2 text-left text-muted-foreground font-semibold w-8">#</th>
                                        <th className="px-3 py-2 text-left text-muted-foreground font-semibold">Nama</th>
                                        <th className="px-2 py-2 text-center text-muted-foreground font-semibold w-12">TGT</th>
                                        <th className="px-2 py-2 text-center text-primary font-semibold w-12">IN</th>
                                        <th className="px-2 py-2 text-center text-success font-semibold w-12">ACC</th>
                                        <th className="px-2 py-2 text-center text-warning font-semibold w-12">PND</th>
                                        <th className="px-2 py-2 text-center text-destructive font-semibold w-12">REJ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {fetching ? (
                                        <tr>
                                            <td colSpan={7} className="px-4 py-8 text-center">
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
                                            <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                                                Belum ada data untuk {activeTab === 'daily' ? 'tanggal' : 'bulan'} ini
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
                                                <td className="px-2 py-2 text-center text-muted-foreground">{item.target || '-'}</td>
                                                <td className="px-2 py-2 text-center font-bold text-primary">{item.input}</td>
                                                <td className="px-2 py-2 text-center font-bold text-success">{item.acc}</td>
                                                <td className="px-2 py-2 text-center font-bold text-warning">{item.pending}</td>
                                                <td className="px-2 py-2 text-center font-bold text-destructive">{item.reject}</td>
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
                                            <td className="px-2 py-2 text-center font-bold text-muted-foreground">{data.totals.target || '-'}</td>
                                            <td className="px-2 py-2 text-center font-bold text-primary">{data.totals.input}</td>
                                            <td className="px-2 py-2 text-center font-bold text-success">{data.totals.acc}</td>
                                            <td className="px-2 py-2 text-center font-bold text-warning">{data.totals.pending}</td>
                                            <td className="px-2 py-2 text-center font-bold text-destructive">{data.totals.reject}</td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>

                        {/* Footer for image */}
                        <div className="bg-muted px-4 py-2 border-t text-center">
                            <p className="text-muted-foreground text-xs">VAST Finance - {data?.supervisor}</p>
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
