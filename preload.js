const { contextBridge, ipcRenderer } = require("electron");

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electronAPI", {
  // Product operations
  getProducts: () => ipcRenderer.invoke("get-products"),
  getProduct: (id) => ipcRenderer.invoke("get-product", id),

  // Cart operations
  addToCart: (productId, quantity) =>
    ipcRenderer.invoke("add-to-cart", productId, quantity),
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

  // Navigation helpers
  navigateTo: (page) => {
    window.location.href = page;
  },
  navigateToProduct: (id) => {
    window.location.href = `product-detail.html?id=${id}`;
  },
});
