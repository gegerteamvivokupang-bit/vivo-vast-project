'use client';

// SWR Provider for VAST Finance
// Wraps entire app to enable global SWR configuration

import { SWRConfig } from 'swr';
import { swrConfig, swrFetcher } from '@/lib/swr-config';

interface SWRProviderProps {
    children: React.ReactNode;
}

export function SWRProvider({ children }: SWRProviderProps) {
    return (
        <SWRConfig
            value={{
                ...swrConfig,
                fetcher: swrFetcher,
                // Optional: Log errors in development
                onError: (error, key) => {
                    if (process.env.NODE_ENV === 'development') {
                        console.error('SWR Error:', key, error);
                    }
                },
                // Optional: Success callback
                onSuccess: (data, key, config) => {
                    if (process.env.NODE_ENV === 'development') {
                        console.log('SWR Success:', key);
                    }
                },
            }}
        >
            {children}
        </SWRConfig>
    );
}
