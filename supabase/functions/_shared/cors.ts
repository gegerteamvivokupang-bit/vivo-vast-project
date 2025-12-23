// VAST FINANCE - Shared CORS Headers untuk Edge Functions
// Import di semua edge functions

export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper response functions
export function jsonResponse(data: unknown, status = 200) {
    return new Response(
        JSON.stringify(data),
        {
            status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
    )
}

export function errorResponse(message: string, status = 400) {
    return new Response(
        JSON.stringify({ success: false, message }),
        {
            status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
    )
}

export function corsPreflightResponse() {
    return new Response('ok', { headers: corsHeaders })
}
