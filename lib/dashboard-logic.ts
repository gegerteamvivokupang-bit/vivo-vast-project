// ============================================
// DASHBOARD BUSINESS LOGIC
// Purpose: Centralized reusable logic untuk dashboard calculations
// Created: 2025-12-30
// ============================================

import { SubordinateData, SatorData, PromotorData } from '@/types/api.types';

// ============================================
// DUAL-ROLE SPV LOGIC
// ============================================

/**
 * Process dual-role SPV as SATOR
 * Handles SPV who also act as SATOR (have direct promotors)
 * 
 * @param sators - List of existing SATORs
 * @param directPromotors - Direct promotors under SPV
 * @param user - Current user (SPV)
 * @param satorTarget - SPV's target as SATOR
 * @returns Updated sators list with SPV added if they have direct promotors
 */
export function processDualRoleSPV(
    sators: SatorData[],
    directPromotors: PromotorData[],
    user: { id: string; name: string },
    satorTarget: number
): SatorData[] {
    // If SPV has no direct promotors, return original list
    if (directPromotors.length === 0) {
        return sators;
    }

    // Sum up data from all direct promotors
    const selfTotal = directPromotors.reduce((acc, p) => ({
        total_input: acc.total_input + p.total_input,
        total_closed: acc.total_closed + p.total_closed,
        total_pending: acc.total_pending + p.total_pending,
        total_rejected: acc.total_rejected + p.total_rejected,
        target: acc.target + p.target,  // Note: This is sum of promotor targets, not SATOR target
    }), {
        total_input: 0,
        total_closed: 0,
        total_pending: 0,
        total_rejected: 0,
        target: 0
    });

    // Create SPV as SATOR entry
    const selfAsSator: SatorData = {
        user_id: user.id,
        name: user.name,
        target: satorTarget,  // Use admin-assigned SATOR target, not sum
        total_input: selfTotal.total_input,
        total_closed: selfTotal.total_closed,
        total_pending: selfTotal.total_pending,
        total_rejected: selfTotal.total_rejected,
    };

    // Add to beginning of list (unshift)
    return [selfAsSator, ...sators];
}

// ============================================
// ACHIEVEMENT CALCULATIONS
// ============================================

/**
 * Calculate achievement percentage
 * 
 * @param input - Actual input/achievement
 * @param target - Target value
 * @returns Percentage (0-100+), rounded to nearest integer
 */
export function calculateAchievement(input: number, target: number): number {
    if (target === 0) return 0;
    return Math.round((input / target) * 100);
}

/**
 * Calculate time gone percentage for current month
 * 
 * @param now - Current date (defaults to today)
 * @returns Percentage of month that has passed (0-100)
 */
export function calculateTimeGone(date: Date = new Date()): number {
    // Shift to WITA (UTC+8) for calculation
    // Indonesia has no DST, so fixed offset is safe
    const now = new Date(date.getTime() + (8 * 60 * 60 * 1000));
    const daysInMonth = new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 0).getUTCDate();
    const currentDay = now.getUTCDate();
    return Math.round((currentDay / daysInMonth) * 100);
}

// ============================================
// PERFORMANCE EVALUATION
// ============================================

/**
 * Determine if promotor is underperforming
 * Logic: 
 * - No input at all = underperform
 * - If has target: achievement% < time gone% = underperform
 * - No target but has input = on track
 * 
 * @param promotor - Promotor data
 * @param timeGonePercent - Current time gone percentage
 * @returns true if underperforming
 */
export function isUnderperform(promotor: PromotorData, timeGonePercent: number): boolean {
    // No input at all = underperform
    if (promotor.total_input === 0) return true;

    // If has target, compare achievement vs time gone
    if (promotor.target > 0) {
        const achievement = calculateAchievement(promotor.total_input, promotor.target);
        return achievement < timeGonePercent;
    }

    // No target but has input = on track
    return false;
}

/**
 * Get achievement status color
 * 
 * @param percent - Achievement percentage
 * @param timeGonePercent - Current time gone percentage
 * @returns Tailwind color class
 */
export function getAchievementColor(percent: number, timeGonePercent: number): string {
    if (percent >= 100) return 'text-emerald-500';
    if (percent >= timeGonePercent) return 'text-amber-500';
    return 'text-red-500';
}

/**
 * Get achievement status color for background
 * 
 * @param percent - Achievement percentage
 * @param timeGonePercent - Current time gone percentage
 * @returns Tailwind bg color class
 */
export function getAchievementBgColor(percent: number, timeGonePercent: number): string {
    if (percent >= 100) return 'bg-emerald-500';
    if (percent >= timeGonePercent) return 'bg-amber-500';
    return 'bg-red-500';
}

// ============================================
// DATA AGGREGATION
// ============================================

/**
 * Calculate totals from subordinate data
 * 
 * @param data - Array of subordinate data
 * @returns Aggregated totals
 */
export function calculateTotals(data: SubordinateData[] | SatorData[]): {
    target: number;
    total_input: number;
    total_closed: number;
    total_pending: number;
    total_rejected: number;
} {
    return data.reduce((acc, item) => ({
        target: acc.target + (item.target || 0),
        total_input: acc.total_input + (item.total_input || 0),
        total_closed: acc.total_closed + (item.total_closed || 0),
        total_pending: acc.total_pending + (item.total_pending || 0),
        total_rejected: acc.total_rejected + (item.total_rejected || 0),
    }), {
        target: 0,
        total_input: 0,
        total_closed: 0,
        total_pending: 0,
        total_rejected: 0,
    });
}

/**
 * Filter data by SATOR
 * 
 * @param promotors - List of promotors
 * @param satorId - SATOR user ID to filter by
 * @returns Filtered promotors
 */
export function filterBySator(promotors: PromotorData[], satorId: string): PromotorData[] {
    return promotors.filter(p => p.sator_id === satorId);
}

/**
 * Group promotors by SATOR
 * 
 * @param promotors - List of promotors
 * @returns Map of SATOR ID to promotors
 */
export function groupBySator(promotors: PromotorData[]): Map<string, PromotorData[]> {
    const grouped = new Map<string, PromotorData[]>();

    promotors.forEach(p => {
        if (p.sator_id) {
            if (!grouped.has(p.sator_id)) {
                grouped.set(p.sator_id, []);
            }
            grouped.get(p.sator_id)!.push(p);
        }
    });

    return grouped;
}

// ============================================
// SORTING & FILTERING
// ============================================

/**
 * Sort promotors by achievement (ascending)
 * Useful for underperform list
 */
export function sortByAchievement(promotors: PromotorData[], ascending = true): PromotorData[] {
    return [...promotors].sort((a, b) => {
        const aAchievement = calculateAchievement(a.total_input, a.target);
        const bAchievement = calculateAchievement(b.total_input, b.target);
        return ascending ? aAchievement - bAchievement : bAchievement - aAchievement;
    });
}

/**
 * Sort promotors by input (descending)
 * Useful for top performers
 */
export function sortByInput(promotors: PromotorData[], descending = true): PromotorData[] {
    return [...promotors].sort((a, b) => {
        return descending ? b.total_input - a.total_input : a.total_input - b.total_input;
    });
}

/**
 * Filter promotors by performance status
 */
export function filterByPerformance(
    promotors: PromotorData[],
    timeGonePercent: number,
    status: 'underperform' | 'ontrack' | 'all' = 'all'
): PromotorData[] {
    if (status === 'all') return promotors;
    if (status === 'underperform') return promotors.filter(p => isUnderperform(p, timeGonePercent));
    return promotors.filter(p => !isUnderperform(p, timeGonePercent));
}

// ============================================
// FORMATTING UTILITIES
// ============================================

/**
 * Format number with thousand separator
 */
export function formatNumber(num: number): string {
    return new Intl.NumberFormat('id-ID').format(num);
}

/**
 * Format currency (IDR style but without symbol by default)
 */
export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('id-ID').format(amount || 0);
}

/**
 * Get short name (first name only)
 */
export function getShortName(fullName: string): string {
    return fullName.split(' ')[0];
}

/**
 * Get initials from name
 */
export function getInitials(name: string): string {
    return name
        .split(' ')
        .map(w => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
}

// ============================================
// VALIDATION
// ============================================

/**
 * Check if data is stale (needs refresh)
 * 
 * @param lastUpdate - Last update timestamp
 * @param maxAgeMinutes - Maximum age in minutes before considered stale
 * @returns true if data is stale
 */
export function isDataStale(lastUpdate: Date, maxAgeMinutes: number = 5): boolean {
    const now = new Date();
    const diffMs = now.getTime() - lastUpdate.getTime();
    const diffMinutes = diffMs / (1000 * 60);
    return diffMinutes > maxAgeMinutes;
}

/**
 * Validate month format (YYYY-MM)
 */
export function isValidMonthFormat(month: string): boolean {
    return /^\d{4}-\d{2}$/.test(month);
}

/**
 * Validate date format (YYYY-MM-DD)
 */
export function isValidDateFormat(date: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(date);
}
