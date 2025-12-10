// Supabase Edge Function: CRM Proxy
//
// Transparent proxy to the CRM server.
// Same API in, same API out - just adds authentication.
//
// This function relays any request to the CRM server's /saas/* endpoints
// with the SAAS_ADMIN_KEY, so the client doesn't need to know the key.
//
// Usage:
//   POST /functions/v1/crm-proxy/tenants
//   POST /functions/v1/crm-proxy/tenants/:id/disable
//   GET  /functions/v1/crm-proxy/tenants/:id
//   GET  /functions/v1/crm-proxy/stats
//
// The path after /crm-proxy is forwarded to CRM's /saas/* endpoint.
//
// Headers:
//   Authorization: Bearer <supabase-jwt> (user must be authenticated)
//
// The edge function adds:
//   x-saas-admin-key: <server-side secret>

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const saasAdminKey = Deno.env.get('SAAS_ADMIN_KEY')
    const crmServerUrl = Deno.env.get('CRM_SERVER_URL')

    if (!saasAdminKey) {
      return new Response(
        JSON.stringify({ error: 'SAAS_ADMIN_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!crmServerUrl) {
      return new Response(
        JSON.stringify({ error: 'CRM_SERVER_URL not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify user is authenticated via Supabase JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify the JWT and get user
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user is admin (has admin role in app_metadata)
    const appMetadata = user.app_metadata || {}
    const isAdmin =
      appMetadata.role === 'admin' ||
      appMetadata.role === 'super_admin' ||
      appMetadata.role === 'platform_admin' ||
      appMetadata.is_admin === true

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Extract the path after /crm-proxy
    const url = new URL(req.url)
    const pathMatch = url.pathname.match(/\/crm-proxy(.*)/)
    const crmPath = pathMatch ? pathMatch[1] : ''

    // Build the CRM URL
    const crmUrl = `${crmServerUrl}/saas${crmPath}${url.search}`

    // Get request body if present
    let body: string | undefined
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      body = await req.text()
    }

    // Forward the request to CRM
    const crmResponse = await fetch(crmUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'x-saas-admin-key': saasAdminKey,
        // Forward user context
        'x-user-id': user.id,
        'x-user-email': user.email || '',
      },
      body: body || undefined,
    })

    // Get response
    const responseText = await crmResponse.text()

    // Return the CRM response as-is
    return new Response(responseText, {
      status: crmResponse.status,
      headers: {
        ...corsHeaders,
        'Content-Type': crmResponse.headers.get('Content-Type') || 'application/json',
      },
    })

  } catch (error) {
    console.error('CRM Proxy error:', error)
    return new Response(
      JSON.stringify({ error: 'Proxy error', details: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
