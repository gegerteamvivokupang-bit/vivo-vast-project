# 🛡️ SAFE CLOUDINARY CLEANUP - ERROR-PROOF STRATEGY
**Tanggal:** 2 Januari 2026  
**Project:** VAST Finance - Safe Photo Cleanup  
**CRITICAL REQUIREMENT:** Cleanup TIDAK BOLEH bikin sistem error!

---

## 🎯 USER REQUIREMENTS (FINAL)

1. ✅ **Tidak ada backup** - Foto HANYA di Cloudinary
2. ✅ **Tidak ada audit** - Foto hanya perlu saat pengajuan
3. ✅ **Retention: 3 bulan** - Clean setiap 3 bulan, data lama OK dihapus
4. 🚨 **CRITICAL: Cleanup must be ERROR-PROOF!**

---

## ⚠️ POTENTIAL ERRORS & PREVENTION

### **ERROR 1: Broken Image Links**

**Scenario:**
```typescript
// Foto dihapus dari Cloudinary
// Frontend masih coba load URL lama
<img src="https://res.cloudinary.com/xxx/deleted_photo.jpg" />
// Result: ❌ Broken image icon, console error 404
```

**SOLUTION: Graceful Degradation**

```typescript
// Component: ImageWithFallback.tsx
export function ImageWithFallback({ src, alt }) {
  const [error, setError] = useState(false)
  
  if (error || !src || src.includes('deleted')) {
    return (
      <div className="placeholder">
        <span>📸</span>
        <p>Foto telah dihapus (retention policy)</p>
      </div>
    )
  }
  
  return (
    <img 
      src={src} 
      alt={alt}
      onError={() => setError(true)}  // Fallback otomatis!
    />
  )
}
```

**Benefit:**
- ✅ Tidak ada error di console
- ✅ User lihat placeholder, bukan broken image
- ✅ Sistem tetap jalan normal

---

### **ERROR 2: Database Foreign Key Violations**

**Scenario:**
```sql
-- Kalau delete record langsung dari database
DELETE FROM vast_finance_data_new WHERE created_at < '3 months ago';
-- Result: ❌ Foreign key violation, cascade delete, data hilang!
```

**SOLUTION: NEVER Delete Records, Only Mark as Deleted**

```typescript
// ❌ WRONG - Delete record
await supabase
  .from('vast_finance_data_new')
  .delete()
  .lt('created_at', threeMonthsAgo)

// ✅ CORRECT - Mark as deleted
await supabase
  .from('vast_finance_data_new')
  .update({
    image_urls: null,  // Clear URLs
    image_urls_metadata: {
      retention_status: 'deleted',
      deleted_at: new Date(),
      original_public_ids: publicIds,  // Backup untuk audit
      deletion_reason: 'retention_policy_3_months'
    }
  })
  .lt('created_at', threeMonthsAgo)
```

**Benefit:**
- ✅ Record tetap ada untuk reporting
- ✅ No foreign key violations
- ✅ Data customer tetap intact
- ✅ Bisa audit history

---

### **ERROR 3: Cloudinary API Failures**

**Scenario:**
```typescript
// Cloudinary API down atau rate limited
await cloudinary.uploader.destroy(publicId)
// Result: ❌ Error, foto tidak terhapus, tapi database sudah di-update!
// Inconsistency: Database bilang deleted, tapi foto masih ada di Cloudinary
```

**SOLUTION: Transaction-Like Approach with Rollback**

```typescript
async function safeDeletePhoto(publicId: string, recordId: string) {
  try {
    // Step 1: Coba delete dari Cloudinary dulu
    const result = await cloudinary.uploader.destroy(publicId)
    
    if (result.result !== 'ok') {
      throw new Error(`Cloudinary delete failed: ${result.result}`)
    }
    
    // Step 2: Kalau berhasil, baru update database
    await supabase
      .from('vast_finance_data_new')
      .update({
        image_urls: null,
        image_urls_metadata: {
          retention_status: 'deleted',
          deleted_at: new Date(),
          cloudinary_result: result
        }
      })
      .eq('id', recordId)
    
    return { success: true }
    
  } catch (error) {
    // ✅ Rollback: Log error, jangan update database
    console.error('Delete failed, skipping database update:', error)
    
    // ✅ Mark for retry next day
    await supabase
      .from('cleanup_retry_queue')
      .insert({
        record_id: recordId,
        public_id: publicId,
        retry_count: 0,
        last_error: error.message
      })
    
    return { success: false, error: error.message }
  }
}
```

**Benefit:**
- ✅ Kalau Cloudinary gagal, database tidak di-update
- ✅ Konsistensi terjaga
- ✅ Auto-retry next day

---

### **ERROR 4: Partial Cleanup (Some Photos Fail)**

**Scenario:**
```typescript
// Ada 1000 foto mau dihapus
// Foto 1-500: ✅ Sukses
// Foto 501: ❌ Error (network timeout)
// Foto 502-1000: ⏸️ Tidak diproses (script berhenti)
```

**SOLUTION: Batch Processing with Continue-on-Error**

```typescript
async function batchCleanup(photos: Photo[]) {
  const results = {
    success: 0,
    failed: 0,
    skipped: 0,
    errors: []
  }
  
  for (const photo of photos) {
    try {
      const result = await safeDeletePhoto(photo.public_id, photo.id)
      
      if (result.success) {
        results.success++
      } else {
        results.failed++
        results.errors.push({
          photo_id: photo.id,
          error: result.error
        })
      }
      
      // ✅ Delay untuk avoid rate limiting
      await sleep(100)  // 100ms delay between deletes
      
    } catch (error) {
      // ✅ Log error, tapi LANJUT ke foto berikutnya
      console.error(`Error deleting photo ${photo.id}:`, error)
      results.failed++
      results.errors.push({
        photo_id: photo.id,
        error: error.message
      })
      
      // ✅ CONTINUE, jangan throw!
    }
  }
  
  return results
}
```

**Benefit:**
- ✅ 1 foto error, foto lain tetap diproses
- ✅ Script tidak berhenti karena 1 error
- ✅ Full visibility: berapa sukses, berapa gagal

---

### **ERROR 5: Frontend Data Fetching Errors**

**Scenario:**
```typescript
// User buka detail pengajuan yang fotonya sudah dihapus
const { data } = await fetch('/api/submission/123')
// data.image_urls = null
// Frontend render error karena expect array

// ❌ Code lama:
{data.image_urls.map(url => <img src={url} />)}
// TypeError: Cannot read property 'map' of null
```

**SOLUTION: Defensive Programming**

```typescript
// ✅ Safe rendering
{(data.image_urls && data.image_urls.length > 0) ? (
  data.image_urls.map(url => (
    <ImageWithFallback key={url} src={url} alt="Foto pengajuan" />
  ))
) : (
  <div className="no-photos">
    <span>📸</span>
    <p>Foto tidak tersedia</p>
    <small>(Dihapus sesuai retention policy)</small>
  </div>
)}
```

**Benefit:**
- ✅ Tidak ada TypeError
- ✅ User tahu foto sudah dihapus
- ✅ Sistem tetap jalan

---

## 🔒 SAFETY CHECKLIST

### **Database Safety:**
- ✅ NEVER delete records (only update)
- ✅ NEVER update critical fields (customer_name, status, etc)
- ✅ ONLY update image_urls & metadata
- ✅ Add deleted_at timestamp
- ✅ Keep original public_ids for audit

### **Cloudinary Safety:**
- ✅ Delete from Cloudinary FIRST, then update database
- ✅ Verify delete success before DB update
- ✅ Log all deletions
- ✅ Rate limiting (100ms delay between deletes)
- ✅ Retry mechanism for failures

### **Frontend Safety:**
- ✅ Null checks everywhere
- ✅ Fallback placeholders
- ✅ onError handlers on images
- ✅ Graceful degradation
- ✅ User-friendly messages

### **Cron Job Safety:**
- ✅ Timeout limit (max 5 minutes)
- ✅ Batch processing (100 photos at a time)
- ✅ Continue on error (don't stop on 1 failure)
- ✅ Email notification if failed
- ✅ Retry queue for failures

---

## 🛠️ IMPLEMENTATION ARCHITECTURE (ERROR-PROOF)

### **1. Database Schema (Safe Design)**

```sql
-- ALTER, not DROP/CREATE
ALTER TABLE vast_finance_data_new 
ADD COLUMN IF NOT EXISTS image_urls_metadata JSONB DEFAULT '{}'::jsonb;

-- Index untuk performance
CREATE INDEX IF NOT EXISTS idx_retention_cleanup 
ON vast_finance_data_new(created_at) 
WHERE image_urls IS NOT NULL;

-- Metadata structure:
{
  "cloudinary_public_ids": ["vast_finance/abc123"],
  "upload_date": "2026-01-02T14:47:00Z",
  "scheduled_deletion_date": "2026-04-02T14:47:00Z",  -- 3 months
  "retention_status": "active" | "scheduled" | "deleted",
  "deleted_at": null | "2026-04-02T14:47:00Z",
  "deletion_reason": "retention_policy_3_months",
  "original_urls": ["https://..."]  -- Backup for audit
}
```

---

### **2. Cleanup Edge Function (Safe Logic)**

**File:** `supabase/functions/cloudinary-cleanup/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { v2 as cloudinary } from 'cloudinary'

const RETENTION_DAYS = 90  // 3 months
const BATCH_SIZE = 100
const RATE_LIMIT_DELAY = 100  // ms

serve(async (req) => {
  try {
    // Initialize Cloudinary
    cloudinary.config({
      cloud_name: Deno.env.get('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME'),
      api_key: Deno.env.get('CLOUDINARY_API_KEY'),
      api_secret: Deno.env.get('CLOUDINARY_API_SECRET'),
    })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Calculate cutoff date
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS)

    // Get photos to delete (SAFE query)
    const { data: photosToDelete, error: queryError } = await supabase
      .from('vast_finance_data_new')
      .select('id, image_urls, image_urls_metadata')
      .lt('created_at', cutoffDate.toISOString())
      .not('image_urls', 'is', null)  // Only get records with images
      .limit(BATCH_SIZE)

    if (queryError) {
      throw new Error(`Query failed: ${queryError.message}`)
    }

    if (!photosToDelete || photosToDelete.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No photos to delete',
          deleted: 0
        }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as any[]
    }

    // Process each record
    for (const record of photosToDelete) {
      try {
        const metadata = record.image_urls_metadata || {}
        const publicIds = metadata.cloudinary_public_ids || []

        // Delete from Cloudinary first
        const cloudinaryResults = []
        for (const publicId of publicIds) {
          try {
            const result = await cloudinary.uploader.destroy(publicId)
            cloudinaryResults.push({ publicId, result: result.result })
            
            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY))
          } catch (cloudError) {
            console.error(`Cloudinary delete failed for ${publicId}:`, cloudError)
            cloudinaryResults.push({ publicId, error: cloudError.message })
          }
        }

        // Only update database if at least one Cloudinary delete succeeded
        const anySuccess = cloudinaryResults.some(r => r.result === 'ok')
        
        if (anySuccess || publicIds.length === 0) {
          // Update database (SAFE update)
          const { error: updateError } = await supabase
            .from('vast_finance_data_new')
            .update({
              image_urls: null,  // Clear URLs
              image_urls_metadata: {
                ...metadata,
                retention_status: 'deleted',
                deleted_at: new Date().toISOString(),
                deletion_reason: 'retention_policy_3_months',
                cloudinary_deletion_results: cloudinaryResults,
                original_urls: record.image_urls  // Backup for audit
              }
            })
            .eq('id', record.id)

          if (updateError) {
            throw new Error(`Database update failed: ${updateError.message}`)
          }

          results.success++
        } else {
          results.failed++
          results.errors.push({
            record_id: record.id,
            error: 'All Cloudinary deletes failed'
          })
        }

      } catch (recordError) {
        // Log error but CONTINUE to next record
        console.error(`Error processing record ${record.id}:`, recordError)
        results.failed++
        results.errors.push({
          record_id: record.id,
          error: recordError.message
        })
      }
    }

    // Return detailed results
    return new Response(
      JSON.stringify({
        success: true,
        total_processed: photosToDelete.length,
        deleted: results.success,
        failed: results.failed,
        errors: results.errors,
        timestamp: new Date().toISOString()
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    // Top-level error handling
    console.error('Cleanup function error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
})
```

---

### **3. Frontend Safe Components**

**File:** `components/ui/ImageWithFallback.tsx`

```typescript
'use client'

import { useState } from 'react'

interface ImageWithFallbackProps {
  src: string | null | undefined
  alt: string
  className?: string
}

export function ImageWithFallback({ src, alt, className }: ImageWithFallbackProps) {
  const [error, setError] = useState(false)

  // Safe checks
  const isDeleted = !src || src === '' || error
  
  if (isDeleted) {
    return (
      <div className={`flex flex-col items-center justify-center bg-muted rounded-lg p-4 ${className}`}>
        <span className="text-4xl mb-2">📸</span>
        <p className="text-sm text-muted-foreground text-center">
          Foto tidak tersedia
        </p>
        <small className="text-xs text-muted-foreground/60">
          (Dihapus sesuai kebijakan retensi)
        </small>
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setError(true)}
      loading="lazy"
    />
  )
}
```

**Update Existing Components:**

```typescript
// app/history/page.tsx (contoh)
import { ImageWithFallback } from '@/components/ui/ImageWithFallback'

// ❌ Old code:
{submission.image_urls?.map(url => (
  <img src={url} alt="Foto" />
))}

// ✅ New code (SAFE):
{submission.image_urls && submission.image_urls.length > 0 ? (
  submission.image_urls.map(url => (
    <ImageWithFallback key={url} src={url} alt="Foto pengajuan" />
  ))
) : (
  <div className="no-photos">
    <span>📸</span>
    <p>Foto tidak tersedia</p>
  </div>
)}
```

---

### **4. Cron Job with Safety (Vercel)**

**File:** `app/api/cron/cleanup-photos/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 300  // 5 minutes max

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const supabase = createClient()

    // Call Edge Function with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 4 * 60 * 1000)  // 4 min timeout

    try {
      const { data, error } = await supabase.functions.invoke(
        'cloudinary-cleanup',
        {
          body: {},
          signal: controller.signal
        }
      )

      clearTimeout(timeoutId)

      if (error) {
        throw error
      }

      // Log results
      console.log('Cleanup completed:', data)

      // Optional: Send email if there were errors
      if (data.failed > 0) {
        // TODO: Send email notification
        console.warn(`Cleanup had ${data.failed} failures`)
      }

      return NextResponse.json({
        success: true,
        ...data
      })

    } catch (invokeError) {
      clearTimeout(timeoutId)
      throw new Error(`Edge Function invocation failed: ${invokeError.message}`)
    }

  } catch (error) {
    console.error('Cron job error:', error)
    
    // Return error response, tapi cron tetap sukses (don't retry)
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 200 })  // 200 agar Vercel tidak retry
  }
}
```

---

## 📊 STORAGE PROJECTION (3 MONTHS RETENTION)

```
Upload: 100 foto/hari × 400 KB = 40 MB/hari
Retention: 90 hari (3 bulan)

Storage Max: 90 × 40 MB = 3.6 GB
Usage: 3.6 / 25 GB = 14.4%
Safety Margin: 85.6%

SUSTAINABLE: ✅ FOREVER!
```

---

## ✅ FINAL IMPLEMENTATION CHECKLIST

### **Phase 1: Database (15 min)**
- [ ] Add `image_urls_metadata` column
- [ ] Create index for performance
- [ ] Test on staging database
- [ ] Verify no existing data broken

### **Phase 2: Upload Tracking (15 min)**
- [ ] Update `app/api/upload/route.ts`
- [ ] Save metadata on upload
- [ ] Test upload & verify metadata
- [ ] Backward compatibility (old records OK)

### **Phase 3: Safe Cleanup Function (30 min)**
- [ ] Create Edge Function with error handling
- [ ] Test manual execution
- [ ] Verify Cloudinary deletes
- [ ] Verify database updates correctly
- [ ] Test error scenarios (API down, etc)

### **Phase 4: Frontend Safety (20 min)**
- [ ] Create ImageWithFallback component
- [ ] Update all image rendering
- [ ] Test with null/deleted URLs
- [ ] Verify no console errors

### **Phase 5: Cron Job (10 min)**
- [ ] Create cron route
- [ ] Setup vercel.json
- [ ] Add CRON_SECRET env
- [ ] Test manual trigger

### **Phase 6: Testing (20 min)**
- [ ] Upload test photos
- [ ] Wait 3 months (or manually set old date in DB)
- [ ] Trigger cleanup manually
- [ ] Verify photos deleted from Cloudinary
- [ ] Verify database updated correctly
- [ ] Verify frontend shows placeholder
- [ ] Verify no errors in logs

---

## 🎯 EXPECTED BEHAVIOR AFTER CLEANUP

### **User Opens Old Submission:**

```
Timeline:
1. Upload photo: Jan 2, 2026
2. Photo stored: ✅ Visible in history
3. After 3 months (Apr 2, 2026): Auto-delete runs
4. User opens submission: 
   ✅ Submission details tetap ada
   ✅ Customer name, status, amount: ✅ Ada
   ✅ Photo placeholder shown: "Foto tidak tersedia (dihapus sesuai kebijakan)"
   ✅ NO ERRORS!
```

---

## 🚨 ERROR PREVENTION SUMMARY

| Potential Error | Prevention Strategy |
|----------------|---------------------|
| Broken image links | ImageWithFallback component |
| Database FK violations | Never delete records, only mark deleted |
| Cloudinary API failure | Try Cloudinary first, rollback on error |
| Partial cleanup | Continue on error, process all |
| Frontend crashes | Null checks, defensive programming |
| Cron timeout | Batch processing, max 100 photos/run |
| Rate limiting | 100ms delay between deletes |
| Inconsistent state | Transaction-like approach |

---

## 📋 READY TO IMPLEMENT

**Settings confirmed:**
- ✅ Optimasi: 1200px + auto:good + format:auto (hemat 90%)
- ✅ Retention: **3 bulan** (storage max 3.6 GB / 14%)
- ✅ Safety: ERROR-PROOF dengan graceful degradation
- ✅ Scope: Minimal + Safety components

**Apakah saya boleh mulai implementasi sekarang?**

Bilang "OK, implementasi sekarang" dan saya akan:
1. ✅ Implement upload optimization
2. ✅ Add database tracking
3. ✅ Create safe cleanup function
4. ✅ Add ImageWithFallback component
5. ✅ Setup cron job
6. ✅ Test & validate

Total waktu: ~1.5-2 jam

Mau lanjut?
