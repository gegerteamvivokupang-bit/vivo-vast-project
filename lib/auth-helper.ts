// VAST FINANCE - Auth Helper
// Helper untuk parsing auth cookie di API routes

import { NextRequest } from 'next/server'

interface AuthSession {
  userId: string
  email: string
  accessToken: string
}

export function getAuthFromCookie(request: NextRequest): AuthSession | null {
  const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL!.split('//')[1].split('.')[0]
  const cookieName = `sb-${projectRef}-auth-token`
  const authCookie = request.cookies.get(cookieName)

  if (!authCookie?.value) {
    return null
  }

  try {
    const session = JSON.parse(authCookie.value)

    // Cek expired
    if (session.expires_at && session.expires_at < Math.floor(Date.now() / 1000)) {
      return null
    }

    if (!session.user?.id) {
      return null
    }

    return {
      userId: session.user.id,
      email: session.user.email,
      accessToken: session.access_token
    }
  } catch {
    return null
  }
}
