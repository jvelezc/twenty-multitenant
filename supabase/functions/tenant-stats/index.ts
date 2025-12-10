// Supabase Edge Function: Tenant Stats
//
// Get platform statistics and tenant metrics.
// Called by the SaaS client app for dashboards and analytics.
//
// GET /functions/v1/tenant-stats
// Headers:
//   Authorization: Bearer <supabase-anon-key>
//   x-saas-admin-key: <your-saas-admin-key>

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-saas-admin-key',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify SaaS Admin Key
    const saasAdminKey = req.headers.get('x-saas-admin-key')
    const expectedKey = Deno.env.get('SAAS_ADMIN_KEY')

    if (!saasAdminKey || saasAdminKey !== expectedKey) {
      return new Response(
        JSON.stringify({ error: 'Invalid or missing x-saas-admin-key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get CRM server URL
    const crmServerUrl = Deno.env.get('CRM_SERVER_URL')
    if (!crmServerUrl) {
      return new Response(
        JSON.stringify({ error: 'CRM_SERVER_URL not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Call CRM SaaS Admin API for stats
    const response = await fetch(`${crmServerUrl}/saas/stats`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-saas-admin-key': expectedKey!,
      },
    })

    const result = await response.json()

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: result.message || 'Failed to get stats', details: result }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        stats: result,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error getting stats:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
