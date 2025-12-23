# 🚀 DEPLOYMENT GUIDE - SMARA PROJECT

**Quick Deployment Guide untuk Vercel**

---

## ✅ PRE-DEPLOYMENT CHECKLIST

Pastikan sudah selesai:
- [x] Build berhasil tanpa error (`npm run build`)
- [x] Environment variables ready
- [x] Database schema deployed di Supabase
- [x] Edge Functions deployed (12 functions)
- [x] RLS policies enabled
- [ ] **Backup database** (PENTING!)

---

## 🎯 DEPLOYMENT KE VERCEL

### Option 1: Via GitHub (Recommended)

#### Step 1: Push ke GitHub

```bash
# Initialize git jika belum
git init

# Add files
git add .

# Commit
git commit -m "Ready for production deployment"

# Add remote (ganti dengan repo Anda)
git remote add origin https://github.com/YOUR_USERNAME/smara-app.git

# Push
git push -u origin main
```

#### Step 2: Connect ke Vercel

1. **Login ke Vercel**: https://vercel.com
2. **Import Project**:
   - Click "Add New..." → "Project"
   - Select GitHub repository
   - Click "Import"

3. **Configure Project**:
   - Framework Preset: **Next.js** (auto-detected)
   - Root Directory: `./` (default)
   - Build Command: `npm run build` (default)
   - Output Directory: `.next` (default)

4. **Environment Variables**:
   Click "Environment Variables" dan tambahkan:
   
   ```
   NEXT_PUBLIC_SUPABASE_URL = https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY = your_anon_key_here
   SUPABASE_SERVICE_ROLE_KEY = your_service_role_key_here
   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = your_cloudinary_name
   NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET = your_preset
   ```
   
   **Important:** Set untuk semua environments (Production, Preview, Development)

5. **Deploy**:
   - Click "Deploy"
   - Wait 2-3 minutes
   - Done! ✅

---

### Option 2: Via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel

# Follow prompts:
# - Setup and deploy? Y
# - Which scope? [select your account]
# - Link to existing project? N
# - Project name? smara-app
# - Directory? ./
# - Override settings? N

# Deploy to production
vercel --prod
```

---

## 🔧 POST-DEPLOYMENT SETUP

### 1. Verify Deployment

Visit your deployed URL: `https://your-app.vercel.app`

Test checklist:
- [ ] Login page loads
- [ ] Can login with test account
- [ ] Dashboard displays correctly
- [ ] Images load from Cloudinary
- [ ] Data fetches from Supabase

### 2. Update Supabase Settings

Di Supabase Dashboard → Settings → API:

**Authentication → URL Configuration:**
```
Site URL: https://your-app.vercel.app
Redirect URLs: 
  - https://your-app.vercel.app/*
  - http://localhost:3000/* (for local dev)
```

**CORS Settings** (if needed):
Add your Vercel domain ke allowed origins

### 3. Configure Custom Domain (Optional)

Di Vercel Dashboard → Settings → Domains:
1. Add your custom domain
2. Update DNS records as instructed
3. Wait for DNS propagation (5-60 minutes)

---

## 🔐 ENVIRONMENT VARIABLES SETUP

### Cara Mendapatkan Credentials:

#### Supabase:
1. Go to: https://app.supabase.com/project/YOUR_PROJECT/settings/api
2. Copy:
   - `URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ **KEEP SECRET!**

#### Cloudinary:
1. Go to: https://cloudinary.com/console
2. Copy:
   - `Cloud Name` → `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
   - Create upload preset → `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`

---

## 📊 MONITORING & ANALYTICS

### Vercel Analytics (Built-in)

1. Go to: Vercel Dashboard → Analytics
2. Enable Web Analytics
3. Monitor:
   - Page views
   - Performance metrics
   - Real-time visitors

### Error Tracking (Optional - Sentry)

```bash
# Install Sentry
npm install @sentry/nextjs

# Initialize
npx @sentry/wizard@latest -i nextjs
```

---

## 🚨 TROUBLESHOOTING

### Build Fails

**Error:** `Module not found`
```bash
# Solution: Dependency issue
npm install --legacy-peer-deps
git commit -am "Fix dependencies"
git push
```

**Error:** `Environment variable not found`
```bash
# Solution: Check Vercel dashboard
# Settings → Environment Variables
# Make sure all vars are set for Production
```

### Runtime Errors

**Error:** `Failed to fetch from Supabase`
- Check Supabase URL di environment variables
- Verify RLS policies enabled
- Check service role key is correct

**Error:** `CORS policy` error
- Add Vercel domain ke Supabase allowed origins
- Update Supabase auth settings

**Error:** Images not loading
- Verify Cloudinary credentials
- Check `next.config.ts` has Cloudinary domain
- Check browser console for errors

---

## 🔄 CONTINUOUS DEPLOYMENT

Setelah initial setup, setiap push ke GitHub akan:
1. Auto-trigger build di Vercel
2. Run tests (jika ada)
3. Deploy preview untuk branch lain
4. Deploy production untuk `main` branch

### Workflow:

```bash
# Make changes
git add .
git commit -m "Your changes"

# Push to branch untuk preview
git push origin feature-branch
# Preview URL: https://smara-app-git-feature-branch.vercel.app

# Merge ke main untuk production
git checkout main
git merge feature-branch
git push origin main
# Production URL: https://your-app.vercel.app
```

---

## 📈 PERFORMANCE OPTIMIZATION

### Already Implemented:
- ✅ Next.js Image optimization
- ✅ Static page generation
- ✅ Edge Functions
- ✅ Security headers

### Recommended Next Steps:

1. **Enable Vercel Speed Insights**
   ```bash
   npm install @vercel/speed-insights
   ```

2. **Add Redis Caching** (Optional - advanced)
   - Use Vercel KV atau Upstash Redis
   - Cache dashboard data

3. **Setup CDN**
   - Vercel automatically uses Edge Network
   - No additional setup needed ✅

---

## 🔒 SECURITY CHECKLIST

### Production Security:
- [x] HTTPS enabled (automatic on Vercel)
- [x] Environment variables secured
- [x] Service role key not exposed to client
- [x] RLS policies enabled
- [x] Security headers configured
- [ ] Setup rate limiting (optional)
- [ ] Add WAF rules (optional - Vercel Pro)

### Supabase Security:
- [x] Enable email confirmation (if needed)
- [x] Configure password requirements
- [x] Setup MFA (optional)
- [ ] Review RLS policies
- [ ] Enable audit logging

---

## 📱 MOBILE TESTING

Test di berbagai devices:
- [ ] iOS Safari
- [ ] Android Chrome
- [ ] Desktop browsers
- [ ] Tablet views

Use Vercel's built-in device preview atau:
- BrowserStack
- LambdaTest
- Real devices

---

## 📞 SUPPORT & MAINTENANCE

### Regular Maintenance:
- **Weekly:** Check error logs di Vercel
- **Monthly:** Review performance metrics
- **Quarterly:** Update dependencies
- **As needed:** Deploy hotfixes

### Update Dependencies:

```bash
# Check outdated packages
npm outdated

# Update safely
npm update

# Test locally
npm run build
npm run start

# Deploy
git commit -am "Update dependencies"
git push
```

---

## 🎯 ROLLBACK (Jika Ada Masalah)

### Quick Rollback di Vercel:

1. Go to: Vercel Dashboard → Deployments
2. Find last working deployment
3. Click "⋯" → "Promote to Production"
4. Confirm rollback
5. **Done in 30 seconds!**

### Manual Rollback:

```bash
# Revert last commit
git revert HEAD

# Push
git push origin main
```

---

## ✅ DEPLOYMENT COMPLETE!

Congratulations! 🎉 Your SMARA app is now live!

### Next Steps:
1. ✅ Test all functionality
2. ✅ Share URL with team
3. ✅ Monitor for 24 hours
4. ✅ Collect user feedback
5. ✅ Iterate and improve

### Quick Links:
- **Production:** https://your-app.vercel.app
- **Vercel Dashboard:** https://vercel.com/dashboard
- **Supabase Dashboard:** https://app.supabase.com
- **Analytics:** https://vercel.com/dashboard/analytics

---

## 📝 DEPLOYMENT LOG TEMPLATE

Keep track of deployments:

```
Date: 2025-12-23
Version: 1.0.0
Deployed by: [Your Name]
Changes:
  - Initial production deployment
  - All features implemented
  - Security headers configured
Status: ✅ Success
Issues: None
Rollback needed: No
Notes: First stable production release
```

---

**Need Help?**
- Vercel Docs: https://vercel.com/docs
- Supabase Docs: https://supabase.com/docs
- Next.js Docs: https://nextjs.org/docs

**Happy Deploying! 🚀**
