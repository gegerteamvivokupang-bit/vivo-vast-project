// VAST FINANCE - Submission List Edge Function
// Fetch submissions for a specific promotor on a specific date
// Used by SPV/Manager to view promotor's daily submissions

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
        const body = await req.json()
        const { promotorId, date } = body

        if (!promotorId || !date) {
            return new Response(
                JSON.stringify({ success: false, message: 'Missing promotorId or date' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        console.log('Fetching submissions for promotor:', promotorId, 'date:', date)

        const { data, error } = await supabaseClient
            .from('vast_finance_data_new')
            .select('id, customer_name, customer_phone, sale_date, status, limit_amount, dp_amount, tenor, pekerjaan, penghasilan, has_npwp, image_urls, created_at')
            .eq('created_by_user_id', promotorId)
            .eq('sale_date', date)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Query error:', error)
            return new Response(
                JSON.stringify({ success: false, message: error.message }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log('Found submissions:', data?.length || 0)

        return new Response(
            JSON.stringify(data || []),
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
