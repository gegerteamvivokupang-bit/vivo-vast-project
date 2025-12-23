// VAST FINANCE - Team Monthly Dashboard Edge Function
// Query agg_monthly views untuk team members (SPV/SATOR)
// Mendukung mixed hierarchy: SPV -> SATOR -> PROMOTOR

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        let requestMonth: string | null = null;
        let userId: string | null = null

        if (req.method === 'POST') {
            const body = await req.json()
            userId = body.userId
            requestMonth = body.month // Format: 'YYYY-MM'
        }

        // Calculate default month (This Month in WITA)
        const witaDate = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Makassar',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(new Date());

        // Use requested month or default to current month (ensure format YYYY-MM-01)
        const currentMonth = requestMonth ? `${requestMonth}-01` : (witaDate.substring(0, 7) + '-01');

        console.log('Fetching team for userId:', userId, 'month:', currentMonth);

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 1. Get direct subordinates from hierarchy
        const { data: subordinates, error: hierarchyError } = await supabaseClient
            .from('hierarchy')
            .select('user_id')
            .eq('atasan_id', userId)

        if (hierarchyError) {
            console.error('Hierarchy error:', hierarchyError)
            return new Response(JSON.stringify([]), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        if (!subordinates || subordinates.length === 0) {
            console.log('No subordinates found for:', userId)
            return new Response(JSON.stringify([]), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const subordinateIds = subordinates.map(s => s.user_id)
        console.log('Found subordinates:', subordinateIds.length)

        // 2. Get User Details & Roles
        const { data: users, error: userError } = await supabaseClient
            .from('users')
            .select('id, name, employee_id, role')
            .in('id', subordinateIds)

        if (userError) {
            console.error('Users fetch error:', userError)
            return new Response(JSON.stringify([]), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const userMap = new Map((users || []).map(u => [u.id, u]))



        // ... (Header logic) ...

        // 3. STANDARD STRATEGY: Fetch directly from Aggregated Views
        // Relies on Database Views being correctly defined (aggregating from Promoters)

        const allDataMap = new Map<string, any>();

        // Initialize Default 0 for all subordinates
        subordinateIds.forEach(id => {
            const user = userMap.get(id);
            allDataMap.set(id, {
                user_id: id,
                name: user?.name || 'Unknown',
                role: user?.role || 'sator', // Default role assumption, will be updated by view data
                employee_id: user?.employee_id || '',
                total_input: 0,
                total_rejected: 0,
                total_pending: 0,
                total_closed: 0,
                agg_month: currentMonth,
                target: 0
            });
        });


        // Calculate date range for robust querying
        const startDate = currentMonth; // "YYYY-MM-01"
        // Next month logic
        const [yearStr, monthStr] = currentMonth.split('-');
        let year = parseInt(yearStr);
        let month = parseInt(monthStr);
        month++; // next month
        if (month > 12) {
            month = 1;
            year++;
        }
        const endDate = `${year}-${String(month).padStart(2, '0')}-01`;

        console.log('Fetching Standard View Range:', startDate, 'to', endDate);

        // Get promotor IDs for parallel query
        const promotorIds = (users || []).filter(u => u.role === 'promotor').map(u => u.id);

        // PARALLEL QUERIES for better performance
        const [satorResult, promotorResult, spvResult, targetsResult, spvOwnTargetResult] = await Promise.all([
            // A. Fetch SATOR Aggregates
            supabaseClient
                .from('v_agg_monthly_sator_all')
                .select('*')
                .in('sator_user_id', subordinateIds)
                .gte('agg_month', startDate)
                .lt('agg_month', endDate),

            // B. Fetch PROMOTOR Aggregates
            promotorIds.length > 0
                ? supabaseClient
                    .from('v_agg_monthly_promoter_all')
                    .select('*')
                    .in('promoter_user_id', promotorIds)
                    .gte('agg_month', startDate)
                    .lt('agg_month', endDate)
                : Promise.resolve({ data: null, error: null }),

            // C. Fetch SPV Aggregates
            supabaseClient
                .from('v_agg_monthly_spv_all')
                .select('*')
                .in('spv_user_id', subordinateIds)
                .gte('agg_month', startDate)
                .lt('agg_month', endDate),

            // D. Fetch targets for subordinates (use YYYY-MM format to match how targets are stored)
            supabaseClient
                .from('targets')
                .select('user_id, target_value')
                .in('user_id', subordinateIds)
                .eq('month', currentMonth.substring(0, 7)),

            // E. Fetch caller's own admin-assigned target (works for both SPV and SATOR)
            supabaseClient
                .from('targets')
                .select('target_value, target_type')
                .eq('user_id', userId)
                .eq('month', currentMonth.substring(0, 7))
                .eq('target_type', 'primary')
                .maybeSingle()
        ]);

        // Process SATOR data
        if (satorResult.error) console.error('Sator view error:', satorResult.error);
        if (satorResult.data) {
            satorResult.data.forEach(item => {
                if (allDataMap.has(item.sator_user_id)) {
                    const entry = allDataMap.get(item.sator_user_id);
                    entry.total_input = item.total_input || 0;
                    entry.total_rejected = item.total_rejected || 0;
                    entry.total_pending = item.total_pending || 0;
                    entry.total_closed = item.total_closed || 0;
                    entry.role = 'sator';
                }
            });
        }

        // Process PROMOTOR data
        if (promotorResult.error) console.error('Promotor view error:', promotorResult.error);
        if (promotorResult.data) {
            promotorResult.data.forEach(item => {
                if (allDataMap.has(item.promoter_user_id)) {
                    const entry = allDataMap.get(item.promoter_user_id);
                    entry.total_input = item.total_input || 0;
                    entry.total_rejected = item.total_rejected || 0;
                    entry.total_pending = item.total_pending || 0;
                    entry.total_closed = item.total_closed || 0;
                    entry.role = 'promotor';
                }
            });
        }

        // Process SPV data
        if (spvResult.error) console.error('SPV view error:', spvResult.error);
        if (spvResult.data) {
            spvResult.data.forEach(item => {
                if (allDataMap.has(item.spv_user_id)) {
                    const entry = allDataMap.get(item.spv_user_id);
                    if (entry.total_input === 0 && (item.total_input > 0)) {
                        entry.total_input = item.total_input || 0;
                        entry.total_rejected = item.total_rejected || 0;
                        entry.total_pending = item.total_pending || 0;
                        entry.total_closed = item.total_closed || 0;
                        entry.role = 'spv';
                    }
                }
            });
        }

        // Process targets
        const { data: targetsData } = targetsResult;

        const targetsMap = new Map(
            (targetsData || []).map(t => [t.user_id, t.target_value])
        )

        // Add target to data
        const finalData = Array.from(allDataMap.values()).map(item => ({
            ...item,
            target: targetsMap.get(item.user_id) || 0
        }))

        // Get caller's own admin-assigned target (works for both SPV and SATOR)
        const callerTarget = spvOwnTargetResult.data?.target_value || 0;

        console.log('Returning Standard View Data count:', finalData.length, 'Caller target:', callerTarget)

        // Return both subordinate data AND caller's own target
        return new Response(
            JSON.stringify({
                subordinates: finalData,
                spvTarget: callerTarget,  // Keep as spvTarget for backward compatibility
                callerTarget: callerTarget  // Also add callerTarget for clarity
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Edge function error:', error)
        return new Response(
            JSON.stringify({ success: false, message: 'Internal server error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
