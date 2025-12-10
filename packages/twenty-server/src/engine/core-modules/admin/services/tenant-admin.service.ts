import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { DataSource, In, Repository } from 'typeorm';

import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { SubscriptionTier } from 'src/engine/core-modules/workspace/enums/subscription-tier.enum';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { getWorkspaceSchemaName } from 'src/engine/workspace-datasource/utils/get-workspace-schema-name.util';

/**
 * Tenant summary - simplified, no tier limits (everyone gets full access)
 */
export type TenantSummary = {
  id: string;
  displayName: string;
  subdomain: string;
  createdAt: Date;
  isDisabled: boolean;
  userCount: number;
};

export type TenantDetails = TenantSummary & {
  users: Array<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    createdAt: Date;
  }>;
  disabledAt?: Date;
  disabledReason?: string;
  adminNotes?: string;
  contactCount?: number;
  companyCount?: number;
  opportunityCount?: number;
};

export type CrossTenantRecord = {
  tenantId: string;
  tenantName: string;
  recordId: string;
  recordType: string;
  data: Record<string, unknown>;
};

@Injectable()
export class TenantAdminService {
  constructor(
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
    @InjectRepository(UserWorkspaceEntity)
    private readonly userWorkspaceRepository: Repository<UserWorkspaceEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Get all tenants with summary info
   * No subscription tier filtering - everyone gets full access
   */
  async getAllTenants(options?: {
    includeDisabled?: boolean;
    search?: string;
  }): Promise<TenantSummary[]> {
    const queryBuilder = this.workspaceRepository
      .createQueryBuilder('workspace')
      .leftJoin('workspace.userWorkspaces', 'userWorkspace')
      .select([
        'workspace.id',
        'workspace.displayName',
        'workspace.subdomain',
        'workspace.createdAt',
        'workspace.isDisabled',
      ])
      .addSelect('COUNT(userWorkspace.id)', 'userCount')
      .groupBy('workspace.id');

    if (!options?.includeDisabled) {
      queryBuilder.andWhere('workspace.isDisabled = :isDisabled', {
        isDisabled: false,
      });
    }

    if (options?.search) {
      queryBuilder.andWhere(
        '(workspace.displayName ILIKE :search OR workspace.subdomain ILIKE :search)',
        { search: `%${options.search}%` },
      );
    }

    const results = await queryBuilder.getRawMany();

    return results.map((row) => ({
      id: row.workspace_id,
      displayName: row.workspace_displayName,
      subdomain: row.workspace_subdomain,
      createdAt: row.workspace_createdAt,
      isDisabled: row.workspace_isDisabled,
      userCount: parseInt(row.userCount, 10),
    }));
  }

  /**
   * Get detailed info for a specific tenant
   */
  async getTenantDetails(tenantId: string): Promise<TenantDetails | null> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: tenantId },
    });

    if (!workspace) {
      return null;
    }

    // Get users for this workspace
    const userWorkspaces = await this.userWorkspaceRepository.find({
      where: { workspaceId: tenantId },
      relations: ['user'],
    });

    const users = userWorkspaces.map((uw) => ({
      id: uw.user.id,
      email: uw.user.email,
      firstName: uw.user.firstName,
      lastName: uw.user.lastName,
      createdAt: uw.user.createdAt,
    }));

    // Get record counts from workspace schema
    const schemaName = getWorkspaceSchemaName(tenantId);
    let contactCount = 0;
    let companyCount = 0;
    let opportunityCount = 0;

    try {
      const countResults = await this.dataSource.query(`
        SELECT
          (SELECT COUNT(*) FROM "${schemaName}"."person") as contact_count,
          (SELECT COUNT(*) FROM "${schemaName}"."company") as company_count,
          (SELECT COUNT(*) FROM "${schemaName}"."opportunity") as opportunity_count
      `);

      if (countResults[0]) {
        contactCount = parseInt(countResults[0].contact_count, 10) || 0;
        companyCount = parseInt(countResults[0].company_count, 10) || 0;
        opportunityCount = parseInt(countResults[0].opportunity_count, 10) || 0;
      }
    } catch (error) {
      // Schema might not exist yet or tables might not exist
      console.warn(`Could not get record counts for tenant ${tenantId}:`, error);
    }

    return {
      id: workspace.id,
      displayName: workspace.displayName || '',
      subdomain: workspace.subdomain,
      createdAt: workspace.createdAt,
      isDisabled: workspace.isDisabled,
      disabledAt: workspace.disabledAt,
      disabledReason: workspace.disabledReason,
      userCount: users.length,
      adminNotes: workspace.adminNotes,
      users,
      contactCount,
      companyCount,
      opportunityCount,
    };
  }

  /**
   * Disable a tenant
   */
  async disableTenant(tenantId: string, reason?: string): Promise<WorkspaceEntity> {
    const workspace = await this.workspaceRepository.findOneOrFail({
      where: { id: tenantId },
    });

    workspace.isDisabled = true;
    workspace.disabledAt = new Date();
    workspace.disabledReason = reason;

    return this.workspaceRepository.save(workspace);
  }

  /**
   * Enable a tenant
   */
  async enableTenant(tenantId: string): Promise<WorkspaceEntity> {
    const workspace = await this.workspaceRepository.findOneOrFail({
      where: { id: tenantId },
    });

    workspace.isDisabled = false;
    workspace.disabledAt = undefined;
    workspace.disabledReason = undefined;

    return this.workspaceRepository.save(workspace);
  }

  // No subscription tier management needed - everyone gets full access

  /**
   * Update admin notes for a tenant
   */
  async updateAdminNotes(tenantId: string, notes: string): Promise<WorkspaceEntity> {
    const workspace = await this.workspaceRepository.findOneOrFail({
      where: { id: tenantId },
    });

    workspace.adminNotes = notes;

    return this.workspaceRepository.save(workspace);
  }

  /**
   * Query records across all tenants (for super admin)
   * This queries each tenant's schema and aggregates results
   */
  async queryCrossTenantRecords(
    recordType: 'person' | 'company' | 'opportunity',
    options?: {
      tenantIds?: string[];
      limit?: number;
      offset?: number;
      search?: string;
    },
  ): Promise<{ records: CrossTenantRecord[]; total: number }> {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    // Get all active workspaces (or filtered by tenantIds)
    const whereCondition: Record<string, unknown> = { isDisabled: false };
    if (options?.tenantIds?.length) {
      whereCondition.id = In(options.tenantIds);
    }

    const workspaces = await this.workspaceRepository.find({
      where: whereCondition,
      select: ['id', 'displayName', 'subdomain'],
    });

    const allRecords: CrossTenantRecord[] = [];

    // Query each tenant's schema
    for (const workspace of workspaces) {
      const schemaName = getWorkspaceSchemaName(workspace.id);

      try {
        let query = `SELECT * FROM "${schemaName}"."${recordType}"`;
        const params: string[] = [];

        if (options?.search && recordType === 'person') {
          query += ` WHERE "name" ->> 'firstName' ILIKE $1 OR "name" ->> 'lastName' ILIKE $1 OR "email" ILIKE $1`;
          params.push(`%${options.search}%`);
        } else if (options?.search && recordType === 'company') {
          query += ` WHERE "name" ILIKE $1`;
          params.push(`%${options.search}%`);
        }

        query += ` LIMIT 100`; // Limit per tenant to avoid memory issues

        const records = await this.dataSource.query(query, params);

        for (const record of records) {
          allRecords.push({
            tenantId: workspace.id,
            tenantName: workspace.displayName || workspace.subdomain,
            recordId: record.id,
            recordType,
            data: record,
          });
        }
      } catch (error) {
        // Schema or table might not exist
        console.warn(`Could not query ${recordType} for tenant ${workspace.id}:`, error);
      }
    }

    // Sort by tenant name, then apply pagination
    allRecords.sort((a, b) => a.tenantName.localeCompare(b.tenantName));

    return {
      records: allRecords.slice(offset, offset + limit),
      total: allRecords.length,
    };
  }

  /**
   * Create a new tenant (workspace) with an initial admin user
   */
  async createTenant(params: {
    email: string;
    displayName?: string;
    subdomain?: string;
    firstName?: string;
    lastName?: string;
  }): Promise<{
    workspace: WorkspaceEntity;
    user: UserEntity;
  }> {
    const { email, displayName, subdomain, firstName, lastName } = params;

    // Generate subdomain from email if not provided
    const workspaceSubdomain = subdomain || email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    const workspaceDisplayName = displayName || workspaceSubdomain;

    // Check if subdomain already exists
    const existingWorkspace = await this.workspaceRepository.findOne({
      where: { subdomain: workspaceSubdomain },
    });

    if (existingWorkspace) {
      throw new Error(`Subdomain "${workspaceSubdomain}" already exists`);
    }

    // Check if user already exists
    let user = await this.userRepository.findOne({
      where: { email },
    });

    // Create workspace
    const workspace = this.workspaceRepository.create({
      displayName: workspaceDisplayName,
      subdomain: workspaceSubdomain,
      subscriptionTier: SubscriptionTier.FULL,
      maxUsers: -1, // Unlimited
      storageQuotaMb: -1, // Unlimited
      isDisabled: false,
    });

    const savedWorkspace = await this.workspaceRepository.save(workspace);

    // Create user if doesn't exist
    if (!user) {
      user = this.userRepository.create({
        email,
        firstName: firstName || '',
        lastName: lastName || '',
        canImpersonate: false,
        canAccessFullAdminPanel: false,
      });
      user = await this.userRepository.save(user);
    }

    // Link user to workspace
    const userWorkspace = this.userWorkspaceRepository.create({
      userId: user.id,
      workspaceId: savedWorkspace.id,
    });
    await this.userWorkspaceRepository.save(userWorkspace);

    return {
      workspace: savedWorkspace,
      user,
    };
  }

  /**
   * Delete a tenant (workspace) permanently
   * WARNING: This is destructive and cannot be undone
   */
  async deleteTenant(tenantId: string): Promise<{ success: boolean; message: string }> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: tenantId },
    });

    if (!workspace) {
      throw new Error(`Tenant ${tenantId} not found`);
    }

    // Remove all user-workspace associations
    await this.userWorkspaceRepository.delete({ workspaceId: tenantId });

    // Drop the workspace schema if it exists
    const schemaName = getWorkspaceSchemaName(tenantId);
    try {
      await this.dataSource.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    } catch (error) {
      console.warn(`Failed to drop schema ${schemaName}:`, error);
    }

    // Delete the workspace
    await this.workspaceRepository.delete({ id: tenantId });

    return {
      success: true,
      message: `Tenant ${tenantId} deleted permanently`,
    };
  }

  /**
   * Get aggregate statistics across all tenants
   */
  async getGlobalStats(): Promise<{
    totalTenants: number;
    activeTenants: number;
    disabledTenants: number;
    totalUsers: number;
    tenantsByTier: Record<SubscriptionTier, number>;
  }> {
    const [totalTenants, activeTenants, totalUsers] = await Promise.all([
      this.workspaceRepository.count(),
      this.workspaceRepository.count({ where: { isDisabled: false } }),
      this.userWorkspaceRepository.count(),
    ]);

    const tierCounts = await this.workspaceRepository
      .createQueryBuilder('workspace')
      .select('workspace.subscriptionTier', 'tier')
      .addSelect('COUNT(*)', 'count')
      .groupBy('workspace.subscriptionTier')
      .getRawMany();

    const tenantsByTier: Record<SubscriptionTier, number> = {
      [SubscriptionTier.FULL]: 0, // Everyone gets full access
    };

    for (const row of tierCounts) {
      tenantsByTier[row.tier as SubscriptionTier] = parseInt(row.count, 10);
    }

    return {
      totalTenants,
      activeTenants,
      disabledTenants: totalTenants - activeTenants,
      totalUsers,
      tenantsByTier,
    };
  }
}
