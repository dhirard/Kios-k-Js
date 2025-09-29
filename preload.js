const { contextBridge, ipcRenderer } = require("electron");

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object

// Small helper to retry an IPC invoke once when a handler is not yet registered
async function invokeWithRetry(channel, args = [], retries = 1, delayMs = 300) {
  try {
    return await ipcRenderer.invoke(channel, ...args);
  } catch (err) {
    const msg = String(err?.message || err || "");
    if (retries > 0 && /No handler registered/i.test(msg)) {
      await new Promise((r) => setTimeout(r, delayMs));
      return invokeWithRetry(channel, args, retries - 1, delayMs);
    }
    throw err;
  }
}
contextBridge.exposeInMainWorld("electronAPI", {
  // Product operations
  getProducts: () => ipcRenderer.invoke("get-products"),
  getProduct: (id) => ipcRenderer.invoke("get-product", id),
  // Artificial items
  getArtificialItems: () => ipcRenderer.invoke("get-artificial-items"),
  adminAddArtificial: (name, price, image = null) =>
    ipcRenderer.invoke("admin-add-artificial", name, price, image),
  adminUpdateArtificial: (id, fields) =>
    ipcRenderer.invoke("admin-update-artificial", id, fields),
  adminDeleteArtificial: (id) =>
    ipcRenderer.invoke("admin-delete-artificial", id),

  // Cart operations
  addToCart: (productId, quantity, variantId = null) =>
    ipcRenderer.invoke("add-to-cart", productId, quantity, variantId),
  // Add a custom bouquet/bucket cart line with arbitrary components/items
  addCustomToCart: (payload) =>
    ipcRenderer.invoke("add-custom-to-cart", payload),
  addArtificialToCart: (artificialId, quantity) =>
    ipcRenderer.invoke("add-artificial-to-cart", artificialId, quantity),
  getCartItems: () => ipcRenderer.invoke("get-cart-items"),
  updateCartItem: (cartId, quantity) =>
    ipcRenderer.invoke("update-cart-item", cartId, quantity),
  removeFromCart: (cartId) => ipcRenderer.invoke("remove-from-cart", cartId),

  // Order operations
  checkout: (totalAmount) => ipcRenderer.invoke("checkout", totalAmount),
  getOrders: () => ipcRenderer.invoke("get-orders"),

  // Admin operations
  adminLogin: (username, password) =>
    ipcRenderer.invoke("admin-login", username, password),
  adminAddProduct: (name, price, image, description, categoryId, occasionId) =>
    ipcRenderer.invoke(
      "admin-add-product",
      name,
      price,
      image,
      description,
      categoryId,
      occasionId
    ),
  adminUpdateProduct: (
    id,
    name,
    price,
    image,
    description,
    categoryId,
    occasionId
  ) =>
    ipcRenderer.invoke(
      "admin-update-product",
      id,
      name,
      price,
      image,
      description,
      categoryId,
      occasionId
    ),
  adminDeleteProduct: (id) => ipcRenderer.invoke("admin-delete-product", id),

  // Sales reports
  getSalesReport: (startDate, endDate) =>
    ipcRenderer.invoke("get-sales-report", startDate, endDate),
  getSalesSummary: () => ipcRenderer.invoke("get-sales-summary"),
  getTopProducts: (limit) => ipcRenderer.invoke("get-top-products", limit),
  // Printing
  printReceipt: (payload) => ipcRenderer.invoke("print-receipt", payload),
  printReceiptAuto: (payload) =>
    ipcRenderer.invoke("print-receipt-auto", payload),
  printReceiptDirectUsb: (payload) =>
    ipcRenderer.invoke("print-receipt-direct-usb", payload),
  printReceiptManual: (payload) =>
    ipcRenderer.invoke("print-receipt-manual", payload),
  getPrinters: () => ipcRenderer.invoke("get-printers"),
  getPreferredPrinter: () => ipcRenderer.invoke("get-preferred-printer"),
  setPreferredPrinter: (name) =>
    ipcRenderer.invoke("set-preferred-printer", name),
  // ESC/POS direct
  listSerialPorts: () => ipcRenderer.invoke("list-serial-ports"),
  printEscPos: (payload) => ipcRenderer.invoke("print-escpos", payload),
  getPreferredSerialPort: () => ipcRenderer.invoke("get-preferred-serial-port"),
  setPreferredSerialPort: (portPath, baudRate) =>
    ipcRenderer.invoke("set-preferred-serial-port", portPath, baudRate),
  getPrintModes: () => ipcRenderer.invoke("get-print-modes"),
  setPrintModes: (modes) => ipcRenderer.invoke("set-print-modes", modes),

  // Enhanced printer diagnostics and testing
  detectPOS58Printer: () => ipcRenderer.invoke("detect-pos58-printer"),
  testPrinterDirect: (printerName) =>
    ipcRenderer.invoke("test-printer-direct", printerName),
  getInstalledPrinters: () => ipcRenderer.invoke("get-installed-printers"),
  printerDiagnostic: () => ipcRenderer.invoke("printer-diagnostic"),
  // Categories
  getCategories: () => ipcRenderer.invoke("get-categories"),
  addCategory: (name) => ipcRenderer.invoke("add-category", name),
  updateCategory: (id, name) => ipcRenderer.invoke("update-category", id, name),
  deleteCategory: (id) => ipcRenderer.invoke("delete-category", id),
  // Occasions
  getOccasions: () => ipcRenderer.invoke("get-occasions"),
  addOccasion: (name) => ipcRenderer.invoke("add-occasion", name),
  updateOccasion: (id, name) => ipcRenderer.invoke("update-occasion", id, name),
  deleteOccasion: (id) => ipcRenderer.invoke("delete-occasion", id),
  // Components & BOM
  getComponents: () => ipcRenderer.invoke("get-components"),
  addComponent: (name, unit, price, stock, type) =>
    ipcRenderer.invoke("add-component", name, unit, price, stock, type),
  updateComponent: (id, fields) =>
    ipcRenderer.invoke("update-component", id, fields),
  deleteComponent: (id) => ipcRenderer.invoke("delete-component", id),
  getProductComponents: (productId) =>
    ipcRenderer.invoke("get-product-components", productId),
  setProductComponents: (productId, items) =>
    ipcRenderer.invoke("set-product-components", productId, items),
  // Variants
  getProductVariants: (productId) =>
    ipcRenderer.invoke("get-product-variants", productId),
  setProductVariants: (productId, variants) =>
    invokeWithRetry("set-product-variants", [productId, variants], 1, 250),
  // Service fee rules
  getServiceFeeRules: () => ipcRenderer.invoke("get-service-fee-rules"),
  setServiceFeeRules: (rules) =>
    ipcRenderer.invoke("set-service-fee-rules", rules),
  // Image handling
  saveImage: (fileName, dataUrl) =>
    ipcRenderer.invoke("save-image", { fileName, dataUrl }),

  // Utility functions
  formatCurrency: (amount) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  },
  // Also expose a simple number-only format (no currency sign)
  formatIDR: (amount) => {
    try {
      return new Intl.NumberFormat("id-ID", {
        minimumFractionDigits: 0,
      }).format(Number(amount) || 0);
    } catch {
      return String(amount);
    }
  },

  // Navigation helpers
  navigateTo: (page) => {
    window.location.href = page;
  },
  navigateToProduct: (id) => {
    window.location.href = `product-detail.html?id=${id}`;
  },
});

// Separate minimal printer API for simpler access in renderer pages
contextBridge.exposeInMainWorld("printerAPI", {
  listPrinters: () => ipcRenderer.invoke("get-printers"),
  printReceipt: (transactionData, deviceName) =>
    ipcRenderer.invoke("print:receipt", transactionData, deviceName),
});
