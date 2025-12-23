// VAST FINANCE - Formatting Utilities
// Centralized formatting functions to avoid duplication

/**
 * Format number as Indonesian Rupiah currency
 * @param amount - Number to format
 * @returns Formatted string with 'Rp' prefix, or '-' if amount is falsy
 */
export function formatCurrency(amount: number | null | undefined): string {
    if (!amount) return '-';
    return 'Rp ' + new Intl.NumberFormat('id-ID').format(amount);
}

/**
 * Format string value as Rupiah for input fields (with dots separator)
 * @param value - String value to format
 * @returns Formatted string with dots as thousand separator
 */
export function formatRupiah(value: string): string {
    const number = value.replace(/\D/g, '');
    return number.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Parse formatted rupiah string back to number
 * @param value - Formatted rupiah string
 * @returns Parsed number
 */
export function parseRupiah(value: string): number {
    return parseInt(value.replace(/\./g, '')) || 0;
}

/**
 * Format date string to Indonesian locale with full detail
 * @param dateStr - ISO date string
 * @returns Formatted date string (e.g., "Sen, 18 Des 2023")
 */
export function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
    });
}

/**
 * Format date string to Indonesian locale with year
 * @param dateStr - ISO date string
 * @returns Formatted date string (e.g., "18 Des 2023")
 */
export function formatDateWithYear(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

/**
 * Normalize phone number to Indonesian format with +62 prefix
 * Handles various input formats: 08xx, 62xx, 8xx
 * @param phone - Phone number string
 * @returns Normalized phone with +62 prefix
 */
export function normalizePhoneNumber(phone: string): string {
    // Remove all non-digit characters
    let normalized = phone.replace(/\D/g, '');

    // Remove leading 62 if present
    if (normalized.startsWith('62')) {
        normalized = normalized.slice(2);
    }

    // Remove leading 0 if present
    if (normalized.startsWith('0')) {
        normalized = normalized.slice(1);
    }

    // Add +62 prefix
    return '+62' + normalized;
}

/**
 * Format phone number for display (without +62)
 * @param phone - Phone number with +62 prefix
 * @returns Phone number without prefix (e.g., "812345678")
 */
export function formatPhoneForDisplay(phone: string): string {
    if (phone.startsWith('+62')) {
        return phone.slice(3);
    }
    if (phone.startsWith('62')) {
        return phone.slice(2);
    }
    if (phone.startsWith('0')) {
        return phone.slice(1);
    }
    return phone;
}
