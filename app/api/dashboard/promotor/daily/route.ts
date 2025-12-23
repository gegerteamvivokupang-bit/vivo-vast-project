// VAST FINANCE - Promotor Daily Dashboard API
// Query agg_daily_promoter untuk user saat ini

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

    const today = new Date().toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('agg_daily_promoter')
      .select('*')
      .eq('promoter_user_id', auth.userId)
      .eq('agg_date', today)
      .single()

    if (error) {
      return NextResponse.json({
        total_input: 0,
        total_pending: 0,
        total_closed: 0,
        total_closing_direct: 0,
        total_closing_followup: 0,
      })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Promotor daily API error:', error)
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 })
  }
}
