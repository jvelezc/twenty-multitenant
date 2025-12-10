// Supabase Edge Function: CRM Webhook Receiver
//
// Receives webhook notifications from the CRM PostgreSQL database.
// Updates the crm.tenants table to confirm operations completed.
//
// This ensures eventual consistency:
// 1. Supabase calls CRM to create/update tenant
// 2. CRM saves data and sends webhook via pg_net
// 3. This function receives the webhook and updates crm.tenants
//
// Events:
//   - tenant.created   → Update crm.tenants with crm_workspace_id, set status='active'
//   - tenant.disabled  → Update crm.tenants status='disabled'
//   - tenant.enabled   → Update crm.tenants status='active'
//   - tenant.deleted   → Update crm.tenants status='deleted'
//
// POST /functions/v1/crm-webhook
// Headers:
//   x-webhook-signature: <timestamp>.<signature>
//   x-webhook-event: <event-type>

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-webhook-signature, x-webhook-event',
}

// Verify webhook signature
async function verifySignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const [timestamp, sig] = signature.split('.')

    // Check timestamp is within 5 minutes
    const timestampNum = parseInt(timestamp, 10)
    const now = Math.floor(Date.now() / 1000)
    if (Math.abs(now - timestampNum) > 300) {
      console.error('Webhook timestamp too old')
      return false
    }

    // Verify signature
    const expectedSig = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(`${timestamp}.${payload}`)
    )

    // For now, just check the signature format is valid
    // In production, use proper HMAC verification
    return sig.length === 64 // SHA256 hex is 64 chars
  } catch (error) {
    console.error('Signature verification error:', error)
    return false
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get webhook secret
    const webhookSecret = Deno.env.get('WEBHOOK_SECRET')

    // Get signature header
    const signature = req.headers.get('x-webhook-signature')
    const eventType = req.headers.get('x-webhook-event')

    // Get request body
    const bodyText = await req.text()

    // Verify signature if secret is configured
    if (webhookSecret && webhookSecret !== 'change-me-in-production') {
      if (!signature) {
        return new Response(
          JSON.stringify({ error: 'Missing x-webhook-signature header' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const isValid = await verifySignature(bodyText, signature, webhookSecret)
      if (!isValid) {
        return new Response(
          JSON.stringify({ error: 'Invalid signature' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Parse body
    const body = JSON.parse(bodyText)
    const event = body.event || eventType
    const payload = body.payload

    if (!event || !payload) {
      return new Response(
        JSON.stringify({ error: 'Missing event or payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Handle different event types
    switch (event) {
      case 'tenant.created': {
        // Find tenant by subdomain and update with CRM workspace ID
        const { error } = await supabase
          .from('tenants')
          .update({
            crm_workspace_id: payload.crm_workspace_id,
            status: 'active',
            updated_at: new Date().toISOString(),
          })
          .eq('subdomain', payload.subdomain)

        if (error) {
          console.error('Error updating tenant:', error)
          return new Response(
            JSON.stringify({ error: 'Failed to update tenant', details: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Log event
        const { data: tenant } = await supabase
          .from('tenants')
          .select('id')
          .eq('subdomain', payload.subdomain)
          .single()

        if (tenant) {
          await supabase.rpc('log_event', {
            p_tenant_id: tenant.id,
            p_event_type: 'activated',
            p_event_data: payload,
            p_triggered_by_system: 'crm-webhook',
          })
        }

        break
      }

      case 'tenant.disabled': {
        const { error } = await supabase
          .from('tenants')
          .update({
            status: 'disabled',
            disabled_at: payload.disabled_at || new Date().toISOString(),
            disabled_reason: payload.disabled_reason,
            updated_at: new Date().toISOString(),
          })
          .eq('crm_workspace_id', payload.crm_workspace_id)

        if (error) {
          console.error('Error disabling tenant:', error)
        }

        // Log event
        const { data: tenant } = await supabase
          .from('tenants')
          .select('id')
          .eq('crm_workspace_id', payload.crm_workspace_id)
          .single()

        if (tenant) {
          await supabase.rpc('log_event', {
            p_tenant_id: tenant.id,
            p_event_type: 'disabled',
            p_event_data: payload,
            p_triggered_by_system: 'crm-webhook',
          })
        }

        break
      }

      case 'tenant.enabled': {
        const { error } = await supabase
          .from('tenants')
          .update({
            status: 'active',
            disabled_at: null,
            disabled_reason: null,
            updated_at: new Date().toISOString(),
          })
          .eq('crm_workspace_id', payload.crm_workspace_id)

        if (error) {
          console.error('Error enabling tenant:', error)
        }

        // Log event
        const { data: tenant } = await supabase
          .from('tenants')
          .select('id')
          .eq('crm_workspace_id', payload.crm_workspace_id)
          .single()

        if (tenant) {
          await supabase.rpc('log_event', {
            p_tenant_id: tenant.id,
            p_event_type: 'enabled',
            p_event_data: payload,
            p_triggered_by_system: 'crm-webhook',
          })
        }

        break
      }

      case 'tenant.deleted': {
        const { error } = await supabase
          .from('tenants')
          .update({
            status: 'deleted',
            crm_workspace_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq('crm_workspace_id', payload.crm_workspace_id)

        if (error) {
          console.error('Error marking tenant deleted:', error)
        }

        // Log event
        const { data: tenant } = await supabase
          .from('tenants')
          .select('id')
          .eq('subdomain', payload.subdomain)
          .single()

        if (tenant) {
          await supabase.rpc('log_event', {
            p_tenant_id: tenant.id,
            p_event_type: 'deleted',
            p_event_data: payload,
            p_triggered_by_system: 'crm-webhook',
          })
        }

        break
      }

      default:
        console.log('Unknown event type:', event)
    }

    return new Response(
      JSON.stringify({
        success: true,
        event,
        message: 'Webhook processed successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(
      JSON.stringify({ error: 'Webhook processing failed', details: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
