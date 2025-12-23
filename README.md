# SMARA - Sales Management and Reporting Application

**Version:** 1.0.0  
**Stack:** Next.js 16 + Supabase + Cloudinary  
**Timezone:** WITA (Asia/Makassar)

---

## 📋 Deskripsi Project

SMARA adalah aplikasi manajemen sales dan pelaporan kredit untuk perusahaan retail elektronik. Sistem ini mendukung multi-level hierarchy:

- **Promotor** - Input pengajuan kredit
- **SATOR** - Supervisor Promotor (1 SATOR = 4-5 Promotor)
- **SPV** - Supervisor SATOR (1 SPV = 3-4 SATOR)
- **Manager Area** - Manage multiple SPV dalam satu area
- **Store Admin** - Manage per-toko
- **Admin** - Full system access

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ atau 20+
- npm atau yarn
- Supabase account
- Cloudinary account (untuk upload gambar)

### Installation

```bash
# Clone repository
git clone <your-repo-url>
cd gpt_crazy_vast

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env.local
# Edit .env.local dengan credentials Anda
```

### Environment Variables

Buat file `.env.local` dengan isi:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Cloudinary (optional, untuk upload gambar)
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=your_preset
```

### Development

```bash
# Run development server
npm run dev

# Build untuk production
npm run build

# Run production build locally
npm run start
```

Buka [http://localhost:3000](http://localhost:3000)

---

## 📱 Features

### Untuk Promotor
- ✅ Input pengajuan kredit
- ✅ Upload foto KTP & bukti
- ✅ Lihat history pengajuan
- ✅ Track status (pending/ACC/reject)
- ✅ Dashboard performance harian & bulanan

### Untuk SATOR/SPV
- ✅ Monitor team performance
- ✅ View daily submissions per promotor
- ✅ Export data ke Excel
- ✅ Target tracking
- ✅ Underperformer identification

### Untuk Manager Area
- ✅ Overview seluruh area
- ✅ Monitor multiple SPV
- ✅ Performance analytics
- ✅ Target management per area

### Untuk Admin
- ✅ User management (CRUD, role assignment)
- ✅ Target setting (monthly targets)
- ✅ Store management
- ✅ System-wide export
- ✅ Data analytics

---

## 🏗️ Project Structure

```
gpt_crazy_vast/
├── app/                          # Next.js App Router
│   ├── dashboard/               # Protected dashboards
│   │   ├── promotor/           # Promotor dashboard
│   │   ├── team/               # SATOR/SPV dashboard
│   │   ├── area/               # Manager dashboard
│   │   └── store/              # Store admin dashboard
│   ├── admin/                  # Admin panel
│   ├── api/                    # API routes
│   └── login/                  # Authentication
├── components/                  # React components
│   └── ui/                     # shadcn/ui components
├── lib/                        # Utilities
│   └── supabase/              # Supabase client setup
├── supabase/
│   └── functions/             # Edge Functions (12 deployed)
├── docs/                       # Design documents
└── scripts/                    # Utility scripts
```

---

## 🗄️ Database Schema

### Main Tables
- `users` - User accounts dengan role-based access
- `stores` - Toko retail
- `phone_types` - Master data tipe HP
- `occupations` - Master data pekerjaan
- `tenors` - Master data tenor kredit
- `submissions` - Pengajuan kredit
- `conversions` - Data closing/ACC
- `targets` - Target bulanan per level

### Aggregate Views
- `daily_promotor_aggregate` - Agregasi harian promotor
- `monthly_promotor_aggregate` - Agregasi bulanan promotor
- `daily_sator_aggregate` - Agregasi harian SATOR
- `monthly_sator_aggregate` - Agregasi bulanan SATOR
- (dan seterusnya untuk SPV, Manager)

---

## 🔐 Authentication & Security

- **Auth Provider:** Supabase Auth
- **Session:** Cookie-based (secure, httpOnly)
- **RLS:** Row Level Security enabled di semua tables
- **Roles:** promotor, sator, spv, manager, store_admin, admin
- **Timezone:** Asia/Makassar (WITA) untuk semua date calculations

---

## 🌐 Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

**Important:** Set semua environment variables di Vercel dashboard sebelum deploy.

### Environment Variables di Vercel
1. Go to Settings > Environment Variables
2. Add semua variables dari `.env.local`
3. Set untuk Production, Preview, dan Development

### Supabase Edge Functions

Edge functions sudah deployed. Untuk update:

```bash
# Deploy single function
npx supabase functions deploy <function-name>

# Deploy all functions
npx supabase functions deploy dashboard-promotor-daily
npx supabase functions deploy dashboard-team-daily
# ... dst
```

---

## 📊 Deployed Edge Functions

12 Edge Functions aktif di Supabase:

1. `dashboard-promotor-daily` - Daily metrics promotor
2. `dashboard-promotor-monthly` - Monthly metrics promotor
3. `dashboard-team-daily` - Daily metrics team (SATOR/SPV)
4. `dashboard-team-monthly` - Monthly metrics team
5. `dashboard-manager` - Manager monthly metrics
6. `dashboard-manager-daily` - Manager daily metrics
7. `promotor-history` - Submission history
8. `promotor-submissions` - Detailed submissions
9. `submission-create` - Create new submission
10. `submission-list` - List submissions
11. `pending-list` - Pending approvals
12. `conversion-create` - Create conversion (closing)

---

## 🎨 UI/UX

- **Theme:** Coffee Theme (warm, professional)
- **Design System:** CSS variables + shadcn/ui
- **Mobile:** Bottom navigation, touch-optimized
- **Typography:** Poppins font family
- **Components:** Fully responsive, glassmorphic effects

---

## 📈 Performance

- **Build Time:** ~113 seconds
- **Routes:** 40 routes (30 static, 10 dynamic)
- **Optimization:** 
  - Image optimization via Next.js
  - Static generation where possible
  - Edge Functions untuk data fetching
  - CSS variables untuk theming

---

## 🧪 Testing

Currently manual testing. Future additions:
- Unit tests (Jest + React Testing Library)
- Integration tests
- E2E tests (Playwright/Cypress)

---

## 📝 Documentation

Lihat folder `/docs` untuk:
- `DESIGN_*.md` - Design specifications
- `DEPLOYMENT_CHECKLIST.md` - Pre-deployment checklist
- Design mockups (HTML)

---

## 🤝 Contributing

1. Create feature branch dari `main`
2. Make changes
3. Test locally (`npm run build`)
4. Submit PR dengan deskripsi lengkap

---

## 📞 Support

Untuk issues atau questions:
1. Check documentation di `/docs`
2. Review conversation summaries
3. Contact development team

---

## 📄 License

Private project - All rights reserved

---

## 🎯 Roadmap

### Phase 1 - Launch (COMPLETE) ✅
- [x] Core CRUD functionality
- [x] Multi-level dashboards
- [x] Target management
- [x] Export functionality
- [x] Mobile optimization

### Phase 2 - Enhancement (Future)
- [ ] Automated testing suite
- [ ] Advanced analytics
- [ ] Push notifications
- [ ] PDF report generation
- [ ] Advanced export options

### Phase 3 - Scale (Future)
- [ ] Multi-tenant support
- [ ] Advanced role permissions
- [ ] Audit logging
- [ ] API documentation
- [ ] Developer API access

---

**Built with ❤️ using Next.js 16 & Supabase**

Last Updated: 23 Desember 2025
