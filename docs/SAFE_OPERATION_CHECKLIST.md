# SAFE OPERATION CHECKLIST

Panduan singkat untuk perubahan kecil yang aman pada project yang sudah dipakai user aktif.

---

## 1. Backup Minimum

Sebelum ubah apa pun, pastikan data berikut tersimpan di tempat aman:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- Vercel `projectId`
- Vercel `orgId`
- Git remote repo
- branch aktif yang sedang dipakai deploy
- daftar Edge Function yang paling sering berubah

File penting:

- `.env.local`
- `.env.vercel`
- `.vercel/project.json`

---

## 2. Klasifikasi Perubahan

### A. Perubahan UI / Next.js

Contoh:

- ubah label
- ubah card
- ubah tabel
- ubah export image template

Butuh deploy:

- Vercel / web app

### B. Perubahan Edge Function Supabase

Contoh:

- query dashboard
- validasi backend
- logic SPC
- logic input / pending / conversion

Butuh deploy:

- Supabase Edge Function

### C. Perubahan Database

Contoh:

- migration
- view
- function SQL
- backfill data

Butuh deploy:

- migration / SQL apply ke project database

Catatan:

Jangan anggap perubahan lokal otomatis live. Pastikan jenis perubahannya jelas dulu.

---

## 3. Alur Kerja Aman

1. Reproduksi masalah di lokal atau dengan data nyata.
2. Tentukan perubahan termasuk kategori A, B, atau C.
3. Ubah sekecil mungkin.
4. Verifikasi file yang diubah.
5. Deploy hanya komponen yang terdampak.
6. Cek hasil live setelah deploy.

Jika 1 perubahan menyentuh lebih dari 1 kategori:

- deploy berdasarkan urutan risiko paling rendah
- cek hasil tiap tahap sebelum lanjut
- jangan anggap deploy Vercel otomatis ikut mengubah Edge Function Supabase

---

## 4. Checklist Sebelum Deploy

### Untuk perubahan UI / Next.js

- [ ] Halaman bisa dibuka tanpa error lokal
- [ ] Label dan angka sudah sesuai
- [ ] Tidak ada layout yang pecah di mobile
- [ ] File yang diubah memang hanya bagian UI yang dimaksud
- [ ] Sudah tahu halaman ini butuh deploy ke Vercel, bukan Supabase

### Untuk perubahan Edge Function

- [ ] Query hanya ambil data yang benar
- [ ] Role / akses tetap aman
- [ ] Tidak mengubah definisi bisnis tanpa sengaja
- [ ] Sudah dipastikan function yang benar yang di-deploy
- [ ] Sudah disiapkan 1 contoh data nyata untuk verifikasi sesudah deploy

### Untuk perubahan Database

- [ ] Query dicek read-only dulu jika memungkinkan
- [ ] Paham dampak ke dashboard, export, dan target
- [ ] Ada backup / rollback plan
- [ ] Tidak menjalankan SQL destruktif tanpa verifikasi
- [ ] Nama migration / SQL jelas dan bisa ditelusuri lagi

---

## 5. Hal Yang Jangan Dilakukan

- Jangan refactor besar saat tidak ada bug nyata.
- Jangan deploy banyak perubahan berbeda sekaligus.
- Jangan ubah database live hanya untuk "merapikan" struktur.
- Jangan campur perubahan UI, Edge Function, dan SQL dalam satu deploy tanpa alasan kuat.
- Jangan `git add .` pada worktree yang sangat dirty.

---

## 6. Prioritas Aman

### Wajib dikerjakan

- bug yang membuat angka salah
- bug yang membuat halaman tidak bisa dipakai
- mismatch data master vs dashboard

### Aman bertahap

- konsistensi label
- total di tabel
- warning UX
- sinkronisasi field ganda

### Tunda dulu

- refactor arsitektur
- redesign besar
- migrasi data besar
- bersih-bersih seluruh repo

---

## 7. Catatan Kasus Nyata di Project Ini

Beberapa masalah yang sudah pernah muncul:

- target SPC salah karena query baca `users.store_id`, padahal assignment toko aktif disimpan di `hierarchy.store_id`
- istilah `ACC` dan `Closing` dipakai ganda untuk angka yang sama
- perubahan edge function tidak langsung terlihat kalau belum di-deploy ke Supabase

Pelajaran:

- selalu cek sumber data sebenarnya
- pastikan tahu perubahan perlu deploy ke mana

---

## 8. Verifikasi Setelah Deploy

Setelah deploy, cek minimal:

- halaman yang terkena perubahan
- satu contoh data yang sebelumnya salah
- satu contoh data yang sebelumnya benar
- satu role lain yang ikut memakai logic yang sama

Tujuannya:

- memastikan bug fixed
- memastikan tidak ada regresi baru

---

## 9. Smoke Test Cepat

Kalau perubahan menyentuh dashboard atau target, cek urutan ini:

1. Login dengan role yang terdampak.
2. Buka dashboard utama dan pastikan tidak ada blank/error.
3. Cek 1 angka yang memang diubah oleh fix.
4. Cek export atau tabel turunan jika halaman itu punya ringkasan.
5. Cek role lain yang ikut memakai source data yang sama.

Contoh:

- perubahan SPC:
  cek tabel toko, target toko, dan toko dengan `0 input`
- perubahan target:
  cek save target, warning, dan tampilan progress bawahannya
- perubahan produk:
  cek admin master produk, form input promotor, dan validasi backend
