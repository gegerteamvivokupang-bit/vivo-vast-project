// VAST FINANCE - Team Daily Dashboard Edge Function
// Query agg_daily_promoter untuk team members (SPV/SATOR)
// Mendukung mixed hierarchy: SPV -> SATOR -> PROMOTOR

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
        let userId: string | null = null
        let requestDate: string | null = null

        if (req.method === 'POST') {
            const body = await req.json()
            userId = body.userId
            requestDate = body.date // Format: "2024-12-24"
        }

        if (!userId) {
            return new Response(
                JSON.stringify({ success: false, message: 'Missing userId' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Fix Timezone: Use WITA (Asia/Makassar)
        const witaDate = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Makassar',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(new Date());

        // Use requested date or fallback to today in WITA
        const today = requestDate || witaDate;

        console.log('Team Daily - userId:', userId, 'date:', today);

        // 1. Get direct subordinates from hierarchy
        const { data: subordinates, error: hierarchyError } = await supabaseClient
            .from('hierarchy')
            .select('user_id')
            .eq('atasan_id', userId)

        if (hierarchyError) {
            console.error('Hierarchy error:', hierarchyError)
            return new Response(JSON.stringify([]), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        if (!subordinates || subordinates.length === 0) {
            console.log('No subordinates found')
            return new Response(JSON.stringify([]), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const subordinateIds = subordinates.map(s => s.user_id)

        // 2. Get User Details & Roles
        const { data: users, error: userError } = await supabaseClient
            .from('users')
            .select('id, name, employee_id, role')
            .in('id', subordinateIds)

        if (userError) {
            console.error('Users fetch error:', userError)
            return new Response(JSON.stringify([]), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const userMap = new Map((users || []).map(u => [u.id, u]))

        // Group IDs by role
        const promotorIds: string[] = []
        const satorIds: string[] = []

        users?.forEach(u => {
            if (u.role === 'promotor') promotorIds.push(u.id)
            else if (u.role === 'sator') satorIds.push(u.id)
        })

        console.log('Subordinates - Promotors:', promotorIds.length, 'Sators:', satorIds.length)

        // 3. For SATORs, get their promotors (second level)
        let secondLevelPromotorIds: string[] = []
        if (satorIds.length > 0) {
            const { data: satorPromotors } = await supabaseClient
                .from('hierarchy')
                .select('user_id')
                .in('atasan_id', satorIds)

            if (satorPromotors) {
                secondLevelPromotorIds = satorPromotors.map(p => p.user_id)
            }
        }

        // 4. Get all promotor user details (direct + second level)
        const allPromotorIds = [...promotorIds, ...secondLevelPromotorIds]

        let allPromotorUsers: any[] = []
        if (allPromotorIds.length > 0) {
            const { data: promotorUsers } = await supabaseClient
                .from('users')
                .select('id, name, employee_id, role')
                .in('id', allPromotorIds)

            allPromotorUsers = promotorUsers || []
            allPromotorUsers.forEach(u => userMap.set(u.id, u))
        }

        console.log('Total promotors to query:', allPromotorIds.length)

        // 5. Query daily aggregate for all promotors
        const allData: any[] = []

        if (allPromotorIds.length > 0) {
            const { data, error } = await supabaseClient
                .from('v_agg_daily_promoter_all')
                .select('*')
                .in('promoter_user_id', allPromotorIds)
                .eq('agg_date', today)

            if (error) {
                console.error('Query error:', error)
            }

            if (data) {
                data.forEach(item => {
                    const user = userMap.get(item.promoter_user_id)
                    allData.push({
                        promoter_user_id: item.promoter_user_id,
                        promoter_name: user?.name || 'Unknown',
                        employee_id: user?.employee_id || '',
                        total_input: item.total_input || 0,
                        total_rejected: item.total_rejected || 0,
                        total_pending: item.total_pending || 0,
                        total_closed: item.total_closed || 0,
                        total_closing_direct: item.total_closing_direct || 0,
                        total_closing_followup: item.total_closing_followup || 0,
                        agg_date: item.agg_date
                    })
                })
            }
        }

        // 6. Add promotors with zero data (ensure all team members appear)
        const existingIds = new Set(allData.map(d => d.promoter_user_id))

        allPromotorUsers.forEach(u => {
            if (!existingIds.has(u.id)) {
                allData.push({
                    promoter_user_id: u.id,
                    promoter_name: u.name,
                    employee_id: u.employee_id || '',
                    total_input: 0,
                    total_rejected: 0,
                    total_pending: 0,
                    total_closed: 0,
                    total_closing_direct: 0,
                    total_closing_followup: 0,
                    agg_date: today
                })
            }
        })

        // 7. Build promotor to sator mapping
        const promotorSatorMap = new Map<string, string>()
        for (const satorId of satorIds) {
            const { data: satorPromotors } = await supabaseClient
                .from('hierarchy')
                .select('user_id')
                .eq('atasan_id', satorId)

            satorPromotors?.forEach(p => {
                promotorSatorMap.set(p.user_id, satorId)
            })
        }

        // Add sator_id to each promotor
        const enrichedData = allData.map(p => ({
            ...p,
            sator_id: promotorSatorMap.get(p.promoter_user_id) || null
        }))

        // 8. Build sators list for tabs
        const satorsData = satorIds.map(satorId => {
            const sator = userMap.get(satorId)
            return {
                user_id: satorId,
                name: sator?.name || 'Unknown',
                promotor_ids: Array.from(promotorSatorMap.entries())
                    .filter(([, sid]) => sid === satorId)
                    .map(([pid]) => pid)
            }
        })

        console.log('Returning data count:', enrichedData.length, 'Sators:', satorsData.length)

        return new Response(
            JSON.stringify({
                promotors: enrichedData,
                sators: satorsData
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Edge function error:', error)
        return new Response(
            JSON.stringify({ success: false, message: 'Internal server error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})


