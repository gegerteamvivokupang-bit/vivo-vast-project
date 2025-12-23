# VAST FINANCE - Sistem Autentikasi

## Ringkasan

Sistem autentikasi VAST Finance menggunakan:
- **Supabase Auth** untuk manajemen user dan session
- **Cookie-based session** untuk menyimpan token
- **PIN verification** sebagai metode login (bukan password)

---

## Alur Login

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  User Input │ --> │ Verify PIN  │ --> │ Supabase    │ --> │ Set Cookie  │
│  Email+PIN  │     │ di Database │     │ Auth Login  │     │ & Redirect  │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

### Step 1: User Input
- User memasukkan **email** dan **PIN** di `/login`
- Form submit memanggil `signInAction()` server action

### Step 2: Verify PIN
- Server action query tabel `users` untuk cari user by email
- Verifikasi PIN dengan field `pin_hash`
- Cek status user harus `active`

### Step 3: Supabase Auth Login
- Jika PIN valid, panggil `supabase.auth.signInWithPassword()`
- Password di Supabase Auth = email (setup khusus)
- Supabase return session dengan `access_token` dan `refresh_token`

### Step 4: Set Cookie & Redirect
- Session disimpan di cookie dengan format JSON
- Cookie name: `sb-{project_ref}-auth-token`
- Redirect ke dashboard sesuai role

---

## Struktur Cookie

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "v1.MDA...",
  "expires_at": 1702800000,
  "expires_in": 3600,
  "token_type": "bearer",
  "user": {
    "id": "c2f9b868-0cdd-4d19-953a-ae03bdf859b2",
    "email": "user@example.com",
    ...
  }
}
```

### Cookie Options
- `path`: `/` (accessible di semua route)
- `maxAge`: 7 hari (604800 detik)
- `sameSite`: `lax`
- `secure`: `true` di production
- `httpOnly`: `false` (agar bisa dibaca client untuk logout)

---

## Role-Based Redirect

| Role     | Redirect Target        |
|----------|------------------------|
| promotor | `/dashboard/promotor`  |
| spv      | `/dashboard/team`      |
| sator    | `/dashboard/team`      |
| manager  | `/dashboard/area`      |
| admin    | `/admin`               |

---

## Verifikasi Session (API Routes)

Setiap API route menggunakan `getAuthFromCookie()` helper:

```typescript
// lib/auth-helper.ts
import { getAuthFromCookie } from '@/lib/auth-helper'

export async function GET(request: NextRequest) {
  const auth = getAuthFromCookie(request)

  if (!auth) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  // auth.userId - ID user dari session
  // auth.email - Email user
  // auth.accessToken - JWT token
}
```

### Validasi yang dilakukan:
1. Cek cookie ada
2. Parse JSON cookie
3. Cek token tidak expired (`expires_at`)
4. Cek user ID ada di session

---

## Verifikasi Session (Client)

`AuthContext` melakukan fetch ke `/api/auth/me` saat mount:

```typescript
// contexts/AuthContext.tsx
useEffect(() => {
  async function initSession() {
    await fetch('/api/auth/me')
    // Set user state dari response
  }
  initSession()
}, [])
```

### Response /api/auth/me:
```json
{
  "success": true,
  "user": {
    "id": "...",
    "email": "...",
    "name": "...",
    "role": "manager",
    "status": "active",
    ...
  }
}
```

---

## Logout

Logout dilakukan di client (`AuthContext.signOut()`):

1. Clear state user
2. Hapus cookie auth dengan set expired date ke masa lalu
3. Redirect ke `/login`

```typescript
async function signOut() {
  setUser(null)

  // Clear auth cookies
  const cookies = document.cookie.split(';')
  for (const cookie of cookies) {
    const name = cookie.split('=')[0].trim()
    if (name.includes('auth-token')) {
      document.cookie = name + '=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    }
  }

  window.location.href = '/login'
}
```

---

## File Penting

| File | Fungsi |
|------|--------|
| `app/actions/auth.ts` | Server action untuk login |
| `app/api/auth/me/route.ts` | API endpoint verifikasi session |
| `lib/auth-helper.ts` | Helper parsing cookie di API routes |
| `contexts/AuthContext.tsx` | Global state management auth |
| `components/layouts/DashboardLayout.tsx` | Wrapper dengan auth check |

---

## Kenapa Tidak Pakai Middleware?

Sistem ini **tidak menggunakan `middleware.ts`** karena:

1. **@supabase/ssr v0.0.10** memiliki bug dimana `setAll` callback tidak dipanggil
2. Cookie di-set manual setelah login berhasil
3. Verifikasi session dilakukan di masing-masing API route menggunakan helper

---

## Kenapa Cookie Format JSON?

Standar Supabase SSR menggunakan format Base64 untuk cookie. Namun karena bug di v0.0.10:

1. `signInWithPassword()` tidak trigger `setAll` callback
2. Session tidak ter-persist otomatis
3. Solusi: Set cookie manual dengan format JSON plain
4. API routes parse JSON langsung dari cookie

---

## Security Notes

1. **Service Role Key** digunakan di server-side untuk query database (bypass RLS)
2. **Anon Key** digunakan untuk Supabase Auth operations
3. Cookie **tidak httpOnly** agar client bisa clear saat logout
4. Token expiry di-check di setiap API request
5. User status di-check di `/api/auth/me` (inactive = 403)

---

## Troubleshooting

### Login berhasil tapi redirect ke login lagi
- Cek cookie ter-set di browser (DevTools > Application > Cookies)
- Pastikan cookie name sesuai dengan project ref Supabase

### API return 401
- Cek cookie ada di request headers
- Cek token tidak expired
- Cek format cookie valid JSON

### User tidak redirect ke dashboard yang benar
- Cek role user di database
- Pastikan `roleRoutes` mapping benar di `auth.ts`

---

## Diagram Arsitektur

```
┌──────────────────────────────────────────────────────────────┐
│                         CLIENT                                │
│  ┌─────────┐    ┌──────────────┐    ┌───────────────────┐   │
│  │ /login  │───>│ AuthContext  │<───│ DashboardLayout   │   │
│  └─────────┘    └──────────────┘    └───────────────────┘   │
│       │               │                      │               │
│       │               │ fetch                │               │
│       ▼               ▼                      ▼               │
└───────┼───────────────┼──────────────────────┼───────────────┘
        │               │                      │
        │               │                      │
┌───────▼───────────────▼──────────────────────▼───────────────┐
│                         SERVER                                │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────┐ │
│  │ auth.ts     │  │ /api/auth/  │  │ /api/dashboard/*     │ │
│  │ (action)    │  │ me          │  │                      │ │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬───────────┘ │
│         │                │                     │             │
│         │                │   getAuthFromCookie │             │
│         │                │         │           │             │
│         ▼                ▼         ▼           ▼             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    SUPABASE                              ││
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐ ││
│  │  │ auth.users  │    │   users     │    │  hierarchy  │ ││
│  │  │ (Auth)      │    │ (Database)  │    │ (Database)  │ ││
│  │  └─────────────┘    └─────────────┘    └─────────────┘ ││
│  └─────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

---

**Last Updated:** 16 Desember 2025
