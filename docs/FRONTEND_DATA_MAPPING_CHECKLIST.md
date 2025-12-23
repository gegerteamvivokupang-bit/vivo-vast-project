# FRONTEND DATA MAPPING CHECKLIST
## VAST FINANCE – UI ↔ DATA CONTRACT

---

## 1. TUJUAN DOKUMEN

Dokumen ini memastikan:
- Frontend **tidak salah ambil data**
- Tidak ada query ke tabel mentah
- Komponen UI punya sumber data yang jelas
- Developer baru bisa langsung kerja tanpa asumsi

---

## 2. ATURAN MUTLAK

❌ Frontend DILARANG query:
- `vast_finance_data_new`
- `conversions`

✅ Frontend WAJIB query:
- tabel agregat
- metadata (`stores`, `hierarchy`)

---

## 3. DASHBOARD PROMOTOR

### 3.1 Card: Target Bulanan
- **Tabel**: `agg_monthly_promoter`
- **Filter**:
```sql
promoter_user_id = current_user.id
AND agg_month = current_month
Kolom:

total_closed → pencapaian

Target:

dari tabel targets

3.2 Card: Pending Hari Ini
Tabel: agg_daily_promoter

Filter:

sql
Copy code
promoter_user_id = current_user.id
AND agg_date = today
Kolom:

total_pending

3.3 Card: Closing Hari Ini
Tabel: agg_daily_promoter

Kolom:

total_closed

total_closing_direct

total_closing_followup

4. DASHBOARD SPV & SATOR
4.1 Rekap Tim Harian
Tabel: agg_daily_promoter

Filter:

sql
Copy code
promoter_user_id IN (
  SELECT user_id FROM hierarchy
  WHERE atasan_id = current_user.id
)
AND agg_date = today
4.2 Rekap Bulanan Tim
Tabel: agg_monthly_promoter

Kolom utama:

total_closed

total_pending

5. DASHBOARD MANAGER AREA
5.1 Rekap Promotor Area
Tabel: agg_monthly_promoter

Filter:

sql
Copy code
promoter_user_id IN (
  SELECT user_id FROM hierarchy
  WHERE area = current_user.area
)
5.2 Rekap Toko Area
Tabel: agg_monthly_store

Filter:

sql
Copy code
store_id IN (
  SELECT store_id FROM hierarchy
  WHERE area = current_user.area
)
6. DASHBOARD TOKO
6.1 Harian
Tabel: agg_daily_store

Filter:

sql
Copy code
store_id = selected_store_id
AND agg_date = today
6.2 Bulanan
Tabel: agg_monthly_store

Kolom:

total_closed

total_pending

7. DASHBOARD SPC
7.1 Filter SPC
Metadata:

sql
Copy code
stores.is_spc = true
7.2 Data
Tabel:

agg_daily_store

agg_monthly_store

8. EXPORT (EXCEL / PNG)
SUM dari tabel agregat

TIDAK BOLEH dari transaksi mentah

Range:

tanggal

bulan

9. CHECKLIST FINAL (SEBELUM MERGE)
 Tidak query tabel mentah

 Semua angka dari agregat

 Tidak hitung manual di frontend

 Filter sesuai role

 Angka konsisten antar dashboard