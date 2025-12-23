# API CONTRACT
## VAST FINANCE – EDGE FUNCTION DATA ACCESS RULES

---

## 1. TUJUAN DOKUMEN

Dokumen ini mendefinisikan **kontrak resmi antara Frontend dan Backend (Edge Function)**.

Tujuan utama:
- Mencegah frontend query database sembarangan
- Mengunci aturan baca data dashboard
- Memisahkan tanggung jawab frontend & backend
- Menghindari logika bisnis bocor ke UI

**Frontend WAJIB mengikuti kontrak ini.**

---

## 2. PRINSIP UMUM (KERAS)

1. Frontend **TIDAK BOLEH** query database langsung untuk dashboard
2. Frontend **HANYA BOLEH** memanggil endpoint di dokumen ini
3. Semua query database dilakukan di **Edge Function**
4. Edge Function **WAJIB** patuh pada:
   - `READ_CONTRACT_DASHBOARD.md`
   - `DATABASE_NORMALIZED_SPEC.md`

---

## 3. AUTH & CONTEXT

Setiap request Edge Function memiliki:
- `auth.user.id`
- `auth.user.role`

Semua filter akses **DITENTUKAN DI BACKEND**, bukan frontend.

---

## 4. DASHBOARD – PROMOTOR

### 4.1 GET Daily Dashboard (Promotor)

**Endpoint**
GET /api/dashboard/promotor/daily

pgsql
Copy code

**Akses**
- Role: `promotor`

**Query Database**
```sql
SELECT *
FROM agg_daily_promoter
WHERE promoter_user_id = auth.user.id
AND agg_date = CURRENT_DATE;
Response

json
Copy code
{
  "total_input": number,
  "total_pending": number,
  "total_closed": number,
  "total_closing_direct": number,
  "total_closing_followup": number
}
4.2 GET Monthly Dashboard (Promotor)
Endpoint

swift
Copy code
GET /api/dashboard/promotor/monthly
Query

sql
Copy code
SELECT *
FROM agg_monthly_promoter
WHERE promoter_user_id = auth.user.id
AND agg_month = CURRENT_MONTH;
5. DASHBOARD – SPV & SATOR
5.1 GET Daily Team Dashboard
Endpoint

swift
Copy code
GET /api/dashboard/team/daily
Akses

Role: spv, sator

Query

sql
Copy code
SELECT *
FROM agg_daily_promoter
WHERE promoter_user_id IN (
  SELECT user_id
  FROM hierarchy
  WHERE atasan_id = auth.user.id
)
AND agg_date = CURRENT_DATE;
5.2 GET Monthly Team Dashboard
Endpoint

swift
Copy code
GET /api/dashboard/team/monthly
Query

sql
Copy code
SELECT *
FROM agg_monthly_promoter
WHERE promoter_user_id IN (
  SELECT user_id
  FROM hierarchy
  WHERE atasan_id = auth.user.id
)
AND agg_month = CURRENT_MONTH;
6. DASHBOARD – MANAGER AREA
6.1 GET Monthly Area Dashboard (Promotor)
Endpoint

swift
Copy code
GET /api/dashboard/area/promotor
Query

sql
Copy code
SELECT *
FROM agg_monthly_promoter
WHERE promoter_user_id IN (
  SELECT user_id
  FROM hierarchy
  WHERE area = auth.user.area
);
6.2 GET Monthly Area Dashboard (Store)
Endpoint

swift
Copy code
GET /api/dashboard/area/store
Query

sql
Copy code
SELECT *
FROM agg_monthly_store
WHERE store_id IN (
  SELECT store_id
  FROM hierarchy
  WHERE area = auth.user.area
);
7. DASHBOARD – SPC
7.1 GET SPC Dashboard
Endpoint

bash
Copy code
GET /api/dashboard/spc
Akses

Whitelist:

Manager Area

SPV Gery

SATOR Andri

Query

sql
Copy code
SELECT *
FROM agg_monthly_store
WHERE store_id IN (
  SELECT id FROM stores WHERE is_spc = true
);
8. TRANSAKSI (FORM & STATUS)
8.1 POST Create Submission
Endpoint

bash
Copy code
POST /api/submission/create
Action

Insert ke vast_finance_data_new

Tidak mengisi agregat langsung

8.2 POST Close Submission (Direct)
Endpoint

arduino
Copy code
POST /api/submission/close
Action

Update transaction_status = closed

Tidak insert conversions

8.3 POST Convert Submission (Follow-up)
Endpoint

bash
Copy code
POST /api/submission/convert
Action

Insert ke conversions

Update transaction_status = closed

9. ADMIN API
9.1 Reset PIN User
Endpoint

pgsql
Copy code
POST /api/admin/reset-pin
9.2 Set Target User
Endpoint

swift
Copy code
POST /api/admin/set-target
10. AGREGASI DATA
Agregasi:

TIDAK otomatis via trigger

Dijalankan via:

Edge Function

Cron

Manual job

Frontend TIDAK BOLEH memanggil query agregat langsung.

11. ERROR HANDLING
Semua endpoint wajib mengembalikan:

json
Copy code
{
  "success": boolean,
  "message": string
}
12. STATUS DOKUMEN
FINAL

WAJIB DIPATUHI

MENJADI PEGANGAN FRONTEND & BACKEND

TIDAK BOLEH DIUBAH TANPA KEPUTUSAN BISNIS

13. PENUTUP
Dengan API Contract ini:

Frontend aman

Backend jelas

Tidak ada debat angka

Sistem stabil jangka panjang

Dokumen ini adalah gerbang resmi akses data.

yaml
Copy code

---

### Rekomendasi Akhir Struktur `/docs`