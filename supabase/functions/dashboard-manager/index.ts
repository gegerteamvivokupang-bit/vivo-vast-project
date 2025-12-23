// VAST FINANCE - Manager Area Dashboard Edge Function
// Mengambil data semua AREA (SPV), SATOR, dan PROMOTOR untuk Manager
// Menggunakan view agregat: v_agg_monthly_spv_all, v_agg_monthly_sator_all, v_agg_monthly_promoter_all

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

        // Get current month in WITA
        const witaDate = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Makassar',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(new Date());
        const currentMonth = witaDate.substring(0, 7) + '-01';

        console.log('Manager Dashboard - Fetching all data for month:', currentMonth);

        // 1. Get all SPVs (= AREA)
        const { data: spvUsers, error: spvError } = await supabaseClient
            .from('users')
            .select('id, name, employee_id')
            .eq('role', 'spv')
            .eq('status', 'active')

        if (spvError) {
            console.error('SPV fetch error:', spvError)
            return new Response(JSON.stringify({ error: 'Failed to fetch SPVs' }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        const spvIds = (spvUsers || []).map(s => s.id)
        const spvMap = new Map((spvUsers || []).map(s => [s.id, s]))
        console.log('Found SPVs:', spvIds.length)

        // 2. Get hierarchy data untuk semua SPV (untuk dapat area name)
        const { data: hierarchyData } = await supabaseClient
            .from('hierarchy')
            .select('user_id, area, atasan_id')

        const hierarchyMap = new Map((hierarchyData || []).map(h => [h.user_id, h]))

        // 3. Get all users untuk mapping
        const { data: allUsers } = await supabaseClient
            .from('users')
            .select('id, name, role, employee_id')
            .in('role', ['sator', 'promotor', 'spv'])

        const userMap = new Map((allUsers || []).map(u => [u.id, u]))

        // 4. Query SPV aggregates dari view (data dari SATOR di bawahnya)
        const { data: spvAggData, error: spvAggError } = await supabaseClient
            .from('v_agg_monthly_spv_all')
            .select('*')
            .in('spv_user_id', spvIds.length > 0 ? spvIds : ['none'])
            .eq('agg_month', currentMonth)

        if (spvAggError) console.error('SPV agg error:', spvAggError)
        const spvAggMap = new Map((spvAggData || []).map(a => [a.spv_user_id, a]))

        // 4b. Query SATOR aggregates untuk SPV yang juga bertindak sebagai SATOR (punya promotor langsung)
        // Ini untuk kasus seperti Anfal & Wilibroddus
        const { data: spvAsSatorData, error: spvAsSatorError } = await supabaseClient
            .from('v_agg_monthly_sator_all')
            .select('*')
            .in('sator_user_id', spvIds.length > 0 ? spvIds : ['none'])
            .eq('agg_month', currentMonth)

        if (spvAsSatorError) console.error('SPV as Sator agg error:', spvAsSatorError)
        const spvAsSatorMap = new Map((spvAsSatorData || []).map(a => [a.sator_user_id, a]))

        // 5. Get all SATOR IDs (bawahan SPV)
        const satorHierarchy = (hierarchyData || []).filter(h =>
            spvIds.includes(h.atasan_id) && userMap.get(h.user_id)?.role === 'sator'
        )
        const satorIds = satorHierarchy.map(h => h.user_id)

        // 6. Query SATOR aggregates dari view
        const { data: satorAggData, error: satorAggError } = await supabaseClient
            .from('v_agg_monthly_sator_all')
            .select('*')
            .in('sator_user_id', satorIds.length > 0 ? satorIds : ['none'])
            .eq('agg_month', currentMonth)

        if (satorAggError) console.error('Sator agg error:', satorAggError)
        const satorAggMap = new Map((satorAggData || []).map(a => [a.sator_user_id, a]))

        // 7. Get all PROMOTOR IDs (bawahan SATOR atau langsung di bawah SPV)
        const promotorHierarchy = (hierarchyData || []).filter(h => {
            const user = userMap.get(h.user_id)
            return user?.role === 'promotor'
        })
        const promotorIds = promotorHierarchy.map(h => h.user_id)

        // 8. Query PROMOTOR aggregates dari view
        const { data: promotorAggData, error: promotorAggError } = await supabaseClient
            .from('v_agg_monthly_promoter_all')
            .select('*')
            .in('promoter_user_id', promotorIds.length > 0 ? promotorIds : ['none'])
            .eq('agg_month', currentMonth)

        if (promotorAggError) console.error('Promotor agg error:', promotorAggError)
        const promotorAggMap = new Map((promotorAggData || []).map(a => [a.promoter_user_id, a]))

        // 9. Get targets untuk semua user
        // Fetch both primary and as_sator targets for dual-role support
        const allUserIds = [...spvIds, ...satorIds, ...promotorIds]

        // Parse month/year from currentMonth ('2024-12-01' format)
        const monthParts = currentMonth.split('-')
        const targetYear = parseInt(monthParts[0])
        const targetMonth = parseInt(monthParts[1])

        const { data: targetsData, error: targetsError } = await supabaseClient
            .from('targets')
            .select('user_id, target_value, target_type')
            .in('user_id', allUserIds.length > 0 ? allUserIds : ['none'])
            .eq('period_month', targetMonth)
            .eq('period_year', targetYear)

        if (targetsError) {
            console.error('Targets fetch error:', targetsError)
        }

        // Create 2 maps: primary targets (for SPV, regular SATOR, Promotor) 
        // and as_sator targets (for SPV acting as SATOR)
        const targetMapPrimary = new Map()
        const targetMapAsSator = new Map()

        if (targetsData) {
            targetsData.forEach(t => {
                if (t.target_type === 'as_sator') {
                    targetMapAsSator.set(t.user_id, t.target_value)
                } else {
                    // 'primary' or null defaults to primary
                    targetMapPrimary.set(t.user_id, t.target_value)
                }
            })
        }

        console.log(`Loaded targets for ${targetMonth}/${targetYear}: ${targetMapPrimary.size} primary, ${targetMapAsSator.size} as_sator`)

        // 10. Build AREAS (SPV level)
        // Gabungkan data dari v_agg_monthly_spv_all + v_agg_monthly_sator_all (untuk SPV yang juga SATOR)
        const areas = spvIds.map(spvId => {
            const spv = spvMap.get(spvId)
            const hier = hierarchyMap.get(spvId)
            const areaName = hier?.area || spv?.name || 'Unknown'

            // Data dari SATOR di bawah SPV
            const spvAgg = spvAggMap.get(spvId) || {}
            // Data promotor langsung di bawah SPV (SPV sebagai SATOR)
            const satorAgg = spvAsSatorMap.get(spvId) || {}

            // Gabungkan kedua data
            return {
                user_id: spvId,
                name: areaName,
                spv_name: spv?.name || 'Unknown',
                role: 'area',
                total_input: (spvAgg.total_input || 0) + (satorAgg.total_input || 0),
                total_pending: (spvAgg.total_pending || 0) + (satorAgg.total_pending || 0),
                total_rejected: (spvAgg.total_rejected || 0) + (satorAgg.total_rejected || 0),
                total_closed: (spvAgg.total_closed || 0) + (satorAgg.total_closed || 0),
                target: targetMapPrimary.get(spvId) || 0,
                sator_count: (spvAgg.sator_count || 0),
                promotor_direct_count: satorAgg.promotor_count || 0
            }
        })

        // 11. Build SATORS (include SPVs with dual role)
        const regularSators = satorIds.map(satorId => {
            const user = userMap.get(satorId)
            const hier = hierarchyMap.get(satorId)
            const agg = satorAggMap.get(satorId) || {}
            const spvUser = spvMap.get(hier?.atasan_id)
            const spvHier = hierarchyMap.get(hier?.atasan_id)
            const areaName = spvHier?.area || spvUser?.name || 'Unknown'

            return {
                user_id: satorId,
                name: user?.name || 'Unknown',
                role: 'sator',
                area: areaName,
                spv_name: spvUser?.name || 'Unknown',
                total_input: agg.total_input || 0,
                total_pending: agg.total_pending || 0,
                total_rejected: agg.total_rejected || 0,
                total_closed: agg.total_closed || 0,
                target: targetMapPrimary.get(satorId) || 0,
                promotor_count: agg.promotor_count || 0
            }
        })

        // Add SPVs with dual role (those who have direct promotors = acting as SATOR)
        // Check hierarchy, not just aggregate data
        const spvDualRole = spvIds
            .filter(spvId => {
                // Check if this SPV has any direct promotor bawahan
                const hasDirectPromotor = promotorHierarchy.some(ph => ph.atasan_id === spvId)
                return hasDirectPromotor
            })
            .map(spvId => {
                const spv = spvMap.get(spvId)
                const hier = hierarchyMap.get(spvId)
                const agg = spvAsSatorMap.get(spvId) || {}
                const areaName = hier?.area || spv?.name || 'Unknown'

                return {
                    user_id: spvId,
                    name: spv?.name || 'Unknown',
                    role: 'spv', // Keep original role to identify dual-role in frontend
                    area: areaName,
                    spv_name: spv?.name || 'Unknown', // Self
                    total_input: agg.total_input || 0,
                    total_pending: agg.total_pending || 0,
                    total_rejected: agg.total_rejected || 0,
                    total_closed: agg.total_closed || 0,
                    target: targetMapAsSator.get(spvId) || targetMapPrimary.get(spvId) || 0,
                    promotor_count: agg.promotor_count || 0
                }
            })

        // Combine regular sators + SPV dual-role
        const sators = [...regularSators, ...spvDualRole]

        console.log(`Found ${spvDualRole.length} SPV with dual role (direct promotors)`)

        // 12. Build PROMOTORS
        const promotors = promotorIds.map(promotorId => {
            const user = userMap.get(promotorId)
            const hier = hierarchyMap.get(promotorId)
            const agg = promotorAggMap.get(promotorId) || {}

            // Find atasan (could be SATOR or SPV)
            const atasanId = hier?.atasan_id
            const atasan = userMap.get(atasanId)

            let spvName = 'Unknown'
            let satorName = 'Unknown'
            let areaName = 'Unknown'

            if (atasan?.role === 'sator') {
                satorName = atasan.name
                // Find SPV dari sator
                const satorHier = hierarchyMap.get(atasanId)
                const spv = spvMap.get(satorHier?.atasan_id)
                const spvHier = hierarchyMap.get(satorHier?.atasan_id)
                spvName = spv?.name || 'Unknown'
                areaName = spvHier?.area || spv?.name || 'Unknown'
            } else if (atasan?.role === 'spv') {
                // Promotor langsung di bawah SPV
                spvName = atasan.name
                satorName = atasan.name // SPV juga sebagai SATOR
                const spvHier = hierarchyMap.get(atasanId)
                areaName = spvHier?.area || atasan.name || 'Unknown'
            }

            return {
                user_id: promotorId,
                name: user?.name || 'Unknown',
                role: 'promotor',
                area: areaName,
                spv_name: spvName,
                sator_name: satorName,
                total_input: agg.total_input || 0,
                total_pending: agg.total_pending || 0,
                total_rejected: agg.total_rejected || 0,
                total_closed: agg.total_closed || 0,
                target: targetMapPrimary.get(promotorId) || 0
            }
        })

        console.log(`Result: ${areas.length} areas, ${sators.length} sators, ${promotors.length} promotors`)

        return new Response(
            JSON.stringify({ areas, sators, promotors }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Manager dashboard error:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
