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

        // TURBO QUERY: Single RPC call replaces multiple queries + loop
        // Old: hierarchy query + user queries + loop through sators (N+1!) + manual mapping
        // New: 1 RPC call with all hierarchical data pre-joined and grouped
        const { data: teamData, error: rpcError } = await supabaseClient
            .rpc('get_team_daily_with_sators', {
                p_manager_id: userId,
                p_date: today
            })

        if (rpcError) {
            console.error('Turbo RPC error:', rpcError)
            return new Response(
                JSON.stringify({ success: false, message: 'Failed to fetch team data' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Data is already structured and ready
        const promotors = teamData?.promotors || []
        const sators = teamData?.sators || []

        console.log('Turbo Query returned:', promotors.length, 'promotors,', sators.length, 'sators')

        return new Response(
            JSON.stringify({
                promotors: promotors,
                sators: sators
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


