// VAST FINANCE - Daily Report API
// Get daily leaderboard data for team
// Query v_agg_daily_promoter_all (VIEW gabungan old + new)

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

    // Get date from query params or use today (WITA timezone)
    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date') // Format: YYYY-MM-DD

    let targetDate: string
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      targetDate = dateParam
    } else {
      targetDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Makassar',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(new Date())
    }

    // Get user info
    const { data: userData } = await supabase
      .from('users')
      .select('id, name, role')
      .eq('id', auth.userId)
      .single()

    if (!userData) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })
    }

    // Get team members based on role
    let promotorIds: string[] = []

    if (userData.role === 'spv' || userData.role === 'sator') {
      const { data: teamMembers } = await supabase
        .from('hierarchy')
        .select('user_id')
        .eq('atasan_id', auth.userId)

      promotorIds = (teamMembers || []).map(m => m.user_id).filter(Boolean)
    } else if (userData.role === 'manager' || userData.role === 'admin') {
      // Get user's area
      const { data: hierarchyData } = await supabase
        .from('hierarchy')
        .select('area')
        .eq('user_id', auth.userId)
        .single()

      if (hierarchyData?.area) {
        const { data: areaMembers } = await supabase
          .from('hierarchy')
          .select('user_id')
          .eq('area', hierarchyData.area)

        promotorIds = (areaMembers || []).map(m => m.user_id).filter(Boolean)
      }
    }

    if (promotorIds.length === 0) {
      return NextResponse.json({
        date: targetDate,
        supervisor: userData.name,
        leaderboard: [],
        totals: { target: 0, input: 0, acc: 0, pending: 0, reject: 0 }
      })
    }

    // Get promotor details
    const { data: promotorUsers } = await supabase
      .from('users')
      .select('id, name')
      .in('id', promotorIds)
      .eq('role', 'promotor')

    // Get daily aggregate data from VIEW
    const { data: aggData } = await supabase
      .from('v_agg_daily_promoter_all')
      .select('*')
      .in('promoter_user_id', promotorIds)
      .eq('agg_date', targetDate)

    // Get monthly targets
    const targetMonth = targetDate.substring(0, 7) + '-01'
    const { data: targetsData } = await supabase
      .from('targets')
      .select('user_id, target_value')
      .in('user_id', promotorIds)
      .eq('month', targetMonth)

    const aggMap = new Map((aggData || []).map(row => [row.promoter_user_id, row]))
    const targetMap = new Map((targetsData || []).map(t => [t.user_id, t.target_value]))

    // Build leaderboard
    const leaderboard = (promotorUsers || []).map(user => {
      const agg = aggMap.get(user.id)
      return {
        id: user.id,
        name: user.name || 'Unknown',
        target: targetMap.get(user.id) || 0,
        input: agg?.total_input || 0,
        acc: agg?.total_closed || 0,
        pending: agg?.total_pending || 0,
        reject: agg?.total_rejected || 0,
      }
    }).sort((a, b) => b.input - a.input) // Sort by input descending

    // Calculate totals
    const totals = leaderboard.reduce(
      (acc, p) => ({
        target: acc.target + p.target,
        input: acc.input + p.input,
        acc: acc.acc + p.acc,
        pending: acc.pending + p.pending,
        reject: acc.reject + p.reject,
      }),
      { target: 0, input: 0, acc: 0, pending: 0, reject: 0 }
    )

    return NextResponse.json({
      date: targetDate,
      supervisor: userData.name,
      leaderboard,
      totals
    })
  } catch (error) {
    console.error('Daily report API error:', error)
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 })
  }
}
