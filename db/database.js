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
      // Separate catalog for artificial items (not part of fresh products)
      artificial_items: [], // { id, name, price, image|null, created_at }
      // Custom designs bucket lines (cart stores custom as item type 'custom')
      // New: component inventory and product BOM mappings
      components: [], // { id, name, unit, price, stock, type: 'material'|'service', created_at }
      product_components: [], // { id, product_id, component_id, quantity }
      // New: product variants
      product_variants: [], // { id, product_id, name, price: number|null, image: string|null, created_at }
      // New: service fee rules for custom builder
      // [{ id, mode: 'custom-komponen'|'custom-bucket-produk', min: number, max: number|null, fee: number }]
      service_fee_rules: [],
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
    if (!this.data.artificial_items) this.data.artificial_items = [];
    if (!this.data.components) this.data.components = [];
    if (!this.data.product_components) this.data.product_components = [];
    if (!this.data.product_variants) this.data.product_variants = [];
    if (!this.data.service_fee_rules) this.data.service_fee_rules = [];
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

  /* =============================
     ARTIFICIAL ITEMS METHODS
     ============================= */
  async addArtificialItem(name, price, image = null) {
    const id = this.generateId("artificial_items");
    const item = {
      id,
      name: String(name || "Artificial"),
      price: Number(price) || 0,
      image: image ? String(image) : null,
      created_at: new Date().toISOString(),
    };
    this.data.artificial_items.push(item);
    this.saveData();
    return { id };
  }

  async getAllArtificialItems() {
    return (this.data.artificial_items || []).map((it) => ({ ...it }));
  }

  async updateArtificialItem(id, fields) {
    const it = (this.data.artificial_items || []).find(
      (x) => x.id === parseInt(id)
    );
    if (!it) return { id, changes: 0 };
    if (typeof fields.name !== "undefined") it.name = String(fields.name);
    if (typeof fields.price !== "undefined")
      it.price = Number(fields.price) || 0;
    if (typeof fields.image !== "undefined")
      it.image = fields.image ? String(fields.image) : null;
    this.saveData();
    return { id, changes: 1 };
  }

  async deleteArtificialItem(id) {
    const idx = (this.data.artificial_items || []).findIndex(
      (x) => x.id === parseInt(id)
    );
    if (idx === -1) return { id, changes: 0 };
    this.data.artificial_items.splice(idx, 1);
    this.saveData();
    return { id, changes: 1 };
  }

  async addArtificialToCart(artificialId, quantity = 1) {
    const it = (this.data.artificial_items || []).find(
      (x) => x.id === parseInt(artificialId)
    );
    if (!it) throw new Error("Artificial item not found");

    const qty = Math.max(1, parseInt(quantity || 1, 10));
    // merge by artificial_id
    const existing = this.data.cart.find(
      (c) => c.type === "artificial" && c.artificial_id === it.id
    );
    if (existing) {
      existing.quantity += qty;
      this.saveData();
      return { id: existing.id, changes: 1 };
    }
    const id = this.generateId("cart");
    this.data.cart.push({
      id,
      type: "artificial",
      artificial_id: it.id,
      name: it.name,
      unit_price: Number(it.price) || 0,
      quantity: qty,
      image: it.image || null,
      created_at: new Date().toISOString(),
    });
    this.saveData();
    return { id, changes: 1 };
  }

  async getAllProducts() {
    return this.data.products.map((p) => {
      const category = this.data.categories.find((c) => c.id === p.category_id);
      const occasion = this.data.occasions.find((o) => o.id === p.occasion_id);
      // variants
      const variants = (this.data.product_variants || [])
        .filter((v) => v.product_id === p.id)
        .map((v) => ({
          id: v.id,
          name: v.name,
          price: typeof v.price === "number" ? v.price : null,
          image: v.image || null,
        }));
      const bom = this.data.product_components
        .filter((pc) => pc.product_id === p.id)
        .map((pc) => {
          const comp = this.data.components.find(
            (c) => c.id === pc.component_id
          );
          return comp
            ? {
                component_id: comp.id,
                name: comp.name,
                unit: comp.unit || null,
                price: comp.price || 0,
                stock: comp.stock ?? null,
                type: comp.type || "material",
                quantity: pc.quantity || 1,
              }
            : null;
        })
        .filter(Boolean);
      const components_cost = bom.reduce(
        (sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 0),
        0
      );
      return {
        ...p,
        category_name: category?.name || null,
        occasion_name: occasion?.name || null,
        variants,
        components: bom,
        components_cost,
      };
    });
  }

  async getProductById(id) {
    return this.data.products.find((p) => p.id === parseInt(id)) || null;
  }

  // Cart operations
  async addToCart(productId, quantity = 1, variantId = null) {
    try {
      // Validate inputs
      if (!productId || quantity <= 0) {
        throw new Error("Invalid productId or quantity");
      }

      // Convert to numbers to ensure consistency
      const prodId = parseInt(productId);
      const qty = parseInt(quantity);
      const varId = variantId != null ? parseInt(variantId) : null;

      // Check if product exists
      const product = this.data.products.find((p) => p.id === prodId);
      if (!product) {
        throw new Error("Product not found");
      }

      // Check variants requirement
      const variants = (this.data.product_variants || []).filter(
        (v) => v.product_id === prodId
      );
      let chosenVariant = null;
      if (variants.length > 0) {
        if (!varId) {
          throw new Error("Variant is required for this product");
        }
        chosenVariant = variants.find((v) => v.id === varId);
        if (!chosenVariant) throw new Error("Variant not found");
      } else if (varId) {
        // variantId provided but product has no variants
        throw new Error("Product has no variants");
      }

      const unitPrice =
        chosenVariant && typeof chosenVariant.price === "number"
          ? Number(chosenVariant.price) || 0
          : Number(product.price) || 0;

      // Check if product already exists in cart
      const existingItem = this.data.cart.find(
        (item) =>
          item.product_id === prodId &&
          (item.variant_id || null) === (varId || null)
      );

      if (existingItem) {
        // Update quantity if item already exists
        existingItem.quantity += qty;
        // keep stored price/name as is
        this.saveData();
        return { id: existingItem.id, changes: 1 };
      } else {
        // Add new item to cart
        const id = this.generateId("cart");
        const cartItem = {
          id,
          product_id: prodId,
          quantity: qty,
          variant_id: varId,
          variant_name: chosenVariant ? chosenVariant.name : null,
          unit_price: unitPrice,
          type: "product",
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
        if (cartItem.type === "custom") {
          const price = Number(cartItem.unit_price) || 0;
          return {
            cart_id: cartItem.id,
            quantity: cartItem.quantity,
            product_id: null,
            name: cartItem.name || "Custom Item",
            variant_id: null,
            variant_name: null,
            price,
            image: cartItem.image || null,
            subtotal: price * cartItem.quantity,
            custom: {
              mode: cartItem.custom_mode,
              service_fee: cartItem.service_fee || 0,
              materials: cartItem.materials || [],
              items: cartItem.items || [],
              flowers: cartItem.flowers || [],
              notes: cartItem.notes || "",
            },
          };
        } else if (cartItem.type === "artificial") {
          const price = Number(cartItem.unit_price) || 0;
          return {
            cart_id: cartItem.id,
            quantity: cartItem.quantity,
            product_id: null,
            name: cartItem.name || "Artificial",
            variant_id: null,
            variant_name: null,
            price,
            image: null,
            subtotal: price * cartItem.quantity,
            artificial: { id: cartItem.artificial_id },
          };
        } else {
          const product = this.data.products.find(
            (p) => p.id === cartItem.product_id
          );
          const variant = cartItem.variant_id
            ? (this.data.product_variants || []).find(
                (v) => v.id === cartItem.variant_id
              )
            : null;
          if (product) {
            const price =
              typeof cartItem.unit_price === "number"
                ? cartItem.unit_price
                : variant && typeof variant.price === "number"
                ? Number(variant.price) || 0
                : Number(product.price) || 0;
            return {
              cart_id: cartItem.id,
              quantity: cartItem.quantity,
              product_id: product.id,
              name: product.name,
              variant_id: cartItem.variant_id || null,
              variant_name: cartItem.variant_name || variant?.name || null,
              price,
              image: variant && variant.image ? variant.image : product.image,
              subtotal: price * cartItem.quantity,
            };
          }
          return null;
        }
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
      if (cartItem.type === "custom") {
        const price = Number(cartItem.unit_price) || 0;
        return total + price * (cartItem.quantity || 1);
      } else if (cartItem.type === "artificial") {
        const price = Number(cartItem.unit_price) || 0;
        return total + price * (cartItem.quantity || 1);
      }
      const product = this.data.products.find(
        (p) => p.id === cartItem.product_id
      );
      if (!product) return total;
      const price =
        typeof cartItem.unit_price === "number"
          ? cartItem.unit_price
          : Number(product.price) || 0;
      return total + price * cartItem.quantity;
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
      const pid = this.data.products[index].id;
      this.data.products.splice(index, 1);
      // cleanup variants & BOM mappings
      this.data.product_variants = (this.data.product_variants || []).filter(
        (v) => v.product_id !== pid
      );
      this.data.product_components = (
        this.data.product_components || []
      ).filter((pc) => pc.product_id !== pid);
      this.saveData();
      return { id, changes: 1 };
    }
    return { id, changes: 0 };
  }

  // Sales operations
  async createSaleRecord(
    orderId,
    productId,
    quantity,
    unitPrice,
    subtotal,
    extra = {}
  ) {
    const id = this.generateId("sales");
    const sale = {
      id,
      order_id: orderId,
      product_id: productId,
      quantity,
      unit_price: unitPrice,
      subtotal,
      sale_date: new Date().toISOString(),
      // optional fields for custom items or variants
      name: typeof extra.name === "string" ? extra.name : undefined,
      details: Array.isArray(extra.details) ? extra.details : undefined,
      variant_id:
        typeof extra.variant_id === "number" &&
        Number.isFinite(extra.variant_id)
          ? extra.variant_id
          : undefined,
      variant_name:
        typeof extra.variant_name === "string" &&
        extra.variant_name.trim() !== ""
          ? extra.variant_name
          : undefined,
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
        const product = sale.product_id
          ? this.data.products.find((p) => p.id === sale.product_id)
          : null;
        const order = this.data.orders.find((o) => o.id === sale.order_id);

        // Build a better display name: prefer explicit sale.name, else product name,
        // else if details exist treat as custom, else fallback.
        let baseName;
        if (typeof sale.name === "string" && sale.name.trim() !== "") {
          baseName = sale.name;
        } else if (product?.name) {
          baseName = product.name;
        } else if (Array.isArray(sale.details) && sale.details.length > 0) {
          baseName = "Custom Item";
        } else {
          baseName = sale.product_id ? "Unknown" : "Custom Item";
        }

        // Resolve variant name if missing using variant_id or price match
        let resolvedVariantName = null;
        if (
          typeof sale.variant_name === "string" &&
          sale.variant_name.trim() !== ""
        ) {
          resolvedVariantName = sale.variant_name.trim();
        } else if (sale.variant_id) {
          const v = (this.data.product_variants || []).find(
            (vv) => vv.id === sale.variant_id
          );
          resolvedVariantName = v?.name || null;
        } else if (product) {
          const variants = (this.data.product_variants || []).filter(
            (v) => v.product_id === product.id
          );
          const byPrice = variants.find(
            (v) =>
              typeof v.price === "number" &&
              Number(v.price) === Number(sale.unit_price)
          );
          if (byPrice) resolvedVariantName = byPrice.name;
        }

        // Append variant name if present (e.g., "4 Titik")
        const product_name = resolvedVariantName
          ? `${baseName} - ${resolvedVariantName}`
          : baseName;

        return {
          ...sale,
          product_name,
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

  /* =============================
     SERVICE FEE RULES METHODS
     ============================= */
  async getServiceFeeRules() {
    // return a copy sorted for stable UI (by mode then min asc)
    const rules = Array.isArray(this.data.service_fee_rules)
      ? this.data.service_fee_rules.slice()
      : [];
    rules.sort((a, b) => {
      if (a.mode !== b.mode) return a.mode.localeCompare(b.mode);
      return (a.min || 0) - (b.min || 0);
    });
    return rules;
  }

  async setServiceFeeRules(rules) {
    // Replace all rules with sanitized list
    const safe = [];
    (Array.isArray(rules) ? rules : []).forEach((r) => {
      const mode =
        r.mode === "custom-bucket-produk"
          ? "custom-bucket-produk"
          : "custom-komponen";
      const min = Math.max(0, parseInt(r.min || 0));
      const maxRaw =
        r.max === null || r.max === "" || typeof r.max === "undefined"
          ? null
          : parseInt(r.max);
      const max =
        maxRaw != null && !Number.isNaN(maxRaw) ? Math.max(min, maxRaw) : null;
      const fee = Math.max(0, Number(r.fee) || 0);
      const id = this.generateId("service_fee_rules");
      safe.push({ id, mode, min, max, fee });
    });
    this.data.service_fee_rules = safe;
    this.saveData();
    return { success: true, count: safe.length };
  }

  computeServiceFee(mode, count) {
    try {
      const rules = Array.isArray(this.data.service_fee_rules)
        ? this.data.service_fee_rules.filter((r) => r.mode === mode)
        : [];
      if (!rules.length) return 0;
      // pick rule where min <= count <= max (or max null), prefer the one with highest min
      const candidates = rules.filter(
        (r) => count >= (r.min || 0) && (r.max == null || count <= r.max)
      );
      if (!candidates.length) return 0;
      candidates.sort((a, b) => (b.min || 0) - (a.min || 0));
      return Math.max(0, Number(candidates[0].fee) || 0);
    } catch {
      return 0;
    }
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
      const orderId = await this.createOrder(totalAmount);

      // Create sales records for each cart item
      for (const item of cartItems) {
        if (item.product_id) {
          await this.createSaleRecord(
            orderId,
            item.product_id,
            item.quantity,
            item.price,
            item.subtotal,
            {
              variant_id: item.variant_id || undefined,
              variant_name: item.variant_name || undefined,
            }
          );
        } else if (item.artificial) {
          // Artificial item sale
          await this.createSaleRecord(
            orderId,
            null,
            item.quantity,
            item.price,
            item.subtotal,
            { name: item.name }
          );
        } else if (item.custom) {
          // custom sale line using item.name and details summary
          const details = [];
          const mapName = (cid) => {
            const comp = this.data.components.find((c) => c.id === Number(cid));
            return comp ? comp.name : `#${cid}`;
          };
          const items = Array.isArray(item.custom.items)
            ? item.custom.items
            : [];
          const mats = Array.isArray(item.custom.materials)
            ? item.custom.materials
            : [];
          const fls = Array.isArray(item.custom.flowers)
            ? item.custom.flowers
            : [];
          if (items.length) {
            details.push(
              `Item: ${items
                .map((it) => `${it.name} x${Number(it.quantity) || 1}`)
                .join(", ")}`
            );
          }
          if (mats.length) {
            details.push(
              `Material: ${mats
                .map(
                  (m) =>
                    `${mapName(m.component_id)} x${Number(m.quantity) || 1}`
                )
                .join(", ")}`
            );
          }
          if (fls.length) {
            details.push(
              `Bunga: ${fls
                .map(
                  (f) =>
                    `${mapName(f.component_id)} x${Number(f.quantity) || 1}`
                )
                .join(", ")}`
            );
          }
          await this.createSaleRecord(
            orderId,
            null,
            item.quantity,
            item.price,
            item.subtotal,
            { name: item.name, details }
          );
        }
      }

      // Consume component stocks based on BOM and quantities and custom materials/flowers
      await this.consumeComponentsForOrder(cartItems);

      // Clear cart
      await this.clearCart();

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

  /* =============================
     COMPONENTS & BOM METHODS
     ============================= */
  async addComponent(
    name,
    unit = null,
    price = 0,
    stock = 0,
    type = "material"
  ) {
    const id = this.generateId("components");
    const comp = {
      id,
      name,
      unit,
      price: Number(price) || 0,
      stock: type === "service" ? null : Number(stock) || 0,
      type: type === "service" ? "service" : "material",
      created_at: new Date().toISOString(),
    };
    this.data.components.push(comp);
    this.saveData();
    return { id };
  }

  async getAllComponents() {
    return this.data.components.sort((a, b) => a.name.localeCompare(b.name));
  }

  async updateComponent(id, fields) {
    const comp = this.data.components.find((c) => c.id === parseInt(id));
    if (!comp) return { id, changes: 0 };
    if (typeof fields.name !== "undefined") comp.name = fields.name;
    if (typeof fields.unit !== "undefined") comp.unit = fields.unit;
    if (typeof fields.price !== "undefined")
      comp.price = Number(fields.price) || 0;
    if (typeof fields.type !== "undefined")
      comp.type = fields.type === "service" ? "service" : "material";
    if (comp.type !== "service" && typeof fields.stock !== "undefined") {
      comp.stock = Number(fields.stock) || 0;
    }
    this.saveData();
    return { id, changes: 1 };
  }

  async deleteComponent(id) {
    const idx = this.data.components.findIndex((c) => c.id === parseInt(id));
    if (idx === -1) return { id, changes: 0 };
    const compId = this.data.components[idx].id;
    // remove from mapping
    this.data.product_components = this.data.product_components.filter(
      (pc) => pc.component_id !== compId
    );
    this.data.components.splice(idx, 1);
    this.saveData();
    return { id, changes: 1 };
  }

  async getProductComponents(productId) {
    const pid = parseInt(productId);
    return this.data.product_components
      .filter((pc) => pc.product_id === pid)
      .map((pc) => {
        const comp = this.data.components.find((c) => c.id === pc.component_id);
        return comp
          ? {
              id: pc.id,
              product_id: pid,
              component_id: comp.id,
              name: comp.name,
              unit: comp.unit || null,
              price: comp.price || 0,
              stock: comp.stock ?? null,
              type: comp.type || "material",
              quantity: pc.quantity || 1,
            }
          : null;
      })
      .filter(Boolean);
  }

  async setProductComponents(productId, items) {
    // items: [{ component_id, quantity }]
    const pid = parseInt(productId);
    // Remove existing mappings for this product
    this.data.product_components = this.data.product_components.filter(
      (pc) => pc.product_id !== pid
    );
    // Add new ones
    (Array.isArray(items) ? items : []).forEach((it) => {
      const compId = parseInt(it.component_id);
      if (!this.data.components.find((c) => c.id === compId)) return; // skip invalid
      const id = this.generateId("product_components");
      this.data.product_components.push({
        id,
        product_id: pid,
        component_id: compId,
        quantity: Number(it.quantity) || 1,
      });
    });
    this.saveData();
    return { success: true };
  }

  async adjustComponentStock(componentId, delta) {
    const comp = this.data.components.find(
      (c) => c.id === parseInt(componentId)
    );
    if (!comp) return { success: false, message: "Component not found" };
    if (comp.type === "service") return { success: true, stock: null }; // no stock changes
    const current = Number(comp.stock) || 0;
    const next = current + Number(delta);
    comp.stock = next;
    this.saveData();
    return { success: true, stock: comp.stock };
  }

  async consumeComponentsForOrder(cartItems) {
    try {
      for (const item of cartItems) {
        const qty = Number(item.quantity) || 1;
        if (item.product_id) {
          const pid = parseInt(item.product_id);
          const mappings = this.data.product_components.filter(
            (pc) => pc.product_id === pid
          );
          for (const pc of mappings) {
            // total usage = quantity per product * item quantity
            const usage = (Number(pc.quantity) || 1) * qty;
            const comp = this.data.components.find(
              (c) => c.id === pc.component_id
            );
            if (!comp || comp.type === "service") continue;
            await this.adjustComponentStock(comp.id, -usage);
          }
        } else if (item.custom && Array.isArray(item.custom.materials)) {
          // custom items: materials contain component_id and quantity per one bucket
          for (const m of item.custom.materials) {
            const comp = this.data.components.find(
              (c) => c.id === parseInt(m.component_id)
            );
            if (!comp || comp.type === "service") continue;
            const usage = (Number(m.quantity) || 1) * qty;
            await this.adjustComponentStock(comp.id, -usage);
          }
          // custom flowers also map to components by id
          if (Array.isArray(item.custom.flowers)) {
            for (const f of item.custom.flowers) {
              const comp = this.data.components.find(
                (c) => c.id === parseInt(f.component_id)
              );
              if (!comp || comp.type === "service") continue;
              const usage = (Number(f.quantity) || 1) * qty;
              await this.adjustComponentStock(comp.id, -usage);
            }
          }
        }
      }
      return { success: true };
    } catch (e) {
      console.warn("consumeComponentsForOrder error", e);
      return { success: false, message: e.message };
    }
  }

  /* =============================
     CUSTOM CART ITEM METHODS
     ============================= */
  // payload contract:
  // {
  //   mode: 'custom-komponen' | 'custom-bucket-produk',
  //   name: string,
  //   quantity: number,
  //   materials?: [{ component_id, quantity }], // for mode custom-komponen
  //   service_pricing?: { base: number, perComponent: number } | { perCount: number } | null,
  //   items?: [{ name, quantity }], // for mode custom-bucket-produk
  //   flowers?: [{ component_id, quantity }], // optional additional flowers
  //   notes?: string
  // }
  async addCustomToCart(payload) {
    if (!payload || !payload.name) throw new Error("Invalid custom payload");
    const quantity =
      Number(payload.quantity) > 0 ? Number(payload.quantity) : 1;
    const mode = payload.mode || "custom";

    // Compute material cost
    let materialsCost = 0;
    const materials = Array.isArray(payload.materials) ? payload.materials : [];
    for (const m of materials) {
      const comp = this.data.components.find(
        (c) => c.id === parseInt(m.component_id)
      );
      if (!comp) continue;
      const qty = Number(m.quantity) || 1;
      const price = Number(comp.price) || 0;
      materialsCost += qty * price;
    }
    // Additional flowers cost
    const flowers = Array.isArray(payload.flowers) ? payload.flowers : [];
    for (const f of flowers) {
      const comp = this.data.components.find(
        (c) => c.id === parseInt(f.component_id)
      );
      if (!comp) continue;
      const qty = Number(f.quantity) || 1;
      const price = Number(comp.price) || 0;
      materialsCost += qty * price;
    }

    // Service fee calculation
    let serviceFee = 0;
    const servicePricing = payload.service_pricing || null;
    // Determine count for rules
    const sumQty = (arr) =>
      Array.isArray(arr)
        ? arr.reduce((s, it) => s + (Number(it.quantity) || 0), 0)
        : 0;
    let countForRules = 0;
    if (mode === "custom-bucket-produk") {
      const itemsQty = sumQty(
        Array.isArray(payload.items) ? payload.items : []
      );
      const flowersQty = sumQty(flowers);
      countForRules = itemsQty + flowersQty;
    } else {
      // custom-komponen or others: use all selected component quantities
      countForRules = sumQty(materials) + sumQty(flowers);
    }
    if (servicePricing) {
      // Backward compatibility: still support manual override from payload
      if (
        typeof servicePricing.base === "number" &&
        typeof servicePricing.perComponent === "number"
      ) {
        serviceFee =
          Number(servicePricing.base) +
          Number(servicePricing.perComponent) * countForRules;
      } else if (typeof servicePricing.perCount === "number") {
        serviceFee = Number(servicePricing.perCount) * countForRules;
      }
    } else if (mode === "custom-komponen" || mode === "custom-bucket-produk") {
      serviceFee = this.computeServiceFee(mode, countForRules);
    }

    const unitPrice = Math.max(0, Math.round(materialsCost + serviceFee));

    const id = this.generateId("cart");
    const cartItem = {
      id,
      type: "custom",
      name: String(payload.name),
      quantity,
      unit_price: unitPrice,
      custom_mode: mode,
      service_fee: serviceFee,
      materials: materials.map((m) => ({
        component_id: parseInt(m.component_id),
        quantity: Number(m.quantity) || 1,
      })),
      items: Array.isArray(payload.items)
        ? payload.items.map((it) => ({
            name: String(it.name || "Item"),
            quantity: Number(it.quantity) || 1,
          }))
        : [],
      flowers: flowers.map((f) => ({
        component_id: parseInt(f.component_id),
        quantity: Number(f.quantity) || 1,
      })),
      notes: payload.notes ? String(payload.notes) : "",
      created_at: new Date().toISOString(),
    };
    this.data.cart.push(cartItem);
    this.saveData();
    return { id, success: true };
  }

  /* =============================
     VARIANT METHODS
     ============================= */
  async getProductVariants(productId) {
    const pid = parseInt(productId);
    return (this.data.product_variants || [])
      .filter((v) => v.product_id === pid)
      .map((v) => ({
        id: v.id,
        name: v.name,
        price: typeof v.price === "number" ? v.price : null,
        image: v.image || null,
      }));
  }

  async setProductVariants(productId, variants) {
    // variants: [{ name, price|null, id? }]. We'll replace all for the product
    const pid = parseInt(productId);
    // Remove existing
    this.data.product_variants = (this.data.product_variants || []).filter(
      (v) => v.product_id !== pid
    );
    // Add new ones
    (Array.isArray(variants) ? variants : []).forEach((it) => {
      const id = this.generateId("product_variants");
      this.data.product_variants.push({
        id,
        product_id: pid,
        name: String(it.name || "Varian"),
        price:
          typeof it.price === "number" || it.price === null
            ? it.price
            : it.price === ""
            ? null
            : Number(it.price) || null,
        image:
          typeof it.image === "string" && it.image.trim() !== ""
            ? it.image.trim()
            : null,
        created_at: new Date().toISOString(),
      });
    });
    this.saveData();
    return { success: true };
  }
}

module.exports = DatabaseHelper;
