// VAST FINANCE - Team Daily Dashboard API
// Query agg_daily_promoter untuk team members (SPV/SATOR)

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

    // Get team members from hierarchy
    const { data: teamMembers, error: hierarchyError } = await supabase
      .from('hierarchy')
      .select('user_id')
      .eq('atasan_id', auth.userId)

    if (hierarchyError || !teamMembers || teamMembers.length === 0) {
      return NextResponse.json({ success: true, data: [] })
    }

    const teamMemberIds = teamMembers.map((m) => m.user_id)
    // FIX: Use WITA timezone instead of UTC toISOString
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Makassar',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date())

    const { data, error } = await supabase
      .from('agg_daily_promoter')
      .select('*')
      .in('promoter_user_id', teamMemberIds)
      .eq('agg_date', today)

    if (error) {
      return NextResponse.json({ success: true, data: [] })
    }

    return NextResponse.json({ success: true, data: data || [] })
  } catch (error) {
    console.error('Team daily API error:', error)
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 })
  }
}
