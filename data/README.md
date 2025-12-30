# 📂 DATA FOLDER - MIGRATION SCRIPTS

Folder ini berisi scripts untuk migrasi data dari Excel ke Supabase database.

---

## 📋 SCRIPTS OVERVIEW

### 🔍 Analysis Scripts

#### `read_excel.js`
**Purpose:** Membaca dan menganalisis struktur file Excel  
**Usage:**
```bash
node data/read_excel.js
```
**Output:**
- Daftar sheets yang ada
- Struktur kolom
- Sample data
- File: `data/excel_analysis.json`

#### `check_date_distribution.js`
**Purpose:** Analisis distribusi tanggal dalam Master Data  
**Usage:**
```bash
node data/check_date_distribution.js
```
**Output:**
- Distribusi per bulan
- Total records per periode
- File: `data/date_distribution.json`

#### `check_26_desember.js`
**Purpose:** Analisis spesifik untuk data dari 26 Desember  
**Usage:**
```bash
node data/check_26_desember.js
```
**Output:**
- Total records >= 26 Des
- Distribusi per tanggal
- Sample data

#### `check_promotor_list.js`
**Purpose:** Extract daftar promotor dari data yang akan di-migrate  
**Usage:**
```bash
node data/check_promotor_list.js
```
**Output:**
- Daftar unique promotor
- Statistik per promotor
- SQL query untuk cek di database
- Files: 
  - `data/promotor_list_migration.json`
  - `check_promotor_migration.sql`

---

### ⚙️ Migration Scripts

#### `transform_final.js` ⭐ **MAIN SCRIPT**
**Purpose:** Transform data Excel menjadi format siap insert  
**Usage:**
```bash
node data/transform_final.js
```

**Proses:**
1. Baca Excel file (Master Data All, Database Promotor, Database Toko)
2. Filter data berdasarkan range tanggal
3. Cari promotor dinamis dari multiple kolom
4. Mapping promotor → toko
5. Normalisasi pekerjaan, status, phone number
6. Generate transformed data

**Output:**
- File: `data/migration_transformed_final.json`
- Contains:
  - `summary`: Total, warnings, errors
  - `data`: Array of transformed records
  - `warnings`: List of warnings
  - `errors`: List of errors

**Configuration:**
```javascript
// Update filter tanggal di line ~142
const startDate = new Date('2025-12-26');
const endDate = new Date('2025-12-30');
const desemberData = masterData.filter(row => {
    const date = excelDateToJSDate(row['Timestamp']);
    return date >= startDate && date < endDate;
});
```

#### `generate_sql_final.js` ⭐ **MAIN SCRIPT**
**Purpose:** Generate SQL INSERT statements dari transformed data  
**Usage:**
```bash
node data/generate_sql_final.js
```

**Proses:**
1. Load `migration_transformed_final.json`
2. Map promotor names → UUIDs
3. Map toko names → UUIDs
4. Map phone types → UUIDs
5. Generate SQL INSERT statements

**Output:**
- File: `migration_desember2025_FINAL.sql`
- Contains:
  - Backup instructions
  - INSERT statements
  - Validation queries

**Important Mappings:**
- `DB_PROMOTOR_UUID`: Line 18-91 (73 promotors)
- `DB_STORE_UUID`: Line 97-152 (55 stores)
- `DB_PHONE_TYPE_UUID`: Line 156-170

---

### 🗄️ Legacy Scripts

#### `transform_migration.js`
Old version of transformation script. Use `transform_final.js` instead.

#### `generate_sql.js`
Old version of SQL generation script. Use `generate_sql_final.js` instead.

#### `check_dinda.js`
Script untuk cek data promotor DINDA (specific use case).

#### `check_promotor_columns.js`
Script untuk analisis kolom promotor di Excel.

#### `analyze_penjualan_bersih.js`
Script untuk analisis sheet "Data Penjualan Bersih".

---

## 🔄 TYPICAL WORKFLOW

### Standard Migration (e.g., 26-29 Desember)

```bash
# 1. Read Excel
node data/read_excel.js

# 2. Check date distribution
node data/check_date_distribution.js

# 3. Transform data (MOST IMPORTANT)
node data/transform_final.js

# 4. Check promotor list
node data/check_promotor_list.js

# 5. Execute SQL query di Supabase untuk cek missing promotors
# (Use SQL from check_promotor_migration.sql)

# 6. Generate SQL migration
node data/generate_sql_final.js

# 7. Execute SQL di Supabase
# (Open migration_desember2025_FINAL.sql and run in Supabase)
```

**Total Time:** ~15-20 minutes

---

## 📁 OUTPUT FILES

### JSON Files
- `excel_analysis.json` - Analisis struktur Excel
- `date_distribution.json` - Distribusi tanggal
- `migration_transformed_final.json` - ⭐ Data transformed siap generate SQL
- `migration_transformed.json` - Legacy
- `promotor_list_migration.json` - Daftar promotor
- `penjualan_bersih_analysis.json` - Analisis penjualan bersih

### SQL Files
- `check_promotor_migration.sql` - Query cek promotor di database

### Generated (Root folder)
- `migration_desember2025_FINAL.sql` - ⭐ SQL INSERT ready to execute
- `migration_warnings.txt` - Warnings (jika ada)

---

## ⚙️ CONFIGURATION

### Excel File Path
Update di setiap script (line ~9):
```javascript
const excelPath = 'F:\\gpt_crazy_vast\\Data Sheet Vast data desmber.xlsx';
```

### Date Filter
Update di `transform_final.js` (line ~142-152):
```javascript
const startDate = new Date('2025-12-26');
const endDate = new Date('2025-12-30');
```

### UUID Mappings
Update di `generate_sql_final.js`:
- Promotor: Line 18-91
- Toko: Line 97-152
- Phone Type: Line 156-170

---

## 🔧 TROUBLESHOOTING

### Error: File not found
**Problem:** Excel file path salah  
**Solution:** Update `excelPath` di script yang error

### Error: Promotor not found in mapping
**Problem:** Ada promotor baru yang belum ada UUID  
**Solution:**
1. Insert user baru di Supabase
2. Add UUID ke `DB_PROMOTOR_UUID` di `generate_sql_final.js`

### Error: Store not found in mapping
**Problem:** Ada toko baru yang belum ada UUID  
**Solution:**
1. Insert store baru di Supabase
2. Add UUID ke `DB_STORE_UUID` di `generate_sql_final.js`

### Warning: Records tanpa mapping toko
**Problem:** Promotor tidak ada di Database Promotor sheet  
**Solution:** Update Database Promotor sheet di Excel

---

## 📚 DOCUMENTATION

Full documentation:
- `PANDUAN_MIGRASI_EXCEL_LENGKAP.md` - Complete step-by-step guide
- `QUICK_REFERENCE_MIGRASI.md` - Quick reference
- `LAPORAN_MIGRASI_26-29_DESEMBER2025.md` - Latest migration report
- `MIGRASI_26-29_DES_SUMMARY.md` - Quick summary

---

## 🎯 BEST PRACTICES

1. **Always run `read_excel.js` first** to understand data structure
2. **Check date distribution** before transform to know expected record count
3. **Verify promotor list** before generating SQL to avoid errors
4. **Test SQL on small sample** before full migration
5. **Keep backups** of previous migration files
6. **Update changelog** in `PANDUAN_MIGRASI_EXCEL_LENGKAP.md`

---

**Last Updated:** 30 Desember 2025  
**Maintained by:** Development Team
