import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { AdminGuard } from 'src/engine/core-modules/admin/guards/admin.guard';
import {
  CrossTenantRecord,
  TenantAdminService,
  TenantDetails,
  TenantSummary,
} from 'src/engine/core-modules/admin/services/tenant-admin.service';
import { JwtAuthGuard } from 'src/engine/guards/jwt.auth.guard';

@Controller('admin/tenants')
@UseGuards(JwtAuthGuard, AdminGuard)
export class TenantAdminController {
  constructor(private readonly tenantAdminService: TenantAdminService) {}

  /**
   * Get all tenants with summary info
   */
  @Get()
  async getAllTenants(
    @Query('includeDisabled') includeDisabled?: string,
    @Query('search') search?: string,
  ): Promise<{ tenants: TenantSummary[] }> {
    const tenants = await this.tenantAdminService.getAllTenants({
      includeDisabled: includeDisabled === 'true',
      search,
    });

    return { tenants };
  }

  /**
   * Get global statistics
   */
  @Get('stats')
  async getGlobalStats() {
    return this.tenantAdminService.getGlobalStats();
  }

  /**
   * Get detailed info for a specific tenant
   */
  @Get(':tenantId')
  async getTenantDetails(
    @Param('tenantId') tenantId: string,
  ): Promise<{ tenant: TenantDetails | null }> {
    const tenant = await this.tenantAdminService.getTenantDetails(tenantId);
    return { tenant };
  }

  /**
   * Disable a tenant
   */
  @Post(':tenantId/disable')
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
      message: `Tenant ${tenantId} has been disabled`,
      workspace: {
        id: workspace.id,
        isDisabled: workspace.isDisabled,
        disabledAt: workspace.disabledAt,
        disabledReason: workspace.disabledReason,
      },
    };
  }

  /**
   * Enable a tenant
   */
  @Post(':tenantId/enable')
  async enableTenant(@Param('tenantId') tenantId: string) {
    const workspace = await this.tenantAdminService.enableTenant(tenantId);
    return {
      success: true,
      message: `Tenant ${tenantId} has been enabled`,
      workspace: {
        id: workspace.id,
        isDisabled: workspace.isDisabled,
      },
    };
  }

  // No subscription tier management - everyone gets full access

  /**
   * Update admin notes
   */
  @Patch(':tenantId/notes')
  async updateAdminNotes(
    @Param('tenantId') tenantId: string,
    @Body() body: { notes: string },
  ) {
    const workspace = await this.tenantAdminService.updateAdminNotes(
      tenantId,
      body.notes,
    );
    return {
      success: true,
      workspace: {
        id: workspace.id,
        adminNotes: workspace.adminNotes,
      },
    };
  }

  /**
   * Query records across all tenants
   */
  @Get('records/:recordType')
  async queryCrossTenantRecords(
    @Param('recordType') recordType: 'person' | 'company' | 'opportunity',
    @Query('tenantIds') tenantIds?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('search') search?: string,
  ): Promise<{ records: CrossTenantRecord[]; total: number }> {
    return this.tenantAdminService.queryCrossTenantRecords(recordType, {
      tenantIds: tenantIds ? tenantIds.split(',') : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      search,
    });
  }
}
