// VAST FINANCE - Manager Area Dashboard Edge Function (TURBO OPTIMIZED)
// Mengambil data semua AREA (SPV), SATOR, dan PROMOTOR untuk Manager
// OPTIMIZED: Single RPC call replaces 10+ sequential queries

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

        // Parse request body for month parameter
        let requestMonth = null;
        try {
            const body = await req.json();
            requestMonth = body?.month; // Format: "2024-12" 
        } catch {
            // No body, use current month
        }

        // Get current month in WITA (fallback)
        const witaDate = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Makassar',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(new Date());

        // Use requested month or fallback to current
        const currentMonth = requestMonth
            ? `${requestMonth}-01`  // "2024-12" -> "2024-12-01"
            : witaDate.substring(0, 7) + '-01';

        console.log('Manager Dashboard TURBO - Fetching for month:', currentMonth);

        // TURBO QUERY: Single RPC call replaces 10+ sequential queries
        // Old: SPV query + hierarchy + users + 3 aggregate views + targets + loops
        // New: 1 RPC call with complete hierarchy pre-built
        const { data: fullHierarchy, error: rpcError } = await supabaseClient
            .rpc('get_manager_monthly_hierarchy', {
                p_month: currentMonth
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

        console.log(`TURBO Result: ${parsedData?.areas?.length || 0} areas, ${parsedData?.sators?.length || 0} sators, ${parsedData?.promotors?.length || 0} promotors`);

        return new Response(
            JSON.stringify(parsedData),
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
