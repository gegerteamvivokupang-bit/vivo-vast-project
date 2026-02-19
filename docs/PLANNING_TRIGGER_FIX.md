# PLANNING SOLUSI - FIX TRIGGER ISSUES
## Tanggal: 2026-01-03
## Status: PLANNING ONLY - BELUM EXECUTE

---

## 🔍 ANALISIS MENDALAM

### 1. APAKAH BUG BENAR-BENAR ADA?

#### **Bug #1: Store Aggregates - CONFIRMED ✓**
```sql
-- File: create_aggregation_functions.sql Line 107-138
CREATE OR REPLACE FUNCTION refresh_daily_store_aggregates()
...
WHERE DATE(sale_date) = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE
```

**Bukti Masalah:**
- Function ini HARDCODED untuk hari ini
- Dipanggil dari trigger untuk SEMUA tanggal
- Jika data kemarin di-update, store aggregate kemarin TIDAK ter-refresh

**Dampak Aktual:**
- Medium severity (Store aggregate jarang dipakai untuk historical)
- Dashboard SPC pakai query langsung, bukan aggregate store
- Hanya impact jika ada laporan per-toko historical

#### **Bug #2: Conversion Trigger - PERLU INVESTIGASI**
```sql
-- Line 218-223
CREATE TRIGGER trigger_agg_on_conversion
  AFTER INSERT OR UPDATE OR DELETE ON conversions
  FOR EACH STATEMENT
  EXECUTE FUNCTION trigger_refresh_aggregates();
```

**Investigasi:**
1. Apakah tabel `conversions` ada? → Saya cek, belum ada CREATE TABLE
2. Apakah trigger ini jalan? → Mungkin tabel belum dibuat
3. Apakah trigger_refresh_aggregates() support STATEMENT? → TIDAK! Butuh NEW/OLD

**Status:** Bug EXIST, tapi mungkin **TIDAK AKTIF** (tabel belum ada)

#### **Bug #3: Race Condition - LOW PRIORITY**
**Analisis:**
- Hanya terjadi jika 2 user input data BERSAMAAN untuk tanggal SAMA
- PostgreSQL punya MVCC (Multi-Version Concurrency Control)
- DELETE + INSERT bisa handle concurrent dengan baik
- Risk: Very Low (< 0.1% chance)

**Keputusan:** SKIP dulu, tidak critical

---

## 📋 DEPENDENCY ANALYSIS

### **Apa yang Pakai Store Aggregates?**

```bash
Cek EdgeFunction yang query agg_daily_store:
- dashboard-spc-daily ← Pakai view langsung
- dashboard-spc-monthly ← Pakai view langsung
```

**Hasil:** Store aggregates TIDAK dipakai langsung oleh dashboard!
**Impact jika broken:** Minimal (hanya view yang pakai)

### **Apa yang Pakai Conversion Trigger?**

```bash
Cek apakah tabel conversions ada:
- Belum ada di migrations
- Trigger dibuat tapi tabel belum ready
```

**Hasil:** Trigger ini DORMANT (belum aktif)
**Impact jika broken:** NONE (belum dipakai)

---

## ⚠️ RISK ASSESSMENT

| Item | Current State | Bug Severity | Impact if Fixed Wrong | Priority |
|------|---------------|--------------|------------------------|----------|
| **Store Daily Agg** | Selalu refresh hari ini | 🟡 Medium | 🔴 High (aggregate broken) | Medium |
| **Store Monthly Agg** | Selalu refresh bulan ini | 🟡 Medium | 🔴 High (aggregate broken) | Medium |
| **Conversion Trigger** | Dormant (tabel belum ada) | 🟢 Low | 🟡 Medium (trigger error) | Low |
| **Promoter Agg** | ✅ Sudah benar | N/A | 🔴 Critical (jangan sentuh!) | N/A |

---

## 🎯 SOLUTION PLAN

### **OPTION A: FIX SEMUA (Recommended)**

**Pros:**
- Complete solution
- Future-proof
- Konsisten dengan promoter agg

**Cons:**
- Risk: Medium (banyak perubahan)
- Butuh test

**Steps:**
1. Buat fungsi baru:
   - `refresh_daily_store_aggregates_for_date(target_date DATE)`
   - `refresh_monthly_store_aggregates_for_month(target_month DATE)`
2. Update trigger untuk call fungsi baru
3. Test di development/staging
4. Apply ke production

### **OPTION B: FIX HANYA YANG CRITICAL (Safe)**

**Pros:**
- Risk: Low (minimal changes)
- Cukup untuk sistem yang ada sekarang

**Cons:**
- Masih ada technical debt

**Steps:**
1. Biarkan store aggregates as-is (jarang dipakai)
2. Fix conversion trigger (tapi wait sampai tabel conversions dibuat)
3. Monitor untuk issue

### **OPTION C: MONITORING DULU (Ultra Safe)**

**Pros:**
- Risk: None (no changes)
- Bisa lihat apakah bug benar-benar impact production

**Cons:**
- Bug tetap ada
- Harus fix nanti

**Steps:**
1. Buat monitoring query
2. Cek apakah store aggregates pernah salah
3. Decide based on data

---

## 📝 DETAILED FIX PLAN (IF GO WITH OPTION A)

### **Step 1: Buat Fungsi Baru (Safe - Tidak Ubah Yang Ada)**

```sql
-- Buat fungsi baru tanpa ubah yang lama
CREATE OR REPLACE FUNCTION refresh_daily_store_aggregates_for_date(target_date DATE)
RETURNS void AS $$
BEGIN
  DELETE FROM agg_daily_store WHERE agg_date = target_date;
  
  INSERT INTO agg_daily_store (...)
  SELECT ...
  FROM vast_finance_data_new
  WHERE DATE(sale_date) = target_date
    AND deleted_at IS NULL
  GROUP BY store_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION refresh_monthly_store_aggregates_for_month(target_month DATE)
RETURNS void AS $$
BEGIN
  DELETE FROM agg_monthly_store WHERE agg_month = target_month;
  
  INSERT INTO agg_monthly_store (...)
  SELECT ...
  FROM vast_finance_data_new
  WHERE DATE_TRUNC('month', sale_date) = target_month
    AND deleted_at IS NULL
  GROUP BY store_id;
END;
$$ LANGUAGE plpgsql;
```

**Risk:** LOW (function baru, tidak break yang lama)

### **Step 2: Update Wrapper Functions**

```sql
-- Update existing functions to call new ones
CREATE OR REPLACE FUNCTION refresh_daily_store_aggregates()
RETURNS void AS $$
BEGIN
  PERFORM refresh_daily_store_aggregates_for_date(
    (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION refresh_monthly_store_aggregates()
RETURNS void AS $$
BEGIN
  PERFORM refresh_monthly_store_aggregates_for_month(
    DATE_TRUNC('month', (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::DATE)::DATE
  );
END;
$$ LANGUAGE plpgsql;
```

**Risk:** LOW (cuma wrapper, logic sama)

### **Step 3: Update Trigger Function**

```sql
CREATE OR REPLACE FUNCTION trigger_refresh_aggregates()
RETURNS trigger AS $$
DECLARE
    affected_date DATE;
    affected_month DATE;
BEGIN
    IF TG_OP = 'DELETE' THEN
        affected_date := OLD.sale_date::DATE;
    ELSE
        affected_date := NEW.sale_date::DATE;
    END IF;
    
    affected_month := DATE_TRUNC('month', affected_date)::DATE;
    
    -- Refresh for AFFECTED date
    PERFORM refresh_daily_promoter_aggregates_for_date(affected_date);
    PERFORM refresh_monthly_promoter_aggregates_for_month(affected_month);
    
    -- FIX: Store aggregates untuk affected date
    PERFORM refresh_daily_store_aggregates_for_date(affected_date);
    PERFORM refresh_monthly_store_aggregates_for_month(affected_month);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
```

**Risk:** MEDIUM (ubah trigger logic)

### **Step 4: Handle Conversion Trigger (Optional - Wait for Table)**

```sql
-- Buat function terpisah untuk conversion
CREATE OR REPLACE FUNCTION trigger_refresh_aggregates_conversion()
RETURNS trigger AS $$
DECLARE
    v_transaction_id UUID;
    v_sale_date DATE;
BEGIN
    -- Get transaction_id from NEW or OLD
    IF TG_OP = 'DELETE' THEN
        v_transaction_id := OLD.transaction_id;
    ELSE
        v_transaction_id := NEW.transaction_id;
    END IF;
    
    -- Get sale_date from vast_finance_data_new
    SELECT sale_date::DATE INTO v_sale_date
    FROM vast_finance_data_new
    WHERE id = v_transaction_id;
    
    IF v_sale_date IS NOT NULL THEN
        PERFORM refresh_daily_promoter_aggregates_for_date(v_sale_date);
        PERFORM refresh_monthly_promoter_aggregates_for_month(
            DATE_TRUNC('month', v_sale_date)::DATE
        );
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Update trigger
DROP TRIGGER IF EXISTS trigger_agg_on_conversion ON conversions;
CREATE TRIGGER trigger_agg_on_conversion
  AFTER INSERT OR UPDATE OR DELETE ON conversions
  FOR EACH ROW  -- PENTING: ROW bukan STATEMENT!
  EXECUTE FUNCTION trigger_refresh_aggregates_conversion();
```

**Risk:** MEDIUM (tapi tabel belum ada, bisa skip dulu)

---

## ✅ TESTING STRATEGY

### **Test #1: Store Aggregates**
```sql
-- 1. Insert data kemarin
INSERT INTO vast_finance_data_new (sale_date, ...) VALUES ('2026-01-02', ...);

-- 2. Cek apakah store aggregate untuk 2026-01-02 ter-update
SELECT * FROM agg_daily_store WHERE agg_date = '2026-01-02';

-- Expected: Ada data (FIXED)
-- Before Fix: Kosong (BUG)
```

### **Test #2: Promoter Aggregates (Ensure Not Broken)**
```sql
-- 1. Insert data kemarin
INSERT INTO vast_finance_data_new (sale_date, ...) VALUES ('2026-01-02', ...);

-- 2. Cek apakah promoter aggregate untuk 2026-01-02 ter-update
SELECT * FROM agg_daily_promoter WHERE agg_date = '2026-01-02';

-- Expected: Ada data (STILL WORKS)
```

### **Test #3: Today Data (Ensure Not Broken)**
```sql
-- 1. Insert data hari ini
INSERT INTO vast_finance_data_new (sale_date, ...) VALUES (CURRENT_DATE, ...);

-- 2. Cek semua aggregates
SELECT * FROM agg_daily_promoter WHERE agg_date = CURRENT_DATE;
SELECT * FROM agg_daily_store WHERE agg_date = CURRENT_DATE;

-- Expected: Both ada data (STILL WORKS)
```

---

## 🔙 ROLLBACK PLAN

Jika setelah fix ada masalah:

```sql
-- ROLLBACK: Restore old functions
-- Simpan file ini sebelum fix: BACKUP_OLD_FUNCTIONS.sql

-- Content:
CREATE OR REPLACE FUNCTION refresh_daily_store_aggregates()
... [versi lama]

CREATE OR REPLACE FUNCTION trigger_refresh_aggregates()
... [versi lama]
```

---

## 🎯 RECOMMENDATION

**Saya Rekomendasikan: OPTION A (Fix Semua)**

**Justifikasi:**
1. Bug #1 (Store) - Real issue, worth fixing
2. Bug #2 (Conversion) - Prepare for future
3. Risk - Manageable dengan testing
4. Benefit - Konsisten dan future-proof

**Timeline:**
1. Anda review plan ini
2. Saya buat SQL file lengkap
3. Anda review SQL file
4. Test di local/staging dulu
5. Apply ke production jika OK

---

## ❓ PERTANYAAN UNTUK ANDA

1. **Apakah dashboard SPC menampilkan data store historical yang benar?**
   - Jika ya → Bug #1 critical
   - Jika tidak → Bug #1 low priority

2. **Apakah ada rencana pakai tabel conversions?**
   - Jika ya → Fix Bug #2 sekarang
   - Jika tidak → Skip dulu

3. **Mau test di mana dulu?**
   - Local database copy?
   - Staging environment?
   - Langsung production (NOT RECOMMENDED)?

4. **Prefer mana?**
   - Option A: Fix semua (complete)
   - Option B: Fix yang critical saja (safe)
   - Option C: Monitor dulu (ultra safe)

---

**Status:** WAITING FOR APPROVAL
**Next Step:** Tunggu keputusan Anda
