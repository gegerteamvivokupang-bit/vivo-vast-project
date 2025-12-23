'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { changePinAction } from '@/app/actions/auth';
import { ArrowLeft, Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ChangePasswordPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const [currentPin, setCurrentPin] = useState('');
    const [newPin, setNewPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [showCurrentPin, setShowCurrentPin] = useState(false);
    const [showNewPin, setShowNewPin] = useState(false);
    const [showConfirmPin, setShowConfirmPin] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess(false);

        const formData = new FormData();
        formData.append('currentPin', currentPin);
        formData.append('newPin', newPin);
        formData.append('confirmPin', confirmPin);

        startTransition(async () => {
            const result = await changePinAction(formData);

            if (result.success) {
                setSuccess(true);
                setCurrentPin('');
                setNewPin('');
                setConfirmPin('');
                // Auto redirect after 2 seconds
                setTimeout(() => {
                    router.back();
                }, 2000);
            } else {
                setError(result.error || 'Terjadi kesalahan');
            }
        });
    };

    // Validation states
    const isNewPinValid = newPin.length >= 4 && newPin.length <= 6 && /^\d+$/.test(newPin);
    const isConfirmMatch = newPin === confirmPin && confirmPin.length > 0;
    const isDifferent = currentPin !== newPin || newPin.length === 0;

    return (
        <DashboardLayout>
            <div className="min-h-screen bg-background pb-24">
                {/* Header */}
                <div className="bg-primary px-4 py-6 rounded-b-2xl shadow-lg">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.back()}
                            className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-white" />
                        </button>
                        <div>
                            <h1 className="text-xl font-bold text-white">Ganti PIN</h1>
                            <p className="text-sm text-blue-100">Ubah PIN login Anda</p>
                        </div>
                    </div>
                </div>

                <div className="p-4">
                    {/* Success Message */}
                    {success && (
                        <div className="mb-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3">
                            <CheckCircle className="w-6 h-6 text-emerald-500 flex-shrink-0" />
                            <div>
                                <p className="font-medium text-emerald-500">PIN berhasil diubah!</p>
                                <p className="text-sm text-muted-foreground">Mengalihkan kembali...</p>
                            </div>
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                            <p className="text-red-500 font-medium">{error}</p>
                        </div>
                    )}

                    {/* Form Card */}
                    <div className="bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
                        <div className="p-4 border-b border-border bg-muted/50">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-full bg-primary/10">
                                    <Lock className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <h2 className="font-semibold text-foreground">Keamanan Akun</h2>
                                    <p className="text-xs text-muted-foreground">PIN harus 4-6 digit angka</p>
                                </div>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="p-4 space-y-4">
                            {/* Current PIN */}
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">
                                    PIN Saat Ini
                                </label>
                                <div className="relative">
                                    <input
                                        type={showCurrentPin ? 'text' : 'password'}
                                        value={currentPin}
                                        onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        placeholder="Masukkan PIN saat ini"
                                        inputMode="numeric"
                                        maxLength={6}
                                        className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all pr-12"
                                        required
                                        disabled={isPending || success}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowCurrentPin(!showCurrentPin)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        {showCurrentPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>

                            {/* New PIN */}
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">
                                    PIN Baru
                                </label>
                                <div className="relative">
                                    <input
                                        type={showNewPin ? 'text' : 'password'}
                                        value={newPin}
                                        onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        placeholder="Masukkan PIN baru (4-6 digit)"
                                        inputMode="numeric"
                                        maxLength={6}
                                        className={cn(
                                            "w-full px-4 py-3 bg-background border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all pr-12",
                                            newPin.length > 0 && !isNewPinValid
                                                ? 'border-red-500 focus:border-red-500'
                                                : newPin.length > 0 && isNewPinValid
                                                    ? 'border-emerald-500 focus:border-emerald-500'
                                                    : 'border-border focus:border-primary'
                                        )}
                                        required
                                        disabled={isPending || success}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNewPin(!showNewPin)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        {showNewPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                                {newPin.length > 0 && !isNewPinValid && (
                                    <p className="mt-1 text-xs text-red-500">PIN harus 4-6 digit angka</p>
                                )}
                                {newPin.length > 0 && !isDifferent && (
                                    <p className="mt-1 text-xs text-red-500">PIN baru tidak boleh sama dengan PIN lama</p>
                                )}
                            </div>

                            {/* Confirm PIN */}
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">
                                    Konfirmasi PIN Baru
                                </label>
                                <div className="relative">
                                    <input
                                        type={showConfirmPin ? 'text' : 'password'}
                                        value={confirmPin}
                                        onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        placeholder="Ulangi PIN baru"
                                        inputMode="numeric"
                                        maxLength={6}
                                        className={cn(
                                            "w-full px-4 py-3 bg-background border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all pr-12",
                                            confirmPin.length > 0 && !isConfirmMatch
                                                ? 'border-red-500 focus:border-red-500'
                                                : confirmPin.length > 0 && isConfirmMatch
                                                    ? 'border-emerald-500 focus:border-emerald-500'
                                                    : 'border-border focus:border-primary'
                                        )}
                                        required
                                        disabled={isPending || success}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPin(!showConfirmPin)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        {showConfirmPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                                {confirmPin.length > 0 && !isConfirmMatch && (
                                    <p className="mt-1 text-xs text-red-500">PIN tidak cocok</p>
                                )}
                                {confirmPin.length > 0 && isConfirmMatch && (
                                    <p className="mt-1 text-xs text-emerald-500 flex items-center gap-1">
                                        <CheckCircle className="w-3 h-3" /> PIN cocok
                                    </p>
                                )}
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={isPending || success || !isNewPinValid || !isConfirmMatch || !isDifferent || !currentPin}
                                className={cn(
                                    "w-full py-3 rounded-xl font-semibold transition-all",
                                    isPending || success || !isNewPinValid || !isConfirmMatch || !isDifferent || !currentPin
                                        ? 'bg-muted text-muted-foreground cursor-not-allowed'
                                        : 'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98]'
                                )}
                            >
                                {isPending ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        Menyimpan...
                                    </span>
                                ) : success ? (
                                    'PIN Berhasil Diubah'
                                ) : (
                                    'Simpan PIN Baru'
                                )}
                            </button>
                        </form>
                    </div>

                    {/* Help Text */}
                    <div className="mt-4 p-4 bg-muted/50 rounded-xl">
                        <h3 className="font-medium text-foreground mb-2">Tips Keamanan:</h3>
                        <ul className="text-sm text-muted-foreground space-y-1">
                            <li>- Jangan gunakan PIN yang mudah ditebak (1234, 0000)</li>
                            <li>- Jangan bagikan PIN kepada siapapun</li>
                            <li>- Ganti PIN secara berkala</li>
                        </ul>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
