# UPDATE TABEL SPC EXPORT

## ✅ PERUBAHAN YANG DILAKUKAN

Berdasarkan request user untuk memperbaiki tabel export SPC:

### 1. **Tampilkan Semua Toko**
- ❌ Sebelumnya: Tabel hanya menampilkan 8 toko pertama (`.slice(0, 8)`) dengan "... dan X toko lainnya"
- ✅ Sekarang: **SEMUA toko ditampilkan** tanpa batasan

### 2. **Hapus Kolom KODE**
- ❌ Sebelumnya: Tabel memiliki kolom KODE untuk store_code
- ✅ Sekarang: **Kolom KODE dihapus** dari tabel dan Excel export

### 3. **Tampilkan Detail Promotor**
- ✅ **Nama Toko** ditampilkan sebagai header row (bold, dengan background purple)
- ✅ **Nama Promotor** ditampilkan di bawah toko dengan:
  - Indentasi (↳ prefix)
  - Font lebih kecil
  - Hanya menampilkan INPUT promotor
  - Kolom TARGET, %, dan CLOSING menampilkan "-"
- ✅ Jika toko **tidak ada promotor**: menampilkan "(Tidak ada promotor)"

---

## 📋 STRUKTUR TABEL BARU

### **Kolom Tabel:**
```
TOKO / PROMOTOR | TARGET | INPUT | % | CLOSING
```

### **Format Data:**
```
🏪 TOKO ALFA (row toko - bold, background purple)
   100 | 85 | 85% | 70

   ↳ Budi Santoso (row promotor - indented, small font)
   - | 45 | - | -

   ↳ Siti Aminah
   - | 40 | - | -

🏪 TOKO BETA
   150 | 120 | 80% | 95
   
   (Tidak ada promotor)
```

---

## 🔧 IMPLEMENTASI TEKNIS

### **Data Fetching:**
```typescript
// Fetch promotor per toko SPC
const { data: promotorData } = await supabase
    .from('users')
    .select('id, name')
    .eq('role', 'promotor')
    .eq('store_id', store.store_id);

// Get input count per promotor
const { data: inputData } = await supabase
    .from('submissions')
    .select('id')
    .eq('user_id', promotor.id)
    .gte('created_at', `${monthStr}-01`)
    .lt('created_at', `${monthStr}-32`);
```

### **Excel Export:**
**Sheet 1: SPC_PERFORMANCE** (Data Toko)
- Kolom: TOKO, TARGET, INPUT, INPUT_%, CLOSING, PENDING, REJECT, STATUS, JUMLAH_PROMOTOR
- **Hapus kolom KODE**
- Tambah kolom JUMLAH_PROMOTOR

**Sheet 2: SPC_PROMOTOR_DETAIL** (BARU!)
- Kolom: TOKO, PROMOTOR, INPUT
- Detail setiap promotor di setiap toko
- Jika tidak ada promotor: "(Tidak ada promotor)"

**Sheet 3: SPC_SUMMARY**
- Tetap sama

---

## 📊 VISUALISASI TABEL

### **Row Styling:**
- **Toko Row**: 
  - Background: `bg-purple-50/50` (normal) atau `bg-destructive/10` (underperform)
  - Font: Bold, larger padding
  - Border: `border-purple-200/50`

- **Promotor Row**:
  - Background: `bg-white` / `dark:bg-gray-900`
  - Font: Text kecil (`text-[10px]` atau `text-xs`)
  - Indentasi: `pl-6` atau `pl-8`
  - Prefix: `↳` untuk visual hierarchy
  - Border: `border-purple-100/30`

---

## 📁 FILE YANG DIUBAH

### 1. **SPV Export** (`/app/dashboard/team/export/page.tsx`)
✅ Interface StoreData + field`promotors`
✅ Fetch promotor detail per toko
✅ Excel: hapus KODE, tambah SPC_PROMOTOR_DETAIL sheet
✅ Tabel: tampilkan semua toko + promotor, hapus kolom KODE

### 2. **Manager Export** (`/app/dashboard/area/export/page.tsx`)
✅ Interface StoreData + field `promotors`
✅ Fetch promotor detail per toko
✅ Excel: hapus KODE, tambah SPC_PROMOTOR_DETAIL sheet
✅ Tabel: tampilkan semua toko + promotor, hapus kolom KODE

---

## 🎯 HASIL AKHIR

### **Tabel Preview:**
- ✅ Tampilkan SEMUA toko (tidak ada "... dan X toko lainnya")
- ✅ Header: "TOKO / PROMOTOR | TARGET | INPUT | % | CLOSING"
- ✅ Setiap toko diikuti detail promotor di bawahnya
- ✅ Visual hierarchy jelas dengan indentasi dan styling

### **Excel Export:**
- ✅ Sheet SPC_PERFORMANCE: data toko tanpa kolom KODE, tambah JUMLAH_PROMOTOR
- ✅ Sheet SPC_PROMOTOR_DETAIL: detail promotor per toko (TOKO | PROMOTOR | INPUT)
- ✅ Sheet SPC_SUMMARY: ringkasan total

---

**Status**: ✅ **SELESAI**  
**Tanggal**: 2025-12-24  
**Waktu**: 12:35 WIB
