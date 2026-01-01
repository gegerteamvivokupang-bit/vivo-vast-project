// VAST FINANCE - Auth Context Provider
// Global authentication state management
// IMPROVED: Better session handling to prevent 'wrong role' errors

'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { UserProfile } from '@/types/database.types'

interface AuthContextType {
  user: UserProfile | null
  loading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const MAX_RETRIES = 3
const RETRY_DELAY = 500

export function AuthProvider({
  children,
  initialUser = null
}: {
  children: React.ReactNode
  initialUser?: UserProfile | null
}) {
  const [user, setUser] = useState<UserProfile | null>(initialUser)
  const [loading, setLoading] = useState(true)

  const fetchCurrentUser = useCallback(async (retryCount = 0): Promise<boolean> => {
    try {
      // Add timestamp to prevent caching
      const response = await fetch(`/api/auth/me?_t=${Date.now()}`, {
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      })

      if (!response.ok) {
        // If unauthorized and retries left, try again
        if (response.status === 401 && retryCount < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, RETRY_DELAY))
          return fetchCurrentUser(retryCount + 1)
        }
        setUser(null)
        return false
      }

      const result = await response.json()

      if (result.success && result.user) {
        // Validate user has required fields
        if (!result.user.id || !result.user.role) {
          console.error('[AuthContext] Invalid user data - missing id or role')
          if (retryCount < MAX_RETRIES) {
            await new Promise(r => setTimeout(r, RETRY_DELAY))
            return fetchCurrentUser(retryCount + 1)
          }
          setUser(null)
          return false
        }

        setUser(result.user)
        return true
      } else {
        setUser(null)
        return false
      }
    } catch (error) {
      console.error('[AuthContext] Fetch error:', error)
      // Retry on network errors
      if (retryCount < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, RETRY_DELAY))
        return fetchCurrentUser(retryCount + 1)
      }
      setUser(null)
      return false
    }
  }, [])

  async function signOut() {
    setUser(null)

    // Clear auth cookies
    const cookies = document.cookie.split(';')
    for (const cookie of cookies) {
      const name = cookie.split('=')[0].trim()
      if (name.includes('auth-token') || name.includes('sb-')) {
        document.cookie = name + '=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
      }
    }

    // Clear localStorage/sessionStorage
    try {
      localStorage.removeItem('supabase.auth.token')
      sessionStorage.clear()
    } catch {
      // Ignore storage errors
    }

    window.location.href = '/login'
  }

  async function refreshProfile() {
    setLoading(true)
    await fetchCurrentUser()
    setLoading(false)
  }

  useEffect(() => {
    async function initSession() {
      // Small delay to ensure cookies are set
      await new Promise(r => setTimeout(r, 150))
      await fetchCurrentUser()
      setLoading(false)
    }

    initSession()
  }, [fetchCurrentUser])

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

