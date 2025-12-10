import {
    Body,
    Controller,
    Get,
    Post,
    Res
} from '@nestjs/common';

import { type Response } from 'express';

import {
    AuthException,
    AuthExceptionCode,
} from 'src/engine/core-modules/auth/auth.exception';
import { AuthService } from 'src/engine/core-modules/auth/services/auth.service';
import { SupabaseAuthService } from 'src/engine/core-modules/auth/services/supabase-auth.service';
import { LoginTokenService } from 'src/engine/core-modules/auth/token/services/login-token.service';
import { AuthProviderEnum } from 'src/engine/core-modules/workspace/types/workspace.type';

type SupabaseTokenExchangeRequest = {
  supabaseAccessToken: string;
  workspaceId?: string;
};

type SupabaseTokenExchangeResponse = {
  loginToken: string;
  workspaceId?: string;
};

@Controller('auth/supabase')
export class SupabaseAuthController {
  constructor(
    private readonly supabaseAuthService: SupabaseAuthService,
    private readonly authService: AuthService,
    private readonly loginTokenService: LoginTokenService,
  ) {}

  /**
   * Exchange a Supabase access token for a Twenty login token
   * This is the main endpoint for Supabase authentication
   */
  @Post('token')
  async exchangeToken(
    @Body() body: SupabaseTokenExchangeRequest,
    @Res() res: Response,
  ): Promise<Response<SupabaseTokenExchangeResponse>> {
    if (!this.supabaseAuthService.isSupabaseEnabled()) {
      throw new AuthException(
        'Supabase authentication is not enabled',
        AuthExceptionCode.FORBIDDEN_EXCEPTION,
      );
    }

    const { supabaseAccessToken, workspaceId } = body;

    if (!supabaseAccessToken) {
      throw new AuthException(
        'Supabase access token is required',
        AuthExceptionCode.INVALID_INPUT,
      );
    }

    // Validate the Supabase token and get user info
    const supabaseAuthContext =
      await this.supabaseAuthService.validateSupabaseToken(supabaseAccessToken);

    // Sync user from Supabase to Twenty
    const user =
      await this.supabaseAuthService.syncUserFromSupabase(supabaseAuthContext);

    // Check if user has access to the requested workspace
    let targetWorkspaceId = workspaceId;

    if (!targetWorkspaceId && user.userWorkspaces?.length > 0) {
      // Default to first workspace if not specified
      targetWorkspaceId = user.userWorkspaces[0].workspaceId;
    }

    if (!targetWorkspaceId) {
      // User has no workspaces - they need to create one or be invited
      throw new AuthException(
        'User does not belong to any workspace. Please create a workspace or request an invitation.',
        AuthExceptionCode.FORBIDDEN_EXCEPTION,
      );
    }

    // Generate Twenty login token
    const loginToken = await this.loginTokenService.generateLoginToken(
      user.email,
      targetWorkspaceId,
      AuthProviderEnum.Supabase,
    );

    return res.status(200).json({
      loginToken: loginToken.token,
      workspaceId: targetWorkspaceId,
    });
  }

  /**
   * Validate a Supabase token and return user info
   * Useful for checking if a token is valid without exchanging it
   */
  @Post('validate')
  async validateToken(
    @Body() body: { supabaseAccessToken: string },
    @Res() res: Response,
  ) {
    if (!this.supabaseAuthService.isSupabaseEnabled()) {
      throw new AuthException(
        'Supabase authentication is not enabled',
        AuthExceptionCode.FORBIDDEN_EXCEPTION,
      );
    }

    const { supabaseAccessToken } = body;

    if (!supabaseAccessToken) {
      throw new AuthException(
        'Supabase access token is required',
        AuthExceptionCode.INVALID_INPUT,
      );
    }

    const supabaseAuthContext =
      await this.supabaseAuthService.validateSupabaseToken(supabaseAccessToken);

    // Check if user exists in Twenty
    const existingUser = await this.supabaseAuthService.findUserBySupabaseId(
      supabaseAuthContext.supabaseUserId,
    );

    return res.status(200).json({
      valid: true,
      supabaseUserId: supabaseAuthContext.supabaseUserId,
      email: supabaseAuthContext.email,
      firstName: supabaseAuthContext.firstName,
      lastName: supabaseAuthContext.lastName,
      isEmailVerified: supabaseAuthContext.isEmailVerified,
      existsInTwenty: !!existingUser,
      workspaceCount: existingUser?.userWorkspaces?.length || 0,
    });
  }

  /**
   * Health check endpoint for Supabase auth
   */
  @Get('status')
  async getStatus(@Res() res: Response) {
    const isEnabled = this.supabaseAuthService.isSupabaseEnabled();

    return res.status(200).json({
      enabled: isEnabled,
      provider: 'supabase',
    });
  }
}
