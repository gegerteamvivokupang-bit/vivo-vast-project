# Edge Function Update Required: dashboard-manager

## Issue
SPV dengan dual role (SPV + SATOR) tidak muncul di data `sators` yang dikembalikan oleh Edge Function `dashboard-manager`.

## Root Cause
Query saat ini hanya mengambil user dengan `role = 'sator'`, tidak include SPV yang juga berfungsi sebagai SATOR.

## Solution Required
Update query untuk SATOR data agar include SPV dual-role:

```sql
-- Current (❌ Wrong):
WHERE role = 'sator'

-- Fixed (✅ Correct):
WHERE role = 'sator' 
   OR (role = 'spv' AND sator_id IS NOT NULL)
```

## Context
- SPV seperti "Anfal" dan "Wili" juga bertindak sebagai SATOR di area mereka
- Admin Target Editor sudah handle ini dengan benar (lihat `/app/admin/targets/[year]/[month]/page.tsx` line 329, 451)
- Manager Performance page butuh data yang sama

## Files Affected
1. **Supabase Edge Function**: `dashboard-manager` (remote)
2. **Frontend consumers**:
   - `/app/dashboard/area/page.tsx`
   - `/app/dashboard/area/performance/page.tsx`
   - `/app/dashboard/area/export/page.tsx`

## Testing
Setelah update, verify bahwa:
1. SPV dual-role muncul di tab SATOR (Manager Performance page)
2. Data target mereka sebagai SATOR ditampilkan
3. Area assignment mereka benar
