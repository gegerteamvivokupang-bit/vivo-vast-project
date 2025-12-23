'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Loading } from '@/components/ui/loading';
import { Alert } from '@/components/ui/alert';
import BottomSheetSelect from '@/components/ui/BottomSheetSelect';
import MultiImageUpload from '@/components/ui/MultiImageUpload';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { formatRupiah, parseRupiah } from '@/lib/utils/format';

// Pilihan pekerjaan (sesuai constraint database vfdn_pekerjaan_check)
const PEKERJAAN_OPTIONS = [
    'PNS',
    'Pegawai Swasta',
    'Buruh',
    'Pelajar',
    'IRT',
    'Wiraswasta',
    'TNI/Polri'
];

// Pilihan tenor
const TENOR_OPTIONS = [3, 6, 9, 12, 24];

// Pilihan status
const STATUS_OPTIONS = [
    { value: 'ACC', label: 'ACC (Closing Langsung)', color: 'green' },
    { value: 'Pending', label: 'Pending (Belum Ambil HP)', color: 'orange' },
    { value: 'Reject', label: 'Reject (Ditolak)', color: 'red' },
];

interface Store {
    id: string;
    name: string;
}

interface PhoneType {
    id: string;
    name: string;
}

export default function InputPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Reference data
    const [stores, setStores] = useState<Store[]>([]);
    const [phoneTypes, setPhoneTypes] = useState<PhoneType[]>([]);
    const [userStoreName, setUserStoreName] = useState<string>('');

    // Form data
    const [status, setStatus] = useState<'ACC' | 'Pending' | 'Reject'>('ACC');
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [pekerjaan, setPekerjaan] = useState('');
    const [penghasilan, setPenghasilan] = useState('');
    const [hasNpwp, setHasNpwp] = useState(false);
    const [storeId, setStoreId] = useState('');
    const [phoneTypeId, setPhoneTypeId] = useState('');
    const [limitAmount, setLimitAmount] = useState('');
    const [dpAmount, setDpAmount] = useState('');
    const [tenor, setTenor] = useState<number | ''>('');

    // Combined images (KTP + proof)
    const [imageUrls, setImageUrls] = useState<string[]>([]);

    useEffect(() => {
        if (user) {
            fetchReferenceData();
        }
    }, [user]);

    const fetchReferenceData = async () => {
        setLoading(true);
        try {
            const supabase = createClient();

            // Fetch user's store from hierarchy
            if (user?.id) {
                const { data: hierarchyData } = await supabase
                    .from('hierarchy')
                    .select('store_id, stores(id, name)')
                    .eq('user_id', user.id)
                    .single();

                if (hierarchyData?.store_id) {
                    setStoreId(hierarchyData.store_id);
                    const storeData = hierarchyData.stores as unknown as { id: string; name: string } | null;
                    setUserStoreName(storeData?.name || 'Unknown Store');
                }
            }

            // Fetch all stores (for fallback/admin)
            const { data: storesData } = await supabase
                .from('stores')
                .select('id, name')
                .order('name');

            setStores(storesData || []);

            // Fetch phone types
            const { data: phoneTypesData, error: phoneTypesError } = await supabase
                .from('phone_types')
                .select('id, name')
                .order('name');

            if (phoneTypesError) {
                console.error('Error fetching phone_types:', phoneTypesError);
            } else {
                console.log('Phone types loaded:', phoneTypesData);
            }

            setPhoneTypes(phoneTypesData || []);

        } catch (err) {
            console.error('Fetch reference data error:', err);
            setError('Gagal memuat data referensi');
        } finally {
            setLoading(false);
        }
    };

    const handleLimitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setLimitAmount(formatRupiah(e.target.value));
    };

    const handleDpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setDpAmount(formatRupiah(e.target.value));
    };

    const handlePenghasilanChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPenghasilan(formatRupiah(e.target.value));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.id) return;

        setSubmitting(true);
        setError(null);

        try {
            const supabase = createClient();

            // Validasi
            if (!customerName || !customerPhone || !pekerjaan || !storeId) {
                throw new Error('Mohon lengkapi semua field wajib');
            }

            if (imageUrls.length === 0) {
                throw new Error('Minimal upload 1 foto (KTP/Bukti Pengajuan)');
            }

            // ACC validation
            if (status === 'ACC') {
                if (!limitAmount || dpAmount === '' || !tenor || !phoneTypeId) {
                    throw new Error('Status ACC memerlukan limit, DP, tenor, dan tipe HP');
                }
            }

            // Pending validation
            if (status === 'Pending') {
                if (!limitAmount) {
                    throw new Error('Status Pending memerlukan limit');
                }
            }

            const submissionData = {
                userId: user.id,
                storeId,
                customerName,
                customerPhone,
                imageUrls, // Array of all uploaded images
                pekerjaan,
                penghasilan: parseRupiah(penghasilan),
                hasNpwp,
                status,
                limitAmount: parseRupiah(limitAmount) || null,
                dpAmount: dpAmount === '' ? null : parseRupiah(dpAmount),
                tenor: tenor || null,
                phoneTypeId: phoneTypeId || null,
            };

            console.log('Submitting data:', submissionData);

            const { data: result, error: submitError } = await supabase.functions.invoke(
                'submission-create',
                { body: submissionData }
            );

            console.log('Submit result:', result);
            console.log('Submit error:', submitError);

            if (submitError || !result?.success) {
                throw new Error(result?.message || submitError?.message || 'Gagal menyimpan pengajuan');
            }

            setSuccess(true);

            // Reset form
            setTimeout(() => {
                router.push('/history');
            }, 2000);

        } catch (err) {
            console.error('Submit error:', err);
            setError(err instanceof Error ? err.message : 'Gagal menyimpan pengajuan');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <DashboardLayout requiredRole="promotor">
                <Loading message="Memuat form..." />
            </DashboardLayout>
        );
    }

    if (success) {
        return (
            <DashboardLayout requiredRole="promotor">
                <div className="min-h-screen bg-background p-4 flex items-center justify-center">
                    <Card className="max-w-sm">
                        <CardContent className="p-8 text-center">
                            <div className="text-6xl mb-4">✅</div>
                            <h2 className="text-xl font-bold text-foreground mb-2">Berhasil!</h2>
                            <p className="text-muted-foreground">Pengajuan berhasil dicatat</p>
                            <p className="text-sm text-muted-foreground mt-2">Mengalihkan ke History...</p>
                        </CardContent>
                    </Card>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout requiredRole="promotor">
            <div className="min-h-screen bg-background p-4 pb-24">
                {/* Header Card */}
                <div className="bg-primary rounded-xl p-4 mb-6 shadow-md">
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
                    <div className="bg-card/10 rounded-xl px-3 py-2">
                        <p className="text-primary-foreground/90 text-sm font-medium">➕ Input Pengajuan Baru</p>
                    </div>
                </div>

                {error && <Alert type="error" message={error} className="mb-4" />}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Status Selection */}
                    <Card>
                        <CardContent className="p-4">
                            <Label className="block text-sm font-semibold text-foreground mb-3">
                                📋 Status Hasil Pengajuan
                            </Label>
                            <div className="grid grid-cols-3 gap-2">
                                {STATUS_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => setStatus(opt.value as 'ACC' | 'Pending' | 'Reject')}
                                        className={cn(
                                            "p-3 rounded-xl text-center transition-all",
                                            status === opt.value
                                                ? opt.value === 'ACC'
                                                    ? 'bg-success text-success-foreground shadow-md'
                                                    : opt.value === 'Pending'
                                                        ? 'bg-warning text-warning-foreground shadow-md'
                                                        : 'bg-destructive text-destructive-foreground shadow-md'
                                                : 'bg-muted text-muted-foreground hover:bg-accent'
                                        )}
                                    >
                                        <div className="text-xl">
                                            {opt.value === 'ACC' ? '✅' : opt.value === 'Pending' ? '⏳' : '❌'}
                                        </div>
                                        <div className="text-xs font-medium mt-1">{opt.value}</div>
                                    </button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Data Customer */}
                    <Card>
                        <CardContent className="p-4">
                            <h3 className="text-sm font-semibold text-foreground mb-3">👤 Data Customer</h3>

                            <div className="space-y-3">
                                <div>
                                    <Label className="block text-xs text-muted-foreground mb-1">Nama Lengkap *</Label>
                                    <input
                                        type="text"
                                        value={customerName}
                                        onChange={(e) => setCustomerName(e.target.value.toUpperCase())}
                                        className="w-full p-3 border border-input rounded-xl bg-background focus:ring-2 focus:ring-ring focus:border-transparent"
                                        placeholder="Nama sesuai KTP"
                                        required
                                    />
                                </div>

                                <div>
                                    <Label className="block text-xs text-muted-foreground mb-1">No. HP *</Label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">+62</span>
                                        <input
                                            type="tel"
                                            value={customerPhone}
                                            onChange={(e) => {
                                                let value = e.target.value.replace(/\D/g, '');
                                                // Remove leading 0 or 62 if user types it
                                                if (value.startsWith('62')) value = value.slice(2);
                                                if (value.startsWith('0')) value = value.slice(1);
                                                setCustomerPhone(value);
                                            }}
                                            className="w-full p-3 pl-12 border border-input rounded-xl bg-background focus:ring-2 focus:ring-ring focus:border-transparent"
                                            placeholder="8xxxxxxxxxx"
                                            required
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">Contoh: 812345678</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Data Pekerjaan */}
                    <Card>
                        <CardContent className="p-4">
                            <h3 className="text-sm font-semibold text-foreground mb-3">💼 Data Pekerjaan</h3>

                            <div className="space-y-3">
                                <BottomSheetSelect
                                    label="Pekerjaan"
                                    placeholder="Pilih Pekerjaan"
                                    icon="💼"
                                    required
                                    value={pekerjaan}
                                    onChange={setPekerjaan}
                                    options={PEKERJAAN_OPTIONS.map(p => ({ value: p, label: p }))}
                                />

                                <div>
                                    <Label className="block text-xs text-muted-foreground mb-1">Penghasilan *</Label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">Rp</span>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={penghasilan}
                                            onChange={handlePenghasilanChange}
                                            className="w-full p-3 pl-10 border border-input rounded-xl bg-background focus:ring-2 focus:ring-ring focus:border-transparent"
                                            placeholder="0"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center justify-between p-3 bg-muted rounded-xl">
                                    <span className="text-sm text-foreground">Punya NPWP?</span>
                                    <button
                                        type="button"
                                        onClick={() => setHasNpwp(!hasNpwp)}
                                        className={cn(
                                            "w-12 h-6 rounded-full transition-colors",
                                            hasNpwp ? 'bg-success' : 'bg-muted-foreground/30'
                                        )}
                                    >
                                        <div className={cn(
                                            "w-5 h-5 bg-card rounded-full shadow transition-transform",
                                            hasNpwp ? 'translate-x-6' : 'translate-x-0.5'
                                        )} />
                                    </button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Data Kredit & Produk - Hidden for Reject */}
                    {status !== 'Reject' && (
                        <Card>
                            <CardContent className="p-4">
                                <h3 className="text-sm font-semibold text-foreground mb-3">💰 Data Kredit & Produk</h3>

                                <div className="space-y-3">
                                    {/* Tipe HP */}
                                    <BottomSheetSelect
                                        label={`Tipe HP ${status === 'ACC' ? '' : '(opsional)'}`}
                                        placeholder="Pilih Tipe HP"
                                        icon="📱"
                                        required={status === 'ACC'}
                                        searchable
                                        value={phoneTypeId}
                                        onChange={setPhoneTypeId}
                                        options={phoneTypes.map(pt => ({ value: pt.id, label: pt.name }))}
                                    />

                                    <div>
                                        <Label className="block text-xs text-muted-foreground mb-1">Limit *</Label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">Rp</span>
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                value={limitAmount}
                                                onChange={handleLimitChange}
                                                className="w-full p-3 pl-10 border border-input rounded-xl bg-background focus:ring-2 focus:ring-ring focus:border-transparent"
                                                placeholder="0"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <Label className="block text-xs text-muted-foreground mb-1">
                                            DP {status === 'ACC' ? '*' : '(opsional)'}
                                        </Label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">Rp</span>
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                value={dpAmount}
                                                onChange={handleDpChange}
                                                className="w-full p-3 pl-10 border border-input rounded-xl bg-background focus:ring-2 focus:ring-ring focus:border-transparent"
                                                placeholder="0"
                                                required={status === 'ACC'}
                                            />
                                        </div>
                                    </div>

                                    <BottomSheetSelect
                                        label={`Tenor ${status === 'ACC' ? '' : '(opsional)'}`}
                                        placeholder="Pilih Tenor"
                                        icon="📅"
                                        required={status === 'ACC'}
                                        value={tenor.toString()}
                                        onChange={(val) => setTenor(val ? parseInt(val) : '')}
                                        options={TENOR_OPTIONS.map(t => ({ value: t.toString(), label: `${t} Bulan` }))}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Foto Dokumentasi */}
                    <Card>
                        <CardContent className="p-4">
                            <h3 className="text-sm font-semibold text-foreground mb-3">📸 Foto Dokumentasi</h3>
                            <MultiImageUpload
                                label="Upload foto KTP dan bukti pengajuan"
                                hint="Upload foto KTP, screenshot hasil pengajuan, atau dokumen pendukung lainnya"
                                required
                                maxImages={5}
                                onUploadComplete={setImageUrls}
                                currentUrls={imageUrls}
                            />
                        </CardContent>
                    </Card>

                    {/* Submit Button */}
                    <Button
                        type="submit"
                        disabled={submitting}
                        loading={submitting}
                        fullWidth
                        size="lg"
                        className="bg-primary hover:shadow-md"
                    >
                        📤 Submit Pengajuan
                    </Button>
                </form>
            </div>
        </DashboardLayout>
    );
}
