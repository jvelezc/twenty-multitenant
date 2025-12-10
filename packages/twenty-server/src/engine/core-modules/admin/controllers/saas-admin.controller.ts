import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';

import { SaasAdminKeyGuard } from 'src/engine/core-modules/admin/guards/saas-admin-key.guard';
import {
    CrossTenantRecord,
    TenantAdminService,
    TenantDetails,
    TenantSummary,
} from 'src/engine/core-modules/admin/services/tenant-admin.service';

/**
 * SaaS Admin Controller - Full platform access via API key.
 *
 * This controller provides complete programmatic access to all tenant
 * management operations for the SaaS platform operator.
 *
 * Authentication: x-saas-admin-key header
 *
 * Use cases:
 * - Platform automation scripts
 * - Admin dashboards
 * - Billing system integrations
 * - Support tools
 * - Monitoring and analytics
 *
 * Example:
 *   curl -X GET https://crm.example.com/saas/tenants \
 *     -H "x-saas-admin-key: your-saas-admin-key"
 */
@Controller('saas')
@UseGuards(SaasAdminKeyGuard)
export class SaasAdminController {
  constructor(private readonly tenantAdminService: TenantAdminService) {}

  // ==================== TENANT MANAGEMENT ====================

  /**
   * Create a new tenant
   */
  @Post('tenants')
  async createTenant(
    @Body() body: {
      email: string;
      displayName?: string;
      subdomain?: string;
      firstName?: string;
      lastName?: string;
    },
  ) {
    const result = await this.tenantAdminService.createTenant(body);

    return {
      success: true,
      action: 'created',
      tenant: {
        id: result.workspace.id,
        displayName: result.workspace.displayName,
        subdomain: result.workspace.subdomain,
        createdAt: result.workspace.createdAt,
      },
      user: {
        id: result.user.id,
        email: result.user.email,
      },
    };
  }

  /**
   * List all tenants
   */
  @Get('tenants')
  async listTenants(
    @Query('includeDisabled') includeDisabled?: string,
    @Query('search') search?: string,
  ): Promise<{ tenants: TenantSummary[]; total: number }> {
    const tenants = await this.tenantAdminService.getAllTenants({
      includeDisabled: includeDisabled === 'true',
      search,
    });

    return {
      tenants,
      total: tenants.length,
    };
  }

  /**
   * Get tenant details
   */
  @Get('tenants/:tenantId')
  async getTenant(
    @Param('tenantId') tenantId: string,
  ): Promise<TenantDetails | null> {
    return this.tenantAdminService.getTenantDetails(tenantId);
  }

  /**
   * Disable a tenant
   */
  @Post('tenants/:tenantId/disable')
  async disableTenant(
    @Param('tenantId') tenantId: string,
    @Body() body: { reason?: string },
  ) {
    const workspace = await this.tenantAdminService.disableTenant(
      tenantId,
      body.reason,
    );

    return {
      success: true,
      action: 'disabled',
      tenantId: workspace.id,
      disabledAt: workspace.disabledAt,
      reason: workspace.disabledReason,
    };
  }

  /**
   * Enable a tenant
   */
  @Post('tenants/:tenantId/enable')
  async enableTenant(@Param('tenantId') tenantId: string) {
    const workspace = await this.tenantAdminService.enableTenant(tenantId);

    return {
      success: true,
      action: 'enabled',
      tenantId: workspace.id,
    };
  }

  /**
   * Delete a tenant permanently
   * WARNING: This is destructive and cannot be undone
   */
  @Delete('tenants/:tenantId')
  async deleteTenant(@Param('tenantId') tenantId: string) {
    const result = await this.tenantAdminService.deleteTenant(tenantId);

    return {
      success: true,
      action: 'deleted',
      tenantId,
      message: result.message,
    };
  }

  /**
   * Update admin notes for a tenant
   */
  @Patch('tenants/:tenantId/notes')
  async updateNotes(
    @Param('tenantId') tenantId: string,
    @Body() body: { notes: string },
  ) {
    const workspace = await this.tenantAdminService.updateAdminNotes(
      tenantId,
      body.notes,
    );

    return {
      success: true,
      tenantId: workspace.id,
      adminNotes: workspace.adminNotes,
    };
  }

  // ==================== CROSS-TENANT QUERIES ====================

  /**
   * Query records across all tenants
   */
  @Get('records/:recordType')
  async queryRecords(
    @Param('recordType') recordType: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
  ): Promise<{ records: CrossTenantRecord[]; total: number }> {
    const records = await this.tenantAdminService.crossTenantQuery(
      recordType,
      search,
      limit ? parseInt(limit, 10) : 100,
    );

    return {
      records,
      total: records.length,
    };
  }

  // ==================== PLATFORM STATS ====================

  /**
   * Get global platform statistics
   */
  @Get('stats')
  async getStats() {
    return this.tenantAdminService.getGlobalStats();
  }

  /**
   * Health check for SaaS admin API
   */
  @Get('health')
  async health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      api: 'saas-admin',
    };
  }

  // ==================== BULK OPERATIONS ====================

  /**
   * Bulk disable tenants
   */
  @Post('tenants/bulk/disable')
  async bulkDisable(
    @Body() body: { tenantIds: string[]; reason?: string },
  ) {
    const results = await Promise.allSettled(
      body.tenantIds.map((id) =>
        this.tenantAdminService.disableTenant(id, body.reason),
      ),
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    return {
      success: true,
      action: 'bulk_disable',
      total: body.tenantIds.length,
      succeeded,
      failed,
    };
  }

  /**
   * Bulk enable tenants
   */
  @Post('tenants/bulk/enable')
  async bulkEnable(@Body() body: { tenantIds: string[] }) {
    const results = await Promise.allSettled(
      body.tenantIds.map((id) => this.tenantAdminService.enableTenant(id)),
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    return {
      success: true,
      action: 'bulk_enable',
      total: body.tenantIds.length,
      succeeded,
      failed,
    };
  }
}
