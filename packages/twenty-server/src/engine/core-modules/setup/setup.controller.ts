import {
    Body,
    Controller,
    Get,
    HttpException,
    HttpStatus,
    Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Setup Controller - One-time configuration endpoint
 *
 * This controller provides an API for initial CRM configuration.
 * Used by external installers (C#, scripts) to configure the CRM
 * without needing SSH access.
 *
 * Security:
 * - Requires SETUP_KEY environment variable to be set
 * - Can only be used once (writes a lock file)
 * - Should be disabled in production after setup
 * - Uses JWKS (JSON Web Key Set) for JWT verification (more secure than shared secret)
 *
 * Usage:
 *   POST /setup/initialize
 *   {
 *     "setupKey": "your-setup-key",
 *     "supabaseUrl": "https://xxx.supabase.co",
 *     "supabaseAnonKey": "...",
 *     "supabaseServiceRoleKey": "...",
 *     "adminEmails": ["admin@example.com"],
 *     "serverUrl": "https://crm.example.com"
 *   }
 *
 * Note: JWKS URL is automatically derived as {supabaseUrl}/auth/v1/.well-known/jwks.json
 */

interface SetupRequest {
  setupKey: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  supabaseJwksUrl?: string;  // Modern: JWKS endpoint for JWT verification
  adminEmails?: string[];
  serverUrl?: string;
  webhookSecret?: string;
  saasAdminKey?: string;
}

interface SetupStatus {
  configured: boolean;
  setupAvailable: boolean;
  supabaseConfigured: boolean;
  message: string;
}

@Controller('setup')
export class SetupController {
  private readonly lockFilePath = path.join(process.cwd(), '.setup-complete');

  constructor(private readonly configService: ConfigService) {}

  /**
   * Check if setup is available and current configuration status
   */
  @Get('status')
  getStatus(): SetupStatus {
    const setupKey = this.configService.get<string>('SETUP_KEY');
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const isLocked = this.isSetupLocked();

    return {
      configured: isLocked,
      setupAvailable: !!setupKey && !isLocked,
      supabaseConfigured: !!supabaseUrl && supabaseUrl !== 'https://your-project.supabase.co',
      message: isLocked
        ? 'CRM is already configured'
        : setupKey
          ? 'Setup available - POST to /setup/initialize'
          : 'Setup not available - SETUP_KEY not configured',
    };
  }

  /**
   * Initialize the CRM with configuration
   *
   * This endpoint:
   * 1. Validates the setup key
   * 2. Writes configuration to .env file
   * 3. Creates a lock file to prevent re-configuration
   * 4. Returns the generated secrets (SAAS_ADMIN_KEY, WEBHOOK_SECRET)
   */
  @Post('initialize')
  async initialize(@Body() body: SetupRequest): Promise<{
    success: boolean;
    message: string;
    generatedSecrets?: {
      saasAdminKey: string;
      webhookSecret: string;
    };
    nextSteps?: string[];
  }> {
    // Check if already configured
    if (this.isSetupLocked()) {
      throw new HttpException(
        'CRM is already configured. Setup can only be run once.',
        HttpStatus.FORBIDDEN,
      );
    }

    // Validate setup key
    const expectedSetupKey = this.configService.get<string>('SETUP_KEY');
    if (!expectedSetupKey) {
      throw new HttpException(
        'Setup not available. SETUP_KEY environment variable not set.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    if (body.setupKey !== expectedSetupKey) {
      throw new HttpException(
        'Invalid setup key',
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Validate required fields
    if (!body.supabaseUrl || !body.supabaseAnonKey || !body.supabaseServiceRoleKey) {
      throw new HttpException(
        'Missing required Supabase configuration (supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey)',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Derive JWKS URL from Supabase URL if not provided
    const supabaseJwksUrl = body.supabaseJwksUrl || `${body.supabaseUrl}/auth/v1/.well-known/jwks.json`;

    // Generate secrets if not provided
    const saasAdminKey = body.saasAdminKey || this.generateSecret();
    const webhookSecret = body.webhookSecret || this.generateSecret();

    // Build environment configuration
    const envConfig = {
      // Supabase
      AUTH_SUPABASE_ENABLED: 'true',
      SUPABASE_URL: body.supabaseUrl,
      SUPABASE_ANON_KEY: body.supabaseAnonKey,
      SUPABASE_SERVICE_ROLE_KEY: body.supabaseServiceRoleKey,
      SUPABASE_JWKS_URL: supabaseJwksUrl,  // JWKS endpoint for JWT verification

      // Admin
      ADMIN_EMAILS: body.adminEmails?.join(',') || '',

      // Server
      SERVER_URL: body.serverUrl || this.configService.get<string>('SERVER_URL') || 'http://localhost:3000',

      // SaaS Integration
      SAAS_ADMIN_KEY: saasAdminKey,
      WEBHOOK_SECRET: webhookSecret,
    };

    try {
      // Write to .env.local (will be loaded on restart)
      await this.writeEnvFile(envConfig);

      // Create lock file
      this.createLockFile();

      // Also set in current process (for immediate use)
      Object.entries(envConfig).forEach(([key, value]) => {
        process.env[key] = value;
      });

      return {
        success: true,
        message: 'CRM configured successfully. Restart the server to apply all changes.',
        generatedSecrets: {
          saasAdminKey,
          webhookSecret,
        },
        nextSteps: [
          'Save the generated secrets securely',
          'Restart the CRM server: docker-compose restart server worker',
          'Configure Supabase redirect URLs to point to this server',
          'Test authentication flow',
        ],
      };
    } catch (error) {
      throw new HttpException(
        `Failed to write configuration: ${(error as Error).message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Health check for the setup endpoint
   */
  @Get('health')
  health(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  private isSetupLocked(): boolean {
    return fs.existsSync(this.lockFilePath);
  }

  private createLockFile(): void {
    fs.writeFileSync(this.lockFilePath, JSON.stringify({
      configuredAt: new Date().toISOString(),
      configuredBy: 'setup-api',
    }));
  }

  private generateSecret(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 64; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private async writeEnvFile(config: Record<string, string>): Promise<void> {
    const envPath = path.join(process.cwd(), '.env.local');

    // Read existing .env.local if it exists
    let existingConfig: Record<string, string> = {};
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      content.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split('=');
        if (key && !key.startsWith('#')) {
          existingConfig[key.trim()] = valueParts.join('=').trim();
        }
      });
    }

    // Merge with new config
    const mergedConfig = { ...existingConfig, ...config };

    // Write back
    const envContent = Object.entries(mergedConfig)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    fs.writeFileSync(envPath, `# Auto-generated by Setup API\n# ${new Date().toISOString()}\n\n${envContent}\n`);
  }
}
