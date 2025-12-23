# DATABASE NORMALIZED SPECIFICATION
## VAST FINANCE – TRACKING & MONITORING SYSTEM

---

## 1. TUJUAN DOKUMEN

Dokumen ini dibuat untuk:
- Menghilangkan kebingungan status pengajuan
- Menormalkan makna data transaksi
- Menjadi **sumber kebenaran tunggal** (single source of truth)
- Memastikan agent / developer baru **langsung paham**
- Menjadi dasar perubahan database yang AMAN ke depan

Dokumen ini **WAJIB dibaca sebelum menyentuh database atau kode**.

---

## 2. MASALAH UTAMA PADA DATABASE SAAT INI

Saat ini, kolom `vast_finance_data_new.status`:
- Memuat **lebih dari satu arti bisnis**
- Digunakan untuk:
  - status approval kredit
  - status pembelian HP
  - status pending follow-up

Akibatnya:
- `acc` ambigu (approved vs closing)
- `pending` ambigu (approved tapi belum beli)
- `conversions` tidak jelas perannya

Ini menyebabkan:
- agent bingung
- query rumit
- agregat rawan salah
- sistem sulit dirawat jangka panjang

---

## 3. PRINSIP NORMALISASI (DIKUNCI)

### Prinsip 1
**Satu kolom = satu arti bisnis**

### Prinsip 2
**Approval ≠ Transaksi ≠ Event Follow-up**

### Prinsip 3
Data lama **TIDAK dirusak**, hanya dinormalkan ke depan

---

## 4. DEFINISI KONSEP BISNIS (FINAL)

### 4.1 STATUS APPROVAL (URUSAN KREDIT)

Menjawab pertanyaan:
> “Apakah pengajuan kredit disetujui?”

Nilai VALID:
- `approved`
- `rejected`

Makna:
- `approved` → konsumen dapat limit
- `rejected` → konsumen tidak dapat limit

❗ Approval **TIDAK berarti beli HP**

---

### 4.2 STATUS TRANSAKSI (URUSAN PEMBELIAN HP)

Menjawab pertanyaan:
> “Apakah konsumen jadi ambil HP?”

Nilai VALID:
- `not_closed`
- `closed`

Makna:
- `not_closed` → belum ambil HP
- `closed` → sudah ambil HP

❗ Transaksi **TIDAK peduli proses kredit**

---

### 4.3 JENIS CLOSING (URUSAN ANALITIK)

Menjawab pertanyaan:
> “Kalau sudah beli, belinya lewat apa?”

Nilai VALID:
- `direct`
- `followup`

Makna:
- `direct` → approved dan langsung beli
- `followup` → approved, pending, lalu beli

❗ Ini **BUKAN status utama**, hanya atribut analitik

---

## 5. PERAN TABEL `vast_finance_data_new`

Tabel ini adalah:
- **RAW TRANSACTION TABLE**
- Source of truth transaksi

### Kolom LEGACY
- `status` (`acc`, `pending`, `reject`)
- Tetap disimpan
- **TIDAK dipakai untuk logic baru**

---

## 6. PERAN TABEL `conversions`

### Definisi FINAL
Tabel `conversions` adalah:
> **BUKTI bahwa transaksi pending  
> berhasil menjadi closing melalui follow-up**

Aturan keras:
- Jika ADA record di `conversions`
  → closing_type = `followup`
- Jika TIDAK ada
  → closing_type = `direct`

❗ `conversions` bukan transaksi baru  
❗ `conversions` bukan sekadar edit DP

---

## 7. KONDISI TRANSAKSI (TIDAK BOLEH AMBIGU)

| Approval Status | Transaction Status | Conversion | Arti Manusia |
|---------------|------------------|-----------|-------------|
| approved | closed | tidak ada | Closing langsung |
| approved | not_closed | tidak ada | Pending |
| approved | closed | ada | Closing hasil follow-up |
| rejected | not_closed | tidak ada | Ditolak |

❗ Tidak ada kondisi lain  
❗ Jika ada → DATA SALAH

---

## 8. MAPPING DATA LAMA (FAKTA, BUKAN OPINI)

Mapping dari `status` lama:

| status lama | approval_status | transaction_status |
|------------|-----------------|--------------------|
| acc | approved | closed |
| pending | approved | not_closed |
| reject | rejected | not_closed |

Closing type:
- Jika `status = acc` DAN ada record di `conversions`
  → `followup`
- Jika `status = acc` DAN tidak ada record
  → `direct`

---

## 9. ATURAN KERAS (WAJIB DIPATUHI)

1. Target **HANYA** dihitung dari:
   - `transaction_status = closed`
2. Pending **TIDAK PERNAH** dihitung target
3. Approval **tidak sama** dengan closing
4. Conversion **selalu berarti follow-up**
5. Logic baru **TIDAK boleh** pakai kolom `status` lama

---

## 10. DAMPAK POSITIF NORMALISASI

Dengan struktur ini:
- Agent baru paham < 10 menit
- Tidak perlu jelasin ulang
- Dashboard sederhana
- Agregat mudah & aman
- Sistem tahan lama (5–10 tahun)

---

## 11. STATUS DOKUMEN

- FINAL
- WAJIB DIJADIKAN PEGANGAN
- DATABASE BELUM DIUBAH
- PERUBAHAN DB BARU BOLEH SETELAH DOKUMEN INI DISETUJUI
