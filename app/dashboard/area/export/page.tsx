'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { ProfileSidebar } from '@/components/ProfileSidebar';
import { Loading } from '@/components/ui/loading';
import { Alert } from '@/components/ui/alert';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Download, FileSpreadsheet, Image, User, Eye, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';

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
    sator_name?: string;
}

export default function ManagerExportPage() {
    const { user } = useAuth();
    const [areas, setAreas] = useState<Member[]>([]);
    const [sators, setSators] = useState<Member[]>([]);
    const [promotors, setPromotors] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const areaTableRef = useRef<HTMLDivElement>(null);
    const satorTableRef = useRef<HTMLDivElement>(null);

    const [includePerformance, setIncludePerformance] = useState(true);
    const [includeUnderperform, setIncludeUnderperform] = useState(false);
    const [includeSummary, setIncludeSummary] = useState(false);
    const [exportFormat, setExportFormat] = useState<'excel' | 'png'>('excel');

    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const currentDay = now.getDate();
    const timeGonePercent = Math.round((currentDay / daysInMonth) * 100);
    const periodLabel = now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }).toUpperCase();

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

            setAreas(data?.areas || []);
            setSators(data?.sators || []);
            setPromotors(data?.promotors || []);
        } catch (err) {
            console.error(err);
            setError('Gagal memuat data');
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            const dateStr = new Date().toISOString().slice(0, 10);

            if (exportFormat === 'excel') {
                const wb = XLSX.utils.book_new();

                if (includePerformance) {
                    const areaData = areas.map(m => {
                        const pct = m.target > 0 ? Math.round((m.total_input / m.target) * 100) : 0;
                        return { AREA: m.name, TARGET: m.target, INPUT: m.total_input, 'INPUT_%': pct, CLOSING: m.total_closed, PENDING: m.total_pending, REJECT: m.total_rejected, STATUS: isUnderperform(m) ? 'UNDERPERFORM' : 'OK' };
                    });
                    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(areaData), 'AREA_SUMMARY');

                    const satorData = sators.map(m => {
                        const pct = m.target > 0 ? Math.round((m.total_input / m.target) * 100) : 0;
                        return { AREA: m.area, SATOR: m.name, TARGET: m.target, INPUT: m.total_input, 'INPUT_%': pct, CLOSING: m.total_closed, PENDING: m.total_pending, REJECT: m.total_rejected, STATUS: isUnderperform(m) ? 'UNDERPERFORM' : 'OK' };
                    });
                    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(satorData), 'SATOR_DETAIL');

                    const promotorData = promotors.map(m => {
                        const pct = m.target > 0 ? Math.round((m.total_input / m.target) * 100) : 0;
                        return { AREA: m.area, SATOR: m.sator_name, PROMOTOR: m.name, TARGET: m.target, INPUT: m.total_input, 'INPUT_%': pct, CLOSING: m.total_closed, PENDING: m.total_pending, REJECT: m.total_rejected, STATUS: isUnderperform(m) ? 'UNDERPERFORM' : 'OK' };
                    });
                    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(promotorData), 'PROMOTOR_DETAIL');
                }

                if (includeUnderperform) {
                    const underData = [
                        ...areas.filter(isUnderperform).map(m => ({ Level: 'AREA', Nama: m.name, Target: m.target, Input: m.total_input })),
                        ...sators.filter(isUnderperform).map(m => ({ Level: 'SATOR', Nama: m.name, Target: m.target, Input: m.total_input, Area: m.area })),
                        ...promotors.filter(isUnderperform).map(m => ({ Level: 'PROMOTOR', Nama: m.name, Target: m.target, Input: m.total_input, Area: m.area })),
                    ];
                    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(underData), 'UNDERPERFORM');
                }

                if (includeSummary) {
                    const summary = [
                        { Info: 'PERIODE', Nilai: periodLabel },
                        { Info: 'TIME GONE', Nilai: `${timeGonePercent}%` },
                        { Info: 'TOTAL AREA', Nilai: areas.length },
                        { Info: 'TOTAL SATOR', Nilai: sators.length },
                        { Info: 'TOTAL PROMOTOR', Nilai: promotors.length },
                        { Info: 'UNDERPERFORM', Nilai: areas.filter(isUnderperform).length + sators.filter(isUnderperform).length + promotors.filter(isUnderperform).length },
                    ];
                    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'SUMMARY');
                }

                XLSX.writeFile(wb, `Laporan_Manager_${dateStr}.xlsx`);
            }

            if (exportFormat === 'png') {
                if (areaTableRef.current) {
                    const canvas1 = await html2canvas(areaTableRef.current, { backgroundColor: '#fff', scale: 2 });
                    const link1 = document.createElement('a');
                    link1.download = `Laporan_AREA_${dateStr}.png`;
                    link1.href = canvas1.toDataURL('image/png');
                    link1.click();
                }
                await new Promise(r => setTimeout(r, 500));
                if (satorTableRef.current) {
                    const canvas2 = await html2canvas(satorTableRef.current, { backgroundColor: '#fff', scale: 2 });
                    const link2 = document.createElement('a');
                    link2.download = `Laporan_SATOR_${dateStr}.png`;
                    link2.href = canvas2.toDataURL('image/png');
                    link2.click();
                }
            }
        } catch (err) {
            console.error(err);
            alert('Gagal export');
        } finally {
            setExporting(false);
        }
    };

    if (loading) return <DashboardLayout><Loading message="Memuat data..." /></DashboardLayout>;
    if (error) return <DashboardLayout><Alert type="error" message={error} /></DashboardLayout>;

    return (
        <DashboardLayout allowedRoles={['manager']}>
            <div className="min-h-screen bg-background flex flex-col pb-24">
                {/* TopAppBar */}
                <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border">
                    <div className="flex items-center p-4 justify-between">
                        <button
                            onClick={() => window.history.back()}
                            className="flex items-center justify-center h-10 w-10 rounded-full hover:bg-muted transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <h2 className="text-foreground text-base font-bold flex-1 text-center uppercase">Manager Area | Export</h2>
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm"
                        >
                            {user?.name ? getInitials(user.name) : <User className="w-5 h-5" />}
                        </button>
                    </div>
                </div>

                {/* Page Header */}
                <div className="px-4 py-4">
                    <h1 className="text-2xl font-bold">Export Laporan</h1>
                    <p className="text-muted-foreground text-sm mt-1">Tarik laporan lengkap kinerja tim dan area.</p>
                </div>

                {/* Section 1: Sumber Data */}
                <div className="px-4 mt-2">
                    <h2 className="text-lg font-bold mb-3">Sumber Data</h2>
                    <div className="bg-card rounded-xl border border-border p-2 shadow-sm">
                        <label className="group flex gap-3 p-3 items-center hover:bg-muted rounded-lg cursor-pointer transition-colors">
                            <input
                                type="checkbox"
                                checked={includePerformance}
                                onChange={(e) => setIncludePerformance(e.target.checked)}
                                className="h-5 w-5 rounded border-border text-primary focus:ring-0 focus:ring-offset-0"
                            />
                            <div className="flex flex-col">
                                <span className="font-medium">PERFORMANCE</span>
                                <span className="text-xs text-muted-foreground">Data pencapaian target harian</span>
                            </div>
                        </label>
                        <div className="h-px bg-border mx-3" />
                        <label className="group flex gap-3 p-3 items-center hover:bg-muted rounded-lg cursor-pointer transition-colors">
                            <input
                                type="checkbox"
                                checked={includeUnderperform}
                                onChange={(e) => setIncludeUnderperform(e.target.checked)}
                                className="h-5 w-5 rounded border-border text-primary focus:ring-0 focus:ring-offset-0"
                            />
                            <div className="flex flex-col">
                                <span className="font-medium">UNDERPERFORM</span>
                                <span className="text-xs text-muted-foreground">Daftar unit dibawah target</span>
                            </div>
                        </label>
                        <div className="h-px bg-border mx-3" />
                        <label className="group flex gap-3 p-3 items-center hover:bg-muted rounded-lg cursor-pointer transition-colors">
                            <input
                                type="checkbox"
                                checked={includeSummary}
                                onChange={(e) => setIncludeSummary(e.target.checked)}
                                className="h-5 w-5 rounded border-border text-primary focus:ring-0 focus:ring-offset-0"
                            />
                            <div className="flex flex-col">
                                <span className="font-medium">SUMMARY</span>
                                <span className="text-xs text-muted-foreground">Ringkasan eksekutif mingguan</span>
                            </div>
                        </label>
                    </div>
                </div>

                {/* Section 2: Format */}
                <div className="px-4 mt-6">
                    <h2 className="text-lg font-bold mb-3">Format</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <label className={cn(
                            "relative flex flex-col items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all",
                            exportFormat === 'excel' ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted"
                        )}>
                            <input
                                type="radio"
                                name="format"
                                checked={exportFormat === 'excel'}
                                onChange={() => setExportFormat('excel')}
                                className="sr-only"
                            />
                            {exportFormat === 'excel' && (
                                <div className="absolute top-3 right-3 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                                    <Check className="w-3 h-3 text-primary-foreground" />
                                </div>
                            )}
                            <FileSpreadsheet className={cn("w-10 h-10 mb-2", exportFormat === 'excel' ? "text-primary" : "text-muted-foreground")} />
                            <span className={cn("text-sm font-semibold", exportFormat === 'excel' ? "text-primary" : "text-muted-foreground")}>EXCEL (.XLSX)</span>
                        </label>
                        <label className={cn(
                            "relative flex flex-col items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all",
                            exportFormat === 'png' ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted"
                        )}>
                            <input
                                type="radio"
                                name="format"
                                checked={exportFormat === 'png'}
                                onChange={() => setExportFormat('png')}
                                className="sr-only"
                            />
                            {exportFormat === 'png' && (
                                <div className="absolute top-3 right-3 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                                    <Check className="w-3 h-3 text-primary-foreground" />
                                </div>
                            )}
                            <Image className={cn("w-10 h-10 mb-2", exportFormat === 'png' ? "text-primary" : "text-muted-foreground")} />
                            <span className={cn("text-sm font-medium", exportFormat === 'png' ? "text-primary" : "text-muted-foreground")}>PNG (2 GAMBAR)</span>
                        </label>
                    </div>
                </div>

                {/* Section 3: Preview */}
                <div className="px-4 mt-8">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-lg font-bold">Preview Data</h2>
                        <span className="text-xs font-medium text-primary cursor-pointer hover:underline flex items-center gap-1">
                            <Eye className="w-3 h-3" /> Lihat Semua
                        </span>
                    </div>

                    {/* Table 1: Laporan Area */}
                    <div ref={areaTableRef} className="mb-6 bg-card rounded-xl overflow-hidden shadow-sm border border-border">
                        <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/50">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Laporan Area</h3>
                            <Eye className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead className="text-xs text-muted-foreground border-b border-border">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">Region</th>
                                        <th className="px-4 py-3 font-medium text-right">Target</th>
                                        <th className="px-4 py-3 font-medium text-right">Achieved</th>
                                        <th className="px-4 py-3 font-medium text-right">%</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {areas.slice(0, 4).map((a, i) => {
                                        const pct = a.target > 0 ? Math.round((a.total_input / a.target) * 100) : 0;
                                        const under = isUnderperform(a);
                                        return (
                                            <tr key={i} className="border-b border-border">
                                                <td className="px-4 py-3 font-medium">{a.name}</td>
                                                <td className="px-4 py-3 text-right text-muted-foreground">{a.target}</td>
                                                <td className="px-4 py-3 text-right">{a.total_input}</td>
                                                <td className={cn("px-4 py-3 text-right font-bold", under ? "text-red-500" : pct >= 80 ? "text-emerald-500" : "text-amber-500")}>{pct}%</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Table 2: Laporan Sator */}
                    <div ref={satorTableRef} className="bg-card rounded-xl overflow-hidden shadow-sm border border-border">
                        <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/50">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Laporan Sator</h3>
                            <Eye className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead className="text-xs text-muted-foreground border-b border-border">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">Unit Name</th>
                                        <th className="px-4 py-3 font-medium">Area</th>
                                        <th className="px-4 py-3 font-medium text-center">Input</th>
                                        <th className="px-4 py-3 font-medium text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sators.slice(0, 4).map((s, i) => {
                                        const under = isUnderperform(s);
                                        return (
                                            <tr key={i} className="border-b border-border">
                                                <td className="px-4 py-3 font-medium">{s.name.split(' ')[0]}</td>
                                                <td className="px-4 py-3 text-muted-foreground">{s.area}</td>
                                                <td className="px-4 py-3 text-center">{s.total_input}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={cn(
                                                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
                                                        under ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 ring-red-600/20" : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 ring-green-600/20"
                                                    )}>
                                                        {under ? 'Risk' : 'On Track'}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Sticky Footer Action */}
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border z-40 pb-8 max-w-md mx-auto">
                    <button
                        onClick={handleExport}
                        disabled={exporting}
                        className="w-full bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98]"
                    >
                        <Download className="w-5 h-5" />
                        {exporting ? 'Mengekspor...' : 'TARIK DATA'}
                    </button>
                </div>

                {/* Profile Sidebar */}
                <ProfileSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            </div>
        </DashboardLayout>
    );
}
