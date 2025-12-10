import {
    Body,
    Controller,
    Headers,
    HttpCode,
    HttpStatus,
    Post,
    RawBodyRequest,
    Req,
} from '@nestjs/common';

import { Request } from 'express';

import { TenantAdminService } from 'src/engine/core-modules/admin/services/tenant-admin.service';
import { WebhookSignatureService } from 'src/engine/core-modules/admin/services/webhook-signature.service';
import {
    AuthException,
    AuthExceptionCode,
} from 'src/engine/core-modules/auth/auth.exception';

/**
 * Webhook event types that external systems can send
 */
type WebhookEventType =
  | 'tenant.disabled'
  | 'tenant.enabled'
  | 'tenant.subscription.cancelled'
  | 'tenant.subscription.updated'
  | 'tenant.user.removed';

/**
 * Webhook payload structure
 */
type WebhookPayload = {
  event: WebhookEventType;
  timestamp: string;
  data: {
    tenantId?: string;
    tenantEmail?: string; // Can identify tenant by admin email
    reason?: string;
    metadata?: Record<string, unknown>;
  };
};

/**
 * Webhook controller for receiving notifications from external systems.
 *
 * External systems (billing, CRM, etc.) can notify this endpoint to:
 * - Disable tenants (e.g., subscription cancelled)
 * - Enable tenants (e.g., subscription renewed)
 *
 * All requests must be signed using HMAC-SHA256 with the shared WEBHOOK_SECRET.
 *
 * Signature format (like Stripe):
 *   x-webhook-signature: t=timestamp,v1=signature
 *
 * Example curl:
 *   timestamp=$(date +%s)
 *   payload='{"event":"tenant.disabled","timestamp":"2024-01-01T00:00:00Z","data":{"tenantId":"xxx","reason":"Subscription cancelled"}}'
 *   signature=$(echo -n "${timestamp}.${payload}" | openssl dgst -sha256 -hmac "your-webhook-secret" | cut -d' ' -f2)
 *   curl -X POST https://your-crm.com/webhooks/tenant \
 *     -H "Content-Type: application/json" \
 *     -H "x-webhook-signature: t=${timestamp},v1=${signature}" \
 *     -d "${payload}"
 */
@Controller('webhooks/tenant')
export class TenantWebhookController {
  constructor(
    private readonly tenantAdminService: TenantAdminService,
    private readonly webhookSignatureService: WebhookSignatureService,
  ) {}

  /**
   * Main webhook endpoint for tenant lifecycle events
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-webhook-signature') signature: string,
    @Body() payload: WebhookPayload,
  ) {
    // Get raw body for signature verification
    const rawBody = req.rawBody?.toString() || JSON.stringify(payload);

    // Verify signature
    try {
      this.webhookSignatureService.verifySignature(rawBody, signature);
    } catch (error) {
      throw new AuthException(
        `Webhook signature verification failed: ${error.message}`,
        AuthExceptionCode.FORBIDDEN_EXCEPTION,
      );
    }

    // Process the event
    const { event, data } = payload;

    switch (event) {
      case 'tenant.disabled':
      case 'tenant.subscription.cancelled':
        return this.handleTenantDisabled(data);

      case 'tenant.enabled':
      case 'tenant.subscription.updated':
        return this.handleTenantEnabled(data);

      case 'tenant.user.removed':
        return this.handleUserRemoved(data);

      default:
        return {
          success: true,
          message: `Event ${event} acknowledged but not processed`,
        };
    }
  }

  /**
   * Handle tenant disabled event
   */
  private async handleTenantDisabled(data: WebhookPayload['data']) {
    const tenantId = await this.resolveTenantId(data);

    if (!tenantId) {
      throw new AuthException(
        'Could not resolve tenant. Provide tenantId or tenantEmail.',
        AuthExceptionCode.INVALID_INPUT,
      );
    }

    const workspace = await this.tenantAdminService.disableTenant(
      tenantId,
      data.reason || 'Disabled via webhook',
    );

    return {
      success: true,
      event: 'tenant.disabled',
      tenantId: workspace.id,
      message: `Tenant ${workspace.id} has been disabled`,
    };
  }

  /**
   * Handle tenant enabled event
   */
  private async handleTenantEnabled(data: WebhookPayload['data']) {
    const tenantId = await this.resolveTenantId(data);

    if (!tenantId) {
      throw new AuthException(
        'Could not resolve tenant. Provide tenantId or tenantEmail.',
        AuthExceptionCode.INVALID_INPUT,
      );
    }

    const workspace = await this.tenantAdminService.enableTenant(tenantId);

    return {
      success: true,
      event: 'tenant.enabled',
      tenantId: workspace.id,
      message: `Tenant ${workspace.id} has been enabled`,
    };
  }

  /**
   * Handle user removed event (placeholder for future implementation)
   */
  private async handleUserRemoved(data: WebhookPayload['data']) {
    // TODO: Implement user removal logic
    return {
      success: true,
      event: 'tenant.user.removed',
      message: 'User removal acknowledged (not yet implemented)',
      data,
    };
  }

  /**
   * Resolve tenant ID from various identifiers
   */
  private async resolveTenantId(
    data: WebhookPayload['data'],
  ): Promise<string | null> {
    // Direct tenant ID
    if (data.tenantId) {
      return data.tenantId;
    }

    // Resolve by email (find workspace where this email is an admin)
    if (data.tenantEmail) {
      const tenants = await this.tenantAdminService.getAllTenants({
        includeDisabled: true,
        search: data.tenantEmail,
      });

      if (tenants.length > 0) {
        return tenants[0].id;
      }
    }

    return null;
  }

  /**
   * Test endpoint to verify webhook configuration
   * Returns a sample signature for testing
   */
  @Post('test')
  @HttpCode(HttpStatus.OK)
  async testWebhook(@Body() payload: Record<string, unknown>) {
    const secret = this.webhookSignatureService.getWebhookSecret();

    if (!secret) {
      return {
        success: false,
        error: 'WEBHOOK_SECRET not configured',
        message: 'Set WEBHOOK_SECRET environment variable to enable webhooks',
      };
    }

    const payloadString = JSON.stringify(payload);
    const signature = this.webhookSignatureService.generateSignature(payloadString);

    return {
      success: true,
      message: 'Webhook secret is configured. Use this signature to test.',
      testSignature: signature,
      payload: payloadString,
      curlExample: `curl -X POST ${process.env.SERVER_URL || 'https://your-server'}/webhooks/tenant \\
  -H "Content-Type: application/json" \\
  -H "x-webhook-signature: ${signature}" \\
  -d '${payloadString}'`,
    };
  }
}
