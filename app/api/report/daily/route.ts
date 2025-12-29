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
        totals: {
          target: 0,
          daily_input: 0,
          total_input: 0,
          daily_closed: 0,
          total_closed: 0,
          daily_pending: 0,
          total_pending: 0,
          daily_rejected: 0,
          total_rejected: 0
        }
      })
    }

    // Get promotor details
    const { data: promotorUsers } = await supabase
      .from('users')
      .select('id, name')
      .in('id', promotorIds)
      .eq('role', 'promotor')

    // Get daily aggregate data for TODAY
    const { data: dailyData } = await supabase
      .from('v_agg_daily_promoter_all')
      .select('*')
      .in('promoter_user_id', promotorIds)
      .eq('agg_date', targetDate)

    // Get cumulative monthly data from monthly view (use range query like team dashboard)
    const targetMonth = targetDate.substring(0, 7)  // 'YYYY-MM'
    const startDate = targetMonth + '-01'

    // Calculate next month for range query
    const [yearStr, monthStr] = targetMonth.split('-')
    let year = parseInt(yearStr)
    let month = parseInt(monthStr)
    month++ // next month
    if (month > 12) {
      month = 1
      year++
    }
    const endDate = `${year}-${String(month).padStart(2, '0')}-01`

    const { data: monthlyData } = await supabase
      .from('v_agg_monthly_promoter_all')
      .select('*')
      .in('promoter_user_id', promotorIds)
      .gte('agg_month', startDate)
      .lt('agg_month', endDate)

    // Get monthly targets (match team dashboard format)
    const { data: targetsData } = await supabase
      .from('targets')
      .select('user_id, target_value')
      .in('user_id', promotorIds)
      .eq('month', targetMonth)

    const dailyMap = new Map((dailyData || []).map(row => [row.promoter_user_id, row]))
    const monthlyMap = new Map((monthlyData || []).map(row => [row.promoter_user_id, row]))
    const targetMap = new Map((targetsData || []).map(t => [t.user_id, t.target_value]))

    // Build leaderboard with H/T/TGT format
    const leaderboard = (promotorUsers || []).map(user => {
      const daily = dailyMap.get(user.id)
      const monthly = monthlyMap.get(user.id) || { total_input: 0, total_closed: 0, total_pending: 0, total_rejected: 0 }
      return {
        id: user.id,
        name: user.name || 'Unknown',
        target: targetMap.get(user.id) || 0,
        daily_input: daily?.total_input || 0,
        total_input: monthly.total_input,
        daily_closed: daily?.total_closed || 0,
        total_closed: monthly.total_closed,
        daily_pending: daily?.total_pending || 0,
        total_pending: monthly.total_pending,
        daily_rejected: daily?.total_rejected || 0,
        total_rejected: monthly.total_rejected,
      }
    }).sort((a, b) => b.total_input - a.total_input) // Sort by monthly total

    // Calculate totals
    const totals = leaderboard.reduce(
      (acc, p) => ({
        target: acc.target + p.target,
        daily_input: acc.daily_input + p.daily_input,
        total_input: acc.total_input + p.total_input,
        daily_closed: acc.daily_closed + p.daily_closed,
        total_closed: acc.total_closed + p.total_closed,
        daily_pending: acc.daily_pending + p.daily_pending,
        total_pending: acc.total_pending + p.total_pending,
        daily_rejected: acc.daily_rejected + p.daily_rejected,
        total_rejected: acc.total_rejected + p.total_rejected,
      }),
      {
        target: 0,
        daily_input: 0,
        total_input: 0,
        daily_closed: 0,
        total_closed: 0,
        daily_pending: 0,
        total_pending: 0,
        daily_rejected: 0,
        total_rejected: 0
      }
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
