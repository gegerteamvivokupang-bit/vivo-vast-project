// VAST FINANCE - PIN Verification API Route
// Verify email + PIN only, session akan dibuat di frontend
// Sesuai docs/AUTH_LOGIN_FLOW.md & docs/API_CONTRACT.md Section 4.1

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { email, pin } = await request.json()

    // Validasi input
    if (!email || !pin) {
      return NextResponse.json(
        { success: false, message: 'Email dan PIN wajib diisi' },
        { status: 400 }
      )
    }

    // Service Role client - untuk query users table (bypass RLS)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Step 1: Find user by email
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email, pin_hash, status, promotor_status, role, name, employee_id')
      .eq('email', email)
      .single()

    if (userError || !user) {
      console.log('❌ User not found:', email)
      return NextResponse.json(
        { success: false, message: 'Email atau PIN salah' },
        { status: 401 }
      )
    }

    console.log('🔍 User found:', user.email, user.role)

    // Step 2: Verify PIN
    // TODO: Implement bcrypt comparison in production
    const pinValid = user.pin_hash === pin

    if (!pinValid) {
      console.log('❌ PIN mismatch for:', user.email)
      return NextResponse.json(
        { success: false, message: 'Email atau PIN salah' },
        { status: 401 }
      )
    }

    console.log('✅ PIN verified for:', user.email)

    // Step 3: Check user status (AUTH_LOGIN_FLOW.md Section 9)
    if (user.status !== 'active') {
      return NextResponse.json(
        { success: false, message: 'Akun tidak aktif. Hubungi admin.' },
        { status: 403 }
      )
    }

    // Success! Return user info only
    // Session akan dibuat oleh frontend dengan signInWithPassword
    // AUTH_LOGIN_FLOW.md: PIN verified, frontend akan create Supabase session
    return NextResponse.json({
      success: true,
      email: user.email,
      userId: user.id,
      role: user.role,
      name: user.name,
      employee_id: user.employee_id,
      message: 'PIN verified. Proceed with session creation.',
    })
  } catch (error) {
    console.error('PIN verification error:', error)
    return NextResponse.json(
      { success: false, message: 'Server error' },
      { status: 500 }
    )
  }
}
