'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import SpvHeader from '@/components/SpvHeader';
import { Loading } from '@/components/ui/loading';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';

interface TeamMember {
    user_id: string;
    name: string;
    role: string;
    total_input: number;
    total_pending: number;
    total_rejected: number;
    total_closed: number;
    target?: number;
    isSelf?: boolean;
}

export default function ExportPage() {
    const { user } = useAuth();
    const [sators, setSators] = useState<TeamMember[]>([]);
    const [allPromotors, setAllPromotors] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);

    // Refs untuk 2 tabel terpisah
    const satorTableRef = useRef<HTMLDivElement>(null);
    const promotorTableRef = useRef<HTMLDivElement>(null);

    // Checkbox states
    const [includePerformance, setIncludePerformance] = useState(true);
    const [includeUnderperform, setIncludeUnderperform] = useState(true);
    const [includeDaily, setIncludeDaily] = useState(true);
    const [formatExcel, setFormatExcel] = useState(true);
    const [formatPng, setFormatPng] = useState(false);

    // Time Gone
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const currentDay = now.getDate();
    const timeGonePercent = Math.round((currentDay / daysInMonth) * 100);
    const periodLabel = now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }).toUpperCase();

    useEffect(() => {
        if (user) fetchData();
    }, [user]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const supabase = createClient();

            const { data: directSubs, error: err1 } = await supabase.functions.invoke('dashboard-team-monthly', {
                body: { userId: user?.id }
            });
            if (err1) throw err1;

            // Handle new response format: { subordinates: [...], spvTarget: number }
            const directData: TeamMember[] = directSubs?.subordinates || [];
            const satorListFromData = directData.filter((m: TeamMember) => m.role === 'sator');
            const directPromotors = directData.filter((m: TeamMember) => m.role === 'promotor');

            let satorList: TeamMember[] = [...satorListFromData];

            if (directPromotors.length > 0 && user) {
                const selfAsSator: TeamMember = {
                    user_id: user.id,
                    name: user.name,
                    role: 'sator',
                    total_input: directPromotors.reduce((sum, p) => sum + (p.total_input || 0), 0),
                    total_pending: directPromotors.reduce((sum, p) => sum + (p.total_pending || 0), 0),
                    total_rejected: directPromotors.reduce((sum, p) => sum + (p.total_rejected || 0), 0),
                    total_closed: directPromotors.reduce((sum, p) => sum + (p.total_closed || 0), 0),
                    target: directPromotors.reduce((sum, p) => sum + (p.target || 0), 0),
                    isSelf: true
                };
                satorList.push(selfAsSator);
            }

            setSators(satorList);

            let promotorList: TeamMember[] = [...directPromotors];

            for (const sator of satorListFromData) {
                const { data: satorSubs } = await supabase.functions.invoke('dashboard-team-monthly', {
                    body: { userId: sator.user_id }
                });
                // Handle new response format
                const satorSubData = satorSubs?.subordinates || [];
                if (satorSubData.length > 0) {
                    const satorPromotors = satorSubData.filter((m: TeamMember) => m.role === 'promotor');
                    promotorList = [...promotorList, ...satorPromotors];
                }
            }

            setAllPromotors(promotorList);

        } catch (err) {
            setError('Gagal memuat data');
        } finally {
            setLoading(false);
        }
    };

    const isUnderperform = (m: TeamMember): boolean => {
        const target = m.target || 0;
        const input = m.total_input || 0;
        if (target === 0) return true;
        return (input / target) * 100 < timeGonePercent;
    };

    const handleExport = async () => {
        if (!formatExcel && !formatPng) {
            alert('Pilih minimal satu format export');
            return;
        }

        setExporting(true);
        try {
            const dateStr = new Date().toISOString().slice(0, 10);
            const userName = user?.name?.replace(/\s+/g, '_') || 'SPV';

            // EXCEL EXPORT
            if (formatExcel) {
                const wb = XLSX.utils.book_new();

                if (includePerformance) {
                    const satorData = sators.map(m => ({
                        Nama: m.name, Target: m.target || 0, Input: m.total_input,
                        Closing: m.total_closed, Pending: m.total_pending, ACC: m.total_closed,
                        Capaian: m.target ? Math.round((m.total_input / m.target) * 100) : 0,
                    }));
                    if (satorData.length > 0) {
                        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(satorData), "SATOR");
                    }

                    const promotorData = allPromotors.map(m => ({
                        Nama: m.name, Target: m.target || 0, Input: m.total_input,
                        Closing: m.total_closed, Pending: m.total_pending, ACC: m.total_closed,
                        Capaian: m.target ? Math.round((m.total_input / m.target) * 100) : 0,
                    }));
                    if (promotorData.length > 0) {
                        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(promotorData), "PROMOTOR");
                    }
                }

                if (includeUnderperform) {
                    const underData = [
                        ...sators.filter(isUnderperform).map(m => ({ Nama: m.name, Role: 'SATOR', Target: m.target || 0, Input: m.total_input, Capaian: m.target ? Math.round((m.total_input / m.target) * 100) : 0 })),
                        ...allPromotors.filter(isUnderperform).map(m => ({ Nama: m.name, Role: 'PROMOTOR', Target: m.target || 0, Input: m.total_input, Capaian: m.target ? Math.round((m.total_input / m.target) * 100) : 0 })),
                    ];
                    if (underData.length > 0) {
                        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(underData), "UNDERPERFORM");
                    }
                }

                if (includeDaily) {
                    const summary = [
                        { Info: 'PERIODE', Nilai: periodLabel },
                        { Info: 'TIME GONE', Nilai: `${timeGonePercent}%` },
                        { Info: 'SATOR', Nilai: sators.length },
                        { Info: 'PROMOTOR', Nilai: allPromotors.length },
                        { Info: 'TOTAL INPUT', Nilai: allPromotors.reduce((s, m) => s + m.total_input, 0) },
                        { Info: 'TOTAL CLOSING', Nilai: allPromotors.reduce((s, m) => s + m.total_closed, 0) },
                    ];
                    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), "SUMMARY");
                }

                XLSX.writeFile(wb, `Laporan_${userName}_${dateStr}.xlsx`);
            }

            // PNG EXPORT - 2 gambar terpisah
            if (formatPng) {
                // Gambar 1: SATOR
                if (satorTableRef.current) {
                    const canvas1 = await html2canvas(satorTableRef.current, { backgroundColor: '#ffffff', scale: 2 });
                    const link1 = document.createElement('a');
                    link1.download = `Laporan_SATOR_${userName}_${dateStr}.png`;
                    link1.href = canvas1.toDataURL('image/png');
                    link1.click();
                }

                // Delay kecil agar tidak bentrok
                await new Promise(r => setTimeout(r, 500));

                // Gambar 2: PROMOTOR
                if (promotorTableRef.current) {
                    const canvas2 = await html2canvas(promotorTableRef.current, { backgroundColor: '#ffffff', scale: 2 });
                    const link2 = document.createElement('a');
                    link2.download = `Laporan_PROMOTOR_${userName}_${dateStr}.png`;
                    link2.href = canvas2.toDataURL('image/png');
                    link2.click();
                }
            }

        } catch (err) {
            console.error(err);
            alert('Gagal export data');
        } finally {
            setExporting(false);
        }
    };

    if (loading) return <DashboardLayout><Loading message="Memuat data..." /></DashboardLayout>;
    if (error) return <DashboardLayout><Alert type="error" message={error} /></DashboardLayout>;

    const underperformCount = sators.filter(isUnderperform).length + allPromotors.filter(isUnderperform).length;
    const totalInput = allPromotors.reduce((s, m) => s + m.total_input, 0);
    const totalClosing = allPromotors.reduce((s, m) => s + m.total_closed, 0);

    return (
        <DashboardLayout allowedRoles={['spv', 'sator']}>
            <div className="min-h-screen bg-background pb-24">

                <SpvHeader title="SUPERVISOR | EXPORT" subtitle="Tarik laporan area" icon="📤" />

                <div className="p-4 space-y-4">

                    {/* OPTIONS */}
                    <div className="bg-card rounded-xl shadow-md p-5">
                        <h3 className="font-bold text-foreground mb-3">SUMBER DATA</h3>
                        <label className="flex items-center gap-3 p-3 bg-muted rounded-xl mb-2 cursor-pointer">
                            <input type="checkbox" checked={includePerformance} onChange={(e) => setIncludePerformance(e.target.checked)} className="w-5 h-5" />
                            <div><span className="font-medium">PERFORMANCE</span><p className="text-xs text-muted-foreground">{sators.length} Sator, {allPromotors.length} Promotor</p></div>
                        </label>
                        <label className="flex items-center gap-3 p-3 bg-muted rounded-xl mb-2 cursor-pointer">
                            <input type="checkbox" checked={includeUnderperform} onChange={(e) => setIncludeUnderperform(e.target.checked)} className="w-5 h-5" />
                            <div><span className="font-medium">UNDERPERFORM</span><p className="text-xs text-muted-foreground">{underperformCount} orang tertinggal</p></div>
                        </label>
                        <label className="flex items-center gap-3 p-3 bg-muted rounded-xl cursor-pointer">
                            <input type="checkbox" checked={includeDaily} onChange={(e) => setIncludeDaily(e.target.checked)} className="w-5 h-5" />
                            <div><span className="font-medium">SUMMARY</span><p className="text-xs text-muted-foreground">Ringkasan keseluruhan</p></div>
                        </label>
                    </div>

                    <div className="bg-card rounded-xl shadow-md p-5">
                        <h3 className="font-bold text-foreground mb-3">FORMAT</h3>
                        <label className="flex items-center gap-3 p-3 bg-muted rounded-xl mb-2 cursor-pointer">
                            <input type="checkbox" checked={formatExcel} onChange={(e) => setFormatExcel(e.target.checked)} className="w-5 h-5" />
                            <div><span className="font-medium">EXCEL (.XLSX)</span><p className="text-xs text-muted-foreground">Multi-sheet lengkap</p></div>
                        </label>
                        <label className="flex items-center gap-3 p-3 bg-muted rounded-xl cursor-pointer">
                            <input type="checkbox" checked={formatPng} onChange={(e) => setFormatPng(e.target.checked)} className="w-5 h-5" />
                            <div><span className="font-medium">PNG (2 GAMBAR)</span><p className="text-xs text-muted-foreground">Tabel SATOR + Tabel PROMOTOR</p></div>
                        </label>
                    </div>

                    {/* PREVIEW: TABEL SATOR */}
                    <div ref={satorTableRef} className="bg-card rounded-xl shadow-md p-4">
                        <div className="text-center mb-3 pb-2 border-b-2 border-primary/30">
                            <h2 className="font-bold text-lg text-primary">LAPORAN SATOR</h2>
                            <p className="text-sm text-muted-foreground">{user?.name} • {periodLabel}</p>
                            <p className="text-xs text-muted-foreground">Time Gone: {timeGonePercent}%</p>
                        </div>
                        <table className="w-full text-xs border border-primary/30">
                            <thead className="bg-primary/20">
                                <tr>
                                    <th className="text-left px-2 py-1">NAMA</th>
                                    <th className="text-center px-1 py-1">TGT</th>
                                    <th className="text-center px-1 py-1">INP</th>
                                    <th className="text-center px-1 py-1">%</th>
                                    <th className="text-center px-1 py-1">CLS</th>
                                    <th className="text-center px-1 py-1">PND</th>
                                    <th className="text-center px-1 py-1">REJ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sators.map((s, i) => {
                                    const pct = s.target ? Math.round((s.total_input / s.target) * 100) : 0;
                                    const under = isUnderperform(s);
                                    const firstName = s.name.split(' ')[0];
                                    return (
                                        <tr key={i} className={under ? 'bg-destructive/10' : ''}>
                                            <td className="px-2 py-1 border-b font-medium">{firstName}</td>
                                            <td className="text-center px-1 py-1 border-b text-muted-foreground">{s.target || 0}</td>
                                            <td className="text-center px-1 py-1 border-b font-bold text-primary">{s.total_input}</td>
                                            <td className={`text-center px-1 py-1 border-b font-bold ${under ? 'text-destructive' : 'text-success'}`}>{pct}%</td>
                                            <td className="text-center px-1 py-1 border-b text-success">{s.total_closed}</td>
                                            <td className="text-center px-1 py-1 border-b text-warning">{s.total_pending}</td>
                                            <td className="text-center px-1 py-1 border-b text-destructive">{s.total_rejected}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        <div className="grid grid-cols-5 gap-1 mt-3 text-center text-xs">
                            <div className="bg-primary/10 rounded p-1"><div className="font-bold text-primary">{sators.reduce((s, m) => s + m.total_input, 0)}</div><div className="text-primary">INP</div></div>
                            <div className="bg-success/10 rounded p-1"><div className="font-bold text-success">{sators.reduce((s, m) => s + m.total_closed, 0)}</div><div className="text-success">CLS</div></div>
                            <div className="bg-warning/10 rounded p-1"><div className="font-bold text-warning">{sators.reduce((s, m) => s + m.total_pending, 0)}</div><div className="text-warning">PND</div></div>
                            <div className="bg-destructive/10 rounded p-1"><div className="font-bold text-destructive">{sators.reduce((s, m) => s + m.total_rejected, 0)}</div><div className="text-destructive">REJ</div></div>
                            <div className="bg-success/10 rounded p-1"><div className="font-bold text-success">{sators.reduce((s, m) => s + m.total_closed, 0)}</div><div className="text-success">ACC</div></div>
                        </div>
                        <div className="text-center text-xs text-muted-foreground mt-2">VAST Finance • {new Date().toLocaleDateString('id-ID')}</div>
                    </div>

                    {/* PREVIEW: TABEL PROMOTOR */}
                    <div ref={promotorTableRef} className="bg-card rounded-xl shadow-md p-4">
                        <div className="text-center mb-3 pb-2 border-b-2 border-primary/30">
                            <h2 className="font-bold text-lg text-primary">LAPORAN PROMOTOR</h2>
                            <p className="text-sm text-muted-foreground">{user?.name} • {periodLabel}</p>
                            <p className="text-xs text-muted-foreground">Time Gone: {timeGonePercent}% • Total: {allPromotors.length} orang</p>
                        </div>
                        <table className="w-full text-xs border border-primary/30">
                            <thead className="bg-primary/20">
                                <tr>
                                    <th className="text-left px-2 py-1">NAMA</th>
                                    <th className="text-center px-1 py-1">TGT</th>
                                    <th className="text-center px-1 py-1">INP</th>
                                    <th className="text-center px-1 py-1">%</th>
                                    <th className="text-center px-1 py-1">CLS</th>
                                    <th className="text-center px-1 py-1">PND</th>
                                    <th className="text-center px-1 py-1">REJ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {allPromotors.map((p, i) => {
                                    const pct = p.target ? Math.round((p.total_input / p.target) * 100) : 0;
                                    const under = isUnderperform(p);
                                    const firstName = p.name.split(' ')[0];
                                    return (
                                        <tr key={i} className={under ? 'bg-destructive/10' : ''}>
                                            <td className="px-2 py-1 border-b font-medium">{firstName}</td>
                                            <td className="text-center px-1 py-1 border-b text-muted-foreground">{p.target || 0}</td>
                                            <td className="text-center px-1 py-1 border-b font-bold text-primary">{p.total_input}</td>
                                            <td className={`text-center px-1 py-1 border-b font-bold ${under ? 'text-destructive' : 'text-success'}`}>{pct}%</td>
                                            <td className="text-center px-1 py-1 border-b text-success">{p.total_closed}</td>
                                            <td className="text-center px-1 py-1 border-b text-warning">{p.total_pending}</td>
                                            <td className="text-center px-1 py-1 border-b text-destructive">{p.total_rejected}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        <div className="grid grid-cols-5 gap-1 mt-3 text-center text-xs">
                            <div className="bg-primary/10 rounded p-1"><div className="font-bold text-primary">{totalInput}</div><div className="text-primary">INP</div></div>
                            <div className="bg-success/10 rounded p-1"><div className="font-bold text-success">{totalClosing}</div><div className="text-success">CLS</div></div>
                            <div className="bg-warning/10 rounded p-1"><div className="font-bold text-warning">{allPromotors.reduce((s, m) => s + m.total_pending, 0)}</div><div className="text-warning">PND</div></div>
                            <div className="bg-destructive/10 rounded p-1"><div className="font-bold text-destructive">{allPromotors.reduce((s, m) => s + m.total_rejected, 0)}</div><div className="text-destructive">REJ</div></div>
                            <div className="bg-secondary/10 rounded p-1"><div className="font-bold text-primary">{allPromotors.filter(isUnderperform).length}</div><div className="text-primary">UND</div></div>
                        </div>
                        <div className="text-center text-xs text-muted-foreground mt-2">VAST Finance • {new Date().toLocaleDateString('id-ID')}</div>
                    </div>

                    {/* EXPORT BUTTON */}
                    <button
                        onClick={handleExport}
                        disabled={exporting}
                        className="w-full py-4 bg-success hover:bg-success/90 disabled:bg-muted disabled:text-muted-foreground rounded-xl font-bold text-lg text-primary-foreground shadow-md flex items-center justify-center gap-3"
                    >
                        {exporting ? <><span className="animate-spin">⏳</span> Mengekspor...</> : <><span className="text-2xl">📥</span> TARIK DATA</>}
                    </button>

                    <p className="text-center text-xs text-muted-foreground">
                        {formatPng ? '2 file PNG akan terunduh (SATOR + PROMOTOR)' : 'File akan terunduh otomatis'}
                    </p>

                </div>
            </div>
        </DashboardLayout>
    );
}
