import { MigrationInterface, QueryRunner } from "typeorm";

// Smarter product search (services/productSearch.ts):
// - search_normalize(): lower case, no accents (é → e), Arabic letter variants
//   unified (أ/إ/آ → ا, ى → ي, ة → ه, short vowels dropped), hyphens and
//   apostrophes → spaces. IMMUTABLE so it can be indexed.
// - trigram indexes on the normalized name and description, replacing the
//   plain ones from AddIndexes (pg_trgm is already installed there). They
//   serve both "contains" and "close enough" (typo) matches.
export class AddSmartSearch1794170000000 implements MigrationInterface {
    name = 'AddSmartSearch1794170000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
        await queryRunner.query(`CREATE OR REPLACE FUNCTION search_normalize(input text) RETURNS text
        LANGUAGE sql IMMUTABLE PARALLEL SAFE RETURNS NULL ON NULL INPUT AS
        $fn$ SELECT translate(replace(replace(replace(lower(input), 'œ', 'oe'), 'æ', 'ae'), 'ß', 'ss'),
          'àáâãäåāăąçćčďèéêëēėęěìíîïīįñńňòóôõöōőřśšşţťùúûüūůűųýÿźżžøłđأإآٱىة-''’ًٌٍَُِّْـ',
          'aaaaaaaaacccdeeeeeeeeiiiiiinnnooooooorsssttuuuuuuuuyyzzzoldاااايه   ') $fn$`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_products_name_trgm"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_products_description_trgm"`);
        await queryRunner.query(`CREATE INDEX "IDX_products_name_search" ON "products" USING gin (search_normalize("name") gin_trgm_ops)`);
        await queryRunner.query(`CREATE INDEX "IDX_products_description_search" ON "products" USING gin (search_normalize(coalesce("description", '')) gin_trgm_ops)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_products_description_search"`);
        await queryRunner.query(`DROP INDEX "IDX_products_name_search"`);
        await queryRunner.query(`DROP FUNCTION search_normalize(text)`);
        await queryRunner.query(`CREATE INDEX "IDX_products_name_trgm" ON "products" USING gin ("name" gin_trgm_ops)`);
        await queryRunner.query(`CREATE INDEX "IDX_products_description_trgm" ON "products" USING gin ("description" gin_trgm_ops)`);
    }
}
