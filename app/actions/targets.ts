'use server'

import { createClient } from '@/lib/supabase/server'
import { getAdminUser } from './admin'

export interface TargetUser {
    user_id: string
    name: string
    role: string
    area: string | null
    atasan_id?: string | null
    current_target: number
    new_target: number
    // For dual-role SPV: separate targets
    current_target_as_sator?: number
    new_target_as_sator?: number
}

export interface TargetValidation {
    isValid: boolean
    errors: string[]
    warnings: string[]
}

// Get target list for specific role
export async function getTargetList(role: 'spv' | 'sator' | 'promotor', periodMonth: number, periodYear: number) {
    const auth = await getAdminUser()
    if (auth.error) return { success: false, message: auth.error, data: [] }

    let users: any[] = []

    if (role === 'sator') {
        // For Sator: Include both actual Sator AND SPV who have promotor directly
        // Get Sator users
        const { data: satorUsers, error: satorError } = await auth.adminDb!
            .from('users')
            .select('id, name, role')
            .eq('role', 'sator')
            .eq('status', 'active')

        // Get SPV users
        const { data: spvUsers, error: spvError } = await auth.adminDb!
            .from('users')
            .select('id, name, role')
            .eq('role', 'spv')
            .eq('status', 'active')

        if (satorError || spvError) {
            console.error('[getTargetList] Error:', satorError || spvError)
            return { success: false, message: (satorError || spvError)?.message || 'Error', data: [] }
        }

        // Check which SPV have promotor directly under them (dual role)
        const spvIds = (spvUsers || []).map(s => s.id)
        const { data: promotorUnderSPV } = await auth.adminDb!
            .from('hierarchy')
            .select('atasan_id')
            .in('atasan_id', spvIds)
            .in('user_id', (await auth.adminDb!
                .from('users')
                .select('id')
                .eq('role', 'promotor')
            ).data?.map(p => p.id) || [])

        const dualRoleSPVIds = new Set((promotorUnderSPV || []).map(h => h.atasan_id))

        // Include Sator + Dual Role SPV
        const dualRoleSPV = (spvUsers || []).filter(spv => dualRoleSPVIds.has(spv.id))
        users = [...(satorUsers || []), ...dualRoleSPV]
    } else {
        // For SPV and Promotor: Normal query
        const { data: normalUsers, error: usersError } = await auth.adminDb!
            .from('users')
            .select('id, name, role')
            .eq('role', role)
            .eq('status', 'active')
            .order('name')

        if (usersError) {
            console.error('[getTargetList] Error:', usersError)
            return { success: false, message: usersError.message, data: [] }
        }

        users = normalUsers || []
    }

    if (users.length === 0) {
        return { success: true, data: [] }
    }

    // Get hierarchy info
    const userIds = users.map(u => u.id)
    const { data: hierarchies } = await auth.adminDb!
        .from('hierarchy')
        .select('user_id, atasan_id, area')
        .in('user_id', userIds)

    const hierarchyMap = new Map(hierarchies?.map(h => [h.user_id, h]) || [])

    // Get current targets
    // For SATOR tab: need to differentiate between regular sator and dual-role SPV
    const { data: targets } = await auth.adminDb!
        .from('targets')
        .select('user_id, target_value, target_type')
        .in('user_id', userIds)
        .eq('period_month', periodMonth)
        .eq('period_year', periodYear)

    // Create map: for dual-role SPV in sator context, use 'as_sator' target
    // For others, use 'primary' target
    const targetMap = new Map()
    if (targets) {
        targets.forEach(t => {
            // Store both targets if exists
            if (!targetMap.has(t.user_id)) {
                targetMap.set(t.user_id, { primary: 0, as_sator: 0 })
            }
            if (t.target_type === 'as_sator') {
                targetMap.get(t.user_id).as_sator = t.target_value
            } else {
                targetMap.get(t.user_id).primary = t.target_value
            }
        })
    }

    // Combine data
    const result: TargetUser[] = users.map(user => {
        const hierarchy = hierarchyMap.get(user.id)
        const targets = targetMap.get(user.id) || { primary: 0, as_sator: 0 }

        // Determine which target to use:
        // If this is SATOR tab and user is SPV (dual-role), use as_sator target
        // Otherwise use primary target
        let currentTarget = targets.primary
        if (role === 'sator' && user.role === 'spv') {
            // Dual-role SPV in SATOR context: use as_sator target if exists, fallback to primary
            currentTarget = targets.as_sator || targets.primary
        }

        const baseUser = {
            user_id: user.id,
            name: user.name,
            role: user.role,
            area: hierarchy?.area || null,
            atasan_id: hierarchy?.atasan_id || null,
            current_target: currentTarget,
            new_target: currentTarget
        }

        // For SPV users (regardless of which tab), include dual-target fields
        if (user.role === 'spv') {
            return {
                ...baseUser,
                current_target_as_sator: targets.as_sator,
                new_target_as_sator: targets.as_sator
            }
        }

        return baseUser
    }).sort((a, b) => a.name.localeCompare(b.name))

    return { success: true, data: result }
}

// Copy targets from previous month
export async function copyTargetsFromPreviousMonth(periodMonth: number, periodYear: number) {
    const auth = await getAdminUser()
    if (auth.error) return { success: false, message: auth.error }

    // Calculate previous month
    let prevMonth = periodMonth - 1
    let prevYear = periodYear
    if (prevMonth < 1) {
        prevMonth = 12
        prevYear -= 1
    }

    // Get previous month's targets
    const { data: prevTargets, error } = await auth.adminDb!
        .from('targets')
        .select('user_id, target_value')
        .eq('period_month', prevMonth)
        .eq('period_year', prevYear)

    if (error) {
        console.error('[copyTargets] Error:', error)
        return { success: false, message: error.message }
    }

    if (!prevTargets || prevTargets.length === 0) {
        return {
            success: false,
            message: `Target bulan sebelumnya (${prevMonth}/${prevYear}) tidak tersedia. Silakan set manual.`
        }
    }

    const nonZeroTargets = prevTargets.filter(t => t.target_value > 0)
    if (nonZeroTargets.length === 0) {
        return {
            success: false,
            message: `Semua target bulan sebelumnya bernilai 0. Silakan set manual.`
        }
    }

    return {
        success: true,
        data: prevTargets,
        message: `${nonZeroTargets.length} target berhasil di-copy dari bulan ${prevMonth}/${prevYear}`
    }
}

// Validate hierarchical targets
export async function validateHierarchicalTargets(
    spvTargets: TargetUser[],
    satorTargets: TargetUser[],
    promotorTargets: TargetUser[]
): Promise<TargetValidation> {
    const errors: string[] = []
    const warnings: string[] = []

    // Group sators by SPV (include dual-role SPV acting as Sator)
    const satorBySPV = new Map<string, TargetUser[]>()
    satorTargets.forEach(sator => {
        if (sator.atasan_id) {
            if (!satorBySPV.has(sator.atasan_id)) {
                satorBySPV.set(sator.atasan_id, [])
            }
            satorBySPV.get(sator.atasan_id)!.push(sator)
        }
    })

    // Validate: SUM(Sator targets) >= SPV target
    // Note: satorTargets already includes dual-role SPV (from getTargetList)
    spvTargets.forEach(spv => {
        // Get all Sators under this SPV (including the SPV itself if dual role)
        const sators = satorBySPV.get(spv.user_id) || []

        // Also check if this SPV has a target as Sator (dual role)
        const spvAsSator = satorTargets.find(s => s.user_id === spv.user_id)

        let totalSatorTarget = sators.reduce((sum, s) => sum + s.new_target, 0)

        // Add SPV's own Sator target if dual role
        if (spvAsSator) {
            totalSatorTarget += spvAsSator.new_target
        }

        if (totalSatorTarget < spv.new_target) {
            errors.push(
                `SPV "${spv.name}": Target (${spv.new_target}) > Total target Sator (${totalSatorTarget}). ` +
                `Total target Sator harus ≥ ${spv.new_target}`
            )
        }
    })

    // Group promotors by Sator
    const promotorBySator = new Map<string, TargetUser[]>()
    promotorTargets.forEach(promotor => {
        if (promotor.atasan_id) {
            if (!promotorBySator.has(promotor.atasan_id)) {
                promotorBySator.set(promotor.atasan_id, [])
            }
            promotorBySator.get(promotor.atasan_id)!.push(promotor)
        }
    })

    // Validate: SUM(Promotor targets) >= Sator target
    satorTargets.forEach(sator => {
        const promotors = promotorBySator.get(sator.user_id) || []
        const totalPromotorTarget = promotors.reduce((sum, p) => sum + p.new_target, 0)

        if (totalPromotorTarget < sator.new_target) {
            errors.push(
                `Sator "${sator.name}": Target (${sator.new_target}) > Total target Promotor (${totalPromotorTarget}). ` +
                `Total target Promotor harus ≥ ${sator.new_target}`
            )
        }
    })

    return {
        isValid: errors.length === 0,
        errors,
        warnings
    }
}

// Save targets (bulk upsert)
export async function saveTargets(
    targets: TargetUser[],
    periodMonth: number,
    periodYear: number,
    adminUserId: string
) {
    const auth = await getAdminUser()
    if (auth.error) return { success: false, message: auth.error }

    const records: any[] = []

    targets.forEach(t => {
        // For all users: save primary target if changed
        if (t.new_target !== t.current_target) {
            records.push({
                user_id: t.user_id,
                period_month: periodMonth,
                period_year: periodYear,
                month: `${periodYear}-${String(periodMonth).padStart(2, '0')}`,
                target_value: t.new_target,
                target_type: 'primary',
                set_by_admin_id: adminUserId,
                updated_at: new Date().toISOString()
            })
        }

        // For SPV users: also save as_sator target if changed
        if (t.role === 'spv' && t.new_target_as_sator !== undefined) {
            if (t.new_target_as_sator !== t.current_target_as_sator) {
                records.push({
                    user_id: t.user_id,
                    period_month: periodMonth,
                    period_year: periodYear,
                    month: `${periodYear}-${String(periodMonth).padStart(2, '0')}`,
                    target_value: t.new_target_as_sator,
                    target_type: 'as_sator',
                    set_by_admin_id: adminUserId,
                    updated_at: new Date().toISOString()
                })
            }
        }
    })

    if (records.length === 0) {
        return { success: true, message: 'Tidak ada perubahan target' }
    }

    const { error } = await auth.adminDb!
        .from('targets')
        .upsert(records, {
            onConflict: 'user_id,period_month,period_year,target_type'
        })

    if (error) {
        console.error('[saveTargets] Error:', error)
        return { success: false, message: error.message }
    }

    return {
        success: true,
        message: `${records.length} target berhasil disimpan`
    }
}

// Get existing target periods
export async function getAvailableTargetPeriods() {
    const auth = await getAdminUser()
    if (auth.error) return { success: false, message: auth.error, data: [] }

    const { data, error } = await auth.adminDb!
        .from('targets')
        .select('period_month, period_year')
        // Use a simple group by or distinct approach logic if possible, 
        // but Supabase JS select distinct is tricky on multiple columns without RPC or distinct on
        // Workaround: Fetch usually not too big, dedup in JS or use .csv() trick.
        // Better: just fetch all and dedup JS side for now (safe for low volume) or unique by query?
        // Let's use order and we will dedup in JS for simplicity unless huge data.
        .order('period_year', { ascending: false })
        .order('period_month', { ascending: false })

    if (error) return { success: false, message: error.message, data: [] }

    // Dedup
    const periods = Array.from(new Set(data.map(d => `${d.period_year}-${d.period_month}`)))
        .map(s => {
            const [year, month] = s.split('-').map(Number)
            return { year, month }
        })

    return { success: true, data: periods }
}
