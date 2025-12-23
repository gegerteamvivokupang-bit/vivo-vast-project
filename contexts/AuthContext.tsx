// VAST FINANCE - Auth Context Provider
// Global authentication state management

'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import type { UserProfile } from '@/types/database.types'

interface AuthContextType {
  user: UserProfile | null
  loading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({
  children,
  initialUser = null
}: {
  children: React.ReactNode
  initialUser?: UserProfile | null
}) {
  const [user, setUser] = useState<UserProfile | null>(initialUser)
  const [loading, setLoading] = useState(true)

  async function fetchCurrentUser(): Promise<boolean> {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
        cache: 'no-store'
      })

      if (!response.ok) {
        setUser(null)
        return false
      }

      const result = await response.json()

      if (result.success && result.user) {
        setUser(result.user)
        return true
      } else {
        setUser(null)
        return false
      }
    } catch {
      setUser(null)
      return false
    }
  }

  async function signOut() {
    setUser(null)

    // Clear auth cookies
    const cookies = document.cookie.split(';')
    for (const cookie of cookies) {
      const name = cookie.split('=')[0].trim()
      if (name.includes('auth-token')) {
        document.cookie = name + '=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
      }
    }

    window.location.href = '/login'
  }

  async function refreshProfile() {
    await fetchCurrentUser()
  }

  useEffect(() => {
    async function initSession() {
      await new Promise(r => setTimeout(r, 100))
      await fetchCurrentUser()
      setLoading(false)
    }

    initSession()
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
