// VAST FINANCE - Manager Area Daily Dashboard Edge Function
// Data HARIAN lengkap: Area → Sator → Promotor dengan breakdown status
// Untuk halaman /dashboard/area/daily

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Promotor {
    user_id: string
    name: string
    total_input: number
    total_closed: number
    total_pending: number
    total_rejected: number
    is_empty: boolean
    has_reject: boolean
}

interface Sator {
    user_id: string
    name: string
    total_input: number
    total_closed: number
    total_pending: number
    total_rejected: number
    promotors: Promotor[]
}

interface Area {
    user_id: string
    area_name: string
    spv_name: string
    total_input: number
    total_closed: number
    total_pending: number
    total_rejected: number
    sators: Sator[]
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Get today's date in WITA timezone
        const today = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Makassar',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(new Date())

        console.log('Manager Daily Dashboard - Full hierarchy for:', today)

        // 1. Get all SPVs (= AREA)
        const { data: spvUsers } = await supabaseClient
            .from('users')
            .select('id, name, employee_id')
            .eq('role', 'spv')
            .eq('status', 'active')

        const spvIds = (spvUsers || []).map(s => s.id)
        const spvMap = new Map((spvUsers || []).map(s => [s.id, s]))

        // 2. Get hierarchy data
        const { data: hierarchyData } = await supabaseClient
            .from('hierarchy')
            .select('user_id, area, atasan_id')

        const hierarchyMap = new Map((hierarchyData || []).map(h => [h.user_id, h]))

        // 3. Get all users
        const { data: allUsers } = await supabaseClient
            .from('users')
            .select('id, name, role, employee_id')
            .eq('status', 'active')

        const userMap = new Map((allUsers || []).map(u => [u.id, u]))

        // 4. Get all promotor daily data
        const { data: promotorDailyData } = await supabaseClient
            .from('v_agg_daily_promoter_all')
            .select('*')
            .eq('agg_date', today)

        const promotorDailyMap = new Map((promotorDailyData || []).map(p => [p.promoter_user_id, p]))

        // 5. Build hierarchy: Area → Sator → Promotor
        const areas: Area[] = []
        let totalPromotorCount = 0
        let activePromotorCount = 0
        let emptyPromotorCount = 0
        let rejectPromotorCount = 0

        for (const spvId of spvIds) {
            const spv = spvMap.get(spvId)
            const spvHier = hierarchyMap.get(spvId)
            const areaName = spvHier?.area || spv?.name || 'Unknown'

            // Find all SATORs under this SPV
            const satorHierarchies = (hierarchyData || []).filter(h =>
                h.atasan_id === spvId && userMap.get(h.user_id)?.role === 'sator'
            )

            // Also check if SPV has direct promotors (SPV acting as SATOR)
            const directPromotorHierarchies = (hierarchyData || []).filter(h =>
                h.atasan_id === spvId && userMap.get(h.user_id)?.role === 'promotor'
            )

            const sators: Sator[] = []

            // Process each SATOR
            for (const satorHier of satorHierarchies) {
                const satorUser = userMap.get(satorHier.user_id)
                if (!satorUser) continue

                // Find all promotors under this SATOR
                const promotorHierarchies = (hierarchyData || []).filter(h =>
                    h.atasan_id === satorHier.user_id && userMap.get(h.user_id)?.role === 'promotor'
                )

                const promotors: Promotor[] = []

                for (const promHier of promotorHierarchies) {
                    const promUser = userMap.get(promHier.user_id)
                    if (!promUser) continue

                    const dailyData = promotorDailyMap.get(promHier.user_id)
                    const totalInput = dailyData?.total_input || 0
                    const totalClosed = dailyData?.total_closed || 0
                    const totalPending = dailyData?.total_pending || 0
                    const totalRejected = dailyData?.total_rejected || 0

                    const isEmpty = totalInput === 0
                    const hasReject = totalRejected > 0

                    totalPromotorCount++
                    if (!isEmpty) activePromotorCount++
                    if (isEmpty) emptyPromotorCount++
                    if (hasReject) rejectPromotorCount++

                    promotors.push({
                        user_id: promHier.user_id,
                        name: promUser.name,
                        total_input: totalInput,
                        total_closed: totalClosed,
                        total_pending: totalPending,
                        total_rejected: totalRejected,
                        is_empty: isEmpty,
                        has_reject: hasReject
                    })
                }

                // Sort promotors: active first (by input desc), then empty
                promotors.sort((a, b) => {
                    if (a.is_empty && !b.is_empty) return 1
                    if (!a.is_empty && b.is_empty) return -1
                    return b.total_input - a.total_input
                })

                const satorTotals = promotors.reduce((acc, p) => ({
                    total_input: acc.total_input + p.total_input,
                    total_closed: acc.total_closed + p.total_closed,
                    total_pending: acc.total_pending + p.total_pending,
                    total_rejected: acc.total_rejected + p.total_rejected
                }), { total_input: 0, total_closed: 0, total_pending: 0, total_rejected: 0 })

                sators.push({
                    user_id: satorHier.user_id,
                    name: satorUser.name,
                    ...satorTotals,
                    promotors
                })
            }

            // Process direct promotors under SPV (SPV as SATOR)
            if (directPromotorHierarchies.length > 0) {
                const directPromotors: Promotor[] = []

                for (const promHier of directPromotorHierarchies) {
                    const promUser = userMap.get(promHier.user_id)
                    if (!promUser) continue

                    const dailyData = promotorDailyMap.get(promHier.user_id)
                    const totalInput = dailyData?.total_input || 0
                    const totalClosed = dailyData?.total_closed || 0
                    const totalPending = dailyData?.total_pending || 0
                    const totalRejected = dailyData?.total_rejected || 0

                    const isEmpty = totalInput === 0
                    const hasReject = totalRejected > 0

                    totalPromotorCount++
                    if (!isEmpty) activePromotorCount++
                    if (isEmpty) emptyPromotorCount++
                    if (hasReject) rejectPromotorCount++

                    directPromotors.push({
                        user_id: promHier.user_id,
                        name: promUser.name,
                        total_input: totalInput,
                        total_closed: totalClosed,
                        total_pending: totalPending,
                        total_rejected: totalRejected,
                        is_empty: isEmpty,
                        has_reject: hasReject
                    })
                }

                directPromotors.sort((a, b) => {
                    if (a.is_empty && !b.is_empty) return 1
                    if (!a.is_empty && b.is_empty) return -1
                    return b.total_input - a.total_input
                })

                const directTotals = directPromotors.reduce((acc, p) => ({
                    total_input: acc.total_input + p.total_input,
                    total_closed: acc.total_closed + p.total_closed,
                    total_pending: acc.total_pending + p.total_pending,
                    total_rejected: acc.total_rejected + p.total_rejected
                }), { total_input: 0, total_closed: 0, total_pending: 0, total_rejected: 0 })

                // Add SPV as a "SATOR" entry for direct promotors
                sators.unshift({
                    user_id: spvId,
                    name: `${spv?.name} (Direct)`,
                    ...directTotals,
                    promotors: directPromotors
                })
            }

            // Sort sators by input desc
            sators.sort((a, b) => b.total_input - a.total_input)

            const areaTotals = sators.reduce((acc, s) => ({
                total_input: acc.total_input + s.total_input,
                total_closed: acc.total_closed + s.total_closed,
                total_pending: acc.total_pending + s.total_pending,
                total_rejected: acc.total_rejected + s.total_rejected
            }), { total_input: 0, total_closed: 0, total_pending: 0, total_rejected: 0 })

            areas.push({
                user_id: spvId,
                area_name: areaName,
                spv_name: spv?.name || 'Unknown',
                ...areaTotals,
                sators
            })
        }

        // Sort areas by input desc
        areas.sort((a, b) => b.total_input - a.total_input)

        // Grand totals
        const grandTotals = areas.reduce((acc, a) => ({
            total_input: acc.total_input + a.total_input,
            total_closed: acc.total_closed + a.total_closed,
            total_pending: acc.total_pending + a.total_pending,
            total_rejected: acc.total_rejected + a.total_rejected
        }), { total_input: 0, total_closed: 0, total_pending: 0, total_rejected: 0 })

        console.log(`Result: ${areas.length} areas, ${totalPromotorCount} promotors (${activePromotorCount} active, ${emptyPromotorCount} empty)`)

        return new Response(
            JSON.stringify({
                date: today,
                date_formatted: new Intl.DateTimeFormat('id-ID', {
                    timeZone: 'Asia/Makassar',
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                }).format(new Date()),
                totals: grandTotals,
                promotor_stats: {
                    total: totalPromotorCount,
                    active: activePromotorCount,
                    empty: emptyPromotorCount,
                    with_reject: rejectPromotorCount
                },
                areas
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Manager daily dashboard error:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
