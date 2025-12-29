# PWA ICONS SETUP GUIDE

## Instruksi Membuat PWA Icons

PWA membutuhkan icon dengan ukuran 192x192px dan 512x512px. Berikut cara membuat icon:

### Option 1: Menggunakan Online Generator
1. Buka https://www.pwabuilder.com/imageGenerator
2. Upload logo/icon aplikasi SMARA
3. Generate semua ukuran icon yang diperlukan
4. Download dan extract
5. Copy file `icon-192x192.png` dan `icon-512x512.png` ke folder `public/`

### Option 2: Manual dengan Design Tool
1. Buat design icon dengan ukuran 512x512px
2. Gunakan gradient purple (#7c3aed ke #6b21a8) sebagai background
3. Tambah logo/text "S" untuk SMARA di center
4. Export sebagai PNG:
   - `icon-512x512.png` (512x512px)
   - `icon-192x192.png` (192x192px - resize dari 512px)
5. Copy ke folder `public/`

### Design Guidelines
- Background: Purple gradient (#7c3aed to #6b21a8)
- Logo: White "S" letter, bold, modern font
- Style: Clean, minimalist, professional
- Format: PNG with transparency support
- Safe area: Keep important elements 10% from edges

### Verify Installation
Setelah icons ditambahkan, verify:
1. File exists: `public/icon-192x192.png`
2. File exists: `public/icon-512x512.png`
3. Build app: `npm run build`
4. Check manifest di browser DevTools > Application > Manifest
5. Test PWA installability di browser

## Testing PWA
1. Build production: `npm run build && npm start`
2. Open browser DevTools > Application tab
3. Check "Manifest" section - harus ada 2 icons
4. Check "Service Workers" - harus registered
5. Click "Install" button di browser untuk test PWA installation

## Troubleshooting
- Icon tidak muncul? Clear cache dan rebuild
- PWA tidak installable? Check manifest.json syntax
- Service worker error? Check next.config.ts PWA settings
