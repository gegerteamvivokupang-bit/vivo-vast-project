// VAST FINANCE - Manager Area Daily Dashboard Edge Function (TURBO OPTIMIZED)
// Data HARIAN lengkap: Area → Sator → Promotor dengan breakdown status
// Untuk halaman /dashboard/area/daily
// OPTIMIZED: Single RPC call replaces 5+ nested loops

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

        // Get today's date in WITA timezone
        const today = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Makassar',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(new Date())

        console.log('Manager Daily Dashboard TURBO - Fetching for:', today)

        // TURBO QUERY: Single RPC call replaces MASSIVE nested loops
        // Old: Multiple queries + 3 levels of nested loops (SPV → SATOR → PROMOTOR)
        // New: 1 RPC call with complete hierarchy pre-built
        const { data: fullHierarchy, error: rpcError } = await supabaseClient
            .rpc('get_manager_daily_hierarchy', {
                p_date: today
            })

        if (rpcError) {
            console.error('Turbo RPC error:', rpcError)
            return new Response(
                JSON.stringify({ error: rpcError.message }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Parse JSON response (RPC returns JSON string)
        const parsedData = typeof fullHierarchy === 'string'
            ? JSON.parse(fullHierarchy)
            : fullHierarchy;

        console.log(`TURBO Result: ${parsedData?.areas?.length || 0} areas, ${parsedData?.promotor_stats?.total || 0} promotors`)

        return new Response(
            JSON.stringify(parsedData),
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
