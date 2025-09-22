const { ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");

/**
 * Manager untuk semua IPC handlers
 */
class IPCHandlers {
  constructor(
    databaseManager,
    printManager,
    serialPortManager,
    settingsManager,
    windowManager
  ) {
    this.databaseManager = databaseManager;
    this.printManager = printManager;
    this.serialPortManager = serialPortManager;
    this.settingsManager = settingsManager;
    this.windowManager = windowManager;

    this.setupHandlers();
  }

  setupHandlers() {
    this.setupDatabaseHandlers();
    this.setupPrintingHandlers();
    this.setupSerialPortHandlers();
    this.setupSettingsHandlers();
    this.setupImageHandlers();
    this.setupDiagnosticHandlers();
  }

  setupDatabaseHandlers() {
    const dbHelper = this.databaseManager.getDbHelper();

    // Product handlers
    ipcMain.handle("get-products", async () => {
      try {
        return await dbHelper.getAllProducts();
      } catch (error) {
        console.error("Error getting products:", error);
        return [];
      }
    });

    ipcMain.handle("get-product", async (event, id) => {
      try {
        return await dbHelper.getProductById(id);
      } catch (error) {
        console.error("Error getting product by id:", error);
        return null;
      }
    });

    // Cart handlers
    ipcMain.handle("add-to-cart", async (event, productId, quantity = 1) => {
      try {
        return await dbHelper.addToCart(productId, quantity);
      } catch (error) {
        console.error("Error adding to cart:", error);
        return false;
      }
    });

    ipcMain.handle("get-cart-items", async () => {
      try {
        return await dbHelper.getCartItems();
      } catch (error) {
        console.error("Error getting cart items:", error);
        return [];
      }
    });

    ipcMain.handle("update-cart-item", async (event, cartId, quantity) => {
      try {
        if (quantity <= 0) {
          return await dbHelper.removeFromCart(cartId);
        } else {
          return await dbHelper.updateCartQuantity(cartId, quantity);
        }
      } catch (error) {
        console.error("Error updating cart item:", error);
        return false;
      }
    });

    ipcMain.handle("remove-from-cart", async (event, cartId) => {
      try {
        return await dbHelper.removeFromCart(cartId);
      } catch (error) {
        console.error("Error removing from cart:", error);
        return false;
      }
    });

    // Checkout handler
    ipcMain.handle("checkout", async (event, totalAmount) => {
      try {
        // Get current cart items for sales tracking
        const cartItems = await dbHelper.getCartItems();
        const orderId = await dbHelper.checkoutWithSales(
          cartItems,
          totalAmount
        );
        return orderId;
      } catch (error) {
        console.error("Error during checkout:", error);
        return false;
      }
    });

    // Order handlers
    ipcMain.handle("get-orders", async () => {
      try {
        return await dbHelper.getAllOrders();
      } catch (error) {
        console.error("Error getting orders:", error);
        return [];
      }
    });

    // Admin authentication
    ipcMain.handle("admin-login", async (event, username, password) => {
      try {
        const admin = await dbHelper.getAdminByUsername(username);
        if (admin && admin.password === password) {
          return {
            success: true,
            admin: { id: admin.id, username: admin.username },
          };
        }
        return { success: false, message: "Username atau password salah" };
      } catch (error) {
        console.error("Error during admin login:", error);
        return { success: false, message: "Terjadi kesalahan sistem" };
      }
    });

    // Admin product management
    ipcMain.handle(
      "admin-add-product",
      async (
        event,
        name,
        price,
        image,
        description = null,
        categoryId = null,
        occasionId = null
      ) => {
        const attempt = async () => {
          return await dbHelper.addProduct(
            name,
            price,
            image,
            description,
            categoryId,
            occasionId
          );
        };
        try {
          const res = await attempt();
          console.log("[DBG admin-add-product] added", {
            name,
            price,
            image,
            categoryId,
            occasionId,
            insertId: res.id,
          });
          return res;
        } catch (error) {
          // If error indicates missing column (e.g., no such column: description) attempt on-the-fly migration then retry once
          if (/no such column: description/i.test(error.message)) {
            console.warn(
              "[MIGRATION] description column missing. Attempting to add then retry insert"
            );
            try {
              await dbHelper.ensureProductColumn("description", "TEXT");
              const res2 = await attempt();
              console.log("[DBG admin-add-product] added after migration", {
                insertId: res2.id,
              });
              return res2;
            } catch (err2) {
              console.error("Retry after migration failed", err2);
              return { success: false, message: err2.message };
            }
          }
          console.error("Error adding product:", error);
          return { success: false, message: error.message };
        }
      }
    );

    ipcMain.handle(
      "admin-update-product",
      async (
        event,
        id,
        name,
        price,
        image,
        description = null,
        categoryId = null,
        occasionId = null
      ) => {
        try {
          return await dbHelper.updateProduct(
            id,
            name,
            price,
            image,
            description,
            categoryId,
            occasionId
          );
        } catch (error) {
          console.error("Error updating product:", error);
          return false;
        }
      }
    );

    ipcMain.handle("admin-delete-product", async (event, id) => {
      try {
        return await dbHelper.deleteProduct(id);
      } catch (error) {
        console.error("Error deleting product:", error);
        return false;
      }
    });

    // Sales reports
    ipcMain.handle("get-sales-report", async (event, startDate, endDate) => {
      try {
        return await dbHelper.getSalesReport(startDate, endDate);
      } catch (error) {
        console.error("Error getting sales report:", error);
        return [];
      }
    });

    ipcMain.handle("get-sales-summary", async () => {
      try {
        return await dbHelper.getSalesSummary();
      } catch (error) {
        console.error("Error getting sales summary:", error);
        return null;
      }
    });

    ipcMain.handle("get-top-products", async (event, limit = 10) => {
      try {
        return await dbHelper.getTopProducts(limit);
      } catch (error) {
        console.error("Error getting top products:", error);
        return [];
      }
    });

    // Category & Occasion Management
    this.setupCategoryOccasionHandlers(dbHelper);
  }

  setupCategoryOccasionHandlers(dbHelper) {
    // Categories
    ipcMain.handle("get-categories", async () => {
      try {
        return await dbHelper.getAllCategories();
      } catch (e) {
        console.error(e);
        return [];
      }
    });
    ipcMain.handle("add-category", async (e, name) => {
      try {
        return await dbHelper.addCategory(name);
      } catch (err) {
        console.error(err);
        return false;
      }
    });
    ipcMain.handle("update-category", async (e, id, name) => {
      try {
        return await dbHelper.updateCategory(id, name);
      } catch (err) {
        console.error(err);
        return false;
      }
    });
    ipcMain.handle("delete-category", async (e, id) => {
      try {
        return await dbHelper.deleteCategory(id);
      } catch (err) {
        console.error(err);
        return false;
      }
    });

    // Occasions
    ipcMain.handle("get-occasions", async () => {
      try {
        return await dbHelper.getAllOccasions();
      } catch (e) {
        console.error(e);
        return [];
      }
    });
    ipcMain.handle("add-occasion", async (e, name) => {
      try {
        return await dbHelper.addOccasion(name);
      } catch (err) {
        console.error(err);
        return false;
      }
    });
    ipcMain.handle("update-occasion", async (e, id, name) => {
      try {
        return await dbHelper.updateOccasion(id, name);
      } catch (err) {
        console.error(err);
        return false;
      }
    });
    ipcMain.handle("delete-occasion", async (e, id) => {
      try {
        return await dbHelper.deleteOccasion(id);
      } catch (err) {
        console.error(err);
        return false;
      }
    });
  }

  setupPrintingHandlers() {
    const mainWindow = this.windowManager.getMainWindow();

    // Get printers
    ipcMain.handle("get-printers", async () => {
      try {
        const wc = mainWindow?.webContents;
        if (!wc) return [];
        if (typeof wc.getPrintersAsync === "function") {
          return await wc.getPrintersAsync();
        }
        return wc.getPrinters();
      } catch (e) {
        console.warn("[IPC get-printers]", e?.message);
        return [];
      }
    });

    // ESC/POS printing
    ipcMain.handle("print-escpos", async (e, payload) => {
      const res = await this.printManager.performEscPosPrint(payload, {
        autoDetectAllowed: false,
      });
      return res;
    });

    // Auto printing with fallback chain
    ipcMain.handle("print-receipt-auto", async (e, payload) => {
      return await this.handleAutoPrint(payload);
    });

    // Regular receipt printing
    ipcMain.handle("print-receipt", async (e, payload) => {
      return await this.handleRegularPrint(payload);
    });

    // Manual print with dialog handler
    ipcMain.handle("print-receipt-manual", async (e, payload) => {
      return await this.handleManualPrint(payload);
    });

    // Direct USB printing
    ipcMain.handle("print-receipt-direct-usb", async (e, payload) => {
      console.log("[PRINT-USB] Handler cetak langsung via USB dipanggil");
      try {
        const res = await this.printManager.directUsbPrint(
          payload,
          payload?.deviceName
        );
        return { success: true, ...res };
      } catch (err) {
        return { success: false, message: err?.message };
      }
    });

    // Printer diagnostics
    ipcMain.handle("detect-pos58-printer", async () => {
      try {
        const printerName = await this.printManager.detectPOS58Printer(
          mainWindow
        );
        return { success: true, printerName };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("test-printer-direct", async (e, printerName) => {
      try {
        const testPayload = {
          orderId: "TEST_" + Date.now(),
          total: 25000,
          items: [{ name: "Test Item POS58", quantity: 1, price: 25000 }],
          businessName: "PRINTER TEST",
          address: "Direct HTML Print Test",
          notes: "Test berhasil jika struk ini tercetak",
          width: 32,
        };

        const result = await this.printManager.rawWindowsPrintEscPos(
          testPayload,
          printerName
        );
        return { success: true, result };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("get-installed-printers", async () => {
      try {
        if (mainWindow && mainWindow.webContents) {
          const printers = await this.printManager.listPrintersRobust(
            mainWindow.webContents,
            null
          );
          return { success: true, printers };
        } else {
          throw new Error("Main window not available");
        }
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
  }

  async handleAutoPrint(payload) {
    console.log(
      "[AUTO-PRINT] Starting automatic printing with fallback chain v2"
    );
    console.log("[AUTO-PRINT] Payload:", {
      orderId: payload?.orderId,
      total: payload?.total,
    });

    let lastError = "No methods succeeded.";
    const mainWindow = this.windowManager.getMainWindow();

    // --- Find Target Printer Name ---
    let targetPrinterName = null;
    try {
      const settings = this.settingsManager.loadSettings();
      targetPrinterName = payload?.deviceName || settings.preferredPrinterName;

      if (!targetPrinterName) {
        const printers =
          mainWindow && mainWindow.webContents
            ? await mainWindow.webContents.getPrintersAsync()
            : [];
        const POS58_VARIATIONS = [
          "POS58 Printer",
          "POS-58",
          "POS 58",
          "EP58M",
          "Generic / Text Only",
        ];
        const firstMatch = printers.find((p) =>
          POS58_VARIATIONS.some((v) =>
            (p.name || "").toLowerCase().includes(v.toLowerCase())
          )
        );
        if (firstMatch) {
          targetPrinterName = firstMatch.name;
          console.log(
            `[AUTO-PRINT] Auto-detected target printer: ${targetPrinterName}`
          );
          this.settingsManager.updateSettings({
            preferredPrinterName: targetPrinterName,
          });
        }
      }
    } catch (findErr) {
      console.warn(
        `[AUTO-PRINT] Could not determine target printer: ${findErr.message}`
      );
    }

    if (!targetPrinterName) {
      console.error(
        "[AUTO-PRINT] CRITICAL: No target printer could be determined. Aborting print."
      );
      return {
        success: false,
        message: "Tidak ada printer yang bisa ditemukan.",
      };
    }

    console.log(
      `[AUTO-PRINT] Determined target printer for all methods: ${targetPrinterName}`
    );

    // Step 1: Attempt Raw Text Print (Java-style) - HIGHEST PRIORITY
    console.log("[AUTO-PRINT] Step 1: Attempting Raw Text Print (Java-style)");
    try {
      const rawTextResult = await this.printManager.printRawText(
        payload,
        targetPrinterName
      );
      if (rawTextResult.success) {
        console.log(
          "[AUTO-PRINT] ✅ Raw Text Print succeeded:",
          rawTextResult.device
        );
        return { ...rawTextResult, step: 1, method: "raw-text" };
      }
      lastError = rawTextResult.message;
      console.warn("[AUTO-PRINT] ❌ Step 1 failed:", lastError);
    } catch (rawTextErr) {
      lastError = rawTextErr.message;
      console.warn("[AUTO-PRINT] ❌ Step 1 failed:", lastError);
    }

    // Step 2: Attempt performEscPosPrint with auto-detection (Serial Port)
    console.log(
      "[AUTO-PRINT] Step 2: Attempting ESC/POS serial with auto-detection"
    );
    try {
      const escPosResult = await this.printManager.performEscPosPrint(payload, {
        autoDetectAllowed: true,
      });
      if (escPosResult.success) {
        console.log(
          "[AUTO-PRINT] ✅ ESC/POS serial succeeded:",
          escPosResult.device
        );
        return { ...escPosResult, step: 2, method: "escpos-serial" };
      }
      lastError = escPosResult.message;
      console.warn("[AUTO-PRINT] ❌ Step 2 failed:", lastError);
    } catch (escErr) {
      lastError = escErr.message;
      console.warn("[AUTO-PRINT] ❌ Step 2 failed:", lastError);
    }

    // Step 3: Last resort HTML silent print
    console.warn(
      "[AUTO-PRINT] Step 3: All reliable methods failed, attempting HTML silent print as last resort"
    );
    try {
      const htmlResult = await this.handleHtmlFallbackPrint(
        payload,
        targetPrinterName
      );
      if (htmlResult.success) {
        console.warn(
          "[AUTO-PRINT] ⚠️ HTML fallback succeeded (may not be reliable)"
        );
        return {
          ...htmlResult,
          step: 3,
          method: "html-silent",
          warning: "Used HTML fallback - reliability not guaranteed",
        };
      }
      lastError = htmlResult.message || "HTML fallback failed";
    } catch (htmlErr) {
      lastError = htmlErr.message;
      console.warn(
        "[AUTO-PRINT][HTML] Last resort fallback failed:",
        lastError
      );
    }

    // If all methods failed
    console.error("[AUTO-PRINT] ❌ All printing methods failed.");
    return {
      success: false,
      message: `Semua metode cetak gagal. Kesalahan terakhir: ${lastError}`,
      attempted: ["raw-text", "escpos-serial", "html-fallback"],
    };
  }

  async handleHtmlFallbackPrint(payload, targetPrinterName) {
    const { formatIDR } = require("../utils/formatters");

    const items = Array.isArray(payload?.items) ? payload.items : [];
    const total = Number(payload?.total) || 0;
    const orderId = payload?.orderId || "";
    const dateStr = new Date().toLocaleString("id-ID");
    const businessName = payload?.businessName || "Florist Kiosk";
    const address = payload?.address || "";
    const notes = payload?.notes || "Terima kasih atas kunjungan Anda";

    const receiptHTML = `<!DOCTYPE html><html><head><meta charset="utf-8" /><style>@page { size: 58mm auto; margin: 3mm; } body { font-family: monospace; font-size: 12px; width: 58mm; } .center { text-align: center; } .row { display:flex; justify-content:space-between; } hr { border: none; border-top: 1px dashed #000; margin: 6px 0; } .tot { font-weight: bold; font-size: 13px; } </style></head><body><div class="center"><div style="font-weight:bold; font-size:14px;">${businessName}</div>${
      address ? `<div>${address}</div>` : ""
    }</div><hr /><div>ID: ${String(orderId).padStart(
      6,
      "0"
    )}<br/>${dateStr}</div><hr />${items
      .map((it) => {
        const name = (it.name || "Item").toString();
        const qty = Number(it.quantity) || 1;
        const price = Number(it.price) || 0;
        const sub = price * qty;
        return `<div><div>${name}</div><div class="row"><span>${qty} x ${formatIDR(
          price
        )}</span><span>${formatIDR(sub)}</span></div></div>`;
      })
      .join("")}<hr /><div class="row tot"><span>Total</span><span>${formatIDR(
      total
    )}</span></div><hr /><div class="center">${notes}</div></body></html>`;

    const printWin = this.windowManager.createPrintWindow();
    await printWin.loadURL(
      "data:text/html;charset=utf-8," + encodeURIComponent(receiptHTML)
    );

    console.log(
      "[AUTO-PRINT][HTML] Last resort printing to:",
      targetPrinterName
    );

    const didPrint = await new Promise((resolve) => {
      const printCallback = (success, failureReason) => {
        console.log(
          `[AUTO-PRINT][HTML] Print callback received. Success: ${success}, Reason: ${
            failureReason || "N/A"
          }`
        );
        resolve(success);
      };
      printWin.webContents.print(
        { silent: true, deviceName: targetPrinterName, printBackground: false },
        printCallback
      );
    });

    setTimeout(() => {
      if (!printWin.isDestroyed()) printWin.close();
    }, 200);

    return {
      success: didPrint,
      device: targetPrinterName,
      mode: "html-fallback",
    };
  }

  async handleRegularPrint(payload) {
    // Implementation dari original print-receipt handler
    // Simplified version for demonstration
    console.log("[PRINT-RECEIPT] Handler called with payload:", payload);

    // This would contain the full implementation from the original main.js
    // For brevity, returning a placeholder
    return {
      success: false,
      message: "Regular print not yet implemented in refactor",
    };
  }

  async handleManualPrint(payload) {
    // Implementation dari original print-receipt-manual handler
    console.log(
      "[PRINT-RECEIPT-MANUAL] Handler called for EP58M with payload:",
      payload
    );

    // This would contain the full implementation from the original main.js
    // For brevity, returning a placeholder
    return {
      success: false,
      message: "Manual print not yet implemented in refactor",
    };
  }

  setupSerialPortHandlers() {
    ipcMain.handle("list-serial-ports", async () => {
      return await this.serialPortManager.listSerialPorts();
    });

    ipcMain.handle("get-preferred-serial-port", async () => {
      return await this.serialPortManager.getPreferredSerialPort();
    });

    ipcMain.handle(
      "set-preferred-serial-port",
      async (e, portPath, baudRate) => {
        const success = this.serialPortManager.setPreferredSerialPort(
          portPath,
          baudRate
        );
        return { success };
      }
    );
  }

  setupSettingsHandlers() {
    ipcMain.handle("get-preferred-printer", async () => {
      return this.settingsManager.getSetting("preferredPrinterName");
    });

    ipcMain.handle("set-preferred-printer", async (e, name) => {
      const success = this.settingsManager.setSetting(
        "preferredPrinterName",
        name
      );
      return { success };
    });

    ipcMain.handle("get-print-modes", async () => {
      const settings = this.settingsManager.loadSettings();
      return {
        preferEscPos: !!settings.preferEscPos,
        preferEscPosEvenOnSuccess: !!settings.preferEscPosEvenOnSuccess,
        preferDirectUsbForPOS58: !!settings.preferDirectUsbForPOS58,
      };
    });

    ipcMain.handle("set-print-modes", async (e, modes) => {
      const updates = {};
      if (typeof modes?.preferEscPos === "boolean") {
        updates.preferEscPos = modes.preferEscPos;
      }
      if (typeof modes?.preferEscPosEvenOnSuccess === "boolean") {
        updates.preferEscPosEvenOnSuccess = modes.preferEscPosEvenOnSuccess;
      }
      if (typeof modes?.preferDirectUsbForPOS58 === "boolean") {
        updates.preferDirectUsbForPOS58 = modes.preferDirectUsbForPOS58;
      }

      const success = this.settingsManager.updateSettings(updates);
      return { success };
    });
  }

  setupImageHandlers() {
    // Image saving (local file uploads from admin panel)
    console.log("[IPC-DBG] Registering save-image handler");
    ipcMain.handle("save-image", async (e, payload) => {
      try {
        if (!payload || !payload.fileName || !payload.dataUrl) {
          throw new Error("Invalid image payload");
        }
        const { fileName, dataUrl } = payload;
        // Extract base64
        const match = /^data:(image\/[^;]+);base64,(.+)$/.exec(dataUrl);
        if (!match) throw new Error("Data URL tidak valid");
        const ext = (path.extname(fileName) || ".png").toLowerCase();
        const safeBase = fileName
          .replace(/[^a-zA-Z0-9-_\.]/g, "_")
          .replace(/\.+/g, (m) => m.slice(0, 1));
        const finalName = `${Date.now()}-${safeBase}`.replace(/_{2,}/g, "_");
        const uploadsDir = path.join(
          __dirname,
          "..",
          "..",
          "renderer",
          "uploads"
        );
        if (!fs.existsSync(uploadsDir))
          fs.mkdirSync(uploadsDir, { recursive: true });
        const finalPath = path.join(
          uploadsDir,
          finalName.endsWith(ext) ? finalName : finalName + ext
        );
        const buffer = Buffer.from(match[2], "base64");
        fs.writeFileSync(finalPath, buffer);
        console.log("[DBG save-image] saved file", {
          fileName,
          finalPath,
          size: buffer.length,
        });
        // Return path relative to renderer HTML (renderer/ is CWD for those files)
        // Since index/admin HTML live in renderer/, relative path for <img src> should be 'uploads/filename'
        return {
          success: true,
          relativePath: `uploads/${path.basename(finalPath)}`,
        };
      } catch (err) {
        console.error("Error saving image", err);
        return { success: false, message: err.message };
      }
    });
    console.log("[IPC-DBG] save-image handler registered");
  }

  setupDiagnosticHandlers() {
    ipcMain.handle("printer-diagnostic", async () => {
      try {
        const mainWindow = this.windowManager.getMainWindow();
        const diagnostic = {
          timestamp: new Date().toISOString(),
          modules: {
            serialport: !!this.serialPortManager.SerialPort,
            escPosEncoder: !!this.printManager.EscPosEncoder,
            printer: !!this.printManager.printer,
          },
          printers: [],
          serialPorts: [],
          detectedPOS58: null,
          autoDetectedSerial: null,
          settings: this.settingsManager.loadSettings(),
          printingCapabilities: {
            escPosSerial: false,
            directUsb: false,
            windowsSpooler: false,
            htmlFallback: true,
          },
        };

        // Test module availability
        diagnostic.printingCapabilities.escPosSerial = !!(
          this.serialPortManager.SerialPort && this.printManager.EscPosEncoder
        );

        try {
          const lib = require("node-thermal-printer");
          diagnostic.printingCapabilities.directUsb = !!(
            lib.printer || lib.ThermalPrinter
          );
          diagnostic.modules.nodeThermalPrinter = true;
        } catch (e) {
          diagnostic.modules.nodeThermalPrinter = false;
          diagnostic.modules.nodeThermalPrinterError = e.message;
        }

        diagnostic.printingCapabilities.windowsSpooler =
          diagnostic.printingCapabilities.escPosSerial; // Uses HTML + EscPosEncoder

        // Get installed printers using Electron's API
        if (mainWindow && mainWindow.webContents) {
          try {
            diagnostic.printers = await this.printManager.listPrintersRobust(
              mainWindow.webContents,
              null
            );
            diagnostic.detectedPOS58 =
              await this.printManager.detectPOS58Printer(mainWindow);
          } catch (e) {
            diagnostic.printerError = e.message;
          }
        } else {
          diagnostic.printerError = "Main window not available";
        }

        // Get serial ports and test auto-detection
        if (this.serialPortManager.SerialPort) {
          try {
            const portsResult = await this.serialPortManager.listSerialPorts();
            if (portsResult.success) {
              diagnostic.serialPorts = portsResult.ports;

              // Test auto-detection
              try {
                diagnostic.autoDetectedSerial =
                  await this.serialPortManager.autoDetectSerialPort();
              } catch (autoDetectError) {
                diagnostic.autoDetectError = autoDetectError.message;
              }
            }
          } catch (e) {
            diagnostic.serialError = e.message;
          }
        }

        // Add recommendations
        diagnostic.recommendations = [];

        if (!diagnostic.modules.serialport) {
          diagnostic.recommendations.push(
            "Install 'serialport' module for ESC/POS serial printing"
          );
        }
        if (!diagnostic.modules.escPosEncoder) {
          diagnostic.recommendations.push(
            "Install 'esc-pos-encoder' module for ESC/POS commands"
          );
        }
        if (!diagnostic.modules.nodeThermalPrinter) {
          diagnostic.recommendations.push(
            "Install 'node-thermal-printer' module for direct USB printing"
          );
        }
        if (
          !diagnostic.settings.preferredSerialPort &&
          !diagnostic.autoDetectedSerial
        ) {
          diagnostic.recommendations.push(
            "Configure serial port or ensure thermal printer is connected via USB"
          );
        }
        if (!diagnostic.detectedPOS58 && diagnostic.printers.length === 0) {
          diagnostic.recommendations.push(
            "Install thermal printer drivers and ensure printer is connected"
          );
        }
        if (diagnostic.serialPorts.length === 0) {
          diagnostic.recommendations.push(
            "Check USB connections and install USB-to-serial drivers if needed"
          );
        }

        return { success: true, diagnostic };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
  }
}

module.exports = IPCHandlers;
