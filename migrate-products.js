
require("dotenv").config();

const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const { Pool } = require("pg");

const sqlitePath = path.join(__dirname, "data", "products.db");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  let sqlite;

  try {
    if (!fs.existsSync(sqlitePath)) {
      throw new Error(`SQLite database not found: ${sqlitePath}`);
    }

    // Read existing products from the local SQLite database.
    sqlite = new Database(sqlitePath, { readonly: true });

    const localProducts = sqlite
      .prepare(`
        SELECT id, name, description, price, stock
        FROM products
        ORDER BY id
      `)
      .all();

    console.log(`Found ${localProducts.length} products in SQLite.`);

    // Check for conflicting IDs before changing Neon.
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const existingResult = await client.query(`
        SELECT id, name, description, price, stock
        FROM products
      `);

      const existingById = new Map(
        existingResult.rows.map((product) => [
          Number(product.id),
          product,
        ])
      );

      for (const product of localProducts) {
        const existing = existingById.get(Number(product.id));

        if (
          existing &&
          (
            existing.name !== product.name ||
            existing.description !== product.description ||
            Number(existing.price) !== Number(product.price) ||
            Number(existing.stock) !== Number(product.stock)
          )
        ) {
          throw new Error(
            `Product ID ${product.id} already exists in Neon with different data. No migration changes were committed.`
          );
        }
      }

      // Copy products, preserving their original IDs.
      const insertSql = `
        INSERT INTO products (id, name, description, price, stock)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO NOTHING
      `;

      let inserted = 0;

      for (const product of localProducts) {
        const result = await client.query(insertSql, [
          product.id,
          product.name,
          product.description,
          product.price,
          product.stock,
        ]);

        inserted += result.rowCount;
      }

      // Ensure future automatically generated IDs do not collide.
      await client.query(`
        SELECT setval(
          pg_get_serial_sequence('public.products', 'id'),
          COALESCE(MAX(id), 1),
          COUNT(*) > 0
        )
        FROM products
      `);

      await client.query("COMMIT");

      console.log("Migration completed successfully!");
      console.log(`Products copied: ${inserted}`);
      console.log(
        `Products already present and matching: ${
          localProducts.length - inserted
        }`
      );
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    // Verify the destination record count.
    const verification = await pool.query(
      "SELECT COUNT(*)::int AS count FROM products"
    );

    console.log(
      "Total products currently in Neon:",
      verification.rows[0].count
    );
  } catch (error) {
    console.error("Migration failed:", error.message);
    process.exitCode = 1;
  } finally {
    if (sqlite) sqlite.close();
    await pool.end();
  }
}

main();
