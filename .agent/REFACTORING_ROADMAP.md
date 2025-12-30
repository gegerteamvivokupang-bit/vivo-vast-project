# 🏗️ MASTER PLAN: VAST FINANCE SYSTEM REFACTORING
## **Target: Production-Grade untuk 10 Tahun Ke Depan**

**Dokumen:** Technical Improvement Roadmap  
**Created:** 30 Desember 2025  
**Timeline:** 3 Bulan (Q1 2026)  
**Goal:** System yang **Kuat • Reliabel • Stabil • Cepat • Scalable**

---

## 📊 **OVERVIEW**

### **Prinsip Utama:**
1. ✅ **Backward Compatible** - No breaking changes
2. ✅ **Incremental** - Deploy per fase, bukan big bang
3. ✅ **Tested** - Setiap perubahan ada testing
4. ✅ **Documented** - Code + architecture documentation
5. ✅ **Monitored** - Track improvement metrics

### **Success Metrics:**
- Page load time: < 1 second
- API response: < 500ms (p95)
- Zero data inconsistency
- 99.9% uptime
- Support 10,000+ users
- Support 1M+ records

---

## 🗓️ **TIMELINE OVERVIEW**

```
┌─────────────────────────────────────────────────────┐
│  PHASE 1: FOUNDATION (Week 1-2) - CRITICAL FIXES   │
│  ✓ Database Performance                             │
│  ✓ Type Safety                                      │
│  ✓ Error Handling                                   │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│  PHASE 2: ARCHITECTURE (Week 3-6) - REFACTORING    │
│  ✓ Fix N+1 Queries                                  │
│  ✓ Centralize Business Logic                        │
│  ✓ API Optimization                                 │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│  PHASE 3: QUALITY (Week 7-10) - HARDENING          │
│  ✓ Testing Infrastructure                           │
│  ✓ Monitoring & Logging                             │
│  ✓ Performance Optimization                         │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│  PHASE 4: FUTURE-PROOF (Week 11-12) - SCALING      │
│  ✓ Caching Strategy                                 │
│  ✓ Documentation                                    │
│  ✓ Developer Experience                             │
└─────────────────────────────────────────────────────┘
```

---

# 🎯 **PHASE 1: FOUNDATION** (Week 1-2)
## **Goal: Fix Critical Issues Yang Bisa Crash System**

### **1.1 Database Performance** ⏱️ 6 hours
**Priority:** 🔴 CRITICAL

#### **Task 1.1.1: Create Database Indexes**
**Effort:** 2 hours  
**File:** `supabase/migrations/20260101_add_performance_indexes.sql`

**Action:**
```sql
-- ============================================
-- PERFORMANCE INDEXES FOR AGGREGATION VIEWS
-- ============================================

-- Index for promoter monthly aggregation
CREATE INDEX IF NOT EXISTS idx_vfdn_promoter_month 
ON vast_finance_data_new(created_by_user_id, sale_date);

-- Index for hierarchy lookups
CREATE INDEX IF NOT EXISTS idx_hierarchy_user 
ON hierarchy(user_id);

CREATE INDEX IF NOT EXISTS idx_hierarchy_atasan 
ON hierarchy(atasan_id);

-- Index for targets
CREATE INDEX IF NOT EXISTS idx_targets_user_month 
ON targets(user_id, month);

CREATE INDEX IF NOT EXISTS idx_targets_type 
ON targets(user_id, target_type, month);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_vfdn_user_date_status 
ON vast_finance_data_new(created_by_user_id, sale_date, status);
```

**Testing:**
```sql
-- Test query performance before/after
EXPLAIN ANALYZE 
SELECT * FROM vast_finance_data_new 
WHERE created_by_user_id = 'xxx' 
  AND sale_date >= '2025-01-01';
```

**Success Criteria:**
- Query execution time < 100ms
- No sequential scans on large tables

---

#### **Task 1.1.2: Optimize Database Views**
**Effort:** 4 hours  
**File:** `supabase/migrations/20260102_optimize_aggregation_views.sql`

**Current Issue:**
Views melakukan aggregation on-the-fly setiap kali di-query.

**Solution: Materialized Views + Refresh Function**

```sql
-- ============================================
-- MATERIALIZED VIEWS FOR PERFORMANCE
-- ============================================

-- Drop existing views
DROP VIEW IF EXISTS v_agg_monthly_promoter_all CASCADE;

-- Create materialized view
CREATE MATERIALIZED VIEW mv_agg_monthly_promoter_all AS
SELECT 
    promoter_user_id,
    agg_month,
    total_input,
    total_approved,
    total_rejected,
    total_closed,
    total_pending,
    total_closing_direct,
    total_closing_followup
FROM (
    -- Existing aggregation logic here
    -- ...
);

-- Create indexes on materialized view
CREATE INDEX idx_mv_promoter_user ON mv_agg_monthly_promoter_all(promoter_user_id);
CREATE INDEX idx_mv_promoter_month ON mv_agg_monthly_promoter_all(agg_month);

-- Create refresh function
CREATE OR REPLACE FUNCTION refresh_aggregation_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_agg_monthly_promoter_all;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_agg_monthly_sator_all;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_agg_monthly_spv_all;
END;
$$ LANGUAGE plpgsql;

-- Schedule refresh every hour (via pg_cron or edge function)
-- Or trigger-based refresh on data insert
```

**Alternative: Trigger-Based Refresh**
```sql
-- Create trigger to auto-refresh on data change
CREATE OR REPLACE FUNCTION trigger_refresh_aggregations()
RETURNS TRIGGER AS $$
BEGIN
    -- Refresh only affected month's data
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_agg_monthly_promoter_all;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_after_submission
AFTER INSERT OR UPDATE OR DELETE ON vast_finance_data_new
FOR EACH STATEMENT
EXECUTE FUNCTION trigger_refresh_aggregations();
```

**Success Criteria:**
- Aggregation query < 50ms (vs 500ms+ tanpa materialized view)
- Data max 1 hour stale (acceptable trade-off)

---

### **1.2 Type Safety** ⏱️ 8 hours
**Priority:** 🔴 CRITICAL

#### **Task 1.2.1: Generate Supabase Types**
**Effort:** 1 hour  
**File:** `types/database.types.ts`

**Action:**
```bash
# Generate types from Supabase schema
npx supabase gen types typescript --project-id gqvmdleyvwhznwjikivf > types/database.types.ts
```

**Result:**
```typescript
// Auto-generated types
export type Database = {
    public: {
        Tables: {
            vast_finance_data_new: {
                Row: {
                    id: string;
                    created_by_user_id: string;
                    sale_date: string;
                    status: 'pending' | 'acc' | 'reject';
                    // ... all fields with proper types
                };
                Insert: { /* ... */ };
                Update: { /* ... */ };
            };
            // ... other tables
        };
    };
};
```

---

#### **Task 1.2.2: Create Shared Type Definitions**
**Effort:** 3 hours  
**File:** `types/api.types.ts`

**Action:**
```typescript
// ============================================
// SHARED TYPE DEFINITIONS
// ============================================

// Role types
export const ROLE = {
    PROMOTOR: 'promotor',
    SATOR: 'sator',
    SPV: 'spv',
    MANAGER: 'manager',
    ADMIN: 'admin'
} as const;

export type RoleType = typeof ROLE[keyof typeof ROLE];

// Status types
export const STATUS = {
    PENDING: 'pending',
    ACC: 'acc',
    REJECT: 'reject'
} as const;

export type StatusType = typeof STATUS[keyof typeof STATUS];

// Target types
export const TARGET_TYPE = {
    PRIMARY: 'primary',
    SATOR: 'sator'
} as const;

export type TargetTypeEnum = typeof TARGET_TYPE[keyof typeof TARGET_TYPE];

// API Response types
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

// Dashboard data types
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

// Utility types
export type ApiResponse<T> = {
    data: T | null;
    error: ApiError | null;
};

export interface ApiError {
    message: string;
    code?: string;
    details?: any;
}
```

---

#### **Task 1.2.3: Update Frontend to Use Types**
**Effort:** 4 hours  
**Files:** All dashboard pages

**Before:**
```typescript
const monthlyData = result?.subordinates || [];  // any[]
.filter((m: any) => m.role === 'sator')
```

**After:**
```typescript
import { TeamMonthlyResponse, SubordinateData, ROLE } from '@/types/api.types';

const response: TeamMonthlyResponse = result;
const monthlyData: SubordinateData[] = response.subordinates || [];
const satorsRaw = monthlyData.filter(m => m.role === ROLE.SATOR);
```

**Success Criteria:**
- Zero `any` types in production code
- TypeScript errors catch bugs at compile-time
- Autocomplete works in IDE

---

### **1.3 Error Handling** ⏱️ 6 hours
**Priority:** 🟡 HIGH

#### **Task 1.3.1: Create Error Utilities**
**Effort:** 2 hours  
**File:** `lib/errors.ts`

```typescript
// ============================================
// ERROR HANDLING UTILITIES
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
    }
}

export const ERROR_CODES = {
    NETWORK_ERROR: 'NETWORK_ERROR',
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    NOT_FOUND: 'NOT_FOUND',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    SERVER_ERROR: 'SERVER_ERROR',
    TIMEOUT: 'TIMEOUT',
} as const;

// User-friendly error messages
export const ERROR_MESSAGES: Record<string, string> = {
    [ERROR_CODES.NETWORK_ERROR]: 'Koneksi internet bermasalah. Coba lagi.',
    [ERROR_CODES.UNAUTHORIZED]: 'Sesi Anda telah berakhir. Silakan login kembali.',
    [ERROR_CODES.FORBIDDEN]: 'Anda tidak memiliki akses untuk data ini.',
    [ERROR_CODES.NOT_FOUND]: 'Data tidak ditemukan.',
    [ERROR_CODES.VALIDATION_ERROR]: 'Data yang Anda masukkan tidak valid.',
    [ERROR_CODES.SERVER_ERROR]: 'Terjadi kesalahan server. Tim kami sedang memperbaikinya.',
    [ERROR_CODES.TIMEOUT]: 'Request timeout. Coba lagi dalam beberapa saat.',
};

// Parse Supabase errors
export function parseSupabaseError(error: any): ApiError {
    if (error.code === 'PGRST301') {
        return new ApiError(
            ERROR_MESSAGES[ERROR_CODES.NOT_FOUND],
            ERROR_CODES.NOT_FOUND,
            404
        );
    }
    
    if (error.message?.includes('JWT')) {
        return new ApiError(
            ERROR_MESSAGES[ERROR_CODES.UNAUTHORIZED],
            ERROR_CODES.UNAUTHORIZED,
            401
        );
    }

    return new ApiError(
        ERROR_MESSAGES[ERROR_CODES.SERVER_ERROR],
        ERROR_CODES.SERVER_ERROR,
        500,
        error
    );
}

// Retry logic
export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    initialDelay = 1000
): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error as Error;
            
            // Don't retry on client errors (4xx)
            if (error instanceof ApiError && error.statusCode < 500) {
                throw error;
            }
            
            if (attempt < maxRetries - 1) {
                const delay = initialDelay * Math.pow(2, attempt);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    throw lastError!;
}
```

---

#### **Task 1.3.2: Update API Calls**
**Effort:** 4 hours  
**Files:** All components with API calls

**Before:**
```typescript
try {
    const { data, error } = await supabase.functions.invoke(...);
    if (error) throw error;
} catch (err) {
    console.error(err);
    setError('Gagal memuat data');
}
```

**After:**
```typescript
import { parseSupabaseError, retryWithBackoff, ApiError } from '@/lib/errors';
import { toast } from 'sonner';

try {
    const result = await retryWithBackoff(async () => {
        const { data, error } = await supabase.functions.invoke(...);
        if (error) throw parseSupabaseError(error);
        return data;
    });
    
    setData(result);
} catch (error) {
    const apiError = error instanceof ApiError 
        ? error 
        : parseSupabaseError(error);
    
    // Log to monitoring service
    console.error('[API Error]', {
        code: apiError.code,
        message: apiError.message,
        details: apiError.details,
        timestamp: new Date().toISOString()
    });
    
    // Show user-friendly message
    toast.error(apiError.message);
    setError(apiError.message);
}
```

**Success Criteria:**
- All errors have user-friendly messages
- Retry logic for network errors
- Error logging for debugging

---

## **PHASE 1 CHECKPOINT** ✅

**Before Moving to Phase 2:**
- [ ] All database indexes deployed
- [ ] Materialized views working
- [ ] TypeScript strict mode enabled, zero errors
- [ ] Error handling tested
- [ ] Performance baseline measured

**Metrics to Track:**
- Average API response time
- P95 response time
- Error rate
- Page load time

---

# 🎯 **PHASE 2: ARCHITECTURE** (Week 3-6)
## **Goal: Refactor untuk Scalability & Maintainability**

### **2.1 Fix N+1 Queries** ⏱️ 12 hours
**Priority:** 🔴 CRITICAL

#### **Task 2.1.1: Update Edge Function - Nested Data**
**Effort:** 8 hours  
**File:** `supabase/functions/dashboard-team-monthly-v2/index.ts`

**Current Problem:**
```typescript
// Frontend melakukan loop untuk fetch promotors per SATOR
satorsRaw.map(async (sator) => {
    await supabase.functions.invoke(...);  // N+1 problem!
});
```

**Solution: Edge Function Return Nested Data**

```typescript
// ============================================
// DASHBOARD TEAM MONTHLY V2 - OPTIMIZED
// ============================================

Deno.serve(async (req) => {
    try {
        // ... existing setup code ...

        // STRATEGY: Single query with all nested data
        
        // 1. Get all subordinates
        const { data: subordinates } = await supabaseClient
            .from('hierarchy')
            .select(`
                user_id,
                users!inner(id, name, employee_id, role)
            `)
            .eq('atasan_id', userId);

        const subordinateIds = subordinates.map(s => s.user_id);
        const satorIds = subordinates.filter(s => s.users.role === 'sator').map(s => s.user_id);

        // 2. Get ALL data in parallel (not sequential!)
        const [satorAggData, promotorAggData, allTargets] = await Promise.all([
            // Sator aggregations
            supabaseClient
                .from('mv_agg_monthly_sator_all')
                .select('*')
                .in('sator_user_id', satorIds)
                .eq('agg_month', currentMonth),
            
            // ALL promotor aggregations under all sators in ONE query
            supabaseClient
                .from('mv_agg_monthly_promoter_all')
                .select('*, hierarchy!inner(atasan_id)')
                .in('hierarchy.atasan_id', [...satorIds, userId])  // Include direct promotors
                .eq('agg_month', currentMonth),
            
            // ALL targets in ONE query
            supabaseClient
                .from('targets')
                .select('*')
                .in('user_id', [...subordinateIds, userId])
                .eq('month', currentMonth.substring(0, 7))
        ]);

        // 3. Build nested structure in memory
        const satorsWithPromotors = satorIds.map(satorId => {
            const satorUser = subordinates.find(s => s.user_id === satorId)?.users;
            const satorAgg = satorAggData.data?.find(a => a.sator_user_id === satorId);
            const satorTarget = allTargets.data?.find(t => t.user_id === satorId);
            
            // Get promotors under this SATOR
            const promotors = promotorAggData.data
                ?.filter(p => p.hierarchy?.atasan_id === satorId)
                .map(p => ({
                    user_id: p.promoter_user_id,
                    name: p.name || '',
                    total_input: p.total_input || 0,
                    total_closed: p.total_closed || 0,
                    total_pending: p.total_pending || 0,
                    total_rejected: p.total_rejected || 0,
                    target: allTargets.data?.find(t => t.user_id === p.promoter_user_id)?.target_value || 0
                })) || [];

            return {
                user_id: satorId,
                name: satorUser?.name || '',
                role: 'sator',
                target: satorTarget?.target_value || 0,
                total_input: satorAgg?.total_input || 0,
                total_closed: satorAgg?.total_closed || 0,
                total_pending: satorAgg?.total_pending || 0,
                total_rejected: satorAgg?.total_rejected || 0,
                promotors: promotors  // ← NESTED DATA!
            };
        });

        // 4. Handle direct promotors (dual-role SPV)
        const directPromotors = promotorAggData.data
            ?.filter(p => p.hierarchy?.atasan_id === userId)
            .map(p => ({
                user_id: p.promoter_user_id,
                name: p.name || '',
                total_input: p.total_input || 0,
                total_closed: p.total_closed || 0,
                total_pending: p.total_pending || 0,
                total_rejected: p.total_rejected || 0,
                target: allTargets.data?.find(t => t.user_id === p.promoter_user_id)?.target_value || 0
            })) || [];

        // 5. Return nested structure
        return new Response(
            JSON.stringify({
                sators: satorsWithPromotors,
                directPromotors: directPromotors,
                spvTarget: allTargets.data?.find(t => t.user_id === userId && t.target_type === 'primary')?.target_value || 0,
                satorTarget: allTargets.data?.find(t => t.user_id === userId && t.target_type === 'sator')?.target_value || 0
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('Error:', error);
        return new Response(
            JSON.stringify({ 
                error: 'Internal server error',
                message: error.message 
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
```

**Key Improvements:**
- ✅ Single API call from frontend
- ✅ All data fetched in parallel (3 queries max)
- ✅ Nested data structure
- ✅ No loops, no N+1

---

#### **Task 2.1.2: Update Frontend to Use New API**
**Effort:** 4 hours  
**File:** `app/dashboard/team/performance/page.tsx`

**Before:** (N+1 problem)
```typescript
const satorPromises = satorsRaw.map(async (sator) => {
    const { data } = await supabase.functions.invoke(...);  // ❌ Loop!
    return { ...sator, promotors: data };
});
const sators = await Promise.all(satorPromises);  // ❌ Multiple calls
```

**After:** (Single call)
```typescript
const { data, error } = await supabase.functions.invoke('dashboard-team-monthly-v2', {
    body: { userId: user?.id, month: monthStr }
});

if (error) throw parseSupabaseError(error);

// Data sudah nested!
const sators: Sator[] = data.sators;
const directPromotors: Promotor[] = data.directPromotors;

// Handle dual-role SPV
if (directPromotors.length > 0 && user) {
    sators.unshift({
        user_id: user.id,
        name: user.name,
        promotors: directPromotors,
        // ... calculate totals from directPromotors
    });
}

setData({ sators });
```

**Success Criteria:**
- 1 API call vs 10-20 API calls sebelumnya
- Page load time reduction: 80%+
- No frontend loops untuk fetch data

---

### **2.2 Centralize Business Logic** ⏱️ 8 hours
**Priority:** 🟡 HIGH

#### **Task 2.2.1: Create Shared Logic Library**
**Effort:** 4 hours  
**File:** `lib/dashboard-logic.ts`

```typescript
// ============================================
// SHARED DASHBOARD BUSINESS LOGIC
// ============================================

import { SubordinateData, SatorData, PromotorData } from '@/types/api.types';

/**
 * Process dual-role SPV as SATOR
 * Handles SPV who also act as SATOR (have direct promotors)
 */
export function processDualRoleSPV(
    sators: SatorData[],
    directPromotors: PromotorData[],
    user: { id: string; name: string },
    satorTarget: number
): SatorData[] {
    // If SPV has direct promotors, add as "self" SATOR
    if (directPromotors.length === 0) {
        return sators;
    }

    const selfTotal = directPromotors.reduce((acc, p) => ({
        total_input: acc.total_input + p.total_input,
        total_closed: acc.total_closed + p.total_closed,
        total_pending: acc.total_pending + p.total_pending,
        total_rejected: acc.total_rejected + p.total_rejected,
        target: acc.target + p.target,
    }), { total_input: 0, total_closed: 0, total_pending: 0, total_rejected: 0, target: 0 });

    const selfAsSator: SatorData = {
        user_id: user.id,
        name: user.name,
        target: satorTarget,  // Use SATOR target, not sum of promotors
        total_input: selfTotal.total_input,
        total_closed: selfTotal.total_closed,
        total_pending: selfTotal.total_pending,
        total_rejected: selfTotal.total_rejected,
    };

    // Add to beginning of list
    return [selfAsSator, ...sators];
}

/**
 * Calculate achievement percentage
 */
export function calculateAchievement(input: number, target: number): number {
    if (target === 0) return 0;
    return Math.round((input / target) * 100);
}

/**
 * Determine if promotor is underperforming
 */
export function isUnderperform(p: PromotorData, timeGonePercent: number): boolean {
    // No input = underperform
    if (p.total_input === 0) return true;
    
    // If has target, compare achievement vs time
    if (p.target > 0) {
        const achievement = calculateAchievement(p.total_input, p.target);
        return achievement < timeGonePercent;
    }
    
    // No target but has input = on track
    return false;
}

/**
 * Get achievement color based on percentage
 */
export function getAchievementColor(percent: number, timeGonePercent: number): string {
    if (percent >= 100) return 'text-emerald-500';
    if (percent >= timeGonePercent) return 'text-amber-500';
    return 'text-red-500';
}
```

---

#### **Task 2.2.2: Update Pages to Use Shared Logic**
**Effort:** 4 hours  
**Files:** All dashboard pages

**Before:** (Logic duplikasi)
```typescript
// Di page.tsx
if (directPromotors.length > 0 && user) {
    const selfTotal = directPromotors.reduce(...);  // ❌ Duplikasi
    satorList.unshift({...});
}

// Di performance/page.tsx
if (directPromotors.length > 0 && user) {
    const selfTotal = directPromotors.reduce(...);  // ❌ Duplikasi
    sators.unshift({...});
}
```

**After:** (Centralized)
```typescript
import { processDualRoleSPV } from '@/lib/dashboard-logic';

// Di semua pages
const sators = processDualRoleSPV(
    satorsRaw,
    directPromotors,
    user,
    satorTarget
);
```

**Success Criteria:**
- Zero code duplication
- Single source of truth untuk business logic
- Easy to update/fix logic

---

### **2.3 Timezone Consistency** ⏱️ 4 hours
**Priority:** 🟡 MEDIUM

#### **Task 2.3.1: Create Date Utility**
**Effort:** 2 hours  
**File:** `lib/date-utils.ts`

```typescript
// ============================================
// TIMEZONE-AWARE DATE UTILITIES
// ============================================

const WITA_TIMEZONE = 'Asia/Makassar';

/**
 * Get current date in WITA timezone
 */
export function getCurrentDateWITA(): Date {
    return new Date(new Date().toLocaleString('en-US', { timeZone: WITA_TIMEZONE }));
}

/**
 * Format date to YYYY-MM-DD in WITA
 */
export function formatDateWITA(date: Date): string {
    return date.toLocaleDateString('en-CA', { timeZone: WITA_TIMEZONE });
}

/**
 * Get current month string (YYYY-MM) in WITA
 */
export function getCurrentMonthWITA(): string {
    const date = getCurrentDateWITA();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

/**
 * Get month string for date (YYYY-MM-01) in WITA
 */
export function getMonthStringWITA(date: Date): string {
    const formatted = formatDateWITA(date);
    return formatted.substring(0, 7) + '-01';
}

/**
 * Check if two dates are same month (WITA)
 */
export function isSameMonthWITA(date1: Date, date2: Date): boolean {
    return getMonthStringWITA(date1) === getMonthStringWITA(date2);
}
```

---

#### **Task 2.3.2: Replace All Date Logic**
**Effort:** 2 hours  
**Files:** All files with date calculations

**Before:**
```typescript
new Date().toISOString().slice(0, 7) + '-01'  // ❌ Client timezone!
```

**After:**
```typescript
import { getCurrentMonthWITA, getMonthStringWITA } from '@/lib/date-utils';

const currentMonth = getCurrentMonthWITA();  // ✅ Always WITA
```

**Success Criteria:**
- All dates consistent in WITA
- No timezone bugs
- Data aggregation accurate

---

## **PHASE 2 CHECKPOINT** ✅

**Before Moving to Phase 3:**
- [ ] N+1 queries eliminated
- [ ] Business logic centralized
- [ ] Timezone utility implemented
- [ ] Performance improvement verified (>80% faster)

---

# 🎯 **PHASE 3: QUALITY** (Week 7-10)
## **Goal: Testing, Monitoring, & Hardening**

### **3.1 Testing Infrastructure** ⏱️ 12 hours
**Priority:** 🟡 HIGH

#### **Task 3.1.1: Setup Testing Framework**
**Effort:** 2 hours

```bash
npm install --save-dev @testing-library/react @testing-library/jest-dom vitest
```

**File:** `vitest.config.ts`
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./tests/setup.ts'],
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './'),
        },
    },
});
```

---

#### **Task 3.1.2: Write Critical Tests**
**Effort:** 10 hours  
**File:** `tests/dashboard-logic.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { processDualRoleSPV, calculateAchievement, isUnderperform } from '@/lib/dashboard-logic';

describe('Dashboard Logic', () => {
    describe('processDualRoleSPV', () => {
        it('should add SPV as SATOR when they have direct promotors', () => {
            const sators = [{ user_id: 'sator1', name: 'Sator 1', /* ... */ }];
            const directPromotors = [{ user_id: 'p1', total_input: 10, /* ... */ }];
            const user = { id: 'spv1', name: 'SPV 1' };
            
            const result = processDualRoleSPV(sators, directPromotors, user, 100);
            
            expect(result).toHaveLength(2);
            expect(result[0].user_id).toBe('spv1');
            expect(result[0].name).toBe('SPV 1');
        });

        it('should not add SPV when no direct promotors', () => {
            const sators = [{ user_id: 'sator1', name: 'Sator 1', /* ... */ }];
            const directPromotors = [];
            const user = { id: 'spv1', name: 'SPV 1' };
            
            const result = processDualRoleSPV(sators, directPromotors, user, 100);
            
            expect(result).toHaveLength(1);
            expect(result[0].user_id).toBe('sator1');
        });
    });

    describe('calculateAchievement', () => {
        it('should calculate percentage correctly', () => {
            expect(calculateAchievement(50, 100)).toBe(50);
            expect(calculateAchievement(100, 100)).toBe(100);
            expect(calculateAchievement(150, 100)).toBe(150);
        });

        it('should return 0 when target is 0', () => {
            expect(calculateAchievement(50, 0)).toBe(0);
        });
    });

    describe('isUnderperform', () => {
        it('should return true when no input', () => {
            const promotor = { total_input: 0, target: 100, /* ... */ };
            expect(isUnderperform(promotor, 50)).toBe(true);
        });

        it('should return true when achievement < time gone', () => {
            const promotor = { total_input: 30, target: 100, /* ... */ };
            expect(isUnderperform(promotor, 50)).toBe(true);
        });

        it('should return false when achievement >= time gone', () => {
            const promotor = { total_input: 60, target: 100, /* ... */ };
            expect(isUnderperform(promotor, 50)).toBe(false);
        });
    });
});
```

**Success Criteria:**
- Test coverage > 80% untuk critical logic
- All tests pass
- CI/CD integration

---

### **3.2 Monitoring & Logging** ⏱️ 8 hours
**Priority:** 🟡 HIGH

#### **Task 3.2.1: Setup Sentry**
**Effort:** 2 hours

```bash
npm install @sentry/nextjs
```

**File:** `sentry.client.config.ts`
```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 1.0,
    beforeSend(event, hint) {
        // Filter sensitive data
        if (event.request) {
            delete event.request.cookies;
        }
        return event;
    },
});
```

---

#### **Task 3.2.2: Add Performance Monitoring**
**Effort:** 4 hours  
**File:** `lib/monitoring.ts`

```typescript
import * as Sentry from '@sentry/nextjs';

export function trackAPICall(endpoint: string, duration: number, success: boolean) {
    Sentry.metrics.increment('api.call', {
        tags: { endpoint, success: success.toString() }
    });
    
    Sentry.metrics.distribution('api.duration', duration, {
        tags: { endpoint },
        unit: 'millisecond'
    });
}

export function trackPageLoad(page: string, duration: number) {
    Sentry.metrics.distribution('page.load', duration, {
        tags: { page },
        unit: 'millisecond'
    });
}

export function trackUserEvent(event: string, metadata?: Record<string, any>) {
    Sentry.metrics.increment('user.event', {
        tags: { event }
    });
    
    if (metadata) {
        Sentry.addBreadcrumb({
            message: event,
            data: metadata,
            level: 'info'
        });
    }
}
```

**Usage:**
```typescript
const startTime = Date.now();
try {
    const result = await supabase.functions.invoke(...);
    trackAPICall('dashboard-team-monthly', Date.now() - startTime, true);
    return result;
} catch (error) {
    trackAPICall('dashboard-team-monthly', Date.now() - startTime, false);
    throw error;
}
```

---

#### **Task 3.2.3: Database Query Logging**
**Effort:** 2 hours  
**File:** `supabase/functions/_shared/logger.ts`

```typescript
export function logQuery(queryName: string, duration: number, recordCount: number) {
    console.log(JSON.stringify({
        type: 'query',
        name: queryName,
        duration_ms: duration,
        record_count: recordCount,
        timestamp: new Date().toISOString()
    }));
}

export function logError(context: string, error: any) {
    console.error(JSON.stringify({
        type: 'error',
        context: context,
        error: {
            message: error.message,
            code: error.code,
            stack: error.stack
        },
        timestamp: new Date().toISOString()
    }));
}
```

**Success Criteria:**
- All errors tracked in Sentry
- Performance metrics visible
- Query slow logs identified

---

### **3.3 Performance Optimization** ⏱️ 6 hours
**Priority:** 🟢 MEDIUM

#### **Task 3.3.1: Frontend Code Splitting**
**Effort:** 3 hours

```typescript
// Use dynamic imports for heavy components
import dynamic from 'next/dynamic';

const SpvHeader = dynamic(() => import('@/components/SpvHeader'), {
    loading: () => <div>Loading...</div>
});

const PerformanceChart = dynamic(() => import('@/components/PerformanceChart'), {
    ssr: false  // Only load on client
});
```

---

#### **Task 3.3.2: React Query for Caching**
**Effort:** 3 hours

```bash
npm install @tanstack/react-query
```

```typescript
import { useQuery } from '@tanstack/react-query';

export function useTeamMonthly(userId: string, month: string) {
    return useQuery({
        queryKey: ['team-monthly', userId, month],
        queryFn: async () => {
            const { data, error } = await supabase.functions.invoke(...);
            if (error) throw parseSupabaseError(error);
            return data;
        },
        staleTime: 5 * 60 * 1000,  // 5 minutes
        cacheTime: 10 * 60 * 1000,  // 10 minutes
    });
}

// Usage
const { data, isLoading, error } = useTeamMonthly(user.id, currentMonth);
```

**Success Criteria:**
- Page load time < 1s
- Reduced API calls (caching)
- Better UX with loading states

---

## **PHASE 3 CHECKPOINT** ✅

**Before Moving to Phase 4:**
- [ ] Test coverage > 80%
- [ ] Sentry tracking all errors
- [ ] Performance monitoring in place
- [ ] No critical bugs found

---

# 🎯 **PHASE 4: FUTURE-PROOF** (Week 11-12)
## **Goal: Caching, Documentation, DX**

### **4.1 Caching Strategy** ⏱️ 6 hours
**Priority:** 🟢 MEDIUM

#### **Task 4.1.1: Redis/Upstash for API Caching**
**Effort:** 4 hours

```bash
npm install @upstash/redis
```

**File:** `lib/cache.ts`
```typescript
import { Redis } from '@upstash/redis';

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const CACHE_TTL = {
    DAILY: 5 * 60,  // 5 minutes
    MONTHLY: 30 * 60,  // 30 minutes
    STATIC: 24 * 60 * 60,  // 24 hours
};

export async function getCachedData<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl: number = CACHE_TTL.MONTHLY
): Promise<T> {
    // Check cache first
    const cached = await redis.get<T>(key);
    if (cached) {
        console.log(`[Cache HIT] ${key}`);
        return cached;
    }

    console.log(`[Cache MISS] ${key}`);
    
    // Fetch fresh data
    const data = await fetchFn();
    
    // Store in cache
    await redis.setex(key, ttl, data);
    
    return data;
}

export async function invalidateCache(pattern: string) {
    // Clear cache for specific pattern
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
        await redis.del(...keys);
    }
}
```

**Usage in Edge Function:**
```typescript
// In dashboard-team-monthly
const cacheKey = `team-monthly:${userId}:${month}`;

const data = await getCachedData(cacheKey, async () => {
    // Expensive query here
    return fetchDataFromDatabase();
}, CACHE_TTL.MONTHLY);

return new Response(JSON.stringify(data), { headers: corsHeaders });
```

---

#### **Task 4.1.2: Cache Invalidation on Data Change**
**Effort:** 2 hours

```typescript
// After submission created
await invalidateCache(`team-monthly:${promotorId}:*`);
await invalidateCache(`team-monthly:${satorId}:*`);
await invalidateCache(`team-monthly:${spvId}:*`);
```

**Success Criteria:**
- API response < 100ms (cached)
- Cache hit rate > 70%
- Correct cache invalidation

---

### **4.2 Documentation** ⏱️ 8 hours
**Priority:** 🟢 HIGH

#### **Task 4.2.1: Architecture Documentation**
**Effort:** 4 hours  
**File:** `docs/ARCHITECTURE.md`

```markdown
# System Architecture

## Technology Stack
- Frontend: Next.js 14 + TypeScript
- Backend: Supabase (PostgreSQL + Edge Functions)
- State: React Query
- Monitoring: Sentry
- Cache: Upstash Redis

## Data Flow
[Diagram showing flow from client → edge function → database → cache]

## Database Schema
[ERD diagram]

## API Endpoints
[List all edge functions with purpose]

## Deployment
[Deployment process & environments]
```

---

#### **Task 4.2.2: Developer Handbook**
**Effort:** 4 hours  
**File:** `docs/DEVELOPER_GUIDE.md`

```markdown
# Developer Guide

## Setup
1. Clone repo
2. Install dependencies
3. Setup .env
4. Run migrations

## Code Standards
- TypeScript strict mode
- No `any` types
- All functions have JSDoc
- Test coverage > 80%

## Common Tasks
- Adding new dashboard page
- Creating new edge function
- Updating database schema
- Deploying to production

## Troubleshooting
[Common issues & solutions]
```

**Success Criteria:**
- New developer can setup in < 1 hour
- All critical flows documented
- Architecture clear

---

### **4.3 Developer Experience** ⏱️ 4 hours
**Priority:** 🟢 MEDIUM

#### **Task 4.3.1: Setup Development Scripts**
**Effort:** 2 hours  
**File:** `package.json`

```json
{
    "scripts": {
        "dev": "next dev",
        "build": "next build",
        "start": "next start",
        "test": "vitest",
        "test:watch": "vitest watch",
        "test:coverage": "vitest run --coverage",
        "type-check": "tsc --noEmit",
        "lint": "next lint",
        "db:generate-types": "npx supabase gen types typescript --project-id xxx > types/database.types.ts",
        "db:migrate": "npx supabase db push",
        "db:reset": "npx supabase db reset",
        "analyze": "ANALYZE=true next build"
    }
}
```

---

#### **Task 4.3.2: Pre-commit Hooks**
**Effort:** 2 hours

```bash
npm install --save-dev husky lint-staged
npx husky install
```

**File:** `.husky/pre-commit`
```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

npx lint-staged
```

**File:** `.lintstagedrc.json`
```json
{
    "*.{ts,tsx}": [
        "eslint --fix",
        "prettier --write"
    ],
    "*.{ts,tsx}": "tsc --noEmit"
}
```

**Success Criteria:**
- Code quality enforced automatically
- No bad code committed
- Smooth development workflow

---

## **FINAL CHECKPOINT** ✅

### **Post-Refactoring Metrics:**

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Page Load Time | 3-5s | < 1s | **80%+** |
| API Response (p95) | 2s+ | < 500ms | **75%+** |
| Database Query | 500ms+ | < 100ms | **80%+** |
| Code Coverage | 0% | > 80% | **New** |
| Type Safety | ~30% | 100% | **Complete** |
| Error Tracking | None | Full | **New** |
| Cache Hit Rate | 0% | > 70% | **New** |

---

## 📋 **DELIVERABLES CHECKLIST**

### **Code:**
- [ ] All database indexes created
- [ ] Materialized views implemented
- [ ] TypeScript types complete
- [ ] Error handling updated
- [ ] N+1 queries eliminated
- [ ] Business logic centralized
- [ ] Timezone utilities implemented
- [ ] Tests written (>80% coverage)
- [ ] Monitoring setup (Sentry)
- [ ] Caching implemented

### **Documentation:**
- [ ] Architecture document
- [ ] Developer guide
- [ ] API documentation
- [ ] Deployment guide
- [ ] Troubleshooting guide

### **Infrastructure:**
- [ ] CI/CD pipeline
- [ ] Pre-commit hooks
- [ ] Performance monitoring
- [ ] Error tracking
- [ ] Automated testing

---

## 💰 **INVESTMENT vs RETURN**

### **Total Investment:**
- **Time:** ~90 hours (3 months @ 1 week/phase)
- **Cost:** Developer time only
- **Risk:** Low (incremental, tested)

### **Long-term Benefits:**
- **Performance:** 80%+ improvement
- **Maintainability:** 10x easier to update
- **Reliability:** 99.9% uptime
- **Scalability:** Ready for 10,000+ users
- **Developer Velocity:** 5x faster development
- **Technical Debt:** Eliminated

### **ROI:**
- **Year 1:** 5x return
- **Year 2-10:** Compound savings
- **Avoid:** System rewrite (would cost 10x more)

---

## 🚀 **LET'S START?**

**Recommended Approach:**
1. **Week 1-2:** Focus on Phase 1 (Foundation) - CRITICAL
2. **Test & Deploy** Phase 1 to production
3. **Week 3-6:** Phase 2 (Architecture)
4. **Test & Deploy** Phase 2
5. **Week 7-12:** Phase 3 & 4 parallel

**Or we can:**
- Start with quick wins (database indexes) - **2 hours, big impact**
- Prioritize based on your biggest pain points

**Mau mulai dari mana?** 🤔
