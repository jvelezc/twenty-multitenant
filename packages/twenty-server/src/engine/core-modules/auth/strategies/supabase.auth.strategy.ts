import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';

import { ExtractJwt, Strategy } from 'passport-jwt';

import {
    AuthException,
    AuthExceptionCode,
} from 'src/engine/core-modules/auth/auth.exception';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

export type SupabaseJwtPayload = {
  sub: string; // Supabase user ID
  email?: string;
  phone?: string;
  app_metadata?: {
    provider?: string;
    providers?: string[];
  };
  user_metadata?: {
    avatar_url?: string;
    email?: string;
    email_verified?: boolean;
    full_name?: string;
    iss?: string;
    name?: string;
    phone_verified?: boolean;
    picture?: string;
    provider_id?: string;
    sub?: string;
  };
  role?: string;
  aal?: string;
  amr?: Array<{ method: string; timestamp: number }>;
  session_id?: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
  email_verified?: boolean;
};

export type SupabaseAuthContext = {
  supabaseUserId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  picture?: string;
  isEmailVerified: boolean;
};

@Injectable()
export class SupabaseAuthStrategy extends PassportStrategy(
  Strategy,
  'supabase-jwt',
) {
  constructor(private readonly twentyConfigService: TwentyConfigService) {
    const supabaseJwtSecret = twentyConfigService.get('SUPABASE_JWT_SECRET');

    if (!supabaseJwtSecret) {
      throw new AuthException(
        'SUPABASE_JWT_SECRET is not configured',
        AuthExceptionCode.INVALID_INPUT,
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: supabaseJwtSecret,
      algorithms: ['HS256'],
    });
  }

  async validate(payload: SupabaseJwtPayload): Promise<SupabaseAuthContext> {
    if (!payload.sub) {
      throw new AuthException(
        'Invalid Supabase token: missing sub claim',
        AuthExceptionCode.INVALID_INPUT,
      );
    }

    const email =
      payload.email || payload.user_metadata?.email || payload.user_metadata?.sub;

    if (!email) {
      throw new AuthException(
        'Invalid Supabase token: missing email',
        AuthExceptionCode.INVALID_INPUT,
      );
    }

    // Parse name from user_metadata
    const fullName =
      payload.user_metadata?.full_name || payload.user_metadata?.name || '';
    const nameParts = fullName.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    return {
      supabaseUserId: payload.sub,
      email: email.toLowerCase(),
      firstName,
      lastName,
      picture:
        payload.user_metadata?.picture || payload.user_metadata?.avatar_url,
      isEmailVerified:
        payload.user_metadata?.email_verified ??
        payload.email_verified ??
        false,
    };
  }
}
