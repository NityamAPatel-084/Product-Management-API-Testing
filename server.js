
const express = require("express");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 3000;

// Create the data directory if it does not exist
const dataDirectory = path.join(__dirname, "data");
fs.mkdirSync(dataDirectory, { recursive: true });

// Connect to the persistent SQLite database
const db = new Database(path.join(dataDirectory, "products.db"));

db.pragma("journal_mode = WAL");

// Create the table automatically if it does not exist
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    price REAL NOT NULL CHECK (price >= 0),
    stock INTEGER NOT NULL CHECK (
      stock >= 0 AND stock = CAST(stock AS INTEGER)
    )
  );
`);

// Add the original sample products only if the table is empty
const productCount = db.prepare(
  "SELECT COUNT(*) AS count FROM products"
).get().count;

if (productCount === 0) {
  const insertProduct = db.prepare(`
    INSERT INTO products (name, description, price, stock)
    VALUES (?, ?, ?, ?)
  `);

  const seedProducts = db.transaction(() => {
    insertProduct.run("Laptop", "Business laptop", 75000, 10);
    insertProduct.run("Mobile Phone", "Android smartphone", 25000, 20);
  });

  seedProducts();
}

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Validate product input
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

// GET: Retrieve all products
app.get("/api/products", (req, res) => {
  const products = db.prepare(
    "SELECT * FROM products ORDER BY id"
  ).all();

  res.status(200).json({
    count: products.length,
    data: products,
  });
});

// GET: Retrieve a product by ID
app.get("/api/products/:id", (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ message: "Invalid product ID" });
  }

  const product = db.prepare(
    "SELECT * FROM products WHERE id = ?"
  ).get(id);

  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }

  res.status(200).json({ data: product });
});

// POST: Create a product
app.post("/api/products", validateProduct, (req, res) => {
  const { name, description, price, stock } = req.body;

  const result = db.prepare(`
    INSERT INTO products (name, description, price, stock)
    VALUES (?, ?, ?, ?)
  `).run(name, description, price, stock);

  const newProduct = db.prepare(
    "SELECT * FROM products WHERE id = ?"
  ).get(Number(result.lastInsertRowid));

  res.status(201).json({
    message: "Product created successfully",
    data: newProduct,
  });
});

// PUT: Update an existing product
app.put("/api/products/:id", validateProduct, (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ message: "Invalid product ID" });
  }

  const existing = db.prepare(
    "SELECT id FROM products WHERE id = ?"
  ).get(id);

  if (!existing) {
    return res.status(404).json({ message: "Product not found" });
  }

  const { name, description, price, stock } = req.body;

  db.prepare(`
    UPDATE products
    SET name = ?, description = ?, price = ?, stock = ?
    WHERE id = ?
  `).run(name, description, price, stock, id);

  const updatedProduct = db.prepare(
    "SELECT * FROM products WHERE id = ?"
  ).get(id);

  res.status(200).json({
    message: "Product updated successfully",
    data: updatedProduct,
  });
});

// DELETE: Remove a product
app.delete("/api/products/:id", (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ message: "Invalid product ID" });
  }

  const deletedProduct = db.prepare(
    "SELECT * FROM products WHERE id = ?"
  ).get(id);

  if (!deletedProduct) {
    return res.status(404).json({ message: "Product not found" });
  }

  db.prepare(
    "DELETE FROM products WHERE id = ?"
  ).run(id);

  res.status(200).json({
    message: "Product deleted successfully",
    data: deletedProduct,
  });
});

// Handle unknown routes
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Handle malformed JSON and server errors
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({ message: "Invalid JSON body" });
  }

  console.error(err);
  res.status(500).json({ message: "Internal server error" });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
