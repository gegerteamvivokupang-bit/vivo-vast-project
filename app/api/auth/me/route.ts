// VAST FINANCE - Me Endpoint
// Verifikasi session dan kembalikan profil user

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthFromCookie } from '@/lib/auth-helper'
import { UserProfile } from '@/types/database.types'

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthFromCookie(request)

    if (!auth) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: profile, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', auth.userId)
      .single()

    if (error || !profile) {
      return NextResponse.json(
        { success: false, message: 'Profile not found' },
        { status: 404 }
      )
    }

    if (profile.status !== 'active') {
      return NextResponse.json(
        { success: false, message: 'Account inactive' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      user: profile as UserProfile
    })

  } catch (error) {
    console.error('[API /auth/me] Error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
