
require("dotenv").config();

const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing from environment variables.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function validateProduct(req, res, next) {
  const { name, description, price, stock } = req.body;

  if (
    typeof name !== "string" ||
    !name.trim() ||
    typeof description !== "string" ||
    !description.trim() ||
    typeof price !== "number" ||
    !Number.isFinite(price) ||
    price < 0 ||
    !Number.isInteger(stock) ||
    stock < 0
  ) {
    return res.status(400).json({
      message:
        "Provide a name, description, non-negative price, and non-negative integer stock.",
    });
  }

  req.body.name = name.trim();
  req.body.description = description.trim();
  next();
}

function formatProduct(row) {
  return {
    ...row,
    id: Number(row.id),
    price: Number(row.price),
    stock: Number(row.stock),
  };
}

// GET: Retrieve all products
app.get("/api/products", async (req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT * FROM products ORDER BY id"
    );

    const products = result.rows.map(formatProduct);

    res.status(200).json({
      count: products.length,
      data: products,
    });
  } catch (error) {
    next(error);
  }
});

// GET: Retrieve a product by ID
app.get("/api/products/:id", async (req, res, next) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ message: "Invalid product ID" });
  }

  try {
    const result = await pool.query(
      "SELECT * FROM products WHERE id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.status(200).json({
      data: formatProduct(result.rows[0]),
    });
  } catch (error) {
    next(error);
  }
});

// POST: Create a product
app.post("/api/products", validateProduct, async (req, res, next) => {
  const { name, description, price, stock } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO products (name, description, price, stock)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, description, price, stock]
    );

    res.status(201).json({
      message: "Product created successfully",
      data: formatProduct(result.rows[0]),
    });
  } catch (error) {
    next(error);
  }
});

// PUT: Update an existing product
app.put(
  "/api/products/:id",
  validateProduct,
  async (req, res, next) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    const { name, description, price, stock } = req.body;

    try {
      const result = await pool.query(
        `UPDATE products
         SET name = $1, description = $2, price = $3, stock = $4
         WHERE id = $5
         RETURNING *`,
        [name, description, price, stock, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Product not found" });
      }

      res.status(200).json({
        message: "Product updated successfully",
        data: formatProduct(result.rows[0]),
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE: Remove a product
app.delete("/api/products/:id", async (req, res, next) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ message: "Invalid product ID" });
  }

  try {
    const result = await pool.query(
      "DELETE FROM products WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.status(200).json({
      message: "Product deleted successfully",
      data: formatProduct(result.rows[0]),
    });
  } catch (error) {
    next(error);
  }
});

// Handle unknown routes
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Error handler
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({ message: "Invalid JSON body" });
  }

  console.error(err);
  res.status(500).json({ message: "Internal server error" });
});

// Verify database connection before starting the server
async function startServer() {
  try {
    await pool.query("SELECT 1");

    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
      console.log("Connected to PostgreSQL.");
    });
  } catch (error) {
    console.error("Could not connect to PostgreSQL:", error.message);
    process.exitCode = 1;
    await pool.end();
  }
}

startServer();
