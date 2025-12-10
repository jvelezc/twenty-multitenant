import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Repository } from 'typeorm';

import {
    AuthException,
    AuthExceptionCode,
} from 'src/engine/core-modules/auth/auth.exception';
import { type SupabaseAuthContext } from 'src/engine/core-modules/auth/strategies/supabase.auth.strategy';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { PrimaryAuthProvider } from 'src/engine/core-modules/user/enums/primary-auth-provider.enum';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';

@Injectable()
export class SupabaseAuthService {
  private supabaseClient: SupabaseClient | null = null;

  constructor(
    private readonly twentyConfigService: TwentyConfigService,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {
    this.initializeSupabaseClient();
  }

  private initializeSupabaseClient(): void {
    const supabaseUrl = this.twentyConfigService.get('SUPABASE_URL');
    const supabaseServiceKey = this.twentyConfigService.get(
      'SUPABASE_SERVICE_ROLE_KEY',
    );

    if (supabaseUrl && supabaseServiceKey) {
      this.supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
    }
  }

  isSupabaseEnabled(): boolean {
    return this.twentyConfigService.get('AUTH_SUPABASE_ENABLED') === true;
  }

  getSupabaseClient(): SupabaseClient {
    if (!this.supabaseClient) {
      throw new AuthException(
        'Supabase client is not initialized. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY configuration.',
        AuthExceptionCode.INVALID_INPUT,
      );
    }

    return this.supabaseClient;
  }

  /**
   * Find a Twenty user by their Supabase user ID
   */
  async findUserBySupabaseId(supabaseUserId: string): Promise<UserEntity | null> {
    return this.userRepository.findOne({
      where: { supabaseUserId },
      relations: { userWorkspaces: true },
    });
  }

  /**
   * Find a Twenty user by email
   */
  async findUserByEmail(email: string): Promise<UserEntity | null> {
    return this.userRepository.findOne({
      where: { email: email.toLowerCase() },
      relations: { userWorkspaces: true },
    });
  }

  /**
   * Create or update a Twenty user from Supabase auth context
   */
  async syncUserFromSupabase(
    supabaseAuthContext: SupabaseAuthContext,
  ): Promise<UserEntity> {
    const { supabaseUserId, email, firstName, lastName, picture, isEmailVerified } =
      supabaseAuthContext;

    // First, try to find by Supabase ID
    let user = await this.findUserBySupabaseId(supabaseUserId);

    if (user) {
      // Update existing user if needed
      let needsUpdate = false;

      if (firstName && user.firstName !== firstName) {
        user.firstName = firstName;
        needsUpdate = true;
      }

      if (lastName && user.lastName !== lastName) {
        user.lastName = lastName;
        needsUpdate = true;
      }

      if (picture && user.defaultAvatarUrl !== picture) {
        user.defaultAvatarUrl = picture;
        needsUpdate = true;
      }

      if (isEmailVerified && !user.isEmailVerified) {
        user.isEmailVerified = true;
        needsUpdate = true;
      }

      if (needsUpdate) {
        user = await this.userRepository.save(user);
      }

      return user;
    }

    // Try to find by email and link Supabase ID
    user = await this.findUserByEmail(email);

    if (user) {
      // Link existing user to Supabase
      user.supabaseUserId = supabaseUserId;
      user.primaryAuthProvider = PrimaryAuthProvider.SUPABASE;

      if (isEmailVerified && !user.isEmailVerified) {
        user.isEmailVerified = true;
      }

      return this.userRepository.save(user);
    }

    // Create new user
    const newUser = this.userRepository.create({
      email: email.toLowerCase(),
      firstName: firstName || '',
      lastName: lastName || '',
      defaultAvatarUrl: picture || '',
      supabaseUserId,
      primaryAuthProvider: PrimaryAuthProvider.SUPABASE,
      isEmailVerified,
    });

    return this.userRepository.save(newUser);
  }

  /**
   * Validate a Supabase access token using the Supabase Admin API
   */
  async validateSupabaseToken(
    accessToken: string,
  ): Promise<SupabaseAuthContext> {
    const client = this.getSupabaseClient();

    const { data, error } = await client.auth.getUser(accessToken);

    if (error || !data.user) {
      throw new AuthException(
        error?.message || 'Invalid Supabase token',
        AuthExceptionCode.INVALID_INPUT,
      );
    }

    const user = data.user;

    // Parse name from user metadata
    const fullName =
      user.user_metadata?.full_name || user.user_metadata?.name || '';
    const nameParts = fullName.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    return {
      supabaseUserId: user.id,
      email: (user.email || '').toLowerCase(),
      firstName,
      lastName,
      picture: user.user_metadata?.picture || user.user_metadata?.avatar_url,
      isEmailVerified: user.email_confirmed_at !== null,
    };
  }

  /**
   * Get Supabase user by ID using Admin API
   */
  async getSupabaseUserById(supabaseUserId: string) {
    const client = this.getSupabaseClient();

    const { data, error } = await client.auth.admin.getUserById(supabaseUserId);

    if (error || !data.user) {
      throw new AuthException(
        error?.message || 'Supabase user not found',
        AuthExceptionCode.USER_NOT_FOUND,
      );
    }

    return data.user;
  }
}
