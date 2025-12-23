'use client';

import { useState, useRef } from 'react';

interface CloudinaryUploadProps {
    onUploadComplete: (url: string) => void;
    label: string;
    required?: boolean;
    currentUrl?: string;
}

export default function CloudinaryUpload({
    onUploadComplete,
    label,
    required = false,
    currentUrl
}: CloudinaryUploadProps) {
    const [uploading, setUploading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl || null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            setError('File harus berupa gambar');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            setError('Ukuran file maksimal 5MB');
            return;
        }

        setUploading(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append('file', file);

            // Upload via our API route (signed upload)
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Upload failed');
            }

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message || 'Upload failed');
            }

            const imageUrl = data.url;
            setPreviewUrl(imageUrl);
            onUploadComplete(imageUrl);

        } catch (err) {
            console.error('Upload error:', err);
            setError('Gagal upload gambar. Coba lagi.');
        } finally {
            setUploading(false);
        }
    };

    const handleRemove = () => {
        setPreviewUrl(null);
        onUploadComplete('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div className="space-y-2">
            <label className="block text-xs text-muted-foreground mb-1">
                {label} {required && '*'}
            </label>

            {previewUrl ? (
                <div className="relative">
                    <img
                        src={previewUrl}
                        alt="Preview"
                        className="w-full h-40 object-cover rounded-xl border border-border"
                    />
                    <button
                        type="button"
                        onClick={handleRemove}
                        className="absolute top-2 right-2 bg-destructive/100 text-primary-foreground p-1 rounded-full hover:bg-destructive transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            ) : (
                <div
                    onClick={() => fileInputRef.current?.click()}
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
                            <span className="text-sm text-muted-foreground">Tap untuk upload</span>
                            <span className="text-xs text-muted-foreground mt-1">JPG, PNG (max 5MB)</span>
                        </div>
                    )}
                </div>
            )}

            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleUpload}
                className="hidden"
                capture="environment"
            />

            {error && (
                <p className="text-xs text-destructive">{error}</p>
            )}
        </div>
    );
}
