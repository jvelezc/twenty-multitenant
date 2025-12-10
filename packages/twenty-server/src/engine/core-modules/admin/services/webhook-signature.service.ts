import { Injectable } from '@nestjs/common';

import * as crypto from 'crypto';

import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

/**
 * Webhook signature verification service.
 *
 * Similar to Stripe's webhook signature verification:
 * - External systems sign their payloads with a shared secret
 * - We verify the signature before processing
 *
 * Signature format: t=timestamp,v1=signature
 *
 * The signature is computed as:
 *   HMAC-SHA256(timestamp + "." + payload, secret)
 */
@Injectable()
export class WebhookSignatureService {
  private readonly SIGNATURE_HEADER = 'x-webhook-signature';
  private readonly TIMESTAMP_TOLERANCE_SECONDS = 300; // 5 minutes

  constructor(private readonly twentyConfigService: TwentyConfigService) {}

  /**
   * Get the webhook secret from config
   */
  getWebhookSecret(): string | undefined {
    return this.twentyConfigService.get('WEBHOOK_SECRET');
  }

  /**
   * Verify a webhook signature
   *
   * @param payload - The raw request body as a string
   * @param signatureHeader - The signature header value (format: t=timestamp,v1=signature)
   * @returns true if valid, throws error if invalid
   */
  verifySignature(payload: string, signatureHeader: string): boolean {
    const secret = this.getWebhookSecret();

    if (!secret) {
      throw new Error('Webhook secret not configured. Set WEBHOOK_SECRET environment variable.');
    }

    // Parse the signature header
    const elements = signatureHeader.split(',');
    const signatureParts: Record<string, string> = {};

    for (const element of elements) {
      const [key, value] = element.split('=');
      if (key && value) {
        signatureParts[key] = value;
      }
    }

    const timestamp = signatureParts['t'];
    const signature = signatureParts['v1'];

    if (!timestamp || !signature) {
      throw new Error('Invalid signature format. Expected: t=timestamp,v1=signature');
    }

    // Check timestamp to prevent replay attacks
    const timestampSeconds = parseInt(timestamp, 10);
    const now = Math.floor(Date.now() / 1000);

    if (Math.abs(now - timestampSeconds) > this.TIMESTAMP_TOLERANCE_SECONDS) {
      throw new Error('Webhook timestamp too old or too far in the future');
    }

    // Compute expected signature
    const signedPayload = `${timestamp}.${payload}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');

    // Constant-time comparison to prevent timing attacks
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    );

    if (!isValid) {
      throw new Error('Invalid webhook signature');
    }

    return true;
  }

  /**
   * Generate a signature for testing/client-side use
   *
   * @param payload - The payload to sign
   * @param secret - The secret to use (defaults to configured secret)
   * @returns The signature header value
   */
  generateSignature(payload: string, secret?: string): string {
    const webhookSecret = secret || this.getWebhookSecret();

    if (!webhookSecret) {
      throw new Error('No secret provided');
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const signedPayload = `${timestamp}.${payload}`;
    const signature = crypto
      .createHmac('sha256', webhookSecret)
      .update(signedPayload)
      .digest('hex');

    return `t=${timestamp},v1=${signature}`;
  }
}
