const initSqlJs = require("sql.js");
const path = require("path");
const fs = require("fs");

class DatabaseHelper {
  constr  // Helper method to run queries with auto-save
  runQuery(sql, params = []) {
    try {
      const result = this.db.run(sql, params);
      this.saveDatabase(); // Auto-save after modifications
      return {
        id: result.lastInsertRowid || null,
        changes: result.changes || 0
      };
    } catch (err) {
      console.error('SQL Error:', err.message);
      console.error('SQL:', sql);
      console.error('Params:', params);
      throw err;
    }
  } this.dbPath = path.join(__dirname, "florist.db");
    this.db = null;
    this.SQL = null;
  }

  // Initialize database and create tables
  async initialize() {
    try {
      // Initialize sql.js
      this.SQL = await initSqlJs();

      // Load existing database or create new one
      if (fs.existsSync(this.dbPath)) {
        const filebuffer = fs.readFileSync(this.dbPath);
        this.db = new this.SQL.Database(filebuffer);
        console.log("Connected to existing SQLite database");
      } else {
        this.db = new this.SQL.Database();
        console.log("Created new SQLite database");
      }

      await this.createTables();
    } catch (err) {
      console.error("Error opening database:", err);
      throw err;
    }
  }

  // Save database to file
  saveDatabase() {
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(this.dbPath, buffer);
    } catch (err) {
      console.error("Error saving database:", err);
    }
  }

  // Create database tables with proper schema
  async createTables() {
    const tables = [
      `CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price REAL NOT NULL CHECK(price >= 0),
        image TEXT,
        description TEXT,
        category_id INTEGER,
        occasion_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories (id),
        FOREIGN KEY (occasion_id) REFERENCES occasions (id)
      )`,

      `CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS occasions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS cart (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity > 0),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
      )`,

      `CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        total_amount REAL NOT NULL CHECK(total_amount >= 0)
      )`,

      `CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL CHECK(quantity > 0),
        unit_price REAL NOT NULL CHECK(unit_price >= 0),
        subtotal REAL NOT NULL CHECK(subtotal >= 0),
        sale_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products (id)
      )`,
    ];

    // Create indexes for better performance
    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id)`,
      `CREATE INDEX IF NOT EXISTS idx_products_occasion ON products(occasion_id)`,
      `CREATE INDEX IF NOT EXISTS idx_cart_product ON cart(product_id)`,
      `CREATE INDEX IF NOT EXISTS idx_sales_order ON sales(order_id)`,
      `CREATE INDEX IF NOT EXISTS idx_sales_product ON sales(product_id)`,
      `CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date)`,
    ];

    // Execute table creation
    for (const sql of tables) {
      this.db.run(sql);
    }

    // Execute index creation
    for (const sql of indexes) {
      this.db.run(sql);
    }

    this.saveDatabase();
  }

  // Helper method to run queries with auto-save
  runQuery(sql, params = []) {
    try {
      const result = this.db.run(sql, params);
      this.saveDatabase(); // Auto-save after modifications
      return {
        id: result.lastInsertRowid || null,
        changes: result.changes || 0,
      };
    } catch (err) {
      console.error("SQL Error:", err.message);
      throw err;
    }
  }

  // Helper method to get single row
  getQuery(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      const result = stmt.getAsObject(params);
      stmt.free();
      return Object.keys(result).length > 0 ? result : null;
    } catch (err) {
      console.error("SQL Error:", err.message);
      throw err;
    }
  }

  // Helper method to get all rows
  getAllQuery(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      const results = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      return results;
    } catch (err) {
      console.error("SQL Error:", err.message);
      throw err;
    }
  }

  // Transaction support
  beginTransaction() {
    this.db.run("BEGIN TRANSACTION");
  }

  commitTransaction() {
    this.db.run("COMMIT");
    this.saveDatabase();
  }

  rollbackTransaction() {
    this.db.run("ROLLBACK");
  }

  // Execute transaction with automatic rollback on error
  async executeTransaction(operations) {
    this.beginTransaction();
    try {
      const results = [];
      for (const operation of operations) {
        if (typeof operation === "function") {
          results.push(await operation());
        } else {
          results.push(this.runQuery(operation.sql, operation.params));
        }
      }
      this.commitTransaction();
      return results;
    } catch (error) {
      this.rollbackTransaction();
      throw error;
    }
  }

  // Product operations with proper SQL
  async addProduct(
    name,
    price,
    image = null,
    description = null,
    categoryId = null,
    occasionId = null
  ) {
    const sql = `INSERT INTO products (name, price, image, description, category_id, occasion_id) 
                 VALUES (?, ?, ?, ?, ?, ?)`;
    return this.runQuery(sql, [
      name,
      price,
      image,
      description,
      categoryId,
      occasionId,
    ]);
  }

  async getAllProducts() {
    const sql = `SELECT p.*, c.name as category_name, o.name as occasion_name
                 FROM products p
                 LEFT JOIN categories c ON p.category_id = c.id
                 LEFT JOIN occasions o ON p.occasion_id = o.id
                 ORDER BY p.name`;
    return this.getAllQuery(sql);
  }

  async getProductById(id) {
    const sql = `SELECT p.*, c.name as category_name, o.name as occasion_name
                 FROM products p
                 LEFT JOIN categories c ON p.category_id = c.id
                 LEFT JOIN occasions o ON p.occasion_id = o.id
                 WHERE p.id = ?`;
    return this.getQuery(sql, [id]);
  }

  async updateProduct(
    id,
    name,
    price,
    image,
    description = null,
    categoryId = null,
    occasionId = null
  ) {
    const sql = `UPDATE products 
                 SET name = ?, price = ?, image = ?, description = ?, category_id = ?, occasion_id = ?
                 WHERE id = ?`;
    return this.runQuery(sql, [
      name,
      price,
      image,
      description,
      categoryId,
      occasionId,
      id,
    ]);
  }

  async deleteProduct(id) {
    const sql = `DELETE FROM products WHERE id = ?`;
    return this.runQuery(sql, [id]);
  }

  // Cart operations with foreign key support
  async addToCart(productId, quantity = 1) {
    try {
      // Validate inputs
      if (!productId || quantity <= 0) {
        throw new Error('Invalid productId or quantity');
      }

      // Check if product exists
      const product = await this.getProductById(productId);
      if (!product) {
        throw new Error("Product not found");
      }

      // Check if item already in cart
      const existingItem = this.getQuery(
        `SELECT * FROM cart WHERE product_id = ?`,
        [productId]
      );

      if (existingItem && existingItem.id) {
        const newQuantity = (existingItem.quantity || 0) + quantity;
        return this.runQuery(`UPDATE cart SET quantity = ? WHERE id = ?`, [
          newQuantity,
          existingItem.id,
        ]);
      } else {
        return this.runQuery(
          `INSERT INTO cart (product_id, quantity) VALUES (?, ?)`,
          [productId, quantity]
        );
      }
    } catch (err) {
      console.error('Error in addToCart:', err.message);
      throw err;
    }
  }

  async getCartItems() {
    const sql = `
      SELECT 
        c.id as cart_id,
        c.quantity,
        p.id as product_id,
        p.name,
        p.price,
        p.image,
        (p.price * c.quantity) as subtotal
      FROM cart c
      INNER JOIN products p ON c.product_id = p.id
      ORDER BY c.created_at DESC
    `;
    return this.getAllQuery(sql);
  }

  async updateCartQuantity(cartId, quantity) {
    if (quantity <= 0) {
      return this.removeFromCart(cartId);
    }
    const sql = `UPDATE cart SET quantity = ? WHERE id = ?`;
    return this.runQuery(sql, [quantity, cartId]);
  }

  async removeFromCart(cartId) {
    const sql = `DELETE FROM cart WHERE id = ?`;
    return this.runQuery(sql, [cartId]);
  }

  async clearCart() {
    const sql = `DELETE FROM cart`;
    return this.runQuery(sql);
  }

  async getCartTotal() {
    const sql = `
      SELECT COALESCE(SUM(p.price * c.quantity), 0) as total
      FROM cart c
      INNER JOIN products p ON c.product_id = p.id
    `;
    const result = this.getQuery(sql);
    return result ? result.total : 0;
  }

  // Order operations
  async createOrder(totalAmount) {
    const sql = `INSERT INTO orders (total_amount) VALUES (?)`;
    const result = this.runQuery(sql, [totalAmount]);
    return result.id;
  }

  async getAllOrders() {
    const sql = `SELECT * FROM orders ORDER BY order_date DESC`;
    return this.getAllQuery(sql);
  }

  async getOrderById(id) {
    const sql = `SELECT * FROM orders WHERE id = ?`;
    return this.getQuery(sql, [id]);
  }

  // Admin operations
  async createAdmin(username, password) {
    const sql = `INSERT INTO admins (username, password) VALUES (?, ?)`;
    return this.runQuery(sql, [username, password]);
  }

  async getAdminByUsername(username) {
    const sql = `SELECT * FROM admins WHERE username = ?`;
    return this.getQuery(sql, [username]);
  }

  // Sales operations with complex queries
  async createSaleRecord(orderId, productId, quantity, unitPrice, subtotal) {
    const sql = `INSERT INTO sales (order_id, product_id, quantity, unit_price, subtotal) 
                 VALUES (?, ?, ?, ?, ?)`;
    return this.runQuery(sql, [
      orderId,
      productId,
      quantity,
      unitPrice,
      subtotal,
    ]);
  }

  async getSalesReport(startDate = null, endDate = null) {
    let sql = `
      SELECT 
        s.id,
        s.sale_date,
        s.quantity,
        s.unit_price,
        s.subtotal,
        p.name as product_name,
        o.order_date,
        o.total_amount as order_total
      FROM sales s
      INNER JOIN products p ON s.product_id = p.id
      INNER JOIN orders o ON s.order_id = o.id
    `;

    const params = [];
    if (startDate && endDate) {
      sql += ` WHERE DATE(s.sale_date) BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    } else if (startDate) {
      sql += ` WHERE DATE(s.sale_date) >= ?`;
      params.push(startDate);
    } else if (endDate) {
      sql += ` WHERE DATE(s.sale_date) <= ?`;
      params.push(endDate);
    }

    sql += ` ORDER BY s.sale_date DESC`;
    return this.getAllQuery(sql, params);
  }

  async getSalesSummary() {
    const sql = `
      SELECT 
        COUNT(DISTINCT o.id) as total_orders,
        COUNT(s.id) as total_items_sold,
        COALESCE(SUM(s.subtotal), 0) as total_revenue,
        COALESCE(AVG(o.total_amount), 0) as average_order_value
      FROM sales s
      INNER JOIN orders o ON s.order_id = o.id
    `;
    return this.getQuery(sql);
  }

  async getTopProducts(limit = 10) {
    const sql = `
      SELECT 
        p.name,
        p.price,
        p.image,
        SUM(s.quantity) as total_sold,
        SUM(s.subtotal) as total_revenue
      FROM sales s
      INNER JOIN products p ON s.product_id = p.id
      GROUP BY s.product_id, p.name, p.price, p.image
      ORDER BY total_sold DESC
      LIMIT ?
    `;
    return this.getAllQuery(sql, [limit]);
  }

  // Enhanced checkout with transaction support
  async checkoutWithSales(cartItems, totalAmount) {
    return await this.executeTransaction([
      async () => {
        // Create order first
        const orderResult = this.runQuery(
          `INSERT INTO orders (total_amount) VALUES (?)`,
          [totalAmount]
        );
        const orderId = orderResult.id;

        // Create sales records for each cart item
        for (const item of cartItems) {
          this.runQuery(
            `INSERT INTO sales (order_id, product_id, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?)`,
            [orderId, item.product_id, item.quantity, item.price, item.subtotal]
          );
        }

        // Clear cart
        this.runQuery(`DELETE FROM cart`);

        return orderId;
      },
    ]);
  }

  // Category & Occasion operations
  async addCategory(name) {
    const sql = `INSERT INTO categories (name) VALUES (?)`;
    return this.runQuery(sql, [name]);
  }

  async getAllCategories() {
    const sql = `SELECT * FROM categories ORDER BY name`;
    return this.getAllQuery(sql);
  }

  async updateCategory(id, name) {
    const sql = `UPDATE categories SET name = ? WHERE id = ?`;
    return this.runQuery(sql, [name, id]);
  }

  async deleteCategory(id) {
    return await this.executeTransaction([
      {
        sql: `UPDATE products SET category_id = NULL WHERE category_id = ?`,
        params: [id],
      },
      { sql: `DELETE FROM categories WHERE id = ?`, params: [id] },
    ]);
  }

  async addOccasion(name) {
    const sql = `INSERT INTO occasions (name) VALUES (?)`;
    return this.runQuery(sql, [name]);
  }

  async getAllOccasions() {
    const sql = `SELECT * FROM occasions ORDER BY name`;
    return this.getAllQuery(sql);
  }

  async updateOccasion(id, name) {
    const sql = `UPDATE occasions SET name = ? WHERE id = ?`;
    return this.runQuery(sql, [name, id]);
  }

  async deleteOccasion(id) {
    return await this.executeTransaction([
      {
        sql: `UPDATE products SET occasion_id = NULL WHERE occasion_id = ?`,
        params: [id],
      },
      { sql: `DELETE FROM occasions WHERE id = ?`, params: [id] },
    ]);
  }

  // Schema utilities
  async ensureProductColumn(column, type) {
    // Check if column exists
    const columns = this.getAllQuery(`PRAGMA table_info(products)`);
    const exists = columns.some((col) => col.name === column);

    if (!exists) {
      try {
        this.db.run(`ALTER TABLE products ADD COLUMN ${column} ${type}`);
        this.saveDatabase();
      } catch (e) {
        console.warn("Ignoring error adding column", column, e.message);
      }
    }
  }

  async productHasColumn(column) {
    const columns = this.getAllQuery(`PRAGMA table_info(products)`);
    return columns.some((col) => col.name === column);
  }

  // Close database connection
  close() {
    if (this.db) {
      this.saveDatabase();
      this.db.close();
      console.log("Database connection closed");
    }
  }
}

module.exports = DatabaseHelper;
