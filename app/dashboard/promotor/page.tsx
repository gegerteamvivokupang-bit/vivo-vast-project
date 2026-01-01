'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Loading } from '@/components/ui/loading';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

// Shared Types
import { AggDailyPromoter, AggMonthlyPromoter } from '@/types/api.types';

// Utilities
import { parseSupabaseError, logError } from '@/lib/errors';
import { calculateAchievement } from '@/lib/dashboard-logic';

interface PromotorMonthlyData extends AggMonthlyPromoter {
  target: number;
}

export default function PromotorDashboardPage() {
  const { user } = useAuth();
  const [dailyData, setDailyData] = useState<AggDailyPromoter | null>(null);
  const [monthlyData, setMonthlyData] = useState<PromotorMonthlyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userStoreName, setUserStoreName] = useState<string>('');

  useEffect(() => {
    if (user) {
      fetchAllData();
    }
  }, [user]);

  // OPTIMIZED: Run all API calls in parallel
  const fetchAllData = async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      // Run all requests in parallel for faster loading
      const [storeResult, dailyResult, monthlyResult] = await Promise.all([
        // Get user store
        supabase
          .from('hierarchy')
          .select('stores(name)')
          .eq('user_id', user.id)
          .single(),

        // Get daily data
        supabase.functions.invoke('dashboard-promotor-daily', {
          body: { userId: user.id }
        }),

        // Get monthly data
        supabase.functions.invoke('dashboard-promotor-monthly', {
          body: { userId: user.id }
        })
      ]);

      // Handle store data
      if (storeResult.data?.stores) {
        const stores = storeResult.data.stores as any;
        setUserStoreName(stores?.name || '');
      }

      // Handle daily data
      if (dailyResult.error) {
        throw new Error('Failed to fetch daily data');
      }
      setDailyData(dailyResult.data);

      // Handle monthly data
      if (monthlyResult.error) {
        throw new Error('Failed to fetch monthly data');
      }
      setMonthlyData(monthlyResult.data);

    } catch (err) {
      const apiError = parseSupabaseError(err);
      logError(apiError, {
        userId: user.id,
        page: 'promotor-dashboard',
        action: 'fetchAllData'
      });
      console.error('Dashboard fetch error:', apiError);
      setError(apiError.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout requiredRole="promotor">
        <Loading message="Memuat dashboard..." />
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout requiredRole="promotor">
        <Alert type="error" message={error} />
      </DashboardLayout>
    );
  }

  const targetBulanan = monthlyData?.target || 0;
  const pencapaianBulanan = monthlyData?.total_input || 0;
  const persentasePencapaian = calculateAchievement(pencapaianBulanan, targetBulanan);

  return (
    <DashboardLayout requiredRole="promotor">
      <div className="min-h-screen bg-background p-4 pb-24">
        {/* Header Card */}
        <div className="bg-primary rounded-xl p-4 mb-6 shadow-md">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-card/20 rounded-full flex items-center justify-center">
              <span className="text-2xl">👤</span>
            </div>
            <div className="flex-1">
              <h2 className="text-primary-foreground font-bold text-lg">{user?.name || 'Promotor'}</h2>
              <div className="flex items-center gap-1 text-primary-foreground/80 text-sm">
                <span>📍</span>
                <span>{userStoreName || 'Toko belum diset'}</span>
              </div>
            </div>
          </div>
          <div className="bg-card/10 rounded-xl px-3 py-2">
            <p className="text-primary-foreground/90 text-sm font-medium">🏠 Dashboard</p>
          </div>
        </div>

        {/* Target Bulanan Card */}
        <Card className="mb-4">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Target Bulan Ini</h2>
              <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
                <span className="text-primary-foreground text-xl">🎯</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-baseline">
                <span className="text-sm text-muted-foreground">Pengajuan</span>
                <span className="text-3xl font-bold text-primary">
                  {pencapaianBulanan}
                </span>
              </div>

              <div className="flex justify-between items-baseline">
                <span className="text-sm text-muted-foreground">Target</span>
                <span className="text-xl font-semibold text-muted-foreground">
                  {targetBulanan}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="mt-4">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Progress</span>
                  <span className="font-semibold">{persentasePencapaian}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-primary h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(persentasePencapaian, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Hari Ini Cards */}
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Aktivitas Hari Ini</h3>

          {/* Row 1: Total Input & Reject */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            {/* Input */}
            <div className="bg-primary rounded-xl shadow-md p-4 text-primary-foreground">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium opacity-90">Total Input</span>
                <span className="text-2xl">📥</span>
              </div>
              <div className="text-3xl font-bold">
                {dailyData?.total_input || 0}
              </div>
              <p className="text-xs opacity-75 mt-1">Pengajuan</p>
            </div>

            {/* Reject */}
            <div className="bg-destructive rounded-xl shadow-md p-4 text-primary-foreground">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium opacity-90">Total Reject</span>
                <span className="text-2xl">❌</span>
              </div>
              <div className="text-3xl font-bold">
                {dailyData?.total_rejected || 0}
              </div>
              <p className="text-xs opacity-75 mt-1">Ditolak</p>
            </div>
          </div>

          {/* Row 2: Pending & Closing */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            {/* Pending */}
            <div className="bg-warning rounded-xl shadow-md p-4 text-primary-foreground">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium opacity-90">Pending</span>
                <span className="text-2xl">⏳</span>
              </div>
              <div className="text-3xl font-bold">
                {dailyData?.total_pending || 0}
              </div>
              <p className="text-xs opacity-75 mt-1">Belum ambil HP</p>
            </div>

            {/* Total Closing */}
            <div className="bg-success rounded-xl shadow-md p-4 text-primary-foreground">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium opacity-90">Closing</span>
                <span className="text-2xl">✅</span>
              </div>
              <div className="text-3xl font-bold">
                {dailyData?.total_closed || 0}
              </div>
              <p className="text-xs opacity-75 mt-1">Sudah ambil HP</p>
            </div>
          </div>

          {/* Row 3: Breakdown Closing (Direct vs Follow-up) */}
          <div className="grid grid-cols-2 gap-3">
            {/* Direct */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground font-medium">Closing Direct</span>
                  <span className="text-lg">⚡</span>
                </div>
                <div className="text-2xl font-bold text-primary">
                  {dailyData?.total_closing_direct || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Langsung closing</p>
              </CardContent>
            </Card>

            {/* Follow-up */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground font-medium">Closing Follow-up</span>
                  <span className="text-lg">🔄</span>
                </div>
                <div className="text-2xl font-bold" style={{ color: 'hsl(280, 60%, 50%)' }}>
                  {dailyData?.total_closing_followup || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Hasil follow-up</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Rekap Bulanan */}
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center">
              <span className="mr-2">📊</span>
              Rekap Bulan Ini
            </h3>

            <div className="space-y-3">
              <div className="flex justify-between items-center pb-2 border-b border-border">
                <span className="text-sm text-muted-foreground">Total Input</span>
                <span className="text-lg font-semibold text-foreground">
                  {monthlyData?.total_input || 0}
                </span>
              </div>

              <div className="flex justify-between items-center pb-2 border-b border-border">
                <span className="text-sm text-muted-foreground">Total Reject</span>
                <span className="text-lg font-semibold text-destructive">
                  {monthlyData?.total_rejected || 0}
                </span>
              </div>

              <div className="flex justify-between items-center pb-2 border-b border-border">
                <span className="text-sm text-muted-foreground">Total Closing</span>
                <span className="text-lg font-semibold text-success">
                  {monthlyData?.total_closed || 0}
                </span>
              </div>

              <div className="flex justify-between items-center pb-2 border-b border-border">
                <span className="text-sm text-muted-foreground">Total Pending</span>
                <span className="text-lg font-semibold text-warning">
                  {monthlyData?.total_pending || 0}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="text-center">
                  <div className="text-xs text-muted-foreground mb-1">Direct</div>
                  <div className="text-xl font-bold text-primary">
                    {monthlyData?.total_closing_direct || 0}
                  </div>
                </div>

                <div className="text-center">
                  <div className="text-xs text-muted-foreground mb-1">Follow-up</div>
                  <div className="text-xl font-bold" style={{ color: 'hsl(280, 60%, 50%)' }}>
                    {monthlyData?.total_closing_followup || 0}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
