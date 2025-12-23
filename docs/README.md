# VAST FINANCE – TRACKING & MONITORING SYSTEM

Aplikasi internal untuk **tracking kinerja promotor, SPV, SATOR, dan Manager Area**  
berbasis data agregat, konsisten, ringan, dan tahan jangka panjang.

Aplikasi ini **BUKAN sistem pengajuan kredit utama**,  
melainkan **sistem pencatatan & monitoring** untuk:
- memantau target
- mengukur follow-up
- menyajikan laporan otomatis
- menjaga konsistensi angka di semua level

---

## 1. TUJUAN SISTEM

- Mencatat pengajuan kredit HP
- Memonitor pencapaian harian & bulanan
- Membedakan:
  - closing langsung (direct)
  - closing hasil follow-up
- Menyediakan dashboard cepat & stabil (mobile-first)

---

## 2. PRINSIP UTAMA (WAJIB DIPATUHI)

1. **Dashboard TIDAK membaca data mentah**
2. **Semua angka berasal dari tabel agregat atau VIEW agregat**
3. **Frontend hanya konsumsi data**
4. **Logika bisnis ada di backend & database**
5. **Tidak ada asumsi di luar dokumen**

Jika prinsip ini dilanggar, sistem akan:
- menghasilkan angka tidak konsisten
- sulit dirawat
- rawan rusak di masa depan

---

## 3. TECH STACK

- **Frontend**: Next.js (App Router), Tailwind CSS
- **Backend**: Supabase (PostgreSQL)
- **Logic Layer**: Supabase Edge Functions
- **Deployment**: Vercel
- **Auth**: Supabase Auth + PIN
- **Target Device**: Mobile (PWA-first)

---

## 4. STRUKTUR DATA (RINGKAS)

### 4.1 Data Operasional (Aktif)
- `vast_finance_data_new`
- Digunakan untuk input berjalan & follow-up

### 4.2 Data Historis (Read-Only)
- `vast_finance_data_old`
- Digunakan untuk laporan masa lalu
- **Tidak boleh diubah**

---

### 4.3 Tabel Agregat (LIVE DASHBOARD)
Digunakan untuk monitoring harian & bulanan berjalan:

- `agg_daily_promoter`
- `agg_monthly_promoter`
- `agg_daily_store`
- `agg_monthly_store`

---

### 4.4 VIEW Agregat Gabungan (HISTORIS + BARU)
Digunakan untuk laporan lintas tahun:

- `v_agg_daily_promoter_all`
- `v_agg_monthly_promoter_all`
- `v_agg_monthly_store_all`
- (opsional) `v_agg_daily_store_all`

Dashboard **TIDAK PERLU tahu** data berasal dari old atau new.

---

## 5. ROLE & AKSES

| Role | Akses |
|-----|------|
| promotor | dashboard pribadi |
| spv | dashboard tim |
| sator | dashboard tim |
| manager | dashboard area & toko |
| admin | konfigurasi & kontrol |

SPC:
- berdasarkan `stores.is_spc = true`
- akses via whitelist (hardcoded)

---

## 6. STRUKTUR DOKUMEN (WAJIB DIBACA)

Semua aturan sistem ada di folder `/docs`.

/docs
├── DATABASE_NORMALIZED_SPEC.md
├── READ_CONTRACT_DASHBOARD.md
├── ARCHITECTURE_OVERVIEW.md
├── FRONTEND_DATA_MAPPING_CHECKLIST.md
├── AUTH_LOGIN_FLOW.md
├── API_CONTRACT.md
├── HISTORICAL_DATA_STRATEGY.md
└── DESIGN_EVOLUTION_NOTE.md

yaml
Copy code

👉 **Developer / agent WAJIB membaca folder ini sebelum coding.**

---

## 7. DOKUMEN PALING PENTING (URUTAN BACA)

Untuk developer baru, baca berurutan:
1. `DESIGN_EVOLUTION_NOTE.md`
2. `ARCHITECTURE_OVERVIEW.md`
3. `DATABASE_NORMALIZED_SPEC.md`
4. `READ_CONTRACT_DASHBOARD.md`
5. `API_CONTRACT.md`
6. `FRONTEND_DATA_MAPPING_CHECKLIST.md`

Urutan ini **menghindari salah paham desain**.

---

## 8. CARA MEMULAI (DEVELOPER)

1. Clone repository
2. Baca seluruh folder `/docs`
3. Setup Supabase & environment variable
4. Implement Edge Functions sesuai `API_CONTRACT.md`
5. Bangun frontend **tanpa menghitung manual**

---

## 9. HAL YANG PALING SERING SALAH (DILARANG)

❌ Query `vast_finance_data_new` di dashboard  
❌ Query `vast_finance_data_old` langsung di UI  
❌ Menggabungkan data lama & baru di frontend  
❌ Menghitung pending / closing manual  

Jika angka tidak cocok:
👉 **cek agregat atau VIEW terlebih dahulu**

---

## 10. FILOSOFI DESAIN

Sistem ini dirancang untuk:
- dipakai 5–10 tahun
- maintenance minimal
- user bertambah
- resource terbatas (free tier)

Karena itu:
- desain sederhana
- logika terkunci
- dokumentasi lengkap
- tidak bergantung pada satu orang

---

## 11. PENUTUP

Dengan mengikuti seluruh dokumen di `/docs`:
- angka konsisten
- agent mudah berganti
- sistem stabil jangka panjang
- tidak perlu penjelasan ulang

📌 **Folder `/docs` adalah sumber kebenaran tunggal.**

---

Maintained by internal team.