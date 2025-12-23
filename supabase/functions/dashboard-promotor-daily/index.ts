// VAST FINANCE - Dashboard Promotor Daily Edge Function
// Query v_agg_daily_promoter_all (VIEW gabungan old + new)
// Sesuai docs/README.md Section 4.4

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

    if (req.method === 'POST') {
      const body = await req.json()
      userId = body.userId
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

    // Tanggal hari ini
    const today = new Date().toISOString().split('T')[0]

    // Query VIEW gabungan (bukan tabel langsung)
    const { data, error } = await supabaseClient
      .from('v_agg_daily_promoter_all')
      .select('total_input, total_rejected, total_pending, total_closed, total_closing_direct, total_closing_followup')
      .eq('promoter_user_id', userId)
      .eq('agg_date', today)
      .single()

    if (error || !data) {
      return new Response(
        JSON.stringify({
          total_input: 0,
          total_rejected: 0,
          total_pending: 0,
          total_closed: 0,
          total_closing_direct: 0,
          total_closing_followup: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify(data),
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
