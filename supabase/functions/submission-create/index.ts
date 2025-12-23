// VAST FINANCE - Submission Create Edge Function
// Insert pengajuan baru ke vast_finance_data_new
// Sesuai docs/DATABASE_NORMALIZED_SPEC.md

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SubmissionData {
  userId: string
  storeId: string
  customerName: string
  customerPhone: string
  imageUrls: string[] // Combined KTP + proof images
  pekerjaan: string
  penghasilan: number
  hasNpwp: boolean
  status: 'ACC' | 'Pending' | 'Reject'
  limitAmount?: number
  dpAmount?: number
  tenor?: number
  phoneTypeId?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body: SubmissionData = await req.json()

    // Validasi field wajib
    if (!body.userId || !body.storeId || !body.customerName ||
      !body.customerPhone || !body.pekerjaan || !body.status ||
      !body.imageUrls || body.imageUrls.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: 'Missing required fields or no images uploaded' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validasi field berdasarkan status
    if (body.status === 'ACC') {
      if (!body.limitAmount || (body.dpAmount === undefined || body.dpAmount === null) || !body.tenor || !body.phoneTypeId) {
        return new Response(
          JSON.stringify({ success: false, message: 'ACC status requires limit, DP, tenor, and phone type' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    if (body.status === 'Pending') {
      if (!body.limitAmount) {
        return new Response(
          JSON.stringify({ success: false, message: 'Pending status requires limit amount' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Validate store exists
    const { data: storeData, error: storeError } = await supabaseClient
      .from('stores')
      .select('id')
      .eq('id', body.storeId)
      .single()

    if (storeError || !storeData) {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid store ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate phone type exists (if provided)
    if (body.phoneTypeId) {
      const { data: phoneData, error: phoneError } = await supabaseClient
        .from('phone_types')
        .select('id')
        .eq('id', body.phoneTypeId)
        .single()

      if (phoneError || !phoneData) {
        return new Response(
          JSON.stringify({ success: false, message: 'Invalid phone type ID' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Mapping status ke format database (lowercase)
    // Database masih pakai kolom 'status' lama (acc, pending, reject)
    const statusMap: Record<string, string> = {
      'ACC': 'acc',
      'Pending': 'pending',
      'Reject': 'reject'
    }

    const dbStatus = statusMap[body.status]
    if (!dbStatus) {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid status' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Normalize phone number - add +62 prefix
    // Remove all non-digits, strip leading 62 or 0, then add +62
    let normalizedPhone = body.customerPhone.replace(/\D/g, '')

    if (normalizedPhone.startsWith('62')) {
      normalizedPhone = normalizedPhone.slice(2)
    } else if (normalizedPhone.startsWith('0')) {
      normalizedPhone = normalizedPhone.slice(1)
    }

    normalizedPhone = '+62' + normalizedPhone

    // Fix Timezone: Use WITA (Asia/Makassar) for sale_date
    const witaDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Makassar',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());

    // Insert ke vast_finance_data_new
    const { data, error } = await supabaseClient
      .from('vast_finance_data_new')
      .insert({
        created_by_user_id: body.userId,
        store_id: body.storeId,
        sale_date: witaDate,
        customer_name: body.customerName,
        customer_phone: normalizedPhone,
        image_urls: body.imageUrls, // Array of all uploaded images (KTP + proof)
        pekerjaan: body.pekerjaan,
        penghasilan: body.penghasilan,
        has_npwp: body.hasNpwp,
        limit_amount: body.limitAmount || null,
        dp_amount: body.dpAmount ?? null,
        tenor: body.tenor || null,
        phone_type_id: body.phoneTypeId || null,
        status: dbStatus, // Kolom legacy (acc, pending, reject)
        // Kolom normalized sesuai DATABASE_NORMALIZED_SPEC.md
        approval_status: dbStatus === 'reject' ? 'rejected' : 'approved',
        transaction_status: dbStatus === 'acc' ? 'closed' : 'not_closed'
      })
      .select()
      .single()

    if (error) {
      console.error('Insert error:', error)
      return new Response(
        JSON.stringify({ success: false, message: 'Failed to create submission', error: error.message }),
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
