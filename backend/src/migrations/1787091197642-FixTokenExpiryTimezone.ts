import { MigrationInterface, QueryRunner } from "typeorm";

export class FixTokenExpiryTimezone1787091197642 implements MigrationInterface {
  name = "FixTokenExpiryTimezone1787091197642";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
          ALTER TABLE "refresh_tokens"
          ALTER COLUMN "expiresAt" TYPE TIMESTAMPTZ
          USING "expiresAt" AT TIME ZONE 'UTC'
        `);
    await queryRunner.query(`
          ALTER TABLE "password_reset_tokens"
          ALTER COLUMN "expiresAt" TYPE TIMESTAMPTZ
          USING "expiresAt" AT TIME ZONE 'UTC'
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
          ALTER TABLE "password_reset_tokens"
          ALTER COLUMN "expiresAt" TYPE TIMESTAMP
          USING "expiresAt" AT TIME ZONE 'UTC'
        `);
    await queryRunner.query(`
          ALTER TABLE "refresh_tokens"
          ALTER COLUMN "expiresAt" TYPE TIMESTAMP
          USING "expiresAt" AT TIME ZONE 'UTC'
        `);
  }
}
