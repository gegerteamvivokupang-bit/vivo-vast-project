# SOLUSI FINAL - TAMBAH STORE_ID KE USERS

## 🎯 **MASALAH:**
Promotor **tidak terhubung langsung** dengan toko → harus query via `vast_finance_data_new` yang ribet dan bisa kena RLS.

## ✅ **SOLUSI YANG BENAR:**
**Tambah kolom `store_id` di table `users`** → promotor langsung assigned ke toko!

---

## 📋 **LANGKAH-LANGKAH:**

### **STEP 1: Run Migration**

Buka **Supabase Dashboard → SQL Editor**, run:

```sql
-- File: supabase/migrations/20241224_add_store_id_to_users.sql

-- 1. Add column
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id);

-- 2. Add indexes
CREATE INDEX IF NOT EXISTS idx_users_store_id ON users(store_id);
CREATE INDEX IF NOT EXISTS idx_users_role_store ON users(role, store_id) WHERE role = 'promotor';

-- 3. Comment
COMMENT ON COLUMN users.store_id IS 'Store assignment for promotor - direct relationship';
```

✅ **Verify:** Check column exists
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'store_id';
```

---

### **STEP 2: Populate Data**

#### **2A. Preview dulu (jangan update):**

```sql
-- Lihat promotor mana yang akan di-assign ke store mana
SELECT 
    u.name as promotor_name,
    s.name as will_be_assigned_to,
    COUNT(v.id) as based_on_submissions
FROM users u
LEFT JOIN LATERAL (
    SELECT store_id, COUNT(*) as cnt
    FROM vast_finance_data_new
    WHERE created_by_user_id = u.id AND deleted_at IS NULL
    GROUP BY store_id
    ORDER BY COUNT(*) DESC
    LIMIT 1
) most_active ON true
LEFT JOIN stores s ON s.id = most_active.store_id
LEFT JOIN vast_finance_data_new v 
    ON v.created_by_user_id = u.id 
    AND v.store_id = most_active.store_id
    AND v.deleted_at IS NULL
WHERE u.role = 'promotor'
GROUP BY u.name, s.name
ORDER BY u.name;
```

#### **2B. Kalau hasil OK, execute update:**

```sql
-- HATI-HATI: Ini akan update data!
-- Assign promotor ke toko berdasarkan submission terbanyak

UPDATE users u
SET store_id = subq.store_id
FROM (
    SELECT DISTINCT ON (created_by_user_id)
        created_by_user_id as user_id,
        store_id
    FROM vast_finance_data_new
    WHERE deleted_at IS NULL
    GROUP BY created_by_user_id, store_id
    ORDER BY created_by_user_id, COUNT(*) DESC
) subq
WHERE u.id = subq.user_id
  AND u.role = 'promotor';
```

✅ **Verify hasil:**
```sql
SELECT 
    u.name,
    s.name as assigned_store,
    COUNT(v.id) as total_submissions
FROM users u
LEFT JOIN stores s ON s.id = u.store_id
LEFT JOIN vast_finance_data_new v ON v.created_by_user_id = u.id
WHERE u.role = 'promotor'
GROUP BY u.name, s.name
ORDER BY u.name;
```

---

### **STEP 3: Update Code**

File: `app/dashboard/team/export/page.tsx`

**GANTI dari:**
```typescript
// ❌ Query ribet via vast_finance_data_new
const { data: financeData } = await supabase
    .from('vast_finance_data_new')
    .select('created_by_user_id')
    .eq('store_id', store.store_id)
    ...
```

**Menjadi:**
```typescript
// ✅ Query simple via users.store_id
const { data: promotorUsers } = await supabase
    .from('users')
    .select('id, name')
    .eq('role', 'promotor')
    .eq('store_id', store.store_id);

// Get count dari view aggregate
const promotorIds = promotorUsers.map(p => p.id);
const { data: aggData } = await supabase
    .from('v_agg_monthly_promoter_all')
    .select('promoter_user_id, total_input')
    .in('promoter_user_id', promotorIds)
    .eq('agg_month', `${monthStr}-01`);

// Map
const promotorsWithInput = promotorUsers.map(promotor => {
    const agg = aggData?.find(a => a.promoter_user_id === promotor.id);
    return {
        name: promotor.name,
        total_input: agg?.total_input || 0
    };
});
```

---

## 🎉 **KEUNTUNGAN:**

### **Sebelum (Ribet):**
1. Query `vast_finance_data_new` untuk setiap store
2. Get unique promotor IDs
3. Query `users` untuk nama
4. Count manual di client
5. **4 queries per store!**

### **Sesudah (Clean):**
1. Query `users` WHERE `store_id = X` 
2. Query aggregate view untuk count
3. **2 queries per store!**

✅ Lebih cepat  
✅ Lebih simple  
✅ Tidak kena RLS  
✅ Database structure lebih proper  

---

## 📁 **Files:**

- ✅ Migration: `supabase/migrations/20241224_add_store_id_to_users.sql`
- ✅ Populate: `supabase/migrations/20241224_populate_promotor_store.sql`
- ⏳ Code update: Manual (contoh di atas)

---

**Silakan jalankan STEP 1 dan STEP 2 dulu, lalu saya akan update code!** 🚀
