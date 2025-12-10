import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

import {
    AuthException,
    AuthExceptionCode,
} from 'src/engine/core-modules/auth/auth.exception';

/**
 * Guard that checks if the current user has admin privileges.
 * Admin users are identified by:
 * - canImpersonate = true (existing Twenty admin flag)
 * - canAccessFullAdminPanel = true
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new AuthException(
        'User not authenticated',
        AuthExceptionCode.UNAUTHENTICATED,
      );
    }

    // Check if user has admin privileges
    const isAdmin = user.canImpersonate === true || user.canAccessFullAdminPanel === true;

    if (!isAdmin) {
      throw new AuthException(
        'Admin access required',
        AuthExceptionCode.FORBIDDEN_EXCEPTION,
      );
    }

    return true;
  }
}
