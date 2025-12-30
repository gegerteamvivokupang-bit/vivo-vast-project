'use client';

// Custom SWR hooks for dashboard data fetching
// Example: Team Dashboard (SPV)

import useSWR from 'swr';
import { dashboardSwrConfig } from '@/lib/swr-config';

interface TeamMonthlyData {
    subordinates: Array<{
        user_id: string;
        name: string;
        role: string;
        total_input: number;
        total_rejected: number;
        total_pending: number;
        total_closed: number;
        target: number;
    }>;
    spvTarget: number;
    callerTarget: number;
}

interface TeamDailyData {
    promotors: Array<{
        promoter_user_id: string;
        promoter_name: string;
        total_input: number;
        total_closed: number;
        total_pending: number;
        total_rejected: number;
        sator_id?: string | null;
    }>;
    sators: Array<{
        user_id: string;
        name: string;
        promotor_ids: string[];
    }>;
}

/**
 * Hook for fetching team monthly dashboard data
 * Uses SWR for caching and auto-refresh
 * 
 * @param userId - User ID of the manager
 * @param month - Month in format 'YYYY-MM' (optional, defaults to current month)
 * @returns SWR response with data, error, loading states
 */
export function useTeamMonthly(userId: string | null, month?: string) {
    const key = userId ? `/api/dashboard/team-monthly?userId=${userId}${month ? `&month=${month}` : ''}` : null;

    return useSWR<TeamMonthlyData>(
        key,
        {
            ...dashboardSwrConfig,
            // Dedupe for 30 seconds (avoid duplicate requests)
            dedupingInterval: 30000,
        }
    );
}

/**
 * Hook for fetching team daily dashboard data
 * 
 * @param userId - User ID of the manager
 * @param date - Date in format 'YYYY-MM-DD' (optional)
 * @returns SWR response with data, error, loading states
 */
export function useTeamDaily(userId: string | null, date?: string) {
    const key = userId ? `/api/dashboard/team-daily?userId=${userId}${date ? `&date=${date}` : ''}` : null;

    return useSWR<TeamDailyData>(
        key,
        {
            ...dashboardSwrConfig,
            // Daily refreshes more frequently
            refreshInterval: 60000, // 1 minute
        }
    );
}

/**
 * Example usage in component:
 * 
 * ```tsx
 * function TeamDashboard() {
 *   const { user } = useAuth();
 *   const { data, error, isLoading } = useTeamMonthly(user?.id);
 * 
 *   if (isLoading) return <Loading />;
 *   if (error) return <Alert message="Failed to load data" />;
 *   if (!data) return null;
 * 
 *   return <DashboardContent data={data} />;
 * }
 * ```
 */
