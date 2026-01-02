# 🗑️ CLOUDINARY AUTO-CLEANUP STRATEGY
**Tanggal:** 2 Januari 2026  
**Project:** VAST Finance - Sustainable Photo Storage  
**Goal:** Sistem foto yang berjalan selamanya tanpa habis kuota

---

## 🎯 OBJECTIVE

**"Agar kuota tidak pernah habis dan siap dipakai sampai kiamat"**

**Strategi:**
1. ✅ Optimasi upload (hemat 90%) → sudah diplan
2. ✅ **Auto-cleanup foto lama** → NEW! 
3. ✅ Retention policy yang smart
4. ✅ Monitoring & alerting

---

## 📊 KALKULASI SUSTAINABLE STORAGE

### **Target: FREE TIER SELAMANYA (25 GB)**

**Dengan Optimasi (400 KB/foto):**

```
Upload Rate: 100 foto/hari
File Size: 400 KB/foto
Daily Storage: 40 MB/hari

Simulasi Akumulasi:
- 1 bulan (30 hari): 1.2 GB
- 3 bulan (90 hari): 3.6 GB
- 6 bulan (180 hari): 7.2 GB
- 12 bulan (365 hari): 14.6 GB
- 18 bulan (540 hari): 21.6 GB ⚠️ MENDEKATI LIMIT!
- 24 bulan (730 hari): 29.2 GB ❌ OVER LIMIT!
```

**KESIMPULAN:**
- Tanpa cleanup: Kuota habis sekitar **18-20 bulan**
- **BUTUH RETENTION POLICY!**

---

## 💡 RETENTION POLICY STRATEGY

### **OPSI 1: Simple Time-Based Cleanup (RECOMMENDED)**

**Konsep:**
Hapus foto yang **lebih tua dari X bulan**

**Pertimbangan Bisnis:**

| Retention Period | Storage Max | Foto Tersimpan | Use Case |
|------------------|-------------|----------------|----------|
| **3 bulan** | 3.6 GB | ~9,000 foto | Short-term auditing |
| **6 bulan** ⭐ | 7.2 GB | ~18,000 foto | **RECOMMENDED** |
| **12 bulan** | 14.6 GB | ~36,000 foto | Annual compliance |
| **18 bulan** | 21.6 GB | ~54,000 foto | Extended legal requirement |

**Rekomendasi: 6 BULAN**
- ✅ Cukup untuk audit normal (Q1-Q2)
- ✅ Aman dalam free tier (7.2 GB < 25 GB)
- ✅ **Safety margin 70%** (masih ada 17.8 GB kosong)
- ✅ Bisa handle spike upload (misal campaign)

---

### **OPSI 2: Status-Based Retention (ADVANCED)**

**Konsep:**
Retention period berbeda berdasarkan status pengajuan

```typescript
Retention Policy:
- Status "Reject": Hapus setelah 1 bulan (ga penting)
- Status "Pending": Hapus setelah 3 bulan (tunggu keputusan)
- Status "ACC": Simpan 12 bulan (penting, ada transaksi)
```

**Benefit:**
- ✅ Hemat storage lebih agresif (Reject = 70% dari total)
- ✅ Prioritas foto penting (ACC)
- ✅ Compliance-friendly

**Kalkulasi:**
```
Asumsi distribusi:
- ACC: 20% (100 foto) → 12 bulan retention = 4.8 GB
- Pending: 10% (50 foto) → 3 bulan retention = 0.6 GB
- Reject: 70% (350 foto) → 1 bulan retention = 0.56 GB
Total: ~6 GB (lebih hemat dari Opsi 1!)
```

---

### **OPSI 3: Hybrid (Time + Storage Quota Check)**

**Konsep:**
- Default: Simpan 6 bulan
- **Jika storage > 80% (20 GB):** Auto cleanup foto > 3 bulan
- **Jika storage > 90% (22.5 GB):** Emergency cleanup foto > 1 bulan

**Benefit:**
- ✅ Flexible & adaptive
- ✅ Mencegah over-limit secara otomatis
- ✅ Safety net

---

## 🛠️ IMPLEMENTATION ARCHITECTURE

### **Component 1: Database Schema Update**

**Tambah kolom tracking di tabel `vast_finance_data_new`:**

```sql
ALTER TABLE vast_finance_data_new 
ADD COLUMN image_urls_metadata JSONB;

-- Struktur metadata:
{
  "upload_date": "2026-01-02T14:43:00Z",
  "cloudinary_public_ids": ["vast_finance/abc123", "vast_finance/def456"],
  "scheduled_deletion_date": "2026-07-02T14:43:00Z",  -- 6 months later
  "retention_status": "active" | "scheduled_for_deletion" | "deleted"
}
```

**Benefit:**
- ✅ Track kapan foto diupload
- ✅ Track kapan foto harus dihapus
- ✅ Track public_id Cloudinary untuk deletion
- ✅ Audit trail

---

### **Component 2: Scheduled Cleanup Function**

**A. Supabase Edge Function: `cloudinary-cleanup`**

**File:** `supabase/functions/cloudinary-cleanup/index.ts`

**Pseudocode:**
```typescript
async function cleanupOldPhotos() {
  // 1. Get foto yang sudah melewati retention period
  const oldPhotos = await supabase
    .from('vast_finance_data_new')
    .select('id, image_urls_metadata')
    .lt('created_at', Date.now() - RETENTION_PERIOD)
    .eq('image_urls_metadata->retention_status', 'active')
  
  // 2. Loop each photo & delete from Cloudinary
  for (const photo of oldPhotos) {
    const publicIds = photo.image_urls_metadata.cloudinary_public_ids
    
    for (const publicId of publicIds) {
      await cloudinary.uploader.destroy(publicId)
    }
    
    // 3. Update status di database (jangan hapus record!)
    await supabase
      .from('vast_finance_data_new')
      .update({
        image_urls_metadata: {
          ...photo.image_urls_metadata,
          retention_status: 'deleted',
          deleted_at: new Date()
        }
      })
      .eq('id', photo.id)
  }
  
  return { deleted_count: oldPhotos.length }
}
```

**B. Vercel Cron Job**

**File:** `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/cron/cleanup-photos",
      "schedule": "0 2 * * *"  // Setiap hari jam 2 pagi
    }
  ]
}
```

**File:** `app/api/cron/cleanup-photos/route.ts`

```typescript
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Call Supabase Edge Function
  const supabase = createClient()
  const { data, error } = await supabase.functions.invoke('cloudinary-cleanup')
  
  return Response.json({
    success: true,
    deleted_count: data.deleted_count,
    timestamp: new Date()
  })
}
```

---

### **Component 3: Upload Tracking System**

**Update `app/api/upload/route.ts`:**

```typescript
// Setelah upload sukses ke Cloudinary
const result = await cloudinary.uploader.upload(dataUri, {
  folder: 'vast_finance',
  // ... transformations
})

// Return juga metadata untuk tracking
return NextResponse.json({
  success: true,
  url: result.secure_url,
  public_id: result.public_id,  // PENTING untuk cleanup!
  metadata: {
    upload_date: new Date().toISOString(),
    scheduled_deletion_date: new Date(Date.now() + RETENTION_PERIOD).toISOString()
  }
})
```

**Update submission function untuk save metadata:**

```typescript
// di supabase/functions/submission-create/index.ts

const submissionData = {
  // ... existing fields
  image_urls_metadata: {
    cloudinary_public_ids: imageResults.map(r => r.public_id),
    upload_date: new Date().toISOString(),
    scheduled_deletion_date: new Date(Date.now() + RETENTION_PERIOD).toISOString(),
    retention_status: 'active'
  }
}
```

---

### **Component 4: Monitoring Dashboard**

**Create Admin Page:** `app/admin/cloudinary-stats/page.tsx`

**Features:**
- 📊 Total storage used (GB)
- 📊 Total foto count
- 📊 Foto by age (< 1 month, 1-3 months, 3-6 months, > 6 months)
- 📊 Foto scheduled for deletion (next 7 days)
- 📊 Storage projection (akan habis kapan?)
- ⚙️ Manual cleanup trigger button (emergency)

**Metrics to Track:**
```typescript
{
  total_storage_gb: 7.2,
  total_photos: 18000,
  storage_usage_percent: 28.8,  // 7.2 / 25 GB
  photos_by_age: {
    "< 1 month": 3000,
    "1-3 months": 6000,
    "3-6 months": 9000,
    "> 6 months": 0  // Should be 0 if cleanup works!
  },
  scheduled_for_deletion: 150,  // In next 7 days
  estimated_full_date: "2027-06-15"  // Projection
}
```

---

## 🔄 CLEANUP WORKFLOW

### **Daily Automated Process:**

```
2:00 AM (Vercel Cron)
    ↓
Call /api/cron/cleanup-photos
    ↓
Invoke Supabase Edge Function: cloudinary-cleanup
    ↓
Query Database: Get photos older than retention period
    ↓
Loop each photo:
    ├─ Delete from Cloudinary (cloudinary.uploader.destroy)
    ├─ Update database retention_status = 'deleted'
    └─ Log deletion
    ↓
Send notification to admin (jika ada)
    ↓
Return stats: { deleted_count: 150 }
```

---

## ⚖️ RETENTION POLICY DECISION TREE

**Pertanyaan untuk menentukan retention period:**

### **1. Apakah ada regulasi/compliance tentang penyimpanan data?**
- **Ya, harus 12 bulan** → Retention: 12 bulan
- **Ya, harus 6 bulan** → Retention: 6 bulan
- **Tidak ada** → Lanjut ke #2

### **2. Apakah foto dipakai untuk audit internal?**
- **Ya, audit quarterly (3 bulan)** → Retention: 6 bulan (safety margin)
- **Ya, audit annual** → Retention: 12 bulan
- **Tidak ada audit** → Lanjut ke #3

### **3. Apakah ada kasus legal/sengketa dengan customer?**
- **Ya, sering ada sengketa** → Retention: 12 bulan (bukti)
- **Jarang/tidak pernah** → Retention: 3-6 bulan

### **4. Apakah ada backup foto di tempat lain?**
- **Ya, ada backup di server local** → Retention: 3 bulan (Cloudinary hanya cache)
- **Tidak, hanya di Cloudinary** → Retention: 6-12 bulan (safety)

---

## 💰 COST OPTIMIZATION SCENARIOS

### **Scenario A: Conservative (12 bulan retention)**

```
Storage: 14.6 GB (58% dari free tier)
Safety margin: 42%
Risk: Low (aman untuk compliance)
Sustainability: ~21 bulan sebelum butuh cleanup aggressive
```

### **Scenario B: Balanced (6 bulan retention) ⭐ RECOMMENDED**

```
Storage: 7.2 GB (29% dari free tier)
Safety margin: 71% 
Risk: Medium-Low (cukup untuk most cases)
Sustainability: FOREVER (selalu di bawah limit)
```

### **Scenario C: Aggressive (3 bulan retention)**

```
Storage: 3.6 GB (14% dari free tier)
Safety margin: 86%
Risk: Medium (mungkin kurang untuk audit)
Sustainability: FOREVER (sangat aman)
```

### **Scenario D: Status-Based (hybrid)**

```
Storage: ~6 GB (24% dari free tier)
Safety margin: 76%
Risk: Low (prioritize important data)
Sustainability: FOREVER + optimal
```

---

## 🚨 ALERTING & SAFETY MECHANISMS

### **Alert Triggers:**

| Condition | Alert Level | Action |
|-----------|-------------|--------|
| Storage > 15 GB (60%) | 📘 INFO | Email ke admin |
| Storage > 20 GB (80%) | ⚠️ WARNING | Slack notification + consider reducing retention |
| Storage > 22.5 GB (90%) | 🚨 CRITICAL | Emergency cleanup + email CEO |
| Cleanup job failed | ⚠️ WARNING | Retry + notify admin |
| Storage trend hitting limit in 30 days | 📘 INFO | Early warning notification |

### **Emergency Cleanup Procedure:**

**Jika storage > 90%:**

```typescript
// Aggressive cleanup
1. Delete all "Reject" photos > 1 month
2. Delete all "Pending" photos > 2 months
3. Consider compressing old "ACC" photos further
4. Notify admin for manual review
5. Consider upgrading to paid plan (temporary)
```

---

## 📋 IMPLEMENTATION CHECKLIST

### **Phase 1: Database Schema (10 menit)**
- [ ] Add `image_urls_metadata` JSONB column
- [ ] Create migration script
- [ ] Test migration on staging

### **Phase 2: Upload Tracking (15 menit)**
- [ ] Update `app/api/upload/route.ts` untuk return `public_id`
- [ ] Update `submission-create` Edge Function untuk save metadata
- [ ] Test upload & verify metadata saved

### **Phase 3: Cleanup Edge Function (30 menit)**
- [ ] Create `supabase/functions/cloudinary-cleanup/index.ts`
- [ ] Implement cleanup logic
- [ ] Add Cloudinary API credentials check
- [ ] Test manual execution

### **Phase 4: Cron Job Setup (20 menit)**
- [ ] Create `app/api/cron/cleanup-photos/route.ts`
- [ ] Setup `vercel.json` cron config
- [ ] Setup `CRON_SECRET` env variable
- [ ] Test cron job (manual trigger)

### **Phase 5: Monitoring Dashboard (OPTIONAL - 1 jam)**
- [ ] Create `app/admin/cloudinary-stats/page.tsx`
- [ ] Implement storage metrics
- [ ] Add charts/visualization
- [ ] Test dashboard

### **Phase 6: Alerting (OPTIONAL - 30 menit)**
- [ ] Setup email notification (Resend/SendGrid)
- [ ] Setup Slack webhook
- [ ] Configure alert thresholds
- [ ] Test notifications

---

## 🎯 RECOMMENDED IMPLEMENTATION PLAN

### **MINIMAL VIABLE SYSTEM (Quick Deploy - 1 jam)**

**Include:**
1. ✅ Database schema update (tracking metadata)
2. ✅ Upload tracking (save public_id)
3. ✅ Cleanup Edge Function
4. ✅ Vercel Cron Job
5. ✅ **Retention: 6 bulan**

**Skip (for now):**
- ❌ Monitoring dashboard (manual check dari Cloudinary console)
- ❌ Email/Slack alerting (check manual weekly)

**Result:**
- ✅ System sustainable FOREVER
- ✅ Auto-cleanup setiap hari
- ✅ Zero maintenance

---

### **FULL SYSTEM (Production-Ready - 2-3 jam)**

**Include Everything:**
1. ✅ All minimal features
2. ✅ Admin monitoring dashboard
3. ✅ Email alerting (storage > 80%)
4. ✅ Slack webhook (critical alerts)
5. ✅ Manual cleanup trigger button
6. ✅ Storage projection chart

**Result:**
- ✅ Enterprise-grade monitoring
- ✅ Proactive alerts
- ✅ Full control & visibility

---

## ❓ QUESTIONS UNTUK USER

### **1. Retention Period:**
Berapa lama foto harus disimpan?

- **A.** 3 bulan (sangat hemat, storage 14%)
- **B.** 6 bulan ⭐ **RECOMMENDED** (balance, storage 29%)
- **C.** 12 bulan (safe, storage 58%)
- **D.** Status-based (Reject: 1 bulan, Pending: 3 bulan, ACC: 12 bulan)

### **2. Implementation Scope:**
Mau deploy versi mana?

- **A.** Minimal (1 jam) - Auto-cleanup only ⭐ **RECOMMENDED**
- **B.** Full (2-3 jam) - With monitoring & alerting

### **3. Backup Strategy:**
Apakah ada backup foto di tempat lain selain Cloudinary?

- **Ya, ada backup** → Bisa pakai retention lebih pendek (3 bulan)
- **Tidak, hanya Cloudinary** → Pakai retention lebih panjang (6-12 bulan)

### **4. Compliance/Legal:**
Apakah ada requirement legal tentang penyimpanan data customer?

- **Ya, ada requirement X bulan** → Set retention sesuai requirement
- **Tidak ada** → Pakai 6 bulan (safe default)

---

## 🎉 EXPECTED OUTCOME

**Dengan sistem ini:**

✅ **Storage NEVER full** (auto-cleanup jaga < 30%)  
✅ **Free tier SELAMANYA** (tidak perlu upgrade)  
✅ **Zero manual maintenance** (fully automated)  
✅ **Compliance-friendly** (retention policy clear)  
✅ **Audit trail** (track semua deletion)  
✅ **Scalable** (bisa handle 1000 foto/hari juga!)  

**"System yang berjalan sampai kiamat" ✅**

---

## 📞 NEXT STEP

Tolong jawab 4 pertanyaan di atas, kemudian saya akan:

1. ✅ Implementasi optimasi Cloudinary (1200px + auto:good + format:auto)
2. ✅ Implementasi auto-cleanup system sesuai pilihan Anda
3. ✅ Setup cron job
4. ✅ Test & validate
5. ✅ Deploy

**Atau kalau mau cepat, bilang:**  
**"OK, pakai recommended semua (6 bulan retention + minimal system)"**

Gimana?
