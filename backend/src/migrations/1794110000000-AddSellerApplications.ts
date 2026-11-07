import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSellerApplications1794110000000 implements MigrationInterface {
    name = 'AddSellerApplications1794110000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "seller_applications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "shopName" character varying NOT NULL, "description" text, "phone" character varying NOT NULL, "wilayaCode" integer, "message" text, "status" character varying NOT NULL DEFAULT 'pending', "reviewNote" character varying, "reviewedById" uuid, "reviewedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_203be9b9b1f8ff560e8af1f90a5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_seller_applications_userId" ON "seller_applications" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_seller_applications_status" ON "seller_applications" ("status") `);
        await queryRunner.query(`ALTER TABLE "seller_applications" ADD CONSTRAINT "FK_bc16b54496faa4ffae868a999ce" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "seller_applications" DROP CONSTRAINT "FK_bc16b54496faa4ffae868a999ce"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_seller_applications_status"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_seller_applications_userId"`);
        await queryRunner.query(`DROP TABLE "seller_applications"`);
    }

}
