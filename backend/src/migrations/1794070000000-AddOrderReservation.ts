import { MigrationInterface, QueryRunner } from "typeorm";

// Unpaid orders now hold stock only until "reservedUntil". Existing orders get
// NULL (no deadline) — review old unpaid orders in the dashboard and cancel
// the stale ones to release their stock.
export class AddOrderReservation1794070000000 implements MigrationInterface {
  name = "AddOrderReservation1794070000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "reservedUntil" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "reservedUntil"`);
  }
}
