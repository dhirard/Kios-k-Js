// Mock Database untuk testing (tidak perlu native modules)
const path = require("path");
const fs = require("fs");

class DatabaseHelper {
  constructor() {
    this.dbPath = path.join(__dirname, "florist.json");
    this.db = null;
    this.data = {
      products: [],
      categories: [],
      occasions: [],
      cart: [],
      orders: [],
      admins: [],
      sales: [],
    };
  }

  // Initialize database and create tables
  async initialize() {
    try {
      // Load from JSON file if exists
      if (fs.existsSync(this.dbPath)) {
        const fileData = fs.readFileSync(this.dbPath, "utf8");
        this.data = { ...this.data, ...JSON.parse(fileData) };
      }
      this.db = true; // Mark as initialized
      console.log("Connected to JSON database");
      await this.createTables();
    } catch (err) {
      console.error("Error opening database:", err);
      throw err;
    }
  }

  // Save data to JSON file
  saveData() {
    try {
      fs.writeFileSync(this.dbPath, JSON.stringify(this.data, null, 2));
    } catch (err) {
      console.error("Error saving database:", err);
    }
  }

  // Create database tables (just ensure data structure)
  async createTables() {
    // Ensure all arrays exist
    if (!this.data.products) this.data.products = [];
    if (!this.data.categories) this.data.categories = [];
    if (!this.data.occasions) this.data.occasions = [];
    if (!this.data.cart) this.data.cart = [];
    if (!this.data.orders) this.data.orders = [];
    if (!this.data.admins) this.data.admins = [];
    if (!this.data.sales) this.data.sales = [];
    this.saveData();
  }

  async ensureProductColumn(column, type) {
    // Mock - always return success
    return true;
  }

  async productHasColumn(column) {
    // Mock - assume all columns exist
    return true;
  }

  // Helper method to generate IDs
  generateId(collection) {
    const items = this.data[collection] || [];
    return items.length > 0
      ? Math.max(...items.map((item) => item.id || 0)) + 1
      : 1;
  }

  // Helper method to run SQL queries (mock)
  runQuery(sql, params = []) {
    // Mock implementation - just return success
    return { id: this.generateId("products"), changes: 1 };
  }

  // Helper method to get data from database (mock)
  getQuery(sql, params = []) {
    // Mock implementation
    return null;
  }

  // Helper method to get all data from database (mock)
  getAllQuery(sql, params = []) {
    // Mock implementation
    return [];
  }

  // Product operations
  async addProduct(
    name,
    price,
    image = null,
    description = null,
    categoryId = null,
    occasionId = null
  ) {
    const id = this.generateId("products");
    const product = {
      id,
      name,
      price,
      image,
      description,
      category_id: categoryId,
      occasion_id: occasionId,
      created_at: new Date().toISOString(),
    };
    this.data.products.push(product);
    this.saveData();
    return { id };
  }

  async getAllProducts() {
    return this.data.products.map((p) => {
      const category = this.data.categories.find((c) => c.id === p.category_id);
      const occasion = this.data.occasions.find((o) => o.id === p.occasion_id);
      return {
        ...p,
        category_name: category?.name || null,
        occasion_name: occasion?.name || null,
      };
    });
  }

  async getProductById(id) {
    return this.data.products.find((p) => p.id === parseInt(id)) || null;
  }

  // Cart operations
  async addToCart(productId, quantity = 1) {
    try {
      // Validate inputs
      if (!productId || quantity <= 0) {
        throw new Error("Invalid productId or quantity");
      }

      // Convert to numbers to ensure consistency
      const prodId = parseInt(productId);
      const qty = parseInt(quantity);

      // Check if product exists
      const product = this.data.products.find((p) => p.id === prodId);
      if (!product) {
        throw new Error("Product not found");
      }

      // Check if product already exists in cart
      const existingItem = this.data.cart.find(
        (item) => item.product_id === prodId
      );

      if (existingItem) {
        // Update quantity if item already exists
        existingItem.quantity += qty;
        this.saveData();
        return { id: existingItem.id, changes: 1 };
      } else {
        // Add new item to cart
        const id = this.generateId("cart");
        const cartItem = {
          id,
          product_id: prodId,
          quantity: qty,
          created_at: new Date().toISOString(),
        };
        this.data.cart.push(cartItem);
        this.saveData();
        return { id, changes: 1 };
      }
    } catch (error) {
      console.error("Error in addToCart:", error.message);
      throw error;
    }
  }

  async getCartItems() {
    return this.data.cart
      .map((cartItem) => {
        const product = this.data.products.find(
          (p) => p.id === cartItem.product_id
        );
        if (product) {
          return {
            cart_id: cartItem.id,
            quantity: cartItem.quantity,
            product_id: product.id,
            name: product.name,
            price: product.price,
            image: product.image,
            subtotal: product.price * cartItem.quantity,
          };
        }
        return null;
      })
      .filter(Boolean);
  }

  async updateCartQuantity(cartId, quantity) {
    const item = this.data.cart.find((item) => item.id === parseInt(cartId));
    if (item) {
      item.quantity = quantity;
      this.saveData();
      return { id: cartId, changes: 1 };
    }
    return { id: cartId, changes: 0 };
  }

  async removeFromCart(cartId) {
    const index = this.data.cart.findIndex(
      (item) => item.id === parseInt(cartId)
    );
    if (index !== -1) {
      this.data.cart.splice(index, 1);
      this.saveData();
      return { id: cartId, changes: 1 };
    }
    return { id: cartId, changes: 0 };
  }

  async clearCart() {
    this.data.cart = [];
    this.saveData();
    return { changes: 1 };
  }

  async getCartTotal() {
    return this.data.cart.reduce((total, cartItem) => {
      const product = this.data.products.find(
        (p) => p.id === cartItem.product_id
      );
      return total + (product ? product.price * cartItem.quantity : 0);
    }, 0);
  }

  // Order operations
  async createOrder(totalAmount) {
    const id = this.generateId("orders");
    const order = {
      id,
      order_date: new Date().toISOString(),
      total_amount: totalAmount,
    };
    this.data.orders.push(order);
    this.saveData();
    return id;
  }

  async getAllOrders() {
    return this.data.orders.sort(
      (a, b) => new Date(b.order_date) - new Date(a.order_date)
    );
  }

  async getOrderById(id) {
    return this.data.orders.find((order) => order.id === parseInt(id)) || null;
  }

  // Admin operations
  async createAdmin(username, password) {
    const id = this.generateId("admins");
    const admin = {
      id,
      username,
      password,
      created_at: new Date().toISOString(),
    };
    this.data.admins.push(admin);
    this.saveData();
    return { id };
  }

  async getAdminByUsername(username) {
    return (
      this.data.admins.find((admin) => admin.username === username) || null
    );
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
    const product = this.data.products.find((p) => p.id === parseInt(id));
    if (product) {
      product.name = name;
      product.price = price;
      product.image = image;
      product.description = description;
      product.category_id = categoryId;
      product.occasion_id = occasionId;
      this.saveData();
      return { id, changes: 1 };
    }
    return { id, changes: 0 };
  }

  async deleteProduct(id) {
    const index = this.data.products.findIndex((p) => p.id === parseInt(id));
    if (index !== -1) {
      this.data.products.splice(index, 1);
      this.saveData();
      return { id, changes: 1 };
    }
    return { id, changes: 0 };
  }

  // Sales operations
  async createSaleRecord(orderId, productId, quantity, unitPrice, subtotal) {
    const id = this.generateId("sales");
    const sale = {
      id,
      order_id: orderId,
      product_id: productId,
      quantity,
      unit_price: unitPrice,
      subtotal,
      sale_date: new Date().toISOString(),
    };
    this.data.sales.push(sale);
    this.saveData();
    return { id };
  }

  async getSalesReport(startDate = null, endDate = null) {
    let sales = this.data.sales;

    if (startDate || endDate) {
      sales = sales.filter((sale) => {
        const saleDate = new Date(sale.sale_date).toISOString().split("T")[0];
        if (startDate && endDate) {
          return saleDate >= startDate && saleDate <= endDate;
        } else if (startDate) {
          return saleDate >= startDate;
        } else if (endDate) {
          return saleDate <= endDate;
        }
        return true;
      });
    }

    return sales
      .map((sale) => {
        const product = this.data.products.find(
          (p) => p.id === sale.product_id
        );
        const order = this.data.orders.find((o) => o.id === sale.order_id);
        return {
          ...sale,
          product_name: product?.name || "Unknown",
          order_date: order?.order_date || sale.sale_date,
          order_total: order?.total_amount || 0,
        };
      })
      .sort((a, b) => new Date(b.sale_date) - new Date(a.sale_date));
  }

  async getSalesSummary() {
    const uniqueOrders = [...new Set(this.data.sales.map((s) => s.order_id))];
    const totalItemsSold = this.data.sales.reduce(
      (sum, s) => sum + s.quantity,
      0
    );
    const totalRevenue = this.data.sales.reduce(
      (sum, s) => sum + s.subtotal,
      0
    );
    const avgOrderValue =
      uniqueOrders.length > 0 ? totalRevenue / uniqueOrders.length : 0;

    return {
      total_orders: uniqueOrders.length,
      total_items_sold: totalItemsSold,
      total_revenue: totalRevenue,
      average_order_value: avgOrderValue,
    };
  }

  async getTopProducts(limit = 10) {
    const productSales = {};

    this.data.sales.forEach((sale) => {
      if (!productSales[sale.product_id]) {
        productSales[sale.product_id] = {
          total_sold: 0,
          total_revenue: 0,
        };
      }
      productSales[sale.product_id].total_sold += sale.quantity;
      productSales[sale.product_id].total_revenue += sale.subtotal;
    });

    return Object.entries(productSales)
      .map(([productId, stats]) => {
        const product = this.data.products.find(
          (p) => p.id === parseInt(productId)
        );
        return {
          name: product?.name || "Unknown",
          price: product?.price || 0,
          image: product?.image || null,
          total_sold: stats.total_sold,
          total_revenue: stats.total_revenue,
        };
      })
      .sort((a, b) => b.total_sold - a.total_sold)
      .slice(0, limit);
  }

  // Enhanced checkout with sales tracking
  async checkoutWithSales(cartItems, totalAmount) {
    try {
      // Create order
      const orderId = this.createOrder(totalAmount);

      // Create sales records for each cart item
      for (const item of cartItems) {
        this.createSaleRecord(
          orderId,
          item.product_id,
          item.quantity,
          item.price,
          item.subtotal
        );
      }

      // Clear cart
      this.clearCart();

      return orderId;
    } catch (error) {
      console.error("Error in checkoutWithSales:", error);
      return false;
    }
  }

  // Close database connection
  close() {
    if (this.db) {
      console.log("Database connection closed");
    }
  }

  /* =============================
     CATEGORY & OCCASION METHODS
     ============================= */
  async addCategory(name) {
    const id = this.generateId("categories");
    const category = {
      id,
      name,
      created_at: new Date().toISOString(),
    };
    this.data.categories.push(category);
    this.saveData();
    return { id };
  }

  async getAllCategories() {
    return this.data.categories.sort((a, b) => a.name.localeCompare(b.name));
  }

  async updateCategory(id, name) {
    const category = this.data.categories.find((c) => c.id === parseInt(id));
    if (category) {
      category.name = name;
      this.saveData();
      return { id, changes: 1 };
    }
    return { id, changes: 0 };
  }

  async deleteCategory(id) {
    // Set products referencing this category to NULL before delete
    this.data.products.forEach((p) => {
      if (p.category_id === parseInt(id)) {
        p.category_id = null;
      }
    });

    const index = this.data.categories.findIndex((c) => c.id === parseInt(id));
    if (index !== -1) {
      this.data.categories.splice(index, 1);
      this.saveData();
      return { id, changes: 1 };
    }
    return { id, changes: 0 };
  }

  async addOccasion(name) {
    const id = this.generateId("occasions");
    const occasion = {
      id,
      name,
      created_at: new Date().toISOString(),
    };
    this.data.occasions.push(occasion);
    this.saveData();
    return { id };
  }

  async getAllOccasions() {
    return this.data.occasions.sort((a, b) => a.name.localeCompare(b.name));
  }

  async updateOccasion(id, name) {
    const occasion = this.data.occasions.find((o) => o.id === parseInt(id));
    if (occasion) {
      occasion.name = name;
      this.saveData();
      return { id, changes: 1 };
    }
    return { id, changes: 0 };
  }

  async deleteOccasion(id) {
    this.data.products.forEach((p) => {
      if (p.occasion_id === parseInt(id)) {
        p.occasion_id = null;
      }
    });

    const index = this.data.occasions.findIndex((o) => o.id === parseInt(id));
    if (index !== -1) {
      this.data.occasions.splice(index, 1);
      this.saveData();
      return { id, changes: 1 };
    }
    return { id, changes: 0 };
  }
}

module.exports = DatabaseHelper;
