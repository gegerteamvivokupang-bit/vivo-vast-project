```md
# AUTH & LOGIN FLOW
## SUPABASE + NEXT.JS + PWA

---

## 1. TUJUAN

Dokumen ini menjelaskan:
- Alur login user
- Cara auth bekerja
- Role & akses dashboard
- Strategi PWA (jarang logout)

---

## 2. PRINSIP AUTH (DIKUNCI)

1. **Email + PIN**
2. Tidak pakai password kompleks
3. Admin bisa reset PIN
4. User jarang logout
5. Session panjang (PWA friendly)

---

## 3. IDENTITAS USER

### 3.1 Primary Identity
- `users.id` (UUID)

### 3.2 Secondary Identity
- `email` (unik, boleh fiktif)
- `employee_id` (unik, internal)

❗ Frontend **TIDAK PERNAH** pakai employee_id sebagai auth token.

---

## 4. ALUR LOGIN

### STEP 1 — INPUT
User memasukkan:
- Email
- PIN

---

### STEP 2 — AUTH SUPABASE
- Supabase Auth (email-based)
- PIN diverifikasi di backend (Edge Function)

---

### STEP 3 — LOAD PROFILE
Setelah login sukses:
```sql
SELECT *
FROM users
WHERE id = auth.user.id
Ambil:

role

status

promotor_status

STEP 4 — REDIRECT
Berdasarkan role:

promotor → /dashboard/promotor

spv / sator → /dashboard/team

manager → /dashboard/area

admin → /admin

5. SESSION & PWA STRATEGY
Session disimpan di:

Supabase Auth

Local storage (PWA)

Auto refresh token

Logout hanya jika:

manual

user di-disable admin

6. ROLE & AKSES
Role	Akses
promotor	dashboard pribadi
spv	dashboard tim
sator	dashboard tim
manager	dashboard area + toko
admin	full akses

SPC:

hardcoded whitelist

dicek di frontend & backend

7. RESET & GANTI PIN
Reset oleh Admin
Admin pilih user

Admin set PIN baru

User login ulang

Ganti PIN oleh User
Login aktif

Masukkan PIN lama

Set PIN baru

8. SECURITY NOTE (REALISTIS)
Tidak ada data finansial sensitif

Risiko rendah

Fokus ke usability & stabilitas

Tidak over-engineering

9. ERROR HANDLING
Salah PIN → pesan sederhana

Akun inactive → blok login

Session expired → silent refresh

10. STATUS DOKUMEN
FINAL

DIGUNAKAN FRONTEND & BACKEND

TIDAK BOLEH DIUBAH TANPA KEPUTUSAN BISNIS

Dokumen ini memastikan login simpel, aman, dan tahan lama.