// ============================================
// DATE UTILITIES - TIMEZONE AWARE
// Purpose: Consistent date handling untuk WITA timezone
// Created: 2025-12-30
// ============================================

const WITA_TIMEZONE = 'Asia/Makassar';
const LOCALE_ID = 'id-ID';

// ============================================
// CURRENT DATE/TIME IN WITA
// ============================================

/**
 * Get current date in WITA timezone
 * Use this instead of new Date() untuk consistency
 */
/**
 * Get current date (Absolute Time)
 * Note: Use format functions to display in WITA
 */
export function getCurrentDateWITA(): Date {
    return new Date();
}

/**
 * Get current timestamp in WITA (ISO string)
 */
export function getCurrentTimestampWITA(): string {
    return getCurrentDateWITA().toISOString();
}

// ============================================
// DATE FORMATTING (WITA)
// ============================================

/**
 * Format date to YYYY-MM-DD in WITA
 * 
 * @param date - Date to format (defaults to current WITA date)
 * @returns Date string in YYYY-MM-DD format
 */
export function formatDateWITA(date: Date = getCurrentDateWITA()): string {
    return date.toLocaleDateString('en-CA', { timeZone: WITA_TIMEZONE });
}

/**
 * Format date to DD/MM/YYYY in WITA (Indonesian format)
 * 
 * @param date - Date to format
 * @returns Date string in DD/MM/YYYY format
 */
export function formatDateIndonesian(date: Date = getCurrentDateWITA()): string {
    return date.toLocaleDateString(LOCALE_ID, { timeZone: WITA_TIMEZONE });
}

/**
 * Format date to readable string (e.g., "30 Desember 2025")
 * 
 * @param date - Date to format
 * @returns Readable date string in Indonesian
 */
export function formatDateReadable(date: Date = getCurrentDateWITA()): string {
    return date.toLocaleDateString(LOCALE_ID, {
        timeZone: WITA_TIMEZONE,
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

/**
 * Format datetime to readable string (e.g., "30 Des 2025, 14:30")
 * 
 * @param date - Date to format
 * @returns Readable datetime string
 */
export function formatDateTimeReadable(date: Date = getCurrentDateWITA()): string {
    return date.toLocaleDateString(LOCALE_ID, {
        timeZone: WITA_TIMEZONE,
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ============================================
// MONTH/YEAR OPERATIONS (WITA)
// ============================================

/**
 * Get current month string (YYYY-MM) in WITA
 * Use this for monthly aggregation queries
 * 
 * @returns Month string in YYYY-MM format
 */
export function getCurrentMonthWITA(): string {
    const formatted = formatDateWITA(new Date());
    return formatted.substring(0, 7);
}

/**
 * Get month string for specific date (YYYY-MM-01) in WITA
 * This format matches database agg_month field
 * 
 * @param date - Date to get month from
 * @returns Month string in YYYY-MM-01 format
 */
export function getMonthStringWITA(date: Date = getCurrentDateWITA()): string {
    const formatted = formatDateWITA(date);
    return formatted.substring(0, 7) + '-01';
}

/**
 * Get month name in Indonesian
 * 
 * @param monthNumber - Month number (1-12)
 * @returns Month name in Indonesian
 */
export function getMonthName(monthNumber: number): string {
    const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return months[monthNumber - 1] || '';
}

/**
 * Get short month name in Indonesian
 * 
 * @param monthNumber - Month number (1-12)
 * @returns Short month name (3 letters)
 */
export function getMonthNameShort(monthNumber: number): string {
    const months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
        'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
    ];
    return months[monthNumber - 1] || '';
}

// ============================================
// DATE COMPARISON (WITA)
// ============================================

/**
 * Check if two dates are the same day (WITA)
 * 
 * @param date1 - First date
 * @param date2 - Second date
 * @returns true if same day
 */
export function isSameDayWITA(date1: Date, date2: Date): boolean {
    return formatDateWITA(date1) === formatDateWITA(date2);
}

/**
 * Check if two dates are in the same month (WITA)
 * 
 * @param date1 - First date
 * @param date2 - Second date
 * @returns true if same month
 */
export function isSameMonthWITA(date1: Date, date2: Date): boolean {
    return getMonthStringWITA(date1) === getMonthStringWITA(date2);
}

/**
 * Check if date is today (WITA)
 * 
 * @param date - Date to check
 * @returns true if date is today
 */
export function isTodayWITA(date: Date): boolean {
    return isSameDayWITA(date, getCurrentDateWITA());
}

/**
 * Check if date is in current month (WITA)
 * 
 * @param date - Date to check
 * @returns true if in current month
 */
export function isCurrentMonthWITA(date: Date): boolean {
    return isSameMonthWITA(date, getCurrentDateWITA());
}

// ============================================
// DATE ARITHMETIC
// ============================================

/**
 * Add days to date
 * 
 * @param date - Base date
 * @param days - Number of days to add (negative to subtract)
 * @returns New date
 */
export function addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

/**
 * Add months to date
 * 
 * @param date - Base date
 * @param months - Number of months to add (negative to subtract)
 * @returns New date
 */
export function addMonths(date: Date, months: number): Date {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
}

/**
 * Get first day of month
 * 
 * @param date - Reference date (defaults to current WITA)
 * @returns First day of month
 */
export function getFirstDayOfMonth(date: Date = getCurrentDateWITA()): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Get last day of month
 * 
 * @param date - Reference date (defaults to current WITA)
 * @returns Last day of month
 */
export function getLastDayOfMonth(date: Date = getCurrentDateWITA()): Date {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

/**
 * Get number of days in month
 * 
 * @param date - Reference date (defaults to current WITA)
 * @returns Number of days in month
 */
export function getDaysInMonth(date: Date = getCurrentDateWITA()): number {
    return getLastDayOfMonth(date).getDate();
}

// ============================================
// DATE RANGE
// ============================================

/**
 * Get date range for current month (WITA)
 * 
 * @returns Object with start and end dates (YYYY-MM-DD)
 */
export function getCurrentMonthRange(): { start: string; end: string } {
    const now = getCurrentDateWITA();
    const firstDay = getFirstDayOfMonth(now);
    const lastDay = getLastDayOfMonth(now);

    return {
        start: formatDateWITA(firstDay),
        end: formatDateWITA(lastDay)
    };
}

/**
 * Get date range for specific month
 * 
 * @param year - Year
 * @param month - Month (1-12)
 * @returns Object with start and end dates (YYYY-MM-DD)
 */
export function getMonthRange(year: number, month: number): { start: string; end: string } {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);

    return {
        start: formatDateWITA(firstDay),
        end: formatDateWITA(lastDay)
    };
}

// ============================================
// PARSING
// ============================================

/**
 * Parse date string (YYYY-MM-DD) safely
 * 
 * @param dateString - Date string to parse
 * @returns Date object or null if invalid
 */
export function parseDateString(dateString: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return null;
    }

    const date = new Date(dateString + 'T00:00:00');
    return isNaN(date.getTime()) ? null : date;
}

/**
 * Parse month string (YYYY-MM) to Date
 * 
 * @param monthString - Month string
 * @returns Date object (first day of month) or null if invalid
 */
export function parseMonthString(monthString: string): Date | null {
    if (!/^\d{4}-\d{2}$/.test(monthString)) {
        return null;
    }

    const [year, month] = monthString.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    return isNaN(date.getTime()) ? null : date;
}

// ============================================
// TIME UTILITIES
// ============================================

/**
 * Calculate percentage of month that has passed
 * 
 * @param now - Current date (defaults to current WITA)
 * @returns Percentage (0-100)
 */
export function getMonthProgress(now: Date = getCurrentDateWITA()): number {
    const daysInMonth = getDaysInMonth(now);
    const currentDay = now.getDate();
    return Math.round((currentDay / daysInMonth) * 100);
}

/**
 * Get days remaining in current month
 * 
 * @param now - Current date (defaults to current WITA)
 * @returns Days remaining
 */
export function getDaysRemainingInMonth(now: Date = getCurrentDateWITA()): number {
    const daysInMonth = getDaysInMonth(now);
    const currentDay = now.getDate();
    return daysInMonth - currentDay;
}

// ============================================
// VALIDATION
// ============================================

/**
 * Validate date format (YYYY-MM-DD)
 * 
 * @param dateString - Date string to validate
 * @returns true if valid
 */
export function isValidDateFormat(dateString: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(dateString) && parseDateString(dateString) !== null;
}

/**
 * Validate month format (YYYY-MM)
 * 
 * @param monthString - Month string to validate
 * @returns true if valid
 */
export function isValidMonthFormat(monthString: string): boolean {
    return /^\d{4}-\d{2}$/.test(monthString) && parseMonthString(monthString) !== null;
}

// ============================================
// RELATIVE TIME
// ============================================

/**
 * Get relative time string (e.g., "2 jam yang lalu")
 * @param date - Date to compare
 * @returns Relative time string in Indonesian
 */
export function getRelativeTime(date: Date): string {
    const now = getCurrentDateWITA();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return 'Baru saja';
    if (diffMinutes < 60) return `${diffMinutes} menit yang lalu`;
    if (diffHours < 24) return `${diffHours} jam yang lalu`;
    if (diffDays < 7) return `${diffDays} hari yang lalu`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} minggu yang lalu`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} bulan yang lalu`;
    return `${Math.floor(diffDays / 365)} tahun yang lalu`;
}
