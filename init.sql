
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    price REAL NOT NULL CHECK (price >= 0),
    stock INTEGER NOT NULL CHECK (
        stock >= 0 AND stock = CAST(stock AS INTEGER)
    )
);

INSERT INTO products (id, name, description, price, stock)
SELECT 1, 'Laptop', 'Business laptop', 75000, 10
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE id = 1
);

INSERT INTO products (id, name, description, price, stock)
SELECT 2, 'Mobile Phone', 'Android smartphone', 25000, 20
WHERE NOT EXISTS (
    SELECT 1 FROM products WHERE id = 2
);

select * from products order by id;