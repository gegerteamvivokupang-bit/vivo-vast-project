// VAST FINANCE - SPC Monthly Dashboard Edge Function
// Query v_agg_monthly_store_all untuk toko-toko SPC (is_spc = true)

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

        // Default ke bulan ini jika tidak ada month
        const now = new Date();
        const targetMonth = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

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

        const result = Array.from(storeMap.values()).map(row => ({
            store_id: row.store_id,
            store_name: row.store_name,
            area: row.area,
            total_input: row.total_input || 0,
            total_closed: row.total_closed || 0,
            total_pending: row.total_pending || 0,
            total_rejected: row.total_rejected || 0,
            total_closing_direct: row.total_closing_direct || 0,
            total_closing_followup: row.total_closing_followup || 0,
            agg_month: row.agg_month || queryMonth
        }));

        // Sort by total_input descending
        result.sort((a, b) => b.total_input - a.total_input);

        // Calculate totals
        const totals = result.reduce((acc, s) => ({
            input: acc.input + s.total_input,
            closed: acc.closed + s.total_closed,
            pending: acc.pending + s.total_pending,
            rejected: acc.rejected + s.total_rejected
        }), { input: 0, closed: 0, pending: 0, rejected: 0 });

        // Calculate time gone untuk bulan ini
        const [year, mon] = targetMonth.split('-').map(Number);
        const daysInMonth = new Date(year, mon, 0).getDate();
        const currentDay = now.getDate();
        const isCurrentMonth = now.getFullYear() === year && (now.getMonth() + 1) === mon;
        const timeGonePercent = isCurrentMonth ? Math.round((currentDay / daysInMonth) * 100) : 100;

        console.log('SPC Monthly - returning', result.length, 'stores');

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
