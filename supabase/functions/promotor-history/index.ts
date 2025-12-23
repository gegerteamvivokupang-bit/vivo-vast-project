// VAST FINANCE - Promotor History Edge Function
// Query v_agg_monthly_promoter_all dan v_agg_daily_promoter_all (VIEW gabungan)
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
    const body = await req.json()
    const { userId, month, type = 'monthly' } = body

    console.log('Request params:', { userId, month, type })

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

    let data = null
    let error = null

    if (type === 'monthly') {
      if (month) {
        const monthDate = `${month}-01`
        const result = await supabaseClient
          .from('v_agg_monthly_promoter_all')
          .select('*')
          .eq('promoter_user_id', userId)
          .eq('agg_month', monthDate)
          .single()

        data = result.data
        error = result.error
      } else {
        const result = await supabaseClient
          .from('v_agg_monthly_promoter_all')
          .select('*')
          .eq('promoter_user_id', userId)
          .order('agg_month', { ascending: false })
          .limit(12)

        data = result.data
        error = result.error
      }
    } else if (type === 'daily') {
      if (!month) {
        return new Response(
          JSON.stringify({ success: false, message: 'Month required for daily view' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Query tanpa filter tanggal dulu, hanya filter user
      const result = await supabaseClient
        .from('v_agg_daily_promoter_all')
        .select('*')
        .eq('promoter_user_id', userId)
        .order('agg_date', { ascending: false })

      console.log('Daily query result count:', result.data?.length || 0)
      console.log('Daily query error:', result.error)

      // Filter by month di JavaScript
      if (result.data && result.data.length > 0) {
        data = result.data.filter((row: { agg_date: string }) => {
          const rowMonth = row.agg_date.substring(0, 7) // "2025-11-01" -> "2025-11"
          return rowMonth === month
        })
        console.log('Filtered data count for month', month, ':', data.length)
      } else {
        data = []
      }
      error = result.error

    } else if (type === 'available_months') {
      const result = await supabaseClient
        .from('v_agg_monthly_promoter_all')
        .select('agg_month')
        .eq('promoter_user_id', userId)
        .order('agg_month', { ascending: false })

      data = result.data?.map((d: { agg_month: string }) => {
        const date = new Date(d.agg_month)
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      }) || []
      error = result.error
    }

    if (error && !data) {
      console.error('Query error:', error)
      return new Response(
        JSON.stringify({ success: false, message: 'Failed to fetch data', error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, data }),
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
