import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddSupabaseAuthFields1765300000000 implements MigrationInterface {
  name = 'AddSupabaseAuthFields1765300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add supabaseUserId to user table for linking Twenty users to Supabase users
    await queryRunner.query(
      `ALTER TABLE "core"."user" ADD "supabaseUserId" character varying(255)`,
    );

    // Add unique index on supabaseUserId (only for non-null values)
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_USER_SUPABASE_ID" ON "core"."user" ("supabaseUserId") WHERE "supabaseUserId" IS NOT NULL`,
    );

    // Add primaryAuthProvider to track how user was created/authenticates
    await queryRunner.query(
      `CREATE TYPE "core"."user_primaryauthprovider_enum" AS ENUM('password', 'google', 'microsoft', 'supabase', 'sso')`,
    );

    await queryRunner.query(
      `ALTER TABLE "core"."user" ADD "primaryAuthProvider" "core"."user_primaryauthprovider_enum" NOT NULL DEFAULT 'password'`,
    );

    // Add isSupabaseAuthEnabled to workspace for per-workspace Supabase auth toggle
    await queryRunner.query(
      `ALTER TABLE "core"."workspace" ADD "isSupabaseAuthEnabled" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove workspace column
    await queryRunner.query(
      `ALTER TABLE "core"."workspace" DROP COLUMN "isSupabaseAuthEnabled"`,
    );

    // Remove user columns
    await queryRunner.query(
      `ALTER TABLE "core"."user" DROP COLUMN "primaryAuthProvider"`,
    );

    await queryRunner.query(
      `DROP TYPE "core"."user_primaryauthprovider_enum"`,
    );

    await queryRunner.query(
      `DROP INDEX "core"."IDX_USER_SUPABASE_ID"`,
    );

    await queryRunner.query(
      `ALTER TABLE "core"."user" DROP COLUMN "supabaseUserId"`,
    );
  }
}
