// VAST FINANCE - Login Page
// Email + PIN authentication using Server Action
// FIXED: Uses full page navigation after login

'use client'

import { useState, useTransition } from 'react'
import { signInAction } from '@/app/actions/auth'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'

export default function LoginPage() {
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(formData: FormData) {
    setError('')

    startTransition(async () => {
      const result = await signInAction(formData)

      if (result.success && result.redirectTo) {
        // CRITICAL: Use full page navigation to ensure cookies are properly sent
        // router.push() was causing timing issues where cookies weren't available
        console.log('[Login] Success! Redirecting to:', result.redirectTo)
        window.location.href = result.redirectTo
      } else if (result.error) {
        setError(result.error)
      }
    })
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-primary">VAST Finance</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Masukkan email dan PIN Anda
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4">
            <Alert type="error" message={error} onClose={() => setError('')} />
          </div>
        )}

        {/* Login Form */}
        <form action={handleSubmit} className="space-y-4">
          <Input
            type="email"
            name="email"
            label="Email"
            placeholder="email@example.com"
            required
            autoComplete="email"
          />

          <Input
            type="password"
            name="pin"
            label="PIN"
            placeholder="Masukkan PIN"
            required
            inputMode="numeric"
            maxLength={6}
            autoComplete="current-password"
          />

          <Button type="submit" variant="default" fullWidth loading={isPending}>
            Masuk
          </Button>
        </form>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Lupa PIN? Hubungi admin untuk reset
        </p>
      </div>
    </div>
  )
}
