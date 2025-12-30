// VAST FINANCE - Team Monthly Dashboard Edge Function
// Query agg_monthly views untuk team members (SPV/SATOR)
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
        let requestMonth: string | null = null;
        let userId: string | null = null

        if (req.method === 'POST') {
            const body = await req.json()
            userId = body.userId
            requestMonth = body.month // Format: 'YYYY-MM'
        }

        // Calculate default month (This Month in WITA)
        const witaDate = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Makassar',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(new Date());

        // Use requested month or default to current month (ensure format YYYY-MM-01)
        const currentMonth = requestMonth ? `${requestMonth}-01` : (witaDate.substring(0, 7) + '-01');

        console.log('Fetching team for userId:', userId, 'month:', currentMonth);

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

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
            console.log('No subordinates found for:', userId)
            return new Response(JSON.stringify([]), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // TURBO QUERY: Single RPC call replaces 5 separate queries
        // Old: 5 queries (sator, promotor, spv views + 2 target queries)
        // New: 1 RPC call with all data pre-joined
        const { data: teamData, error: rpcError } = await supabaseClient
            .rpc('get_team_monthly_data', {
                p_manager_id: userId,
                p_month: currentMonth
            })

        if (rpcError) {
            console.error('Turbo RPC error:', rpcError)
            return new Response(
                JSON.stringify({ success: false, message: 'Failed to fetch team data' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Data is already merged and ready to use
        const subordinates = teamData || []
        const callerTarget = subordinates.length > 0 ? subordinates[0].manager_target : 0

        console.log('Turbo Query returned:', subordinates.length, 'team members, Caller target:', callerTarget)

        // Return response
        return new Response(
            JSON.stringify({
                subordinates: subordinates.map(item => ({
                    user_id: item.user_id,
                    name: item.name,
                    role: item.role,
                    employee_id: item.employee_id,
                    total_input: item.total_input,
                    total_rejected: item.total_rejected,
                    total_pending: item.total_pending,
                    total_closed: item.total_closed,
                    agg_month: item.agg_month,
                    target: item.target
                })),
                spvTarget: callerTarget,
                callerTarget: callerTarget
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
