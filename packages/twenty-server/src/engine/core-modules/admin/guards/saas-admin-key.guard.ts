import {
    CanActivate,
    ExecutionContext,
    Injectable,
} from '@nestjs/common';

import {
    AuthException,
    AuthExceptionCode,
} from 'src/engine/core-modules/auth/auth.exception';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

/**
 * Guard for SaaS Admin API Key authentication.
 *
 * This provides a master API key for the platform operator (SaaS deployer)
 * to have full programmatic access to all tenant management operations.
 *
 * Usage:
 *   Header: x-saas-admin-key: your-saas-admin-key
 *
 * This key should be kept extremely secret and only used by:
 * - Platform automation scripts
 * - Admin dashboards
 * - Billing system integrations
 * - Support tools
 */
@Injectable()
export class SaasAdminKeyGuard implements CanActivate {
  private readonly HEADER_NAME = 'x-saas-admin-key';

  constructor(private readonly twentyConfigService: TwentyConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const providedKey = request.headers[this.HEADER_NAME];

    if (!providedKey) {
      throw new AuthException(
        `Missing ${this.HEADER_NAME} header`,
        AuthExceptionCode.UNAUTHENTICATED,
      );
    }

    const saasAdminKey = this.twentyConfigService.get('SAAS_ADMIN_KEY');

    if (!saasAdminKey) {
      throw new AuthException(
        'SaaS Admin Key not configured on server',
        AuthExceptionCode.FORBIDDEN_EXCEPTION,
      );
    }

    // Constant-time comparison to prevent timing attacks
    if (!this.secureCompare(providedKey, saasAdminKey)) {
      throw new AuthException(
        'Invalid SaaS Admin Key',
        AuthExceptionCode.FORBIDDEN_EXCEPTION,
      );
    }

    // Mark request as SaaS admin authenticated
    request.isSaasAdmin = true;

    return true;
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   */
  private secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;

    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }
}
