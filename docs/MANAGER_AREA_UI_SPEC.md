# VAST Finance - Manager Area Dashboard UI Documentation

**Dokumentasi untuk Planning UI Design di Google Stitch**

---

## Overview

Manager Area adalah dashboard untuk **Manager** yang mengelola semua area (SPV) di bawahnya. Fokus utama: **BIG PICTURE** - melihat keseluruhan performa semua area.

### Struktur Menu (5 Menu Utama)

| No | Menu | Icon | Path | Deskripsi |
|----|------|------|------|-----------|
| 1 | Dashboard | 🏠 | `/dashboard/area` | Overview semua AREA |
| 2 | Tim (Performance) | 👥 | `/dashboard/area/performance` | Performance AREA/SATOR/PROMOTOR |
| 3 | Under (Underperform) | 📉 | `/dashboard/area/underperform` | Yang tertinggal |
| 4 | Target | 🎯 | `/dashboard/area/target` | Set target AREA & SATOR |
| 5 | Export | 📤 | `/dashboard/area/export` | Laporan lengkap |

**+ 1 Halaman Tambahan (via Dashboard):**
| Daily | - | `/dashboard/area/daily` | Progress harian detail |

---

## 1. Dashboard (`/dashboard/area`)

### Header
- Judul: "MANAGER AREA | DASHBOARD"
- Subtitle: Nama user
- Icon: 🏠

### Komponen UI

#### 1.1 Card: Tanggal & Time Gone
- **Kiri:**
  - Label: "HARI INI"
  - Value: Tanggal lengkap (contoh: "Senin, 23 Desember 2024")
- **Kanan:**
  - Label: "TIME GONE"
  - Value: Persentase bulan yang sudah lewat (contoh: "75%")

#### 1.2 Card: Progress Hari Ini (Clickable → Daily Page)
- **Header:**
  - Judul: "PROGRESS HARI INI"
  - Angka besar: Total Input hari ini
- **Metrics (3 kolom):**
  - CLOSED | PENDING | REJECT
- **Footer:**
  - Promotor aktif (hijau)
  - Promotor kosong (merah)
  - Link: "Lihat Detail →"

#### 1.3 Card: Area Summary
- **Header:** "AREA SUMMARY (X)" - X = jumlah area
- **List per Area:**
  - Nama Area + SPV
  - Progress bar (merah/hijau berdasarkan underperform)
  - Persentase pencapaian
  - Metrics: TGT | INP | CLS | PND | REJ

### Warna Status
- **Hijau (Success):** Performa on-track (% input >= % time gone)
- **Merah (Destructive):** Underperform (% input < % time gone)

---

## 2. Performance (`/dashboard/area/performance`)

### Header
- Judul: "MANAGER AREA | PERFORMANCE"
- Subtitle: Tanggal
- Icon: 👥

### Komponen UI

#### 2.1 Breadcrumb/Navigation
- Tombol "← Kembali" (muncul jika sudah drill-down)
- Display current selection: AREA → SATOR

#### 2.2 Tab Switch (3 Tab)
| Tab | Fungsi |
|-----|--------|
| **AREA** | Lihat semua area |
| **SATOR** | Lihat sator di area terpilih |
| **PROMOTOR** | Lihat promotor di sator terpilih |

#### 2.3 Tabel Performance
| Kolom | Deskripsi |
|-------|-----------|
| NAMA | Nama user |
| TGT | Target |
| INP | Input |
| % | Persentase pencapaian |
| CLS | Closing |
| PND | Pending |
| REJ | Reject |

- **Row highlight:** Background merah jika underperform
- **Clickable:** Tap baris untuk drill-down ke level berikutnya

#### 2.4 Legend
- Kotak merah = Underperform
- Info: "Tap baris untuk drill-down"

---

## 3. Underperform (`/dashboard/area/underperform`)

### Header
- Judul: "MANAGER AREA | UNDERPERFORM"
- Subtitle: Tanggal
- Icon: 📉

### Komponen UI

#### 3.1 Summary Cards (3 Kolom)
| Card | Isi |
|------|-----|
| AREA | Jumlah area underperform |
| SATOR | Jumlah sator underperform |
| PROMOTOR | Jumlah promotor underperform |

#### 3.2 Tab Switch (3 Tab)
- AREA (X) | SATOR (X) | PROMOTOR (X)
- X = jumlah underperform per level

#### 3.3 Tabel Underperform
| Kolom | Deskripsi |
|-------|-----------|
| NAMA | Nama user |
| AREA | Parent area (untuk sator/promotor) |
| TGT | Target |
| INP | Input saat ini |
| % | Persentase pencapaian |
| GAP | Selisih dengan time gone (contoh: -15%) |

- Semua row berwarna merah (semua underperform)
- Jika kosong: "🎉 Tidak ada yang underperform!"

---

## 4. Target (`/dashboard/area/target`)

### Header
- Judul: "MANAGER AREA | TARGET"
- Subtitle: Tanggal
- Icon: 🎯

### Komponen UI

#### 4.1 Tab Switch (2 Tab)
| Tab | Fungsi |
|-----|--------|
| AREA (X) | Set target per AREA |
| SATOR | Set target per SATOR |

#### 4.2 List Target
**Per Item:**
- Nama (+ Area untuk SATOR)
- Input field: Angka target (editable)
- Indicator: "Sebelumnya: X → Baru: Y" (jika berubah)

#### 4.3 Tombol Simpan
- "💾 SIMPAN TARGET"
- Disabled jika tidak ada perubahan
- Loading state: "⏳ Menyimpan..."

### Perilaku
- Target untuk bulan DEPAN (bukan bulan ini)
- Perubahan di-highlight dengan warna kuning

---

## 5. Export (`/dashboard/area/export`)

### Header
- Judul: "MANAGER AREA | EXPORT"
- Subtitle: "Tarik laporan lengkap"
- Icon: 📤

### Komponen UI

#### 5.1 Card: Sumber Data (Checkbox)
| Option | Detail |
|--------|--------|
| ☑️ PERFORMANCE | X AREA, Y SATOR, Z PROMOTOR |
| ☑️ UNDERPERFORM | N orang tertinggal |
| ☑️ SUMMARY | Ringkasan keseluruhan |

#### 5.2 Card: Format (Checkbox)
| Option | Detail |
|--------|--------|
| ☑️ EXCEL (.XLSX) | Multi-sheet lengkap |
| ☐ PNG (2 GAMBAR) | Tabel AREA + SATOR |

#### 5.3 Preview Tables
**Tabel AREA:**
- Header: "LAPORAN AREA" + nama manager + periode
- Kolom: AREA | TGT | INP | % | CLS | PND | REJ

**Tabel SATOR:**
- Header: "LAPORAN SATOR" + nama manager + periode
- Kolom: NAMA | AREA | TGT | INP | % | CLS

#### 5.4 Tombol Export
- "📥 TARIK DATA"
- Loading state: "⏳ Mengekspor..."

---

## 6. Daily (`/dashboard/area/daily`)

### Header
- Judul: "PROGRESS HARIAN"
- Subtitle: Tanggal formatted
- Back button: → Dashboard

### Komponen UI

#### 6.1 Area Selection Tabs (4 Tab)
- **All** (total input semua area)
- **KPG** (Kupang)
- **SMB** (Sumba)
- **Kab** (Kabupaten)
- dst...

#### 6.2 Summary Card
- **Input Hari Ini:** Angka besar
- **Metrics:** CLS | PND | REJ
- **Promotor Stats:** X aktif, Y kosong, Z total

#### 6.3 Quick Filter (3 Button)
| Filter | Fungsi |
|--------|--------|
| Semua | Tampilkan semua promotor |
| Kosong (X) | Hanya yang belum input |
| Reject (X) | Hanya yang ada reject |

#### 6.4 Hierarchical List
**Per Area:**
- Header hijau: Nama Area + SPV + Metrics
- **Per Sator:**
  - Nama + total input
  - **Per Promotor:**
    - Status indicator (dot: hijau/merah/kuning)
    - Nama
    - Metrics atau "KOSONG"
    - Arrow: Klik untuk detail

#### 6.5 Modal: Detail Promotor (Popup dari bawah)
- **Header:** Nama promotor + "Pengajuan Hari Ini"
- **Stats Cards:** Input | Closed | Pending | Reject
- **List Submissions:**
  - #1 Nama customer
  - Status badge (ACC/PENDING/REJECT)
  - Phone | Limit | Tenor
  - Photo thumbnails (max 3)

#### 6.6 Modal: Detail Submission (Popup dari bawah)
- **Status badge besar** (center)
- **Card Data Customer:**
  - Nama, No HP, Pekerjaan, Penghasilan, NPWP
- **Card Data Kredit:**
  - Tanggal, Limit, DP, Tenor
- **Card Foto:**
  - Grid foto dokumentasi (2 kolom)

---

## Catatan Desain

### Warna & Status
| Status | Warna | Penggunaan |
|--------|-------|------------|
| Success (On-track) | Hijau | % >= time gone |
| Warning (Pending) | Kuning | Status pending |
| Destructive (Underperform/Reject) | Merah | % < time gone |
| Primary | Warna utama tema | Header, tombol aktif |

### Pola Interaksi
1. **Drill-down:** Tap item untuk masuk ke detail
2. **Filter:** Tab/button untuk filter data
3. **Modal popup:** Slide up dari bawah untuk detail
4. **Clickable card:** Card dengan panah → menuju halaman lain

### Responsive Consideration
- Semua halaman dirancang untuk mobile-first
- Tabel horizontal scrollable jika terlalu lebar
- Modal full-width dengan rounded corner atas
