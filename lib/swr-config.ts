// SWR Configuration for VAST Finance
// Purpose: Centralized config for data caching and revalidation

import { SWRConfiguration } from 'swr';

/**
 * Default SWR Configuration
 * 
 * Strategy:
 * - dedupingInterval: 2000ms - Dedupe requests within 2s window
 * - focusThrottleInterval: 5000ms - Throttle revalidation on window focus
 * - revalidateOnFocus: true - Refresh when user returns to tab
 * - revalidateOnReconnect: true - Refresh when internet reconnects
 * - revalidateIfStale: true - Revalidate if data is stale
 * - shouldRetryOnError: false - Don't retry on error (avoid hammering server)
 */
export const swrConfig: SWRConfiguration = {
    // Deduplication
    dedupingInterval: 2000, // 2 seconds

    // Revalidation
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    revalidateIfStale: true,
    focusThrottleInterval: 5000, // 5 seconds

    // Error handling
    shouldRetryOnError: false,
    errorRetryCount: 2,

    // Loading states
    loadingTimeout: 3000, // Show loading after 3s

    // Keep previous data while revalidating
    keepPreviousData: true,
};

/**
 * Dashboard-specific SWR config
 * Longer cache time, less aggressive revalidation
 */
export const dashboardSwrConfig: SWRConfiguration = {
    ...swrConfig,

    // Cache for 30 seconds
    dedupingInterval: 30000,

    // Revalidate every 5 minutes
    refreshInterval: 300000, // 5 minutes

    // Only revalidate on focus if data is older than 1 minute
    focusThrottleInterval: 60000, // 1 minute
};

/**
 * Report-specific SWR config
 * Very long cache, minimal revalidation (reports don't change often)
 */
export const reportSwrConfig: SWRConfiguration = {
    ...swrConfig,

    // Cache for 5 minutes
    dedupingInterval: 300000,

    // No auto refresh (reports are static)
    refreshInterval: 0,

    // Don't revalidate on focus
    revalidateOnFocus: false,
};

/**
 * Real-time SWR config
 * For data that needs to be fresh (e.g., pending list)
 */
export const realtimeSwrConfig: SWRConfiguration = {
    ...swrConfig,

    // Short cache
    dedupingInterval: 1000,

    // Refresh every 30 seconds
    refreshInterval: 30000,

    // Always revalidate on focus
    focusThrottleInterval: 0,
};

/**
 * Generic fetcher for SWR
 * Handles authentication and error parsing
 */
export async function swrFetcher<T>(url: string): Promise<T> {
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for auth
    });

    if (!response.ok) {
        const error = new Error('API request failed');
        // Attach extra info to error
        (error as any).status = response.status;
        (error as any).info = await response.json().catch(() => ({}));
        throw error;
    }

    return response.json();
}

/**
 * POST fetcher for SWR mutations
 */
export async function swrPostFetcher<T>(url: string, { arg }: { arg: any }): Promise<T> {
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(arg),
    });

    if (!response.ok) {
        const error = new Error('API request failed');
        (error as any).status = response.status;
        (error as any).info = await response.json().catch(() => ({}));
        throw error;
    }

    return response.json();
}
