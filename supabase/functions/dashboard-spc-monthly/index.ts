// VAST FINANCE - SPC Monthly Dashboard Edge Function
// Query v_agg_monthly_store_all untuk toko-toko SPC (is_spc = true)
// DENGAN DETAIL PER PROMOTOR DAN TARGET

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Whitelist akses SPC (hardcoded sesuai dokumentasi)
const SPC_WHITELIST = [
    { role: 'manager' },
    { name: 'Gery', role: 'spv' },
    { name: 'Andri', role: 'sator' }
];

function canAccessSPC(user: { name?: string; role?: string }): boolean {
    if (!user) return false;

    for (const allowed of SPC_WHITELIST) {
        if (!allowed.name && allowed.role === user.role) {
            return true;
        }
        if (allowed.name && allowed.role) {
            const userName = user.name?.toLowerCase() || '';
            if (userName.includes(allowed.name.toLowerCase()) && user.role === allowed.role) {
                return true;
            }
        }
    }
    return false;
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        let userId: string | null = null;
        let month: string | null = null;

        if (req.method === 'POST') {
            const body = await req.json();
            userId = body.userId;
            month = body.month; // Format: YYYY-MM
        }

        if (!userId) {
            return new Response(
                JSON.stringify({ success: false, message: 'Missing userId' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Get user info untuk cek akses
        const { data: userData, error: userError } = await supabaseClient
            .from('users')
            .select('id, name, role')
            .eq('id', userId)
            .single();

        if (userError || !userData) {
            return new Response(
                JSON.stringify({ success: false, message: 'User not found' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Cek akses SPC
        if (!canAccessSPC(userData)) {
            return new Response(
                JSON.stringify({ success: false, message: 'Access denied to SPC dashboard' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Default ke bulan ini jika tidak ada month - FIX: Use WITA timezone
        const now = new Date();
        const witaMonth = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Makassar',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(now).substring(0, 7);
        const targetMonth = month || witaMonth;

        // Format untuk query: YYYY-MM-01
        const queryMonth = `${targetMonth}-01`;

        console.log('SPC Monthly - userId:', userId, 'month:', queryMonth);

        // Query dari view v_agg_monthly_store_all
        const { data: spcData, error: spcError } = await supabaseClient
            .from('v_agg_monthly_store_all')
            .select('*')
            .eq('is_spc', true)
            .or(`agg_month.eq.${queryMonth},agg_month.is.null`);

        if (spcError) {
            console.error('SPC query error:', spcError);
            return new Response(
                JSON.stringify({ success: false, message: 'Failed to fetch SPC data: ' + spcError.message }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Group by store_id (karena bisa ada null dan data)
        const storeMap = new Map<string, any>();
        for (const row of (spcData || [])) {
            const existing = storeMap.get(row.store_id);
            // Prioritaskan yang punya agg_month (bukan null)
            if (!existing || (row.agg_month && !existing.agg_month)) {
                storeMap.set(row.store_id, row);
            }
        }

        // Get all store IDs
        const storeIds = Array.from(storeMap.keys());

        // Query all promotors in SPC stores
        const { data: promotorData, error: promotorError } = await supabaseClient
            .from('users')
            .select('id, name, store_id')
            .eq('role', 'promotor')
            .in('store_id', storeIds);

        if (promotorError) {
            console.error('Promotor query error:', promotorError);
        }

        const promotors = promotorData || [];
        const promotorIds = promotors.map(p => p.id);

        // Query targets for all promotors
        const [targetYear, targetMon] = targetMonth.split('-').map(Number);

        const { data: targetData, error: targetError } = await supabaseClient
            .from('targets')
            .select('user_id, target_value, target_type')
            .in('user_id', promotorIds)
            .eq('period_year', targetYear)
            .eq('period_month', targetMon);
        // TIDAK filter target_type - ambil semua

        if (targetError) {
            console.error('Target query error:', targetError);
        }

        // Map targets - jika user punya multiple target_type, ambil yang terbesar
        const targetMap = new Map<string, number>();
        (targetData || []).forEach(t => {
            const existingTarget = targetMap.get(t.user_id) || 0;
            const newTarget = t.target_value || 0;
            if (newTarget > existingTarget) {
                targetMap.set(t.user_id, newTarget);
            }
        });

        // Query aggregate monthly untuk semua promotor SPC
        const { data: aggPromotorData, error: aggPromotorError } = await supabaseClient
            .from('v_agg_monthly_promoter_all')
            .select('promoter_user_id, total_input, total_closed, total_pending, total_rejected')
            .in('promoter_user_id', promotorIds)
            .eq('agg_month', queryMonth);

        if (aggPromotorError) {
            console.error('Promotor aggregate query error:', aggPromotorError);
        }

        const aggPromotorMap = new Map<string, any>();
        (aggPromotorData || []).forEach(agg => {
            aggPromotorMap.set(agg.promoter_user_id, {
                total_input: agg.total_input || 0,
                total_closed: agg.total_closed || 0,
                total_pending: agg.total_pending || 0,
                total_rejected: agg.total_rejected || 0
            });
        });

        // Map promotors to stores and calculate store targets
        const result = Array.from(storeMap.values()).map(row => {
            const storePromotors = promotors
                .filter(p => p.store_id === row.store_id)
                .map(p => {
                    const agg = aggPromotorMap.get(p.id) || { total_input: 0, total_closed: 0, total_pending: 0, total_rejected: 0 };
                    const target = targetMap.get(p.id) || 0;
                    return {
                        user_id: p.id,
                        name: p.name,
                        target: target,
                        total_input: agg.total_input,
                        total_closed: agg.total_closed,
                        total_pending: agg.total_pending,
                        total_rejected: agg.total_rejected
                    };
                });

            // Target toko = SUM dari target promotor
            const storeTarget = storePromotors.reduce((sum, p) => sum + (p.target || 0), 0);

            return {
                store_id: row.store_id,
                store_name: row.store_name,
                store_code: row.store_code || '',
                area: row.area,
                target: storeTarget,
                total_input: row.total_input || 0,
                total_closed: row.total_closed || 0,
                total_pending: row.total_pending || 0,
                total_rejected: row.total_rejected || 0,
                total_closing_direct: row.total_closing_direct || 0,
                total_closing_followup: row.total_closing_followup || 0,
                agg_month: row.agg_month || queryMonth,
                promotors: storePromotors
            };
        });

        // Sort by total_input descending
        result.sort((a, b) => b.total_input - a.total_input);

        // Calculate totals (including target from all stores)
        const totals = result.reduce((acc, s) => ({
            input: acc.input + s.total_input,
            closed: acc.closed + s.total_closed,
            pending: acc.pending + s.total_pending,
            rejected: acc.rejected + s.total_rejected,
            target: acc.target + s.target
        }), { input: 0, closed: 0, pending: 0, rejected: 0, target: 0 });

        // Calculate time gone untuk bulan ini
        const daysInMonth = new Date(targetYear, targetMon, 0).getDate();
        const currentDay = now.getDate();
        const isCurrentMonth = now.getFullYear() === targetYear && (now.getMonth() + 1) === targetMon;
        const timeGonePercent = isCurrentMonth ? Math.round((currentDay / daysInMonth) * 100) : 100;

        return new Response(
            JSON.stringify({
                success: true,
                stores: result,
                month: targetMonth,
                totals,
                timeGonePercent,
                daysInMonth,
                currentDay: isCurrentMonth ? currentDay : daysInMonth
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Edge function error:', error);
        return new Response(
            JSON.stringify({ success: false, message: 'Internal server error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
