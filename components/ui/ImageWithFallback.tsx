'use client'

import { useState } from 'react'

interface ImageWithFallbackProps {
    src: string | null | undefined
    alt: string
    className?: string
}

export function ImageWithFallback({ src, alt, className = '' }: ImageWithFallbackProps) {
    const [error, setError] = useState(false)

    // Check if image is deleted or invalid
    const isDeleted = !src || src === '' || error

    if (isDeleted) {
        return (
            <div className={`flex flex-col items-center justify-center bg-muted rounded-lg p-4 ${className}`}>
                <span className="text-4xl mb-2">📸</span>
                <p className="text-sm text-muted-foreground text-center">
                    Foto tidak tersedia
                </p>
                <small className="text-xs text-muted-foreground/60 text-center mt-1">
                    (Dihapus sesuai kebijakan retensi 3 bulan)
                </small>
            </div>
        )
    }

    return (
        <img
            src={src}
            alt={alt}
            className={className}
            onError={() => setError(true)}
            loading="lazy"
        />
    )
}
