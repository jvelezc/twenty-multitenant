import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SaasAdminController } from 'src/engine/core-modules/admin/controllers/saas-admin.controller';
import { TenantAdminController } from 'src/engine/core-modules/admin/controllers/tenant-admin.controller';
import { TenantWebhookController } from 'src/engine/core-modules/admin/controllers/tenant-webhook.controller';
import { AdminGuard } from 'src/engine/core-modules/admin/guards/admin.guard';
import { SaasAdminKeyGuard } from 'src/engine/core-modules/admin/guards/saas-admin-key.guard';
import { TenantAdminService } from 'src/engine/core-modules/admin/services/tenant-admin.service';
import { WebhookSignatureService } from 'src/engine/core-modules/admin/services/webhook-signature.service';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkspaceEntity,
      UserWorkspaceEntity,
      UserEntity,
    ]),
  ],
  controllers: [
    TenantAdminController,
    TenantWebhookController,
    SaasAdminController,
  ],
  providers: [
    TenantAdminService,
    WebhookSignatureService,
    AdminGuard,
    SaasAdminKeyGuard,
  ],
  exports: [TenantAdminService, WebhookSignatureService],
})
export class AdminModule {}
