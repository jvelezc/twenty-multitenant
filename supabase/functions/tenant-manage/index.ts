// Supabase Edge Function: Manage Tenant
//
// Manages existing tenants - disable, enable, update, delete.
// Called by the SaaS client app for tenant lifecycle management.
//
// POST /functions/v1/tenant-manage
// Headers:
//   Authorization: Bearer <supabase-anon-key>
//   x-saas-admin-key: <your-saas-admin-key>
// Body:
//   { "action": "disable", "tenantId": "xxx", "reason": "Non-payment" }
//   { "action": "enable", "tenantId": "xxx" }
//   { "action": "delete", "tenantId": "xxx" }
//   { "action": "update", "tenantId": "xxx", "notes": "VIP customer" }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-saas-admin-key',
}

type TenantAction = 'disable' | 'enable' | 'delete' | 'update' | 'get' | 'list'

interface ManageTenantRequest {
  action: TenantAction
  tenantId?: string
  reason?: string
  notes?: string
  search?: string
  includeDisabled?: boolean
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

    // Parse request body
    const body: ManageTenantRequest = await req.json()

    if (!body.action) {
      return new Response(
        JSON.stringify({ error: 'action is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    let endpoint: string
    let method: string
    let requestBody: Record<string, unknown> | undefined

    switch (body.action) {
      case 'list':
        const params = new URLSearchParams()
        if (body.search) params.append('search', body.search)
        if (body.includeDisabled) params.append('includeDisabled', 'true')
        endpoint = `/saas/tenants?${params.toString()}`
        method = 'GET'
        break

      case 'get':
        if (!body.tenantId) {
          return new Response(
            JSON.stringify({ error: 'tenantId is required for get action' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        endpoint = `/saas/tenants/${body.tenantId}`
        method = 'GET'
        break

      case 'disable':
        if (!body.tenantId) {
          return new Response(
            JSON.stringify({ error: 'tenantId is required for disable action' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        endpoint = `/saas/tenants/${body.tenantId}/disable`
        method = 'POST'
        requestBody = { reason: body.reason }
        break

      case 'enable':
        if (!body.tenantId) {
          return new Response(
            JSON.stringify({ error: 'tenantId is required for enable action' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        endpoint = `/saas/tenants/${body.tenantId}/enable`
        method = 'POST'
        break

      case 'update':
        if (!body.tenantId) {
          return new Response(
            JSON.stringify({ error: 'tenantId is required for update action' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        endpoint = `/saas/tenants/${body.tenantId}/notes`
        method = 'PATCH'
        requestBody = { notes: body.notes }
        break

      case 'delete':
        if (!body.tenantId) {
          return new Response(
            JSON.stringify({ error: 'tenantId is required for delete action' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        // For now, delete = disable with reason
        endpoint = `/saas/tenants/${body.tenantId}/disable`
        method = 'POST'
        requestBody = { reason: body.reason || 'Tenant deleted' }
        break

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${body.action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    // Call CRM SaaS Admin API
    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-saas-admin-key': expectedKey!,
      },
    }

    if (requestBody) {
      fetchOptions.body = JSON.stringify(requestBody)
    }

    const response = await fetch(`${crmServerUrl}${endpoint}`, fetchOptions)
    const result = await response.json()

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: result.message || 'Operation failed', details: result }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        action: body.action,
        result,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error managing tenant:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
