// Supabase Edge Function: Create Tenant
//
// Creates a new tenant in the crm schema and syncs to CRM server.
// Called by the SaaS client app when a user signs up or purchases.
//
// Flow:
// 1. Create tenant record in crm.tenants (Supabase)
// 2. Queue sync operation to crm.sync_queue
// 3. Call CRM server to create workspace
// 4. Update crm.tenants with crm_workspace_id
//
// POST /functions/v1/tenant-create
// Headers:
//   Authorization: Bearer <supabase-anon-key>
//   x-saas-admin-key: <your-saas-admin-key>
// Body:
//   { "email": "user@example.com", "displayName": "My Company", "subdomain": "mycompany" }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-saas-admin-key',
}

interface CreateTenantRequest {
  email: string
  displayName: string
  subdomain?: string
  firstName?: string
  lastName?: string
  userId?: string // Optional Supabase user ID
}

serve(async (req: Request) => {
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
    const body: CreateTenantRequest = await req.json()

    if (!body.email) {
      return new Response(
        JSON.stringify({ error: 'email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Generate subdomain from email if not provided
    const subdomain = body.subdomain || body.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '')
    const displayName = body.displayName || subdomain

    // Check if subdomain already exists in crm.tenants
    const { data: existingTenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('subdomain', subdomain)
      .single()

    if (existingTenant) {
      return new Response(
        JSON.stringify({ error: `Subdomain "${subdomain}" already exists` }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Step 1: Create tenant record in crm.tenants
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        display_name: displayName,
        subdomain: subdomain,
        owner_email: body.email,
        owner_user_id: body.userId || null,
        status: 'pending',
        metadata: {
          firstName: body.firstName,
          lastName: body.lastName,
        },
      })
      .select()
      .single()

    if (tenantError) {
      console.error('Error creating tenant in crm schema:', tenantError)
      return new Response(
        JSON.stringify({ error: 'Failed to create tenant record', details: tenantError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Step 2: Log the creation event
    await supabase.rpc('log_event', {
      p_tenant_id: tenant.id,
      p_event_type: 'created',
      p_event_data: { email: body.email, displayName, subdomain },
      p_triggered_by_system: 'supabase',
    })

    // Step 3: Queue sync to CRM server
    await supabase.rpc('queue_sync', {
      p_operation: 'create_tenant',
      p_payload: {
        email: body.email,
        displayName,
        subdomain,
        firstName: body.firstName,
        lastName: body.lastName,
      },
      p_tenant_id: tenant.id,
    })

    // Step 4: Call CRM server to create workspace
    const crmServerUrl = Deno.env.get('CRM_SERVER_URL')

    if (crmServerUrl) {
      try {
        const crmResponse = await fetch(`${crmServerUrl}/saas/tenants`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-saas-admin-key': expectedKey!,
          },
          body: JSON.stringify({
            email: body.email,
            displayName,
            subdomain,
            firstName: body.firstName,
            lastName: body.lastName,
          }),
        })

        const crmResult = await crmResponse.json()

        if (crmResponse.ok && crmResult.tenant?.id) {
          // Update tenant with CRM workspace ID and set status to active
          await supabase
            .from('tenants')
            .update({
              crm_workspace_id: crmResult.tenant.id,
              status: 'active',
            })
            .eq('id', tenant.id)

          // Log activation event
          await supabase.rpc('log_event', {
            p_tenant_id: tenant.id,
            p_event_type: 'activated',
            p_event_data: { crm_workspace_id: crmResult.tenant.id },
            p_triggered_by_system: 'crm',
          })

          // Mark sync as completed
          await supabase
            .from('sync_queue')
            .update({ status: 'completed', processed_at: new Date().toISOString() })
            .eq('tenant_id', tenant.id)
            .eq('operation', 'create_tenant')
            .eq('status', 'pending')
        } else {
          // Mark sync as failed
          await supabase
            .from('sync_queue')
            .update({
              status: 'failed',
              last_error: crmResult.message || 'CRM creation failed',
              attempts: 1,
            })
            .eq('tenant_id', tenant.id)
            .eq('operation', 'create_tenant')
            .eq('status', 'pending')
        }
      } catch (crmError) {
        console.error('Error calling CRM server:', crmError)
        // Sync will be retried later
      }
    }

    // Fetch updated tenant
    const { data: updatedTenant } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenant.id)
      .single()

    return new Response(
      JSON.stringify({
        success: true,
        tenant: updatedTenant,
        message: 'Tenant created successfully',
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error creating tenant:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
