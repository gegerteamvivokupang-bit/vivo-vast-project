/**
 * SIMPLIFIED SPC PROMOTOR QUERY
 * 
 * Ganti query yang lama (lines 156-212) dengan yang ini
 * 
 * SEBELUM: Query vast_finance_data_new, filter, count manual
 * SESUDAH: Query users.store_id, ambil count dari view aggregate
 */

// Fetch promotor detail untuk setiap toko SPC
const storesWithPromotors = await Promise.all(
    stores.map(async (store: StoreData) => {
        // Query promotor yang assigned ke toko ini (via users.store_id)
        const { data: promotorUsers, error: promError } = await supabase
            .from('users')
            .select('id, name')
            .eq('role', 'promotor')
            .eq('store_id', store.store_id);

        if (promError) {
            console.log(`🏪 ${store.store_name}: Error -`, promError.message);
            return { ...store, promotors: [] };
        }

        if (!promotorUsers || promotorUsers.length === 0) {
            console.log(`🏪 ${store.store_name}: 0 promotors (not assigned)`);
            return { ...store, promotors: [] };
        }

        // Get input count dari view aggregate
        const promotorIds = promotorUsers.map(p => p.id);
        const { data: aggData } = await supabase
            .from('v_agg_monthly_promoter_all')
            .select('promoter_user_id, total_input')
            .in('promoter_user_id', promotorIds)
            .eq('agg_month', `${monthStr}-01`);

        // Map promotor dengan input count
        const promotorsWithInput = promotorUsers.map(promotor => {
            const agg = aggData?.find(a => a.promoter_user_id === promotor.id);
            return {
                name: promotor.name,
                total_input: agg?.total_input || 0
            };
        });

        console.log(`🏪 ${store.store_name}: ${promotorsWithInput.length} promotors`);

        return {
            ...store,
            promotors: promotorsWithInput
        };
    })
);
