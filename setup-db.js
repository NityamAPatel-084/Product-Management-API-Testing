
require("dotenv").config();

const fs = require("fs");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  try {
    const schema = fs.readFileSync("schema.sql", "utf8");
    await pool.query(schema);

    console.log("Products table created successfully in Neon!");

    const result = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'products'
      ORDER BY ordinal_position
    `);

    console.table(result.rows);
  } catch (error) {
    console.error("Setup failed:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
