# ⚡ QUICK REFERENCE - MIGRASI DATA EXCEL

**For:** Next migration (misal: data 26-31 Desember atau bulan lain)  
**Time:** ~15-20 menit (jika tidak ada user baru)

---

## 🚀 FAST TRACK (No New Users)

### 1. Update Filter (2 menit)
Edit `data/transform_final.js`:
```javascript
// Line ~119: Update filter tanggal
const desemberData = masterData.filter(row => {
    const timestamp = row['Timestamp'];
    if (!timestamp) return false;
    const date = excelDateToJSDate(timestamp);
    // GANTI INI:
    return date.getFullYear() === 2025 && date.getMonth() + 1 === 12;
    // Atau filter range spesifik:
    // return date >= new Date('2025-12-26') && date <= new Date('2025-12-31');
});
```

### 2. Transform & Generate (5 menit)
```bash
# Transform data
node data/transform_final.js

# Generate SQL
node data/generate_sql_final.js
```

**Expected:**
```
✅ Success: XXX records
⚠️ Warnings: 0
⚠️ Errors: 0
```

### 3. Execute SQL (5 menit)
1. Buka `migration_BULAN_FINAL.sql`
2. Copy all (Ctrl+A, Ctrl+C)
3. Paste di Supabase SQL Editor
4. Execute

### 4. Verify (3 menit)
```sql
-- Check total
SELECT COUNT(*) FROM vast_finance_data_new WHERE source = 'excel';

-- Check latest date
SELECT MAX(sale_date) FROM vast_finance_data_new WHERE source = 'excel';
```

---

## ⚠️ IF NEW USERS DETECTED (Add 10 menit)

### Check Warnings
```bash
cat data/migration_transformed_final.json | grep "warning"
```

### Insert New User
```sql
INSERT INTO users (id, email, name, employee_id, role, status, store_id, created_at, updated_at)
VALUES (gen_random_uuid(), 'nama@vast.com', 'NAMA USER', 'EMP001', 'promotor', 'active', 'UUID_TOKO', NOW(), NOW())
RETURNING id, name;
```

### Add to Hierarchy
```sql
-- Cari SATOR di toko yang sama
SELECT u.id, u.name FROM users u
JOIN hierarchy h ON h.user_id = u.id
WHERE h.store_id = 'UUID_TOKO' AND u.role IN ('sator', 'spv');

-- Insert hierarchy
INSERT INTO hierarchy (id, user_id, atasan_id, store_id, area, created_at, updated_at)
VALUES (gen_random_uuid(), 'UUID_USER_BARU', 'UUID_SATOR', 'UUID_TOKO', 'AREA', NOW(), NOW());
```

### Update Mapping & Re-generate
Edit `data/generate_sql_final.js`:
```javascript
const DB_PROMOTOR_UUID = {
    // ... existing
    'NAMA USER BARU': 'UUID_DARI_INSERT',
};
```

```bash
node data/generate_sql_final.js
```

---

## 📊 VALIDATION QUERIES

```sql
-- 1. Total records
SELECT source, COUNT(*) FROM vast_finance_data_new GROUP BY source;

-- 2. Date range
SELECT MIN(sale_date), MAX(sale_date) FROM vast_finance_data_new WHERE source = 'excel';

-- 3. Status distribution
SELECT status, COUNT(*) FROM vast_finance_data_new WHERE source = 'excel' GROUP BY status;

-- 4. Aggregation check
SELECT agg_month, SUM(total_input) FROM v_agg_monthly_promoter_all 
WHERE agg_month = '2025-12-01' GROUP BY agg_month;
```

---

## 🔧 QUICK FIXES

### Dashboard tidak tampil semua data?
```sql
-- Cek user tanpa hierarchy
SELECT u.name, COUNT(vfdn.id) FROM users u
JOIN vast_finance_data_new vfdn ON vfdn.created_by_user_id = u.id
LEFT JOIN hierarchy h ON h.user_id = u.id
WHERE vfdn.source = 'excel' AND h.user_id IS NULL
GROUP BY u.name;

-- Fix: Insert ke hierarchy
```

### Views tidak update?
```sql
-- Refresh if MATERIALIZED
REFRESH MATERIALIZED VIEW v_agg_monthly_promoter_all;
REFRESH MATERIALIZED VIEW v_agg_monthly_sator_all;
REFRESH MATERIALIZED VIEW v_agg_monthly_spv_all;
```

---

## ✅ CHECKLIST

- [ ] Transform done (no errors)
- [ ] SQL generated (no warnings)
- [ ] New users inserted (if any)
- [ ] Hierarchy added (if any)
- [ ] SQL executed successfully
- [ ] Total records match
- [ ] Dashboard shows all data

---

## 📞 NEED HELP?

See: `PANDUAN_MIGRASI_EXCEL_LENGKAP.md` for detailed step-by-step guide
