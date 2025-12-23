# Panduan Migrasi UI ke shadcn/ui

## Status Migrasi (21 Desember 2024)

### ✅ SELESAI - Semua Halaman Sudah Dimigrate!

#### Base Setup:
- [x] Setup CSS variables di globals.css
- [x] Core components (button, input, alert, card, loading, drawer, label, skeleton)
- [x] Layouts (ManagerHeader, SpvHeader, DashboardLayout, BottomNav)

#### Halaman Utama:
- [x] app/login/page.tsx
- [x] app/unauthorized/page.tsx
- [x] app/input/page.tsx
- [x] app/pending/page.tsx
- [x] app/history/page.tsx
- [x] app/profile/page.tsx
- [x] app/report/page.tsx
- [x] app/admin/page.tsx

#### Dashboard Pages:
- [x] app/dashboard/promotor/page.tsx
- [x] app/dashboard/team/page.tsx
- [x] app/dashboard/team/daily/page.tsx
- [x] app/dashboard/team/performance/page.tsx
- [x] app/dashboard/team/underperform/page.tsx
- [x] app/dashboard/team/export/page.tsx
- [x] app/dashboard/area/page.tsx
- [x] app/dashboard/area/daily/page.tsx
- [x] app/dashboard/area/performance/page.tsx
- [x] app/dashboard/area/underperform/page.tsx
- [x] app/dashboard/area/target/page.tsx
- [x] app/dashboard/area/export/page.tsx
- [x] app/dashboard/store/page.tsx
- [x] app/dashboard/store/[storeId]/page.tsx

---

## Pola Migrasi yang Diterapkan

### 1. Import Components
```tsx
// OLD
import Loading from '@/components/ui/Loading';
import Alert from '@/components/ui/Alert';

// NEW
import { Loading } from '@/components/ui/loading';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
```

### 2. Text Colors → CSS Variables
```tsx
// OLD                    // NEW
text-gray-900         →   text-foreground
text-gray-800         →   text-foreground  
text-gray-700         →   text-foreground
text-gray-600         →   text-muted-foreground
text-gray-500         →   text-muted-foreground
text-gray-400         →   text-muted-foreground
```

### 3. Borders & Dividers
```tsx
// OLD                    // NEW
border-gray-100       →   border-border
border-gray-200       →   border-border
divide-gray-100       →   divide-border
divide-slate-100      →   divide-border
```

### 4. Backgrounds
```tsx
// OLD                    // NEW
bg-gray-50            →   bg-muted
bg-gray-100           →   bg-muted
bg-white rounded-xl   →   <Card><CardContent>
```

### 5. Status Colors (TETAP - Intentional)
```tsx
// Tetap menggunakan warna semantik untuk status:
text-green-600   // ACC/Success
text-orange-500  // Pending/Warning
text-red-600     // Reject/Error
bg-green-100     // Success background
bg-orange-100    // Warning background
bg-red-100       // Error background
```

---

## CSS Variables (globals.css)

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --card: 0 0% 100%;
  --card-foreground: 222.2 84% 4.9%;
  --muted: 210 40% 96.1%;
  --muted-foreground: 215.4 16.3% 46.9%;
  --border: 214.3 31.8% 91.4%;
  --input: 214.3 31.8% 91.4%;
  --ring: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;
  --destructive: 0 84.2% 60.2%;
  --success: 142.1 76.2% 36.3%;
  --warning: 38 92% 50%;
}
```

---

## File yang Dibuat Selama Migrasi

Helper scripts (bisa dihapus setelah migrasi):
- `fix_imports.py` - Fix import casing
- `migrate_css.py` - Batch migrate CSS classes
- `add_card_imports.py` - Add Card component imports
- `fix-imports.ps1` - PowerShell version (not used)

---

## Verifikasi

✅ Build sukses tanpa error
✅ Semua import menggunakan lowercase (`loading`, `alert`)
✅ Card imports sudah ditambahkan
✅ CSS variables sudah diterapkan
