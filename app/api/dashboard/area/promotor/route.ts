// VAST FINANCE - Area Promotor Dashboard API
// Query agg_monthly_promoter untuk semua promotor di area (Manager)

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

    // Get user's area from hierarchy
    const { data: hierarchyData, error: hierarchyError } = await supabase
      .from('hierarchy')
      .select('area')
      .eq('user_id', auth.userId)
      .single()

    if (hierarchyError || !hierarchyData?.area) {
      return NextResponse.json([])
    }

    // Get all users in the area
    const { data: areaUsers, error: areaError } = await supabase
      .from('hierarchy')
      .select('user_id')
      .eq('area', hierarchyData.area)

    if (areaError || !areaUsers) {
      return NextResponse.json([])
    }

    const userIds = areaUsers.map((u) => u.user_id)

    // Get current month
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

    // Query aggregated data
    const { data: aggData, error: aggError } = await supabase
      .from('agg_monthly_promoter')
      .select('*')
      .in('promoter_user_id', userIds)
      .eq('agg_month', currentMonth)

    if (aggError) {
      return NextResponse.json([])
    }

    return NextResponse.json(aggData || [])
  } catch (error) {
    console.error('Area Promotor API error:', error)
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 })
  }
}
