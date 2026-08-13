// One-off backfill: adds/populates products.instantBuyPrice for rows that
// predate the Instant Buy feature, so TypeORM's `synchronize: true` can then
// add the NOT NULL constraint without failing on existing rows.
// Safe to run multiple times (idempotent — only touches NULL rows).
require('dotenv').config({ path: '.env.development' });
const { Client } = require('pg');

async function main() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true',
  });
  await client.connect();

  try {
    const colCheck = await client.query(`
      SELECT column_name, is_nullable FROM information_schema.columns
      WHERE table_name = 'products' AND column_name = 'instantBuyPrice'
    `);

    if (colCheck.rows.length === 0) {
      console.log('Column does not exist yet — adding as nullable first...');
      await client.query(
        `ALTER TABLE "products" ADD COLUMN "instantBuyPrice" numeric(12,2)`,
      );
    } else if (colCheck.rows[0].is_nullable === 'NO') {
      console.log('Column already exists and is already NOT NULL — nothing to do.');
      return;
    }

    const result = await client.query(`
      UPDATE "products"
      SET "instantBuyPrice" = ROUND("basePrice" * 1.4, 2)
      WHERE "instantBuyPrice" IS NULL
    `);
    console.log(`Backfilled ${result.rowCount} row(s).`);

    await client.query(
      `ALTER TABLE "products" ALTER COLUMN "instantBuyPrice" SET NOT NULL`,
    );
    console.log('Column is now NOT NULL. TypeORM synchronize should pass now.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
