// VAST FINANCE - Database TypeScript Types
// Sesuai dengan docs/DATABASE_NORMALIZED_SPEC.md

// ============================================
// USER ROLES & STATUS
// ============================================

export type UserRole = 'promotor' | 'spv' | 'sator' | 'manager' | 'admin'

export type UserStatus = 'active' | 'inactive'

export type PromotorStatus = 'active' | 'inactive' | 'suspended'

// ============================================
// USER PROFILE (dari tabel users)
// ============================================

export interface UserProfile {
  id: string
  email: string
  employee_id: string
  name: string // REAL DB: 'name' not 'full_name'
  role: UserRole
  status: UserStatus
  promotor_status: PromotorStatus | null
  area: string | null
  phone: string | null
  created_at: string
  updated_at: string
}

// ============================================
// AUTH SESSION
// ============================================

export interface AuthSession {
  user: UserProfile
  access_token: string
  refresh_token: string
  expires_at: number
}

// ============================================
// DASHBOARD DATA TYPES (dari tabel agregat)
// Sesuai dengan docs/READ_CONTRACT_DASHBOARD.md
// ============================================

// Agregat harian promotor
export interface PromoterDailyAgg {
  promoter_user_id: string
  agg_date: string
  total_input: number
  total_pending: number
  total_closed: number
  total_closing_direct: number
  total_closing_followup: number
}

// Agregat bulanan promotor
export interface PromoterMonthlyAgg {
  promoter_user_id: string
  agg_month: string // Format: YYYY-MM
  total_input: number
  total_pending: number
  total_closed: number
  total_closing_direct: number
  total_closing_followup: number
  target: number
}

// Agregat harian toko
export interface StoreDailyAgg {
  store_id: string
  agg_date: string
  total_input: number
  total_pending: number
  total_closed: number
  total_closing_direct: number
  total_closing_followup: number
}

// Agregat bulanan toko
export interface StoreMonthlyAgg {
  store_id: string
  agg_month: string // Format: YYYY-MM
  total_input: number
  total_pending: number
  total_closed: number
  total_closing_direct: number
  total_closing_followup: number
}

// ============================================
// METADATA TABLES
// ============================================

// Store metadata
export interface Store {
  id: string
  name: string
  area: string
  is_spc: boolean
  created_at: string
}

// Hierarchy untuk access control
export interface Hierarchy {
  user_id: string
  atasan_id: string | null
  area: string
  store_id: string | null
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiResponse<T> {
  success: boolean
  data?: T
  message?: string
}

export interface LoginResponse {
  success: boolean
  userId?: string
  message?: string
}
