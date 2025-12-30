// ============================================
// SHARED TYPE DEFINITIONS
// Purpose: Centralized type safety untuk seluruh aplikasi
// Created: 2025-12-30
// ============================================

// ============================================
// ENUMS & CONSTANTS
// ============================================

export const ROLE = {
    PROMOTOR: 'promotor',
    SATOR: 'sator',
    SPV: 'spv',
    MANAGER: 'manager',
    ADMIN: 'admin'
} as const;

export type RoleType = typeof ROLE[keyof typeof ROLE];

export const STATUS = {
    PENDING: 'pending',
    ACC: 'acc',
    REJECT: 'reject'
} as const;

export type StatusType = typeof STATUS[keyof typeof STATUS];

export const TARGET_TYPE = {
    PRIMARY: 'primary',
    SATOR: 'sator'
} as const;

export type TargetTypeEnum = typeof TARGET_TYPE[keyof typeof TARGET_TYPE];

// ============================================
// USER & AUTH TYPES
// ============================================

export interface User {
    id: string;
    email: string | null;
    name: string;
    role: RoleType;
    employee_id?: string | null;
    phone?: string | null;
    status: 'active' | 'inactive';
    store_id?: string | null;
    created_at?: string;
    updated_at?: string;
}

export interface AuthUser extends User {
    session?: any;
}

// ============================================
// HIERARCHY & ORGANIZATION
// ============================================

export interface Hierarchy {
    user_id: string;
    atasan_id: string | null;
    area: string | null;
    store_id?: string | null;
}

export interface Store {
    id: string;
    name: string;
    alamat?: string | null;
    area?: string | null;
    is_spc?: boolean;
}

// ============================================
// TARGET MANAGEMENT
// ============================================

export interface Target {
    id: string;
    user_id: string;
    month: string;  // Format: YYYY-MM
    period_year?: number;
    period_month?: number;
    target_value: number;
    target_type: TargetTypeEnum;
    set_by_admin_id: string;
    created_at: string;
    updated_at: string;
}

export interface TargetUser {
    user_id: string;
    name: string;
    role: RoleType;
    area: string | null;
    atasan_id: string | null;
    current_target: number;
    new_target: number;
    new_target_as_sator?: number;  // For dual-role SPV
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface SubordinateData {
    user_id: string;
    name: string;
    employee_id: string;
    role: RoleType;
    total_input: number;
    total_rejected: number;
    total_pending: number;
    total_closed: number;
    agg_month: string;
    target: number;
}

export interface TeamMonthlyResponse {
    subordinates: SubordinateData[];
    spvTarget: number;
    callerTarget: number;
}

// ============================================
// DASHBOARD DATA TYPES
// ============================================

export interface SatorData {
    user_id: string;
    name: string;
    target: number;
    total_input: number;
    total_closed: number;
    total_pending: number;
    total_rejected: number;
}

export interface PromotorData extends SatorData {
    sator_id?: string;
    sator_name?: string;
}

export interface AreaSummary {
    user_id: string;
    name: string;
    spv_name: string;
    target: number;
    total_input: number;
    total_closed: number;
    total_pending: number;
    total_rejected: number;
}

export interface MonthlySummary {
    target: number;
    input: number;
    closing: number;
    pending: number;
    rejected: number;
}

export interface DailyData {
    total_input: number;
    total_pending: number;
    total_rejected: number;
    total_closed: number;
    promotor_active: number;
    promotor_empty: number;
}

// ============================================
// AGGREGATION VIEW TYPES
// ============================================

export interface AggMonthlyPromoter {
    promoter_user_id: string;
    agg_month: string;  // Format: YYYY-MM-01
    total_input: number;
    total_approved: number;
    total_rejected: number;
    total_closed: number;
    total_pending: number;
    total_closing_direct: number;
    total_closing_followup: number;
}

export interface AggMonthlySator extends Omit<AggMonthlyPromoter, 'promoter_user_id'> {
    sator_user_id: string;
    promotor_count: number;
}

export interface AggMonthlySPV extends Omit<AggMonthlySator, 'sator_user_id' | 'promotor_count'> {
    spv_user_id: string;
    sator_count: number;
}

export interface AggDailyPromoter {
    promoter_user_id: string;
    agg_date: string;  // Format: YYYY-MM-DD
    total_input: number;
    total_approved: number;
    total_rejected: number;
    total_closed: number;
    total_pending: number;
    total_closing_direct: number;
    total_closing_followup: number;
}

export interface AggDailySator extends Omit<AggDailyPromoter, 'promoter_user_id'> {
    sator_user_id: string;
    promotor_count: number;
}

export interface AggDailySPV extends Omit<AggDailySator, 'sator_user_id' | 'promotor_count'> {
    spv_user_id: string;
    sator_count: number;
}

// ============================================
// UTILITY TYPES
// ============================================

export type ApiResponse<T> = {
    data: T | null;
    error: ApiError | null;
};

export interface ApiError {
    message: string;
    code?: string;
    details?: any;
}

export type Nullable<T> = T | null;

export type Optional<T> = T | undefined;

// ============================================
// FINANCE DATA TYPES
// ============================================

export interface FinanceData {
    id: string;
    created_by_user_id: string;
    sale_date: string;
    status: StatusType;
    customer_name: string;
    customer_phone: string;
    customer_id_number: string;
    pekerjaan: string;
    phone_type_id: string;
    tenor: number;
    limit_amount?: number;
    dp_amount?: number;
    penghasilan?: number;
    has_npwp?: boolean;
    store_id: string;
    source: 'manual' | 'excel';
    ktp_photo_url?: string | null;
    proof_photo_url?: string | null;
    image_urls?: string[] | null;
    created_at: string;
    updated_at: string;
}

// ============================================
// FORM TYPES
// ============================================

export interface SubmissionFormData {
    customer_name: string;
    customer_phone: string;
    customer_id_number: string;
    pekerjaan: string;
    phone_type_id: string;
    tenor: number;
    sale_date: string;
    ktp_photo?: string;
    proof_photo?: string;
}

// ============================================
// TYPE GUARDS
// ============================================

export function isRole(value: string): value is RoleType {
    return Object.values(ROLE).includes(value as RoleType);
}

export function isStatus(value: string): value is StatusType {
    return Object.values(STATUS).includes(value as StatusType);
}

export function isTargetType(value: string): value is TargetTypeEnum {
    return Object.values(TARGET_TYPE).includes(value as TargetTypeEnum);
}

// ============================================
// HELPER TYPES
// ============================================

// Extract keys from object as literal type
export type KeysOf<T> = keyof T;

// Make specific fields required
export type RequireFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

// Make specific fields optional
export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
