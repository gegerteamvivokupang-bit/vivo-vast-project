import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { ToastProvider } from '@/components/ui/toast'
import { ConfirmProvider } from '@/components/ui/confirm'
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'

// Load Modern font
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'VAST Finance',
  description: 'Finance Tracking & Monitoring System',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'VAST Finance',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#7c3aed',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="id" className={inter.variable}>
      <body className={`${inter.className} bg-background text-foreground antialiased`}>
        <AuthProvider initialUser={null}>
          <ToastProvider>
            <ConfirmProvider>
              <div className="mx-auto min-h-screen max-w-md bg-background">
                {children}
              </div>
            </ConfirmProvider>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
