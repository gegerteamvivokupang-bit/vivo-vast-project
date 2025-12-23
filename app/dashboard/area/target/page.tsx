'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import ManagerHeader from '@/components/ManagerHeader';
import { Loading } from '@/components/ui/loading';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';

interface TargetItem {
    user_id: string;
    name: string;
    role: 'area' | 'sator';
    area?: string;
    current_target: number;
    new_target: number;
}

export default function ManagerTargetPage() {
    const { user } = useAuth();
    const [level, setLevel] = useState<'area' | 'sator'>('area');
    const [items, setItems] = useState<TargetItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const periodLabel = nextMonth.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }).toUpperCase();
    const todayLabel = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    useEffect(() => {
        fetchData();
    }, [level]);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const supabase = createClient();

            // Ambil data dari edge function
            const { data, error: fnError } = await supabase.functions.invoke('dashboard-manager');
            if (fnError) throw fnError;

            const monthNum = nextMonth.getMonth() + 1;
            const yearNum = nextMonth.getFullYear();

            if (level === 'area') {
                const areaItems: TargetItem[] = [];
                for (const area of data?.areas || []) {
                    // Get current target
                    const { data: targetData } = await supabase
                        .from('targets')
                        .select('target_value')
                        .eq('user_id', area.user_id)
                        .eq('period_month', monthNum)
                        .eq('period_year', yearNum)
                        .single();

                    areaItems.push({
                        user_id: area.user_id,
                        name: area.name,
                        role: 'area',
                        current_target: targetData?.target_value || 0,
                        new_target: targetData?.target_value || 0
                    });
                }
                setItems(areaItems);
            } else {
                const satorItems: TargetItem[] = [];
                for (const sator of data?.sators || []) {
                    const { data: targetData } = await supabase
                        .from('targets')
                        .select('target_value')
                        .eq('user_id', sator.user_id)
                        .eq('period_month', monthNum)
                        .eq('period_year', yearNum)
                        .single();

                    satorItems.push({
                        user_id: sator.user_id,
                        name: sator.name,
                        role: 'sator',
                        area: sator.area,
                        current_target: targetData?.target_value || 0,
                        new_target: targetData?.target_value || 0
                    });
                }
                setItems(satorItems);
            }
        } catch (err) {
            console.error(err);
            setError('Gagal memuat data');
        } finally {
            setLoading(false);
        }
    };

    const handleTargetChange = (userId: string, value: number) => {
        setItems(prev => prev.map(item =>
            item.user_id === userId ? { ...item, new_target: value } : item
        ));
    };

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const supabase = createClient();
            const monthNum = nextMonth.getMonth() + 1;
            const yearNum = nextMonth.getFullYear();

            for (const item of items) {
                if (item.new_target !== item.current_target) {
                    await supabase
                        .from('targets')
                        .upsert({
                            user_id: item.user_id,
                            period_month: monthNum,
                            period_year: yearNum,
                            target_value: item.new_target,
                            updated_at: new Date().toISOString()
                        }, {
                            onConflict: 'user_id,period_month,period_year'
                        });
                }
            }

            setSuccess('Target berhasil disimpan!');
            fetchData();
        } catch (err) {
            console.error(err);
            setError('Gagal menyimpan target');
        } finally {
            setSaving(false);
        }
    };

    const hasChanges = items.some(item => item.new_target !== item.current_target);

    if (loading) return <DashboardLayout><Loading message="Memuat data target..." /></DashboardLayout>;

    return (
        <DashboardLayout allowedRoles={['manager']}>
            <div className="min-h-screen bg-background pb-24">
                <ManagerHeader title="MANAGER AREA | TARGET" subtitle={todayLabel} icon="🎯" />

                <div className="p-4">
                    {error && <Alert type="error" message={error} />}
                    {success && <Alert type="success" message={success} />}

                    <div className="flex gap-2 mb-4">
                        <button onClick={() => setLevel('area')}
                            className={`flex-1 py-3 rounded-xl font-medium transition-all ${level === 'area' ? 'bg-primary text-primary-foreground shadow-md' : 'bg-card text-muted-foreground hover:bg-muted'}`}>
                            AREA ({items.length})
                        </button>
                        <button onClick={() => setLevel('sator')}
                            className={`flex-1 py-3 rounded-xl font-medium transition-all ${level === 'sator' ? 'bg-primary text-primary-foreground shadow-md' : 'bg-card text-muted-foreground hover:bg-muted'}`}>
                            SATOR
                        </button>
                    </div>

                    <div className="bg-card rounded-xl shadow-md overflow-hidden mb-4">
                        <div className="bg-primary text-primary-foreground px-4 py-3 font-medium">
                            TARGET {level.toUpperCase()} ({items.length})
                        </div>

                        <div className="divide-y divide-border">
                            {items.map((item) => (
                                <div key={item.user_id} className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="font-medium text-foreground">{item.name}</div>
                                            {item.area && level === 'sator' && <div className="text-xs text-muted-foreground">Area: {item.area}</div>}
                                        </div>
                                        <input
                                            type="number"
                                            min="0"
                                            value={item.new_target}
                                            onChange={(e) => handleTargetChange(item.user_id, parseInt(e.target.value) || 0)}
                                            className="w-24 px-3 py-2 border rounded-xl text-center font-bold text-lg focus:ring-2 focus:ring-ring focus:border-ring bg-background text-foreground"
                                        />
                                    </div>
                                    {item.new_target !== item.current_target && (
                                        <div className="text-xs text-warning mt-1">
                                            Sebelumnya: {item.current_target} → Baru: {item.new_target}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {items.length === 0 && <div className="p-8 text-center text-muted-foreground">Tidak ada data</div>}
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={!hasChanges || saving}
                        className={`w-full py-4 rounded-xl font-bold text-lg shadow-md transition-all flex items-center justify-center gap-3 ${hasChanges ? 'bg-primary text-primary-foreground hover:shadow-md' : 'bg-muted text-muted-foreground cursor-not-allowed'
                            }`}
                    >
                        {saving ? <><span className="animate-spin">⏳</span> Menyimpan...</> : <><span className="text-2xl">💾</span> SIMPAN TARGET</>}
                    </button>
                </div>
            </div>
        </DashboardLayout>
    );
}
