// ============================================
// ERROR HANDLING UTILITIES
// Purpose: Centralized error handling dengan user-friendly messages
// Created: 2025-12-30
// ============================================

// ============================================
// ERROR CLASSES
// ============================================

export class ApiError extends Error {
    code: string;
    statusCode: number;
    details?: any;

    constructor(message: string, code: string, statusCode: number = 500, details?: any) {
        super(message);
        this.name = 'ApiError';
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;

        // Maintain proper stack trace (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ApiError);
        }
    }
}

// ============================================
// ERROR CODES
// ============================================

export const ERROR_CODES = {
    // Network & Connection
    NETWORK_ERROR: 'NETWORK_ERROR',
    TIMEOUT: 'TIMEOUT',
    CONNECTION_LOST: 'CONNECTION_LOST',

    // Authentication & Authorization
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    SESSION_EXPIRED: 'SESSION_EXPIRED',

    // Data & Validation
    NOT_FOUND: 'NOT_FOUND',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    DUPLICATE_ERROR: 'DUPLICATE_ERROR',

    // Server Errors
    SERVER_ERROR: 'SERVER_ERROR',
    DATABASE_ERROR: 'DATABASE_ERROR',
    EDGE_FUNCTION_ERROR: 'EDGE_FUNCTION_ERROR',

    // Business Logic
    INSUFFICIENT_DATA: 'INSUFFICIENT_DATA',
    INVALID_STATE: 'INVALID_STATE',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

// ============================================
// USER-FRIENDLY ERROR MESSAGES
// ============================================

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
    // Network & Connection
    [ERROR_CODES.NETWORK_ERROR]: 'Koneksi internet bermasalah. Silakan cek koneksi Anda dan coba lagi.',
    [ERROR_CODES.TIMEOUT]: 'Request timeout. Server terlalu lama merespons. Coba lagi dalam beberapa saat.',
    [ERROR_CODES.CONNECTION_LOST]: 'Koneksi terputus. Silakan cek koneksi internet Anda.',

    // Authentication & Authorization
    [ERROR_CODES.UNAUTHORIZED]: 'Sesi Anda telah berakhir. Silakan login kembali.',
    [ERROR_CODES.FORBIDDEN]: 'Anda tidak memiliki akses untuk data ini.',
    [ERROR_CODES.SESSION_EXPIRED]: 'Sesi Anda telah berakhir. Silakan login kembali.',

    // Data & Validation
    [ERROR_CODES.NOT_FOUND]: 'Data tidak ditemukan.',
    [ERROR_CODES.VALIDATION_ERROR]: 'Data yang Anda masukkan tidak valid. Periksa kembali form Anda.',
    [ERROR_CODES.DUPLICATE_ERROR]: 'Data sudah ada. Tidak dapat membuat duplikat.',

    // Server Errors
    [ERROR_CODES.SERVER_ERROR]: 'Terjadi kesalahan server. Tim kami sedang memperbaikinya.',
    [ERROR_CODES.DATABASE_ERROR]: 'Terjadi masalah dengan database. Coba lagi dalam beberapa saat.',
    [ERROR_CODES.EDGE_FUNCTION_ERROR]: 'Terjadi kesalahan pada service. Coba lagi dalam beberapa saat.',

    // Business Logic
    [ERROR_CODES.INSUFFICIENT_DATA]: 'Data tidak lengkap. Harap lengkapi semua field yang diperlukan.',
    [ERROR_CODES.INVALID_STATE]: 'Operasi tidak dapat dilakukan dalam kondisi saat ini.',
};

// ============================================
// SUPABASE ERROR PARSER
// ============================================

export function parseSupabaseError(error: any): ApiError {
    // PostgreSQL specific errors
    if (error.code) {
        switch (error.code) {
            case 'PGRST301':
            case '42P01':  // undefined_table
                return new ApiError(
                    ERROR_MESSAGES[ERROR_CODES.NOT_FOUND],
                    ERROR_CODES.NOT_FOUND,
                    404,
                    error
                );

            case '23505':  // unique_violation
                return new ApiError(
                    ERROR_MESSAGES[ERROR_CODES.DUPLICATE_ERROR],
                    ERROR_CODES.DUPLICATE_ERROR,
                    409,
                    error
                );

            case '23503':  // foreign_key_violation
                return new ApiError(
                    'Data terkait tidak ditemukan. Periksa kembali data Anda.',
                    ERROR_CODES.VALIDATION_ERROR,
                    400,
                    error
                );

            case '23502':  // not_null_violation
                return new ApiError(
                    ERROR_MESSAGES[ERROR_CODES.INSUFFICIENT_DATA],
                    ERROR_CODES.INSUFFICIENT_DATA,
                    400,
                    error
                );
        }
    }

    // JWT/Auth errors
    if (error.message?.includes('JWT') || error.message?.includes('auth')) {
        return new ApiError(
            ERROR_MESSAGES[ERROR_CODES.UNAUTHORIZED],
            ERROR_CODES.UNAUTHORIZED,
            401,
            error
        );
    }

    // Network errors
    if (error.message?.includes('fetch') || error.message?.includes('network')) {
        return new ApiError(
            ERROR_MESSAGES[ERROR_CODES.NETWORK_ERROR],
            ERROR_CODES.NETWORK_ERROR,
            0,
            error
        );
    }

    // RLS/Permission errors
    if (error.message?.includes('permission') || error.message?.includes('policy')) {
        return new ApiError(
            ERROR_MESSAGES[ERROR_CODES.FORBIDDEN],
            ERROR_CODES.FORBIDDEN,
            403,
            error
        );
    }

    // Default server error
    return new ApiError(
        ERROR_MESSAGES[ERROR_CODES.SERVER_ERROR],
        ERROR_CODES.SERVER_ERROR,
        500,
        error
    );
}

// ============================================
// RETRY LOGIC WITH EXPONENTIAL BACKOFF
// ============================================

export interface RetryOptions {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffMultiplier?: number;
    retryableErrors?: ErrorCode[];
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
    maxRetries: 3,
    initialDelay: 1000,  // 1 second
    maxDelay: 10000,  // 10 seconds
    backoffMultiplier: 2,
    retryableErrors: [
        ERROR_CODES.NETWORK_ERROR,
        ERROR_CODES.TIMEOUT,
        ERROR_CODES.CONNECTION_LOST,
        ERROR_CODES.SERVER_ERROR,
    ]
};

export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
    let lastError: Error;

    for (let attempt = 0; attempt < opts.maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error as Error;

            // Parse error if it's a Supabase error
            const apiError = error instanceof ApiError
                ? error
                : parseSupabaseError(error);

            // Don't retry on client errors (4xx) except for specific cases
            if (apiError.statusCode >= 400 && apiError.statusCode < 500) {
                // Only retry if it's in the retryable list
                if (!opts.retryableErrors.includes(apiError.code as ErrorCode)) {
                    throw apiError;
                }
            }

            // If last attempt, throw the error
            if (attempt === opts.maxRetries - 1) {
                throw apiError;
            }

            // Calculate delay with exponential backoff
            const delay = Math.min(
                opts.initialDelay * Math.pow(opts.backoffMultiplier, attempt),
                opts.maxDelay
            );

            // Log retry attempt (optional, can be removed for production)
            console.log(`Retry attempt ${attempt + 1}/${opts.maxRetries} after ${delay}ms delay`);

            // Wait before next attempt
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    // This should never be reached, but TypeScript needs it
    throw lastError!;
}

// ============================================
// ERROR LOGGING
// ============================================

export interface ErrorLog {
    timestamp: string;
    code: string;
    message: string;
    userId?: string;
    page?: string;
    details?: any;
}

export function logError(error: ApiError | Error, context?: {
    userId?: string;
    page?: string;
    action?: string;
}) {
    const errorLog: ErrorLog = {
        timestamp: new Date().toISOString(),
        code: error instanceof ApiError ? error.code : 'UNKNOWN_ERROR',
        message: error.message,
        userId: context?.userId,
        page: context?.page,
        details: {
            action: context?.action,
            stack: error.stack,
            ...(error instanceof ApiError && { errorDetails: error.details })
        }
    };

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
        console.error('[Error Log]', errorLog);
    }

    // TODO: In production, send to monitoring service (Sentry, LogRocket, etc)
    // if (process.env.NODE_ENV === 'production') {
    //     sendToMonitoring(errorLog);
    // }

    return errorLog;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if error is a network error
 */
export function isNetworkError(error: Error | ApiError): boolean {
    if (error instanceof ApiError) {
        const networkErrors: string[] = [
            ERROR_CODES.NETWORK_ERROR,
            ERROR_CODES.TIMEOUT,
            ERROR_CODES.CONNECTION_LOST
        ];
        return networkErrors.includes(error.code);
    }
    return false;
}

/**
 * Check if error is an auth error
 */
export function isAuthError(error: Error | ApiError): boolean {
    if (error instanceof ApiError) {
        const authErrors: string[] = [
            ERROR_CODES.UNAUTHORIZED,
            ERROR_CODES.FORBIDDEN,
            ERROR_CODES.SESSION_EXPIRED
        ];
        return authErrors.includes(error.code);
    }
    return false;
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: Error | ApiError): boolean {
    if (error instanceof ApiError) {
        const retryableErrors = DEFAULT_RETRY_OPTIONS.retryableErrors as string[];
        return retryableErrors.includes(error.code);
    }
    return false;
}

/**
 * Get user-friendly error message
 */
export function getUserMessage(error: Error | ApiError): string {
    if (error instanceof ApiError) {
        return error.message;
    }
    return ERROR_MESSAGES[ERROR_CODES.SERVER_ERROR];
}
