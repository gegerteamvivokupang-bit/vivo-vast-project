'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Loading } from '@/components/ui/loading';
import { Alert } from '@/components/ui/alert';
import BottomSheetSelect from '@/components/ui/BottomSheetSelect';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency, formatDateWithYear, formatRupiah, parseRupiah } from '@/lib/utils/format';

interface PendingTransaction {
    id: string;
    customer_name: string;
    customer_phone: string;
    sale_date: string;
    limit_amount: number;
    dp_amount: number;
    tenor: number;
    pekerjaan: string;
    penghasilan: number;
    image_urls: string[];
    stores?: { name: string };
    phone_types?: { name: string };
}

interface PhoneType {
    id: string;
    name: string;
}

const TENOR_OPTIONS = [3, 6, 9, 12, 24];

export default function PendingPage() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [pendingList, setPendingList] = useState<PendingTransaction[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [userStoreName, setUserStoreName] = useState<string>('');

    // Conversion modal state
    const [showModal, setShowModal] = useState(false);
    const [selectedTransaction, setSelectedTransaction] = useState<PendingTransaction | null>(null);
    const [converting, setConverting] = useState(false);

    // Form data for conversion
    const [newDpAmount, setNewDpAmount] = useState('');
    const [phoneTypeId, setPhoneTypeId] = useState('');
    const [tenor, setTenor] = useState<number | ''>('');
    const [phoneTypes, setPhoneTypes] = useState<PhoneType[]>([]);

    useEffect(() => {
        if (user) {
            fetchPendingList();
            fetchPhoneTypes();
            fetchUserStore();
        }
    }, [user]);

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
                    const stores = hierarchyData.stores as any;
                    setUserStoreName(stores?.name || '');
                }
            }
        } catch (err) {
            console.error('Fetch user store error:', err);
        }
    };

    const fetchPendingList = async () => {
        if (!user?.id) return;
        setLoading(true);
        setError(null);

        try {
            const supabase = createClient();

            const { data: result, error: fetchError } = await supabase.functions.invoke(
                'pending-list',
                { body: { userId: user.id } }
            );

            if (fetchError) {
                throw new Error('Failed to fetch pending list: ' + fetchError.message);
            }

            if (result?.success) {
                setPendingList(result.data || []);
            } else {
                throw new Error(result?.message || 'Failed to fetch pending list');
            }

        } catch (err) {
            console.error('Fetch pending error:', err);
            setError(err instanceof Error ? err.message : 'Failed to load pending list');
        } finally {
            setLoading(false);
        }
    };

    const fetchPhoneTypes = async () => {
        try {
            const supabase = createClient();
            const { data } = await supabase
                .from('phone_types')
                .select('id, name')
                .order('name');
            setPhoneTypes(data || []);
        } catch (err) {
            console.error('Fetch phone types error:', err);
        }
    };

    const openConvertModal = (transaction: PendingTransaction) => {
        setSelectedTransaction(transaction);
        setNewDpAmount(formatRupiah(String(transaction.dp_amount || 0)));
        setTenor(transaction.tenor || '');
        setPhoneTypeId('');
        setShowModal(true);
    };

    const handleConvert = async () => {
        if (!selectedTransaction || !user?.id) return;

        if (!newDpAmount || parseRupiah(newDpAmount) <= 0) {
            setError('DP amount harus diisi');
            return;
        }

        setConverting(true);
        setError(null);

        try {
            const supabase = createClient();

            const { data: result, error: convertError } = await supabase.functions.invoke(
                'conversion-create',
                {
                    body: {
                        transactionId: selectedTransaction.id,
                        convertedByUserId: user.id,
                        newDpAmount: parseRupiah(newDpAmount),
                        phoneTypeId: phoneTypeId || undefined,
                        tenor: tenor || undefined,
                    }
                }
            );

            if (convertError) {
                throw new Error('Failed to convert: ' + convertError.message);
            }

            if (result?.success) {
                setSuccess(`Berhasil convert ${selectedTransaction.customer_name} ke Closing!`);
                setShowModal(false);
                setSelectedTransaction(null);
                // Refresh list
                fetchPendingList();
                // Clear success after 3 seconds
                setTimeout(() => setSuccess(null), 3000);
            } else {
                throw new Error(result?.message || 'Failed to convert');
            }

        } catch (err) {
            console.error('Convert error:', err);
            setError(err instanceof Error ? err.message : 'Failed to convert');
        } finally {
            setConverting(false);
        }
    };

    if (loading) {
        return (
            <DashboardLayout requiredRole="promotor">
                <Loading message="Memuat data pending..." />
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout requiredRole="promotor">
            <div className="min-h-screen bg-background p-4 pb-32">
                {/* Header Card */}
                <div className="bg-warning rounded-xl p-4 mb-6 shadow-md">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 bg-card/20 rounded-full flex items-center justify-center">
                            <span className="text-2xl">👤</span>
                        </div>
                        <div className="flex-1">
                            <h2 className="text-primary-foreground font-bold text-lg">{user?.name || 'Promotor'}</h2>
                            <div className="flex items-center gap-1 text-primary-foreground/80 text-sm">
                                <span>📍</span>
                                <span>{userStoreName || 'Toko belum diset'}</span>
                            </div>
                        </div>
                    </div>
                    <div className="bg-card/10 rounded-xl px-3 py-2 flex justify-between items-center">
                        <p className="text-primary-foreground/90 text-sm font-medium">⏳ Pending Follow-up</p>
                        <span className="bg-card/20 text-primary-foreground text-xs font-bold px-2 py-1 rounded-full">{pendingList.length}</span>
                    </div>
                </div>

                {error && <Alert type="error" message={error} className="mb-4" />}
                {success && <Alert type="success" message={success} className="mb-4" />}

                {/* Pending List */}
                {pendingList.length === 0 ? (
                    <Card>
                        <CardContent className="p-8 text-center">
                            <div className="text-4xl mb-3">🎉</div>
                            <h3 className="font-semibold text-foreground mb-1">Tidak Ada Pending</h3>
                            <p className="text-sm text-muted-foreground">
                                Semua transaksi sudah closing atau tidak ada data pending
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-3">
                        {pendingList.map((item) => (
                            <Card key={item.id}>
                                <CardContent className="p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <h3 className="font-bold text-foreground">{item.customer_name}</h3>
                                            <p className="text-sm text-muted-foreground">{item.customer_phone}</p>
                                        </div>
                                        <span className="px-2 py-1 bg-warning/10 text-warning text-xs font-semibold rounded-full">
                                            PENDING
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                                        <div>
                                            <span className="text-muted-foreground">Tanggal:</span>
                                            <span className="ml-1 font-medium">{formatDateWithYear(item.sale_date)}</span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Limit:</span>
                                            <span className="ml-1 font-medium">Rp {formatCurrency(item.limit_amount)}</span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">DP:</span>
                                            <span className="ml-1 font-medium">Rp {formatCurrency(item.dp_amount || 0)}</span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Tenor:</span>
                                            <span className="ml-1 font-medium">{item.tenor || '-'} bln</span>
                                        </div>
                                    </div>

                                    {item.stores?.name && (
                                        <p className="text-xs text-muted-foreground mb-3">Toko: {item.stores.name}</p>
                                    )}

                                    <Button
                                        onClick={() => openConvertModal(item)}
                                        fullWidth
                                        variant="success"
                                        className="font-bold"
                                    >
                                        Convert ke Closing
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                {/* Convert Modal */}
                {showModal && selectedTransaction && (
                    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
                        <div className="bg-card w-full max-w-lg rounded-t-3xl p-6 pb-24 animate-slide-up max-h-[85vh] overflow-y-auto">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg font-bold text-foreground">Convert ke Closing</h2>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="text-muted-foreground hover:text-foreground text-2xl"
                                >
                                    &times;
                                </button>
                            </div>

                            <div className="bg-muted rounded-xl p-3 mb-4">
                                <p className="font-semibold text-foreground">{selectedTransaction.customer_name}</p>
                                <p className="text-sm text-muted-foreground">Limit: Rp {formatCurrency(selectedTransaction.limit_amount)}</p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <Label className="block text-sm font-medium text-foreground mb-1">
                                        DP Baru *
                                    </Label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">Rp</span>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={newDpAmount}
                                            onChange={(e) => setNewDpAmount(formatRupiah(e.target.value))}
                                            className="w-full p-3 pl-10 border border-input rounded-xl bg-background focus:ring-2 focus:ring-ring"
                                            placeholder="0"
                                        />
                                    </div>
                                </div>

                                <BottomSheetSelect
                                    label="Tipe HP (opsional)"
                                    placeholder="Pilih Tipe HP"
                                    icon="📱"
                                    searchable
                                    value={phoneTypeId}
                                    onChange={setPhoneTypeId}
                                    options={phoneTypes.map(pt => ({ value: pt.id, label: pt.name }))}
                                />

                                <BottomSheetSelect
                                    label="Tenor (opsional)"
                                    placeholder="Pilih Tenor"
                                    icon="📅"
                                    value={tenor.toString()}
                                    onChange={(val) => setTenor(val ? parseInt(val) : '')}
                                    options={TENOR_OPTIONS.map(t => ({ value: t.toString(), label: `${t} Bulan` }))}
                                />

                                <Button
                                    onClick={handleConvert}
                                    disabled={converting}
                                    loading={converting}
                                    fullWidth
                                    size="lg"
                                    variant="success"
                                >
                                    Konfirmasi Closing
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
