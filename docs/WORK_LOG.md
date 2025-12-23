# WORK LOG - VAST FINANCE

---

## 17 Desember 2025, 13:00 - 15:30 WIB

### PEKERJAAN SELESAI:

#### 1. Fix Form Submit Error 500
- Edge Function `submission-create` error karena pakai kolom `approval_status` & `transaction_status` yang belum ada
- Solusi: Ubah ke kolom `status` lama (`acc`, `pending`, `reject`)
- File: `supabase/functions/submission-create/index.ts`

#### 2. Fix Constraint Pekerjaan
- Opsi pekerjaan frontend tidak sesuai constraint database `vfdn_pekerjaan_check`
- Update opsi: PNS, Pegawai Swasta, Buruh, Pelajar, IRT, Tidak Bekerja, Lainnya
- File: `app/input/page.tsx`

#### 3. Fix History Data Tidak Muncul
- VIEW `v_agg_monthly_promoter_all` tidak include `vast_finance_data_new`
- Update VIEW query dari 3 sumber: `vast_finance_data_old`, `agg_monthly_promoter`, `vast_finance_data_new`
- Sama untuk VIEW `v_agg_daily_promoter_all`

#### 4. Buat Fitur Conversion (Follow-up Pending)
- Edge Function `pending-list` - ambil daftar transaksi pending
- Edge Function `conversion-create` - convert pending ke closing
- Halaman `app/pending/page.tsx` - UI untuk follow-up
- Tabel `conversions` digunakan untuk tracking follow-up

#### 5. Update VIEW dengan Conversion Logic
- `total_closing_direct` = ACC tanpa record di conversions
- `total_closing_followup` = ACC dengan record di conversions

#### 6. Update Navigasi Bottom Nav
- Tambah menu Pending untuk role promotor (jadi 5 menu)
- File: `config/navigation.ts`, `components/BottomNav.tsx`

#### 7. Update Header Semua Halaman
- Design modern dengan gradient card
- Tampilkan nama promotor & nama toko
- Halaman: Dashboard, Input, History, Pending

#### 8. Refactor History Page
- Tampilkan per pengajuan individual (bukan agregat harian)
- Popup detail saat klik pengajuan
- Dropdown bulan pakai BottomSheetSelect
- Edge Function `submission-list` query dari NEW + OLD tables

#### 9. Fix UX Mobile
- `inputMode="numeric"` untuk field Rupiah (keyboard angka otomatis)
- Hapus auto-focus search di dropdown
- Fix padding tombol tertutup navigasi

#### 10. Fix Dashboard Data
- Update Edge Function `dashboard-promotor-daily` & `dashboard-promotor-monthly`
- Hapus kolom `target` dari query (tidak ada di VIEW)
- Tambah logging untuk debug

---

### EDGE FUNCTIONS DEPLOYED:
- `submission-create`
- `submission-list`
- `pending-list`
- `conversion-create`
- `dashboard-promotor-daily`
- `dashboard-promotor-monthly`
- `promotor-history`

---

### YANG BELUM SELESAI:

#### 1. Data Lama di History - Customer Name
- **Masalah:** `vast_finance_data_old` tidak punya kolom `customer_name`
- **Saat ini:** Tampil sebagai `sale_id` (kode tidak jelas)
- **Solusi yang perlu:** Cek kolom lain atau tampilkan "Data Historis"

#### 2. Target Bulanan
- **Masalah:** Tabel `targets` belum ada atau belum diisi
- **Dampak:** Target di dashboard selalu 0

#### 3. Kolom vast_finance_data_old
- Struktur berbeda dari `vast_finance_data_new`
- Kolom yang ada: id, sale_id, sale_date, promoter_id, store_id, promoter_name, raw_json (kosong)
- Tidak ada: customer_name, customer_phone, status, limit_amount, dp_amount, tenor, pekerjaan, penghasilan, has_npwp, image_urls

---

### CATATAN TEKNIS:

#### User ID Mapping
- New ID: `218f4692-3309-4fc5-bab0-8bd119af7b7e`
- Old ID: `a2189ae0-e851-4f50-8009-161fa39c4d89`
- Tabel: `user_id_mapping`

#### Database Constraints
- `vfdn_pekerjaan_check`: PNS, Pegawai Swasta, Buruh, Pelajar, IRT, Tidak Bekerja, Lainnya

#### Status Mapping (sesuai DATABASE_NORMALIZED_SPEC.md)
- `acc` = approved + closed (closing langsung)
- `pending` = approved + not_closed (belum ambil HP)
- `reject` = rejected + not_closed

---

### FILES YANG DIUBAH:
```
app/input/page.tsx
app/history/page.tsx
app/pending/page.tsx (baru)
app/dashboard/promotor/page.tsx
config/navigation.ts
components/BottomNav.tsx
components/ui/BottomSheetSelect.tsx
supabase/functions/submission-create/index.ts
supabase/functions/submission-list/index.ts (baru)
supabase/functions/pending-list/index.ts (baru)
supabase/functions/conversion-create/index.ts (baru)
supabase/functions/dashboard-promotor-daily/index.ts
supabase/functions/dashboard-promotor-monthly/index.ts
```

---
