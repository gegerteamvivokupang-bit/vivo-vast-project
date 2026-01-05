// VAST FINANCE - Store Detail API
// Get promotor list and their performance for a specific store

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthFromCookie } from '@/lib/auth-helper'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string }> }
) {
  try {
    const auth = getAuthFromCookie(request)

    if (!auth) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const { storeId } = await params

    if (!storeId) {
      return NextResponse.json({ success: false, message: 'Store ID required' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get store info
    const { data: storeInfo, error: storeError } = await supabase
      .from('stores')
      .select('id, name')
      .eq('id', storeId)
      .single()

    if (storeError || !storeInfo) {
      return NextResponse.json({ success: false, message: 'Store not found' }, { status: 404 })
    }

    // Get all promotors assigned to this store
    const { data: promotorHierarchy, error: hierarchyError } = await supabase
      .from('hierarchy')
      .select('user_id')
      .eq('store_id', storeId)

    if (hierarchyError) {
      console.error('Hierarchy error:', hierarchyError)
      return NextResponse.json({ success: false, message: 'Failed to fetch promotors' }, { status: 500 })
    }

    const promotorIds = (promotorHierarchy || []).map(h => h.user_id).filter(Boolean)

    // Get promotor details (only ACTIVE promotors)
    const { data: promotorUsers } = await supabase
      .from('users')
      .select('id, name, employee_id, role')
      .in('id', promotorIds)
      .eq('role', 'promotor')
      .eq('status', 'active')

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

    // Get aggregate data for promotors
    const { data: aggData } = await supabase
      .from('agg_monthly_promoter')
      .select('*')
      .in('promoter_user_id', promotorIds)
      .eq('agg_month', targetMonth)

    // Get targets
    const { data: targetsData } = await supabase
      .from('targets')
      .select('user_id, target_value')
      .in('user_id', promotorIds)
      .eq('month', targetMonth)

    const aggMap = new Map((aggData || []).map(row => [row.promoter_user_id, row]))
    const targetMap = new Map((targetsData || []).map(t => [t.user_id, t.target_value]))

    // Build promotor list with data
    const promotors = (promotorUsers || []).map(user => {
      const agg = aggMap.get(user.id)
      return {
        promoter_user_id: user.id,
        promoter_name: user.name || 'Unknown',
        employee_id: user.employee_id || '',
        total_input: agg?.total_input || 0,
        total_approved: agg?.total_approved || 0,
        total_rejected: agg?.total_rejected || 0,
        total_pending: agg?.total_pending || 0,
        total_closed: agg?.total_closed || 0,
        total_closing_direct: agg?.total_closing_direct || 0,
        total_closing_followup: agg?.total_closing_followup || 0,
        target: targetMap.get(user.id) || 0,
      }
    })

    // Calculate store totals
    const storeTotals = promotors.reduce(
      (acc, p) => ({
        total_input: acc.total_input + p.total_input,
        total_approved: acc.total_approved + p.total_approved,
        total_rejected: acc.total_rejected + p.total_rejected,
        total_pending: acc.total_pending + p.total_pending,
        total_closed: acc.total_closed + p.total_closed,
        total_closing_direct: acc.total_closing_direct + p.total_closing_direct,
        total_closing_followup: acc.total_closing_followup + p.total_closing_followup,
        target: acc.target + p.target,
      }),
      { total_input: 0, total_approved: 0, total_rejected: 0, total_pending: 0, total_closed: 0, total_closing_direct: 0, total_closing_followup: 0, target: 0 }
    )

    return NextResponse.json({
      store: {
        id: storeInfo.id,
        name: storeInfo.name,
        ...storeTotals,
      },
      promotors,
    })
  } catch (error) {
    console.error('Store detail API error:', error)
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 })
  }
}
