# ⚠️ VERCEL CRON LIMITATIONS & ALTERNATIVE SOLUTIONS

## 🚨 VERCEL FREE TIER CRON LIMITS (Updated 2026)

### **HOBBY PLAN (Free) - VERY LIMITED:**

| Feature | Limit | Impact |
|---------|-------|--------|
| **Max Cron Jobs** | 2 per project | ⚠️ Sangat terbatas |
| **Frequency** | **1x per hari MAX** | ❌ **CRITICAL!** |
| **Timing Accuracy** | 1 jam window | ⚠️ Tidak presisi |
| **Max Duration** | 10-60 detik | ⚠️ Harus cepat |

**CRITICAL ISSUE:**
- ❌ Cron hanya bisa jalan **1x per hari**
- ❌ Kalau set lebih frequent (e.g., setiap jam) → **Deployment ERROR!**
- ❌ Timing tidak presisi (bisa delay 1 jam)

**Untuk cleanup foto, 1x per hari sebenarnya OK, TAPI:**
- ⚠️ Hanya 2 cron jobs per project (terbatas!)
- ⚠️ Kalau butuh cron lain (e.g., reminder, report) → sudah habis kuota!

---

## ✅ ALTERNATIVE SOLUTIONS (RECOMMENDED)

### **OPSI 1: GitHub Actions (FREE & UNLIMITED)** ⭐ **BEST!**

**Benefit:**
- ✅ **100% GRATIS selamanya** (untuk public/private repo)
- ✅ **UNLIMITED cron jobs**
- ✅ Support **any schedule** (setiap jam, menit, dll)
- ✅ **Presisi tinggi** (dalam menit)
- ✅ Easy to setup

**How it works:**
```yaml
# .github/workflows/cleanup-photos.yml
name: Cloudinary Cleanup

on:
  schedule:
    - cron: '0 2 * * *'  # Setiap hari jam 2 pagi UTC

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Cleanup
        run: |
          curl -X GET "https://your-app.vercel.app/api/cron/cleanup-photos" \
               -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

**Setup Steps:**
1. Create `.github/workflows/cleanup-photos.yml`
2. Add `CRON_SECRET` to GitHub Secrets
3. Push to GitHub
4. Done! Auto-jalan setiap hari

**Quota:**
- ✅ 2,000 menit/bulan (free)
- ✅ Request ke Vercel API hanya ~1 detik
- ✅ Bisa bikin **unlimited workflows**

---

### **OPSI 2: Supabase Edge Functions Cron (FREE)**

**Benefit:**
- ✅ **Gratis** di Supabase Free Tier
- ✅ Native integration dengan database
- ✅ Tidak perlu external service

**How it works:**
```typescript
// Supabase sudah ada pg_cron extension
// Setup cron langsung di database

-- Create cron job di Supabase
SELECT cron.schedule(
  'cloudinary-cleanup',
  '0 2 * * *',  -- Setiap hari jam 2 pagi
  $$ 
    SELECT net.http_post(
      url := 'https://your-supabase-project.supabase.co/functions/v1/cloudinary-cleanup',
      headers := '{"Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
    ) 
  $$
);
```

**Quota:**
- ✅ Included dalam Supabase Free (500k invocations/month)
- ✅ Native di database (tidak keluar network)

---

### **OPSI 3: EasyCron / Cron-job.org (FREE External)**

**Benefit:**
- ✅ Dedicated cron service (reliable)
- ✅ Free tier available
- ✅ Web UI untuk manage

**Quota:**
- EasyCron Free: 1 cron job, 1x/hari
- Cron-job.org Free: Up to 50 cron jobs!

**Setup:**
1. Register di cron-job.org
2. Add URL: `https://your-app.vercel.app/api/cron/cleanup-photos`
3. Add header: `Authorization: Bearer YOUR_SECRET`
4. Set schedule: Daily at 2 AM
5. Done!

---

## 📊 COMPARISON

| Solution | Free? | Frequency | Reliability | Setup Difficulty |
|----------|-------|-----------|-------------|------------------|
| **Vercel Cron** | ✅ | ❌ 1x/day only | ⚠️ Medium | Easy |
| **GitHub Actions** | ✅ | ✅ Any | ✅ High | Easy |
| **Supabase Cron** | ✅ | ✅ Any | ✅ High | Medium |
| **Cron-job.org** | ✅ | ✅ Any | ✅ High | Very Easy |

---

## 🎯 RECOMMENDED SOLUTION

### **USE: GitHub Actions** ⭐

**Why:**
1. ✅ **FREE FOREVER** (tidak ada hidden costs)
2. ✅ **UNLIMITED** cron jobs (bisa bikin banyak!)
3. ✅ **RELIABLE** (GitHub infrastructure)
4. ✅ **EASY** setup (copy-paste YAML)
5. ✅ **FLEXIBLE** schedule (bisa ubah kapan saja)
6. ✅ **TRANSPARENT** (bisa lihat logs di GitHub)

**Setup Time:** 5 menit!

---

## 🛠️ UPDATED IMPLEMENTATION PLAN

### **With GitHub Actions:**

**File 1:** `.github/workflows/cleanup-photos.yml`
```yaml
name: Daily Photo Cleanup

on:
  schedule:
    # Runs every day at 2 AM UTC (10 AM WIB)
    - cron: '0 2 * * *'
  
  # Allow manual trigger
  workflow_dispatch:

jobs:
  cleanup:
    runs-on: ubuntu-latest
    
    steps:
      - name: Trigger Cloudinary Cleanup
        run: |
          RESPONSE=$(curl -s -w "\n%{http_code}" \
            -X GET "https://your-app.vercel.app/api/cron/cleanup-photos" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}")
          
          HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
          BODY=$(echo "$RESPONSE" | head -n-1)
          
          echo "Response: $BODY"
          echo "Status Code: $HTTP_CODE"
          
          if [ "$HTTP_CODE" != "200" ]; then
            echo "Error: Cleanup failed with status $HTTP_CODE"
            exit 1
          fi
          
      - name: Notify on Failure
        if: failure()
        run: |
          echo "Cleanup job failed! Check logs above."
          # Optional: Send notification (email, Slack, etc)
```

**File 2:** `app/api/cron/cleanup-photos/route.ts` (SAME AS BEFORE)
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    // Verify secret
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient()
    const { data, error } = await supabase.functions.invoke('cloudinary-cleanup')

    if (error) throw error

    return NextResponse.json({
      success: true,
      ...data,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Cleanup error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
```

**Setup GitHub Secret:**
1. Go to GitHub repo → Settings → Secrets → Actions
2. Add new secret:
   - Name: `CRON_SECRET`
   - Value: (generate random string, same as in Vercel env)

---

## ✅ UPDATED CHECKLIST

### **Phase 1: Upload Optimization (15 min)**
- [ ] Update `app/api/upload/route.ts`
- [ ] Add resize + compression
- [ ] Save metadata

### **Phase 2: Database Schema (10 min)**
- [ ] Add `image_urls_metadata` column
- [ ] Create index

### **Phase 3: Cleanup Function (30 min)**
- [ ] Create Edge Function `cloudinary-cleanup`
- [ ] Test manually

### **Phase 4: API Route (10 min)**
- [ ] Create `app/api/cron/cleanup-photos/route.ts`
- [ ] Add CRON_SECRET env variable (Vercel)

### **Phase 5: GitHub Actions (5 min)** ⭐ NEW!
- [ ] Create `.github/workflows/cleanup-photos.yml`
- [ ] Add CRON_SECRET to GitHub Secrets
- [ ] Push to GitHub
- [ ] Test manual trigger

### **Phase 6: Frontend Safety (20 min)**
- [ ] Create `ImageWithFallback.tsx`
- [ ] Update all components

### **Phase 7: Testing (15 min)**
- [ ] Manual trigger dari GitHub Actions
- [ ] Verify cleanup works
- [ ] Check logs

---

## 🎉 FINAL SOLUTION

**Architecture:**
```
GitHub Actions (FREE cron scheduler)
    ↓ (Daily at 2 AM)
HTTP Request to Vercel API
    ↓
/api/cron/cleanup-photos (Vercel serverless)
    ↓
Invoke Supabase Edge Function
    ↓
cloudinary-cleanup (Delete photos)
    ↓
Update Database (Mark as deleted)
```

**Benefits:**
- ✅ **100% FREE** (no hidden costs)
- ✅ **UNLIMITED** schedule flexibility
- ✅ **RELIABLE** (GitHub + Vercel + Supabase)
- ✅ **SIMPLE** (copy-paste setup)
- ✅ **SUSTAINABLE** sampai kiamat! ♾️

---

## 📝 READY TO IMPLEMENT

**Total Time:** ~1.5 jam
**Cost:** $0 (FREE FOREVER)
**Maintenance:** ZERO (fully automated)

**Mau lanjut implementasi dengan GitHub Actions?**
