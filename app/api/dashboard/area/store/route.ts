// VAST FINANCE - Area Store Dashboard API
// Query agg_monthly_store untuk area (Manager)

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthFromCookie } from '@/lib/auth-helper'

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthFromCookie(request)

    if (!auth) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get user's role and hierarchy info
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', auth.userId)
      .single()

    if (userError || !userData) {
      return NextResponse.json([])
    }

    // Get user's hierarchy data
    const { data: hierarchyData, error: hierarchyError } = await supabase
      .from('hierarchy')
      .select('area, store_id, atasan_id')
      .eq('user_id', auth.userId)
      .single()

    let storeIds: string[] = []

    if (userData.role === 'manager' || userData.role === 'admin') {
      // Manager/Admin: get all stores in their area
      if (hierarchyData?.area) {
        const { data: storesData } = await supabase
          .from('hierarchy')
          .select('store_id')
          .eq('area', hierarchyData.area)
          .not('store_id', 'is', null)

        storeIds = [...new Set((storesData || []).map((s) => s.store_id).filter(Boolean))]
      }
    } else if (userData.role === 'spv' || userData.role === 'sator') {
      // SPV/Sator: get stores from their team members
      const { data: teamMembers } = await supabase
        .from('hierarchy')
        .select('store_id')
        .eq('atasan_id', auth.userId)
        .not('store_id', 'is', null)

      storeIds = [...new Set((teamMembers || []).map((m) => m.store_id).filter(Boolean))]
    }

    if (storeIds.length === 0) {
      return NextResponse.json([])
    }

    // Get ALL store info (name, etc)
    const { data: storesInfo } = await supabase
      .from('stores')
      .select('id, name')
      .in('id', storeIds)

    // Get month from query params or use current month (WITA timezone)
    const { searchParams } = new URL(request.url)
    const monthParam = searchParams.get('month') // Format: YYYY-MM

    let targetMonth: string
    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      targetMonth = monthParam + '-01'
    } else {
      const witaDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Makassar',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(new Date())
      targetMonth = witaDate.substring(0, 7) + '-01'
    }

    // Query from agg_monthly_store
    const { data: aggData, error: aggError } = await supabase
      .from('agg_monthly_store')
      .select('*')
      .in('store_id', storeIds)
      .eq('agg_month', targetMonth)

    if (aggError) {
      console.error('Agg query error:', aggError)
    }

    // Create map of aggregate data by store_id
    const aggMap = new Map((aggData || []).map(row => [row.store_id, row]))

    // Return ALL stores, with 0 if no aggregate data
    const result = (storesInfo || []).map(store => {
      const agg = aggMap.get(store.id)
      return {
        store_id: store.id,
        store_name: store.name || 'Unknown Store',
        total_input: agg?.total_input || 0,
        total_approved: agg?.total_approved || 0,
        total_rejected: agg?.total_rejected || 0,
        total_pending: agg?.total_pending || 0,
        total_closed: agg?.total_closed || 0,
        total_closing_direct: agg?.total_closing_direct || 0,
        total_closing_followup: agg?.total_closing_followup || 0,
      }
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Area Store API error:', error)
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 })
  }
}
