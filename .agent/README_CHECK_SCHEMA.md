# CARA CEK DATABASE SCHEMA

## 📋 Tujuan
Script SQL ini dibuat untuk melihat struktur database yang SEBENARNYA agar tidak lagi berasumsi tentang nama table dan column.

## 🚀 Cara Menjalankan

### **Opsi 1: Via Supabase Dashboard (RECOMMENDED)**

1. **Buka Supabase Dashboard**
   - Login ke https://supabase.com
   - Pilih project VAST Finance

2. **Buka SQL Editor**
   - Klik menu "SQL Editor" di sidebar kiri
   - Atau langsung ke: https://supabase.com/dashboard/project/[PROJECT_ID]/sql

3. **Copy & Paste Query**
   - Buka file `.agent/check_database_schema.sql`
   - Copy paste **SATU PER SATU** query (mulai dari query #1)
   - Atau run semua sekaligus

4. **Lihat Hasil**
   - Setiap query akan menampilkan hasil
   - **Query #2** akan show struktur `vast_finance_data_new`
   - **Query #8** akan show semua column yang ada "promoter"

---

### **Opsi 2: Via Supabase CLI**

```powershell
# Pastikan sudah login
supabase db diff

# Run query
supabase db query < .agent/check_database_schema.sql
```

---

## 🎯 Yang Paling Penting

### **QUERY #2** - Struktur `vast_finance_data_new`:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'vast_finance_data_new'
ORDER BY ordinal_position;
```

**Dari hasil ini akan ketahuan:**
- ✅ Nama column untuk promotor (promoter_id? user_id? created_by?)
- ✅ Nama column untuk tanggal (sale_date? created_at? date?)
- ✅ Nama column untuk toko (store_id? shop_id?)

### **QUERY #8** - Cari column promoter:
```sql
SELECT table_name, column_name
FROM information_schema.columns
WHERE column_name ILIKE '%promoter%' OR column_name ILIKE '%promotor%'
ORDER BY table_name;
```

**Ini akan show:**
- Semua table yang punya column dengan kata "promoter"
- Nama column yang tepat (promoter_id? promoter_user_id? dll)

---

## 📊 Hasil yang Diharapkan

Setelah run query, kita akan tahu PASTI:

1. **Table name yang benar** untuk data finance/submissions
2. **Column names yang benar**:
   - Untuk promotor ID
   - Untuk store ID  
   - Untuk tanggal
3. **Struktur data** yang sebenarnya

---

## 🔄 Langkah Selanjutnya

Setelah dapat hasil:

1. **Screenshot hasil Query #2 dan #8**
2. **Share ke saya**
3. **Saya akan update code** dengan nama table/column yang BENAR

---

**FILE:** `.agent/check_database_schema.sql`
