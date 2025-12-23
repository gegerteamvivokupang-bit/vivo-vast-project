// VAST FINANCE - Conversion Create Edge Function
// Convert transaksi pending → closing (follow-up)
// Sesuai docs/DATABASE_NORMALIZED_SPEC.md Section 6

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ConversionData {
  transactionId: string      // ID transaksi yang di-convert
  convertedByUserId: string  // User yang melakukan follow-up
  newDpAmount: number        // DP baru setelah conversion
  phoneTypeId?: string       // Tipe HP (jika berubah)
  tenor?: number             // Tenor (jika berubah)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body: ConversionData = await req.json()

    // Validasi
    if (!body.transactionId || !body.convertedByUserId || body.newDpAmount === undefined) {
      return new Response(
        JSON.stringify({ success: false, message: 'Missing required fields: transactionId, convertedByUserId, newDpAmount' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Get current transaction data
    const { data: transaction, error: fetchError } = await supabaseClient
      .from('vast_finance_data_new')
      .select('*')
      .eq('id', body.transactionId)
      .single()

    if (fetchError || !transaction) {
      return new Response(
        JSON.stringify({ success: false, message: 'Transaction not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // SECURITY: Validate ownership - only owner can convert their own data
    if (transaction.created_by_user_id !== body.convertedByUserId) {
      return new Response(
        JSON.stringify({ success: false, message: 'Unauthorized: You can only convert your own transactions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validasi: hanya pending yang bisa di-convert
    // Per DATABASE_NORMALIZED_SPEC.md: Pending = approved + not_closed
    if (transaction.approval_status !== 'approved' || transaction.transaction_status !== 'not_closed') {
      return new Response(
        JSON.stringify({ success: false, message: 'Only pending transactions (approved + not_closed) can be converted' }),
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

    const oldDpAmount = transaction.dp_amount || 0

    // 2. Update transaction to closed (follow-up)
    // Per DATABASE_NORMALIZED_SPEC.md: Set transaction_status='closed'
    const updateData: Record<string, unknown> = {
      transaction_status: 'closed',
      dp_amount: body.newDpAmount,
      updated_at: new Date().toISOString(),
    }

    if (body.phoneTypeId) {
      updateData.phone_type_id = body.phoneTypeId
    }
    if (body.tenor) {
      updateData.tenor = body.tenor
    }

    const { error: updateError } = await supabaseClient
      .from('vast_finance_data_new')
      .update(updateData)
      .eq('id', body.transactionId)

    if (updateError) {
      console.error('Update error:', updateError)
      return new Response(
        JSON.stringify({ success: false, message: 'Failed to update transaction', error: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Insert conversion record
    const { data: conversion, error: insertError } = await supabaseClient
      .from('conversions')
      .insert({
        transaction_id: body.transactionId,
        converted_by_user_id: body.convertedByUserId,
        old_dp_amount: oldDpAmount,
        new_dp_amount: body.newDpAmount,
        converted_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (insertError) {
      console.error('Insert conversion error:', insertError)
      // Rollback: kembalikan ke pending
      await supabaseClient
        .from('vast_finance_data_new')
        .update({ transaction_status: 'not_closed', dp_amount: oldDpAmount })
        .eq('id', body.transactionId)

      return new Response(
        JSON.stringify({ success: false, message: 'Failed to create conversion record', error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, data: conversion }),
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
