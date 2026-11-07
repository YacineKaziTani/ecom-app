import { MigrationInterface, QueryRunner } from "typeorm";

// minOrderAmount was created as integer, so a decimal minimum like 25.50 made
// coupon creation fail. expiresAt gets the same TIMESTAMPTZ treatment the token
// tables got in FixTokenExpiryTimezone.
export class FixCouponColumnTypes1794067200000 implements MigrationInterface {
  name = "FixCouponColumnTypes1794067200000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "coupons" ALTER COLUMN "minOrderAmount" TYPE numeric(10,2)`,
    );
    await queryRunner.query(`
      ALTER TABLE "coupons"
      ALTER COLUMN "expiresAt" TYPE TIMESTAMPTZ
      USING "expiresAt" AT TIME ZONE 'UTC'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "coupons"
      ALTER COLUMN "expiresAt" TYPE TIMESTAMP
      USING "expiresAt" AT TIME ZONE 'UTC'
    `);
    await queryRunner.query(`
      ALTER TABLE "coupons"
      ALTER COLUMN "minOrderAmount" TYPE integer
      USING round("minOrderAmount")
    `);
  }
}
