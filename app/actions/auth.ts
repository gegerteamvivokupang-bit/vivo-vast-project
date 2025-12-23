// VAST FINANCE - Server Actions for Authentication
// Cookie-based auth karena @supabase/ssr v0.0.10 tidak auto-set cookies

'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function signInAction(formData: FormData) {
    const email = formData.get('email') as string
    const pin = formData.get('pin') as string

    if (!email || !pin) {
        return { success: false, error: 'Email dan PIN wajib diisi' }
    }

    const cookieStore = await cookies()

    // Supabase client dengan service role untuk verify PIN
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        cookieStore.set(name, value, options)
                    )
                },
            },
        }
    )

    // Find user by email
    const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, email, pin_hash, status, role, name')
        .eq('email', email)
        .single()

    if (userError || !user) {
        return { success: false, error: 'Email atau PIN salah' }
    }

    // Verify PIN
    if (user.pin_hash !== pin) {
        return { success: false, error: 'Email atau PIN salah' }
    }

    // Check user status
    if (user.status !== 'active') {
        return { success: false, error: 'Akun tidak aktif. Hubungi admin.' }
    }

    // Sign in with Supabase Auth (password = email)
    const supabaseAuth = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        cookieStore.set(name, value, options)
                    )
                },
            },
        }
    )

    const { data: authData, error: signInError } = await supabaseAuth.auth.signInWithPassword({
        email: user.email,
        password: user.email,
    })

    if (signInError || !authData.session) {
        return {
            success: false,
            error: 'Login gagal. Hubungi admin.'
        }
    }

    // Set auth cookie manually (karena @supabase/ssr v0.0.10 tidak auto-set)
    const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL!.split('//')[1].split('.')[0]
    const cookieName = `sb-${projectRef}-auth-token`

    const cookieValue = JSON.stringify({
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        expires_at: authData.session.expires_at,
        expires_in: authData.session.expires_in,
        token_type: authData.session.token_type,
        user: authData.session.user
    })

    cookieStore.set(cookieName, cookieValue, {
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        httpOnly: false
    })

    // Role-based redirect
    const roleRoutes: Record<string, string> = {
        promotor: '/dashboard/promotor',
        spv: '/dashboard/team',
        sator: '/dashboard/team',
        manager: '/dashboard/area',
        admin: '/admin',
    }

    return {
        success: true,
        redirectTo: roleRoutes[user.role] || '/dashboard/promotor',
        role: user.role
    }
}

export async function changePinAction(formData: FormData) {
    const currentPin = formData.get('currentPin') as string
    const newPin = formData.get('newPin') as string
    const confirmPin = formData.get('confirmPin') as string

    // Validation
    if (!currentPin || !newPin || !confirmPin) {
        return { success: false, error: 'Semua field wajib diisi' }
    }

    if (newPin !== confirmPin) {
        return { success: false, error: 'PIN baru dan konfirmasi tidak cocok' }
    }

    if (newPin.length < 4 || newPin.length > 6) {
        return { success: false, error: 'PIN harus 4-6 digit' }
    }

    if (!/^\d+$/.test(newPin)) {
        return { success: false, error: 'PIN harus berupa angka' }
    }

    if (currentPin === newPin) {
        return { success: false, error: 'PIN baru tidak boleh sama dengan PIN lama' }
    }

    const cookieStore = await cookies()

    // Get current user from auth cookie
    const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL!.split('//')[1].split('.')[0]
    const cookieName = `sb-${projectRef}-auth-token`
    const authCookie = cookieStore.get(cookieName)

    if (!authCookie?.value) {
        return { success: false, error: 'Sesi tidak valid. Silakan login ulang.' }
    }

    let userId: string
    try {
        const session = JSON.parse(authCookie.value)
        userId = session.user?.id
        if (!userId) {
            return { success: false, error: 'Sesi tidak valid. Silakan login ulang.' }
        }
    } catch {
        return { success: false, error: 'Sesi tidak valid. Silakan login ulang.' }
    }

    // Supabase client with service role
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        cookieStore.set(name, value, options)
                    )
                },
            },
        }
    )

    // Get current user and verify current PIN
    const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, pin_hash')
        .eq('id', userId)
        .single()

    if (userError || !user) {
        return { success: false, error: 'User tidak ditemukan' }
    }

    // Verify current PIN
    if (user.pin_hash !== currentPin) {
        return { success: false, error: 'PIN saat ini salah' }
    }

    // Update to new PIN
    const { error: updateError } = await supabase
        .from('users')
        .update({ pin_hash: newPin })
        .eq('id', userId)

    if (updateError) {
        console.error('[ChangePIN] Error:', updateError)
        return { success: false, error: 'Gagal mengubah PIN. Silakan coba lagi.' }
    }

    return { success: true, message: 'PIN berhasil diubah' }
}
