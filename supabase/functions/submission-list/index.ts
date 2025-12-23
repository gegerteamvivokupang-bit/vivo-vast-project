// VAST FINANCE - Submission List Edge Function
// Ambil daftar pengajuan individual dari NEW + OLD tables

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
    const { userId, month } = body

    console.log('Submission list request:', { userId, month })

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

    // Calculate date range for month filter
    let startDate = ''
    let endDate = ''
    if (month) {
      startDate = `${month}-01`
      const [year, monthNum] = month.split('-').map(Number)
      endDate = new Date(year, monthNum, 0).toISOString().split('T')[0]
    }

    // Query from vast_finance_data_new
    let queryNew = supabaseClient
      .from('vast_finance_data_new')
      .select('id, customer_name, customer_phone, sale_date, status, approval_status, transaction_status, limit_amount, dp_amount, tenor, pekerjaan, penghasilan, has_npwp, image_urls, created_at')
      .eq('created_by_user_id', userId)

    if (month) {
      queryNew = queryNew.gte('sale_date', startDate).lte('sale_date', endDate)
    }

    const { data: rawNewData, error: newError } = await queryNew

    if (newError) {
      console.error('Query new error:', newError)
    }

    // Transform new data to use normalized status logic
    // Frontend expects 'acc', 'pending', 'reject' in the status field
    const newData = (rawNewData || []).map((item: any) => {
      let displayStatus = item.status; // Default to legacy status

      // Override with normalized logic if available
      if (item.approval_status === 'approved') {
        if (item.transaction_status === 'closed') {
          displayStatus = 'acc';
        } else if (item.transaction_status === 'not_closed') {
          displayStatus = 'pending';
        }
      } else if (item.approval_status === 'rejected') {
        displayStatus = 'reject';
      }

      return {
        ...item,
        status: displayStatus
      };
    })

    // Query from vast_finance_data_old (check for mapped user or direct promoter_id)
    // First check if there's a mapping from new user_id to old promoter_id
    const { data: mappingData } = await supabaseClient
      .from('user_id_mapping')
      .select('old_id')
      .eq('new_id', userId)
      .single()

    const oldUserId = mappingData?.old_id || userId
    console.log('Using old_id for query:', oldUserId)

    let queryOld = supabaseClient
      .from('vast_finance_data_old')
      .select('id, sale_date, promoter_name, sale_id, created_at')
      .eq('promoter_id', oldUserId)

    if (month) {
      queryOld = queryOld.gte('sale_date', startDate).lte('sale_date', endDate)
    }

    const { data: oldDataRaw, error: oldError } = await queryOld

    if (oldError) {
      console.error('Query old error:', oldError)
    }

    // Transform old data to match new data structure
    // Old table doesn't have customer_name, show "Data Historis" with date for clarity
    const oldData = (oldDataRaw || []).map((item: any) => {
      const saleDate = new Date(item.sale_date)
      const formattedDate = saleDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
      return {
        id: item.id,
        customer_name: `Data Historis (${formattedDate})`,
        customer_phone: '-',
        sale_date: item.sale_date,
        status: 'acc', // Old data assumed as ACC
        limit_amount: 0,
        dp_amount: 0,
        tenor: 0,
        pekerjaan: '-',
        penghasilan: 0,
        has_npwp: false,
        image_urls: [],
        created_at: item.created_at,
        is_old_data: true // Flag untuk identifikasi data lama
      }
    })

    // Combine and sort by sale_date desc
    const allData = [
      ...(newData || []),
      ...(oldData || [])
    ].sort((a: any, b: any) => {
      const dateA = new Date(a.sale_date).getTime()
      const dateB = new Date(b.sale_date).getTime()
      return dateB - dateA
    })

    console.log('Submissions count - new:', newData?.length || 0, 'old:', oldData?.length || 0, 'total:', allData.length)

    return new Response(
      JSON.stringify({ success: true, data: allData }),
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
