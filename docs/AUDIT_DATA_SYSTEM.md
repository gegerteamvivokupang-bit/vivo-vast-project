# AUDIT KOMPREHENSIF SISTEM DATA - VAST FINANCE
## Dibuat: 2026-01-03
## Tujuan: Identifikasi SEMUA masalah recurring dan solusi permanen

---

## 📊 RINGKASAN MASALAH YANG DITEMUKAN

### 🔴 MASALAH KRITIS (Penyebab Utama)

| No | Masalah | Lokasi | Dampak |
|----|---------|--------|--------|
| 1 | **RPC Function tidak sinkron** | Migration vs FIX SQL files | Data sator tidak lengkap, bolak-balik rusak |
| 2 | **Timezone Tidak Konsisten** | Edge Functions berbeda-beda | Data tanggal tidak cocok |
| 3 | **Trigger hanya refresh hari ini** | create_aggregation_functions.sql | Data kemarin tidak diupdate |

---

## 🔍 ANALISIS DETAIL

### 1. INKONSISTENSI TIMEZONE DI EDGE FUNCTIONS

**Masalah:** Setiap Edge Function menggunakan metode berbeda untuk mendapatkan tanggal.

| Edge Function | Metode Timezone | Status |
|--------------|-----------------|--------|
| `dashboard-team-daily` | ✅ WITA (`Intl.DateTimeFormat`) | Benar |
| `dashboard-team-monthly` | ✅ WITA | Benar |
| `dashboard-manager-daily` | ✅ WITA | Benar |
| `dashboard-promotor-daily` | ❌ **UTC** (`new Date().toISOString()`) | **SALAH** |
| `dashboard-promotor-monthly` | ❌ **UTC** (`new Date()`) | **SALAH** |
| `dashboard-spc-daily` | ✅ WITA | Benar |
| `dashboard-spc-monthly` | ⚠️ Mixed (local `new Date()`) | **PERLU FIX** |

**Dampak:** 
- Data promotor di waktu 00:00-08:00 WITA akan tertukar tanggal
- Data tidak cocok antar dashboard

### 2. RPC FUNCTION DUPLIKAT (Source of Truth Problem)

**Masalah:** Ada 2 versi fungsi `get_team_daily_with_sators`:

| File | Versi | Status |
|------|-------|--------|
| `migrations/20251230_create_turbo_rpc_functions.sql` | Lama (hanya promotor_ids) | **Di-deploy ke DB** |
| `FIX_DAILY_RPC_COMPLETE_DATA.sql` | Baru (dengan agregasi) | Hanya fix manual |

**Dampak:**
- Setiap re-deploy/migration, fungsi yang LAMA yang terpasang
- Fix manual harus diulang terus-menerus

### 3. TRIGGER AGREGASI TIDAK LENGKAP

**Masalah di `create_aggregation_functions.sql`:**
```sql
-- Ini HANYA refresh untuk HARI INI
WHERE DATE(sale_date) = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE
```

**Dampak:**
- Data yang diinput untuk tanggal kemarin tidak ter-agregasi
- Data lama tidak diupdate jika ada perubahan

### 4. VIEW TIDAK DIUPDATE OTOMATIS

**Masalah:** `v_agg_daily_promoter_all` adalah **VIEW** yang UNION dari:
1. `agg_daily_promoter` (tabel trigger-based)
2. `vast_finance_data_old` (data lama)

**Dampak:**
- Jika trigger tidak berjalan, tabel `agg_daily_promoter` kosong
- Data hari ini tidak muncul

---

## 📐 ARSITEKTUR SAAT INI (Diagram)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         DATA INPUT SOURCES                          │
├─────────────────────────────────────────────────────────────────────┤
│  vast_finance_data_new    │   vast_finance_data_old               │
│  (Live submissions)        │   (Historical Excel imports)          │
└─────────────┬─────────────────────────────┬────────────────────────┘
              │                             │
              ▼                             │
┌─────────────────────────┐                 │
│  TRIGGER (on insert)    │                 │
│  refresh_daily_promoter │                 │
│  ** ONLY TODAY **       │                 │
└───────────┬─────────────┘                 │
            │                               │
            ▼                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    AGGREGATION TABLES                               │
├─────────────────────────────────────────────────────────────────────┤
│  agg_daily_promoter        │  agg_monthly_promoter                 │
│  agg_daily_store           │  agg_monthly_store                    │
└─────────────┬─────────────────────────────┬────────────────────────┘
              │                             │
              ▼                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    VIEWS (UNION old + new)                          │
├─────────────────────────────────────────────────────────────────────┤
│  v_agg_daily_promoter_all  │  v_agg_monthly_promoter_all           │
│  v_agg_daily_sator_all     │  v_agg_monthly_sator_all              │
│  v_agg_daily_spv_all       │  v_agg_monthly_spv_all                │
│  v_agg_daily_store_all     │  v_agg_monthly_store_all              │
└─────────────┬─────────────────────────────┬────────────────────────┘
              │                             │
              ▼                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    RPC FUNCTIONS                                    │
├─────────────────────────────────────────────────────────────────────┤
│  get_team_daily_with_sators  │  get_manager_daily_hierarchy        │
│  get_team_monthly_data       │  get_manager_monthly_hierarchy      │
└─────────────┬─────────────────────────────┬────────────────────────┘
              │                             │
              ▼                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    EDGE FUNCTIONS (Supabase)                        │
├─────────────────────────────────────────────────────────────────────┤
│  dashboard-team-daily      │  dashboard-manager-daily              │
│  dashboard-team-monthly    │  dashboard-manager (monthly)          │
│  dashboard-promotor-daily  │  dashboard-promotor-monthly           │
│  dashboard-spc-daily       │  dashboard-spc-monthly                │
└─────────────┬─────────────────────────────┬────────────────────────┘
              │                             │
              ▼                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    FRONTEND PAGES                                   │
├─────────────────────────────────────────────────────────────────────┤
│  /dashboard/team/daily     │  /dashboard/area/daily                │
│  /dashboard/team           │  /dashboard/area                      │
│  /dashboard/team/export    │  /dashboard/area/export               │
│  /dashboard/promotor       │  /admin/export                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## ✅ SOLUSI YANG HARUS DITERAPKAN

### FASE 1: FIX TIMEZONE (Urgent)

**File yang harus diperbaiki:**

1. `supabase/functions/dashboard-promotor-daily/index.ts`
   - Baris 39: Ganti `new Date().toISOString().split('T')[0]` 
   - Dengan: WITA timezone

2. `supabase/functions/dashboard-promotor-monthly/index.ts`
   - Baris 39-40: Ganti `new Date()` 
   - Dengan: WITA timezone

3. `supabase/functions/dashboard-spc-monthly/index.ts`
   - Baris 87-88: Ganti `new Date()` 
   - Dengan: WITA timezone

### FASE 2: FIX RPC FUNCTIONS (Sinkronisasi)

**Langkah:**
1. Update `migrations/20251230_create_turbo_rpc_functions.sql` dengan versi yang benar ✅ SUDAH DILAKUKAN
2. Jalankan SQL fix di Supabase SQL Editor untuk menerapkan perubahan

### FASE 3: FIX TRIGGER AGREGASI

**Masalah saat ini:**
- Trigger hanya refresh data hari ini
- Data untuk tanggal lain tidak diupdate

**Solusi:**
Buat function yang lebih fleksibel:
```sql
CREATE OR REPLACE FUNCTION refresh_daily_promoter_aggregates_for_date(target_date DATE)
RETURNS void AS $$
BEGIN
  DELETE FROM agg_daily_promoter WHERE agg_date = target_date;
  
  INSERT INTO agg_daily_promoter (...)
  SELECT ... FROM vast_finance_data_new
  WHERE DATE(sale_date) = target_date
  ...
END;
```

### FASE 4: CENTRALIZE DATE HANDLING

**Solusi:**
1. Buat `supabase/functions/_shared/date-utils.ts`
2. Semua Edge Function import dari sini
3. Tidak ada lagi `new Date().toISOString()` langsung

---

## 📋 CHECKLIST IMPLEMENTASI

### Timezone Fixes
- [ ] Fix `dashboard-promotor-daily/index.ts` - Use WITA
- [ ] Fix `dashboard-promotor-monthly/index.ts` - Use WITA
- [ ] Fix `dashboard-spc-monthly/index.ts` - Use WITA
- [ ] Create shared date utility for Edge Functions

### RPC Function Sync
- [x] Update migration file `20251230_create_turbo_rpc_functions.sql`
- [ ] Run updated SQL in Supabase to apply changes
- [ ] Delete old FIX_*.sql files after migration is verified

### Aggregation Trigger
- [ ] Create date-flexible refresh function
- [ ] Add trigger for any date updates
- [ ] Test with past date data

### Testing
- [ ] Test Manager daily view for yesterday
- [ ] Test SPV daily view for yesterday
- [ ] Test Export PNG with correct data
- [ ] Test Export Excel with correct data
- [ ] Test Promotor dashboard

---

## 🔐 ROOT CAUSE SUMMARY

**Mengapa masalah ini selalu kembali?**

1. **Tidak ada Single Source of Truth** untuk SQL functions
   - Migration files dan FIX files berbeda
   - Setiap deploy menggunakan migration files

2. **Timezone handling tersebar**
   - Setiap developer menangani timezone sendiri-sendiri
   - Tidak ada utility terpusat

3. **Trigger terlalu sederhana**
   - Hanya menangani hari ini
   - Tidak menghandle kasus edge

4. **Kurang testing regression**
   - Tidak ada automated test untuk data flow
   - Masalah ditemukan setelah production

---

## 🚀 NEXT STEPS

1. **SEGERA:** Jalankan FIX RPC di Supabase SQL Editor
2. **HARI INI:** Fix semua Edge Functions timezone
3. **BESOK:** Test semua scenario (kemarin, hari ini, bulan lalu)
4. **MINGGU INI:** Implement regression tests

---

**Catatan:** Dokumen ini harus di-review setelah semua fix diterapkan untuk memastikan tidak ada masalah baru yang muncul.
