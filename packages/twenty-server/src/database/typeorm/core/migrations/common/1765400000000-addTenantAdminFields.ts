import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddTenantAdminFields1765400000000 implements MigrationInterface {
  name = 'AddTenantAdminFields1765400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add isDisabled flag to workspace for admin to disable tenants
    await queryRunner.query(
      `ALTER TABLE "core"."workspace" ADD "isDisabled" boolean NOT NULL DEFAULT false`,
    );

    // Add disabledAt timestamp
    await queryRunner.query(
      `ALTER TABLE "core"."workspace" ADD "disabledAt" TIMESTAMP WITH TIME ZONE`,
    );

    // Add disabledReason for audit trail
    await queryRunner.query(
      `ALTER TABLE "core"."workspace" ADD "disabledReason" character varying(500)`,
    );

    // Add subscription tier - everyone gets FULL access (no tiered pricing)
    await queryRunner.query(
      `CREATE TYPE "core"."workspace_subscriptiontier_enum" AS ENUM('full')`,
    );

    await queryRunner.query(
      `ALTER TABLE "core"."workspace" ADD "subscriptionTier" "core"."workspace_subscriptiontier_enum" NOT NULL DEFAULT 'full'`,
    );

    // No limits - everyone gets full access (-1 = unlimited)
    await queryRunner.query(
      `ALTER TABLE "core"."workspace" ADD "maxUsers" integer NOT NULL DEFAULT -1`,
    );

    await queryRunner.query(
      `ALTER TABLE "core"."workspace" ADD "storageQuotaMb" integer NOT NULL DEFAULT -1`,
    );

    // Add notes field for admin notes about tenant
    await queryRunner.query(
      `ALTER TABLE "core"."workspace" ADD "adminNotes" text`,
    );

    // Create index for quick lookup of disabled workspaces
    await queryRunner.query(
      `CREATE INDEX "IDX_WORKSPACE_DISABLED" ON "core"."workspace" ("isDisabled") WHERE "isDisabled" = true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "core"."IDX_WORKSPACE_DISABLED"`);
    await queryRunner.query(`ALTER TABLE "core"."workspace" DROP COLUMN "adminNotes"`);
    await queryRunner.query(`ALTER TABLE "core"."workspace" DROP COLUMN "storageQuotaMb"`);
    await queryRunner.query(`ALTER TABLE "core"."workspace" DROP COLUMN "maxUsers"`);
    await queryRunner.query(`ALTER TABLE "core"."workspace" DROP COLUMN "subscriptionTier"`);
    await queryRunner.query(`DROP TYPE "core"."workspace_subscriptiontier_enum"`);
    await queryRunner.query(`ALTER TABLE "core"."workspace" DROP COLUMN "disabledReason"`);
    await queryRunner.query(`ALTER TABLE "core"."workspace" DROP COLUMN "disabledAt"`);
    await queryRunner.query(`ALTER TABLE "core"."workspace" DROP COLUMN "isDisabled"`);
  }
}
