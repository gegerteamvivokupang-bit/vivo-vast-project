'use client';

import { useState, useRef } from 'react';

interface MultiImageUploadProps {
    onUploadComplete: (urls: string[]) => void;
    label: string;
    required?: boolean;
    currentUrls?: string[];
    maxImages?: number;
    hint?: string;
}

export default function MultiImageUpload({
    onUploadComplete,
    label,
    required = false,
    currentUrls = [],
    maxImages = 5,
    hint
}: MultiImageUploadProps) {
    const [uploading, setUploading] = useState(false);
    const [imageUrls, setImageUrls] = useState<string[]>(currentUrls);
    const [error, setError] = useState<string | null>(null);
    const [showSourcePicker, setShowSourcePicker] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        // Check if we can add more images
        const remainingSlots = maxImages - imageUrls.length;
        if (remainingSlots <= 0) {
            setError(`Maksimal ${maxImages} foto`);
            return;
        }

        const filesToUpload = Array.from(files).slice(0, remainingSlots);

        setUploading(true);
        setError(null);
        setShowSourcePicker(false);

        try {
            const uploadedUrls: string[] = [];

            for (const file of filesToUpload) {
                // Validate file type
                if (!file.type.startsWith('image/')) {
                    continue;
                }

                // Validate file size (max 5MB)
                if (file.size > 5 * 1024 * 1024) {
                    setError('Ukuran file maksimal 5MB');
                    continue;
                }

                const formData = new FormData();
                formData.append('file', file);

                const response = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData,
                });

                if (!response.ok) {
                    throw new Error('Upload failed');
                }

                const data = await response.json();

                if (data.success && data.url) {
                    uploadedUrls.push(data.url);
                }
            }

            const newUrls = [...imageUrls, ...uploadedUrls];
            setImageUrls(newUrls);
            onUploadComplete(newUrls);

        } catch (err) {
            console.error('Upload error:', err);
            setError('Gagal upload gambar. Coba lagi.');
        } finally {
            setUploading(false);
            // Reset inputs
            if (fileInputRef.current) fileInputRef.current.value = '';
            if (cameraInputRef.current) cameraInputRef.current.value = '';
        }
    };

    const handleRemove = (index: number) => {
        const newUrls = imageUrls.filter((_, i) => i !== index);
        setImageUrls(newUrls);
        onUploadComplete(newUrls);
    };

    const openSourcePicker = () => {
        if (imageUrls.length >= maxImages) {
            setError(`Maksimal ${maxImages} foto`);
            return;
        }
        setShowSourcePicker(true);
    };

    const selectFromGallery = () => {
        fileInputRef.current?.click();
    };

    const openCamera = () => {
        cameraInputRef.current?.click();
    };

    return (
        <div className="space-y-2">
            <label className="block text-xs text-muted-foreground mb-1">
                {label} {required && '*'}
            </label>

            {hint && (
                <p className="text-xs text-muted-foreground mb-2">{hint}</p>
            )}

            {/* Image Preview Grid */}
            {imageUrls.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mb-3">
                    {imageUrls.map((url, index) => (
                        <div key={index} className="relative aspect-square">
                            <img
                                src={url}
                                alt={`Foto ${index + 1}`}
                                className="w-full h-full object-cover rounded-xl border border-border"
                            />
                            <button
                                type="button"
                                onClick={() => handleRemove(index)}
                                className="absolute -top-2 -right-2 bg-destructive/100 text-primary-foreground p-1.5 rounded-full hover:bg-destructive transition-colors shadow-md"
                            >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Add Photo Button */}
            {imageUrls.length < maxImages && (
                <div
                    onClick={openSourcePicker}
                    className={`
                        border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors
                        ${uploading
                            ? 'border-border bg-muted'
                            : 'border-border hover:border-primary/70 hover:bg-primary/10'
                        }
                    `}
                >
                    {uploading ? (
                        <div className="flex flex-col items-center">
                            <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mb-2" />
                            <span className="text-sm text-muted-foreground">Mengupload...</span>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center">
                            <div className="text-3xl mb-2">📷</div>
                            <span className="text-sm text-muted-foreground">
                                {imageUrls.length === 0 ? 'Tap untuk upload foto' : 'Tambah foto lagi'}
                            </span>
                            <span className="text-xs text-muted-foreground mt-1">
                                {imageUrls.length}/{maxImages} foto • JPG, PNG (max 5MB)
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* Hidden File Inputs */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleUpload}
                className="hidden"
            />
            <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleUpload}
                className="hidden"
            />

            {/* Source Picker Bottom Sheet */}
            {showSourcePicker && (
                <div
                    className="fixed inset-0 z-50 flex items-end justify-center"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setShowSourcePicker(false);
                    }}
                >
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" />

                    {/* Sheet */}
                    <div className="relative w-full max-w-lg bg-card rounded-t-3xl shadow-2xl animate-slide-up">
                        {/* Handle bar */}
                        <div className="flex justify-center pt-3 pb-2">
                            <div className="w-10 h-1 bg-muted rounded-full" />
                        </div>

                        {/* Header */}
                        <div className="px-4 pb-3 border-b border-border">
                            <h3 className="text-lg font-semibold text-foreground text-center">
                                Pilih Sumber Foto
                            </h3>
                        </div>

                        {/* Options */}
                        <div className="p-4 space-y-2">
                            <button
                                type="button"
                                onClick={openCamera}
                                className="w-full p-4 flex items-center gap-4 rounded-xl hover:bg-muted transition-colors"
                            >
                                <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center text-2xl">
                                    📸
                                </div>
                                <div className="text-left">
                                    <div className="font-medium text-foreground">Kamera</div>
                                    <div className="text-sm text-muted-foreground">Ambil foto langsung</div>
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={selectFromGallery}
                                className="w-full p-4 flex items-center gap-4 rounded-xl hover:bg-muted transition-colors"
                            >
                                <div className="w-12 h-12 bg-success/20 rounded-full flex items-center justify-center text-2xl">
                                    🖼️
                                </div>
                                <div className="text-left">
                                    <div className="font-medium text-foreground">Galeri</div>
                                    <div className="text-sm text-muted-foreground">Pilih dari galeri foto</div>
                                </div>
                            </button>
                        </div>

                        {/* Cancel Button */}
                        <div className="p-4 border-t border-border">
                            <button
                                type="button"
                                onClick={() => setShowSourcePicker(false)}
                                className="w-full p-3 text-center text-muted-foreground font-medium rounded-xl hover:bg-muted transition-colors"
                            >
                                Batal
                            </button>
                        </div>

                        {/* Safe area */}
                        <div className="h-6 bg-card" />
                    </div>
                </div>
            )}

            {error && (
                <p className="text-xs text-destructive">{error}</p>
            )}

            {/* CSS Animations */}
            <style jsx global>{`
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                
                @keyframes slide-up {
                    from { 
                        transform: translateY(100%);
                        opacity: 0;
                    }
                    to { 
                        transform: translateY(0);
                        opacity: 1;
                    }
                }
                
                .animate-fade-in {
                    animation: fade-in 0.2s ease-out forwards;
                }
                
                .animate-slide-up {
                    animation: slide-up 0.3s ease-out forwards;
                }
            `}</style>
        </div>
    );
}
