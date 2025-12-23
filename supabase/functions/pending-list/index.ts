// VAST FINANCE - Pending List Edge Function
// Ambil daftar transaksi pending untuk follow-up

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
    const { userId, storeId } = body

    console.log('Pending list request:', { userId, storeId })

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

    // Query pending transactions - ONLY for current user
    // Per DATABASE_NORMALIZED_SPEC.md: Pending = approved + not_closed
    const { data, error } = await supabaseClient
      .from('vast_finance_data_new')
      .select(`
        id,
        customer_name,
        customer_phone,
        sale_date,
        limit_amount,
        dp_amount,
        tenor,
        phone_type_id
      `)
      .eq('created_by_user_id', userId)
      .eq('approval_status', 'approved')
      .eq('transaction_status', 'not_closed')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Query error:', error)
      return new Response(
        JSON.stringify({ success: false, message: 'Failed to fetch pending list', error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Pending list for user ${userId}: ${data?.length || 0} records`)

    return new Response(
      JSON.stringify({ success: true, data: data || [] }),
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
