# 🚀 DEPLOYMENT GUIDE - PHASE 2 COMPLETE
## Turbo Query + SWR Optimization

**Date:** 2025-12-30  
**Status:** ✅ Ready for Deployment

---

## 📦 WHAT'S BEING DEPLOYED

### **1. Backend Optimization (Turbo Query)**
- 5 SQL RPC Functions (Database)
- 4 Optimized Edge Functions (Supabase)

### **2. Frontend Optimization (SWR)**
- SWR Library installed
- Caching configuration
- Custom dashboard hooks

---

## 🔧 DEPLOYMENT STEPS

### **PART A: Deploy Backend (Turbo Query)**

#### **Option 1: Via Supabase Dashboard (RECOMMENDED)**

**Step 1: Deploy SQL RPC Functions**
1. Login ke Supabase Dashboard: https://supabase.com/dashboard
2. Pilih project VAST Finance
3. Klik "SQL Editor" di sidebar
4. Klik "New Query"
5. Copy-paste isi file: `supabase/migrations/20251230_create_turbo_rpc_functions.sql`
6. Klik "Run" (atau F5)
7. Verify: Should see "Success. No rows returned"

**Step 2: Deploy Edge Functions**
```bash
# Deploy 1 by 1
npx supabase functions deploy dashboard-team-monthly
npx supabase functions deploy dashboard-team-daily
npx supabase functions deploy dashboard-manager-daily
npx supabase functions deploy dashboard-manager
```

Expected output for each:
```
✓ Deployed Function dashboard-xxx
```

---

#### **Option 2: Via CLI (If Supabase Link Works)**

```bash
# Try this first
npx supabase db push --include-all

# If error "duplicate key", manually run SQL via dashboard (Option 1)
```

---

### **PART B: Deploy Frontend (SWR)**

**Step 1: Verify SWR Installed**
```bash
npm list swr
```
Expected: `swr@2.x.x`

**Step 2: Add SWR Provider to Root Layout**

Edit `app/layout.tsx`:

```tsx
import { SWRProvider } from '@/components/providers/SWRProvider';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <AuthProvider>
          <SWRProvider>  {/* ADD THIS */}
            {children}
          </SWRProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
```

**Step 3: (Optional) Migrate Dashboard to use SWR Hooks**

Example for `app/dashboard/team/page.tsx`:

**Before (manual fetch):**
```tsx
const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
  fetch('/api/dashboard/team-monthly')
    .then(res => res.json())
    .then(data => {
      setData(data);
      setLoading(false);
    });
}, []);
```

**After (with SWR):**
```tsx
import { useTeamMonthly } from '@/hooks/useDashboard';

const { data, error, isLoading } = useTeamMonthly(user?.id);
```

**Step 4: Build & Deploy Frontend**
```bash
npm run build
```

If using Vercel:
```bash
vercel --prod
```

Or commit and push to Git (auto-deploy via CI/CD)

---

## ✅ VERIFICATION CHECKLIST

### **Backend (SQL + Edge Functions):**
- [ ] SQL functions created (check Supabase Dashboard > Database > Functions)
- [ ] Edge functions deployed (check Supabase > Edge Functions)
- [ ] No errors in Supabase logs

### **Frontend (SWR):**
- [ ] `npm run build` succeeds without errors
- [ ] SWRProvider added to layout
- [ ] App loads without errors

### **End-to-End Test:**
1. **Login as SPV (e.g., Gery)**
   - [ ] Go to `/dashboard/team`
   - [ ] Loading time < 1 second
   - [ ] Data displays correctly
   - [ ] Switch to "Daily" tab → Instant (from cache)
   - [ ] Switch back → Instant

2. **Login as Manager**
   - [ ] Go to `/dashboard/area`
   - [ ] Loading time < 1 second
   - [ ] All areas/sators/promotors show
   - [ ] Go to `/dashboard/area/daily` → Fast load
   - [ ] Drill-down works

3. **Cache Test (SWR)**
   - [ ] Open dashboard → Note loading time
   - [ ] Navigate away → Come back
   - [ ] Should load **instantly** from cache
   - [ ] Check Network tab: Should see background refresh

---

## 📊 EXPECTED PERFORMANCE

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **First Load** | 2-5s | <0.5s | 80-90% |
| **Repeat Load** | 2-5s | **Instant (0ms)** | 100% |
| **# of Queries** | 30-45+ | 4 RPCs | 90% |
| **Cache Hit Rate** | 0% | 80%+ | N/A |

---

## ⚠️ TROUBLESHOOTING

### **Issue: SQL Functions Not Created**
**Solution:**
1. Check SQL error in Supabase Dashboard
2. Common issue: Function name conflict
3. Drop existing: `DROP FUNCTION IF EXISTS get_team_monthly_data(UUID, TEXT);`
4. Re-run SQL

### **Issue: Edge Function Deploy Fails**
**Solution:**
```bash
# Login again
npx supabase login

# Link project
npx supabase link --project-ref YOUR_PROJECT_REF

# Retry deploy
npx supabase functions deploy dashboard-xxx
```

### **Issue: SWR Not Caching**
**Solution:**
1. Check browser console for errors
2. Verify SWRProvider is in layout
3. Check Network tab for duplicate requests
4. Clear browser cache and retry

### **Issue: Data Not Updating**
**Solution:**
SWR auto-refreshes, but you can force:
```tsx
import { mutate } from 'swr';

// Force refresh
mutate('/api/dashboard/team-monthly');
```

---

## 🔄 ROLLBACK PLAN

### **Backend Rollback:**
```bash
# Re-deploy old Edge Functions
git checkout HEAD~1 supabase/functions/
npx supabase functions deploy dashboard-xxx
```

### **Frontend Rollback:**
```tsx
// Remove SWRProvider from layout
// Revert to manual fetch
```

---

## 📈 SUCCESS CRITERIA

Deployment successful if:
- [x] All SQL functions deployed
- [x] All Edge Functions deployed
- [x] Frontend builds without errors
- [x] Loading time < 1s (first time)
- [x] Loading time instant (repeat)
- [x] No console errors
- [x] Data accuracy maintained

---

## 🎉 NEXT STEPS AFTER DEPLOYMENT

1. **Monitor Supabase Logs:** Check for errors
2. **User Feedback:** Ask SPV/Manager jika loading sudah cepat
3. **Analytics:** Monitor loading times (if available)
4. **Iterate:** Jika perlu, adjust SWR refresh intervals

---

## 📞 SUPPORT

If deployment fails:
1. Check `.agent/TURBO_DEPLOYMENT_GUIDE.md` (more detailed)
2. Check Supabase logs: `npx supabase functions logs dashboard-xxx`
3. Share error message for assistance

---

**Status:** ✅ READY TO DEPLOY  
**Estimated Time:** 15-20 minutes  
**Risk:** LOW (Both optimizations are backward compatible)

---

**Good Luck! 🚀**
