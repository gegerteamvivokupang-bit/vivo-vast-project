// VAST FINANCE - Dashboard Promotor Monthly Edge Function
// Query v_agg_monthly_promoter_all (VIEW gabungan old + new)
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

    // Bulan ini (format: YYYY-MM-01 untuk tipe DATE)
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

    // Query VIEW gabungan (tanpa target karena tidak ada di view)
    const { data, error } = await supabaseClient
      .from('v_agg_monthly_promoter_all')
      .select('total_input, total_rejected, total_pending, total_closed, total_closing_direct, total_closing_followup')
      .eq('promoter_user_id', userId)
      .eq('agg_month', currentMonth)
      .single()

    if (error || !data) {
      return new Response(
        JSON.stringify({
          total_input: 0,
          total_pending: 0,
          total_closed: 0,
          total_closing_direct: 0,
          total_closing_followup: 0,
          target: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch target dari tabel targets jika ada (use YYYY-MM format)
    let target = 0
    const { data: targetData } = await supabaseClient
      .from('targets')
      .select('target_value')
      .eq('user_id', userId)
      .eq('month', currentMonth.substring(0, 7))
      .single()

    if (targetData?.target_value) {
      target = targetData.target_value
    }

    return new Response(
      JSON.stringify({ ...data, target }),
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
