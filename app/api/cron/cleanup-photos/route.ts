import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'

export const maxDuration = 300 // 5 minutes max

export async function GET(request: NextRequest) {
    try {
        // Verify cron secret
        const authHeader = request.headers.get('authorization')
        const expectedAuth = `Bearer ${process.env.CRON_SECRET}`

        if (authHeader !== expectedAuth) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            )
        }

        console.log('Cloudinary cleanup triggered')

        const supabase = createClient()

        // Call Edge Function
        const { data, error } = await supabase.functions.invoke('cloudinary-cleanup')

        if (error) {
            throw new Error(`Edge Function error: ${error.message}`)
        }

        console.log('Cleanup result:', data)

        // Log if there were failures
        if (data.failed > 0) {
            console.warn(`⚠️ Cleanup had ${data.failed} failures`)
        }

        return NextResponse.json({
            success: true,
            ...data
        })

    } catch (error) {
        console.error('❌ Cron job error:', error)

        // Return 200 to prevent Vercel/GitHub retry
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        }, { status: 200 })
    }
}
