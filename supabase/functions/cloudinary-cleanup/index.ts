// Cloudinary Auto-Cleanup Edge Function
// Deletes photos older than retention period (90 days / 3 months)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RETENTION_DAYS = 90 // 3 months
const BATCH_SIZE = 500 // Max photos per run (safe from timeout)

// Extract public_id from Cloudinary URL
function extractPublicId(url: string): string | null {
    try {
        // URL format: https://res.cloudinary.com/{cloud}/image/upload/{transform}/{public_id}.{ext}
        const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.\w+$/)
        if (match && match[1]) {
            // Remove transformation params
            return match[1].replace(/^[^/]+\//, '')
        }
        return null
    } catch {
        return null
    }
}

serve(async (req) => {
    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        )

        // Calculate cutoff date (90 days ago)
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS)

        console.log(`Cleanup: Looking for photos older than ${cutoffDate.toISOString()}`)

        // Get old photos
        const { data: oldRecords, error: queryError } = await supabase
            .from('vast_finance_data_new')
            .select('id, image_urls, created_at')
            .lt('created_at', cutoffDate.toISOString())
            .not('image_urls', 'is', null)
            .limit(BATCH_SIZE)

        if (queryError) {
            throw new Error(`Query failed: ${queryError.message}`)
        }

        if (!oldRecords || oldRecords.length === 0) {
            console.log('No photos to delete')
            return new Response(
                JSON.stringify({
                    success: true,
                    message: 'No photos to delete',
                    deleted: 0,
                    timestamp: new Date().toISOString()
                }),
                { headers: { 'Content-Type': 'application/json' } }
            )
        }

        console.log(`Found ${oldRecords.length} records with old photos`)

        const results = {
            success: 0,
            failed: 0,
            errors: [] as any[]
        }

        // Process each record
        for (const record of oldRecords) {
            try {
                const imageUrls = record.image_urls || []

                // Extract public_ids from URLs
                const publicIds = imageUrls
                    .map((url: string) => extractPublicId(url))
                    .filter((id: string | null) => id !== null)

                console.log(`Record ${record.id}: Found ${publicIds.length} public IDs`)

                // Delete from Cloudinary using API (no SDK needed!)
                const cloudinaryResults = []
                const cloudName = Deno.env.get('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME')
                const apiKey = Deno.env.get('CLOUDINARY_API_KEY')
                const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET')

                for (const publicId of publicIds) {
                    try {
                        // Cloudinary delete API
                        const timestamp = Math.floor(Date.now() / 1000)
                        const signature = await crypto.subtle.digest(
                            'SHA-1',
                            new TextEncoder().encode(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`)
                        )
                        const signatureHex = Array.from(new Uint8Array(signature))
                            .map(b => b.toString(16).padStart(2, '0'))
                            .join('')

                        const formData = new FormData()
                        formData.append('public_id', publicId)
                        formData.append('timestamp', timestamp.toString())
                        formData.append('api_key', apiKey!)
                        formData.append('signature', signatureHex)

                        const response = await fetch(
                            `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`,
                            {
                                method: 'POST',
                                body: formData
                            }
                        )

                        const result = await response.json()
                        cloudinaryResults.push({ publicId, result: result.result })

                        // Rate limiting (100ms delay)
                        await new Promise(resolve => setTimeout(resolve, 100))

                    } catch (cloudError) {
                        console.error(`Cloudinary delete failed for ${publicId}:`, cloudError)
                        cloudinaryResults.push({ publicId, error: String(cloudError) })
                    }
                }

                // Check if any Cloudinary delete succeeded
                const anySuccess = cloudinaryResults.some(r => r.result === 'ok')

                if (anySuccess || publicIds.length === 0) {
                    // Update database: Clear URLs and mark as deleted
                    const { error: updateError } = await supabase
                        .from('vast_finance_data_new')
                        .update({
                            image_urls: null,
                            image_urls_metadata: {
                                retention_status: 'deleted',
                                deleted_at: new Date().toISOString(),
                                deletion_reason: 'retention_policy_3_months',
                                cloudinary_results: cloudinaryResults,
                                original_urls: imageUrls
                            }
                        })
                        .eq('id', record.id)

                    if (updateError) {
                        throw new Error(`DB update failed: ${updateError.message}`)
                    }

                    results.success++
                    console.log(`✅ Record ${record.id}: Deleted successfully`)
                } else {
                    results.failed++
                    results.errors.push({
                        record_id: record.id,
                        error: 'All Cloudinary deletes failed'
                    })
                    console.log(`❌ Record ${record.id}: All deletes failed`)
                }

            } catch (recordError) {
                console.error(`Error processing record ${record.id}:`, recordError)
                results.failed++
                results.errors.push({
                    record_id: record.id,
                    error: String(recordError)
                })
            }
        }

        console.log(`Cleanup complete: ${results.success} success, ${results.failed} failed`)

        return new Response(
            JSON.stringify({
                success: true,
                total_processed: oldRecords.length,
                deleted: results.success,
                failed: results.failed,
                errors: results.errors.length > 0 ? results.errors : undefined,
                timestamp: new Date().toISOString()
            }),
            { headers: { 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Cleanup function error:', error)
        return new Response(
            JSON.stringify({
                success: false,
                error: String(error),
                timestamp: new Date().toISOString()
            }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            }
        )
    }
})
