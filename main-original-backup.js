const { app, BrowserWindow, ipcMain, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const DatabaseHelper = require("./db/database");
let SerialPort, EscPosEncoder, printer;
try {
  SerialPort = require("serialport");
  console.log(
    "[DEBUG] SerialPort loaded, available properties:",
    Object.keys(SerialPort || {})
  );
  console.log(
    "[DEBUG] SerialPort.SerialPort exists:",
    !!SerialPort?.SerialPort
  );
  console.log("[DEBUG] SerialPort.list exists:", !!SerialPort?.list);
} catch (e) {
  console.warn("[DEBUG] Failed to load serialport:", e?.message);
}
try {
  EscPosEncoder = require("esc-pos-encoder");
  console.log("[DEBUG] EscPosEncoder loaded:", !!EscPosEncoder);
} catch (e) {
  console.warn("[DEBUG] Failed to load esc-pos-encoder:", e?.message);
}
try {
  printer = require("printer");
  console.log("[DEBUG] Printer module loaded:", !!printer);
} catch (e) {
  console.warn(
    "[DEBUG] Printer module not available (this is OK):",
    e?.message
  );
  printer = null;
}

console.log("[MAIN] JS Florist main.js loaded (debug stamp v-cat-1)");

// Currency formatter used across printing flows
function formatIDR(n) {
  const num = Number(n) || 0;
  try {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  } catch (_) {
    return `Rp${num.toLocaleString("id-ID")}`;
  }
}

// Helper function untuk auto-detect dan set serial port untuk EP58M
async function autoDetectSerialPort() {
  console.log("[AUTO-DETECT] Scanning for POS58ENG thermal printer ports...");
  console.log(
    "[AUTO-DETECT] Looking for USB009 and other thermal printer ports"
  );

  try {
    if (!SerialPort?.SerialPort && !SerialPort) {
      console.log("[AUTO-DETECT] SerialPort not available");
      return null;
    }

    const listFn =
      (SerialPort?.SerialPort && SerialPort.SerialPort.list) ||
      SerialPort?.list;
    if (!listFn) {
      console.log(
        "[AUTO-DETECT] SerialPort list() not available in this version"
      );
      return null;
    }
    const ports = await listFn();
    console.log("[AUTO-DETECT] Found", ports?.length || 0, "serial ports");

    if (!ports || ports.length === 0) {
      console.log("[AUTO-DETECT] No serial ports detected");
      return null;
    }

    // Aggressive detection for thermal printers and USB serial ports
    const validPorts = ports.filter((port) => {
      const friendlyName = (port.friendlyName || "").toLowerCase();
      const path = (port.path || "").toLowerCase();
      const manufacturer = (port.manufacturer || "").toLowerCase();
      const vendorId = (port.vendorId || "").toLowerCase();
      const productId = (port.productId || "").toLowerCase();

      console.log(
        `[AUTO-DETECT] Checking port: ${port.path} - ${port.friendlyName} (VID: ${port.vendorId}, PID: ${port.productId})`
      );

      // Skip Bluetooth ports
      if (
        friendlyName.includes("bluetooth") ||
        friendlyName.includes("rfcomm")
      ) {
        console.log("[AUTO-DETECT] Skipping Bluetooth:", port.path);
        return false;
      }

      // Priority 1: Specific USB009 or similar patterns in path
      if (
        path.includes("usb009") ||
        path.includes("ttyusb") ||
        (path.match(/com\d+/) && friendlyName.includes("usb"))
      ) {
        console.log(
          "[AUTO-DETECT] ⭐⭐⭐ Found USB serial pattern:",
          port.path,
          "-",
          port.friendlyName
        );
        return true;
      }

      // Priority 2: Look for POS58ENG specifically
      if (
        friendlyName.includes("pos58") ||
        friendlyName.includes("pos 58") ||
        friendlyName.includes("ep58") ||
        friendlyName.includes("pos-58")
      ) {
        console.log(
          "[AUTO-DETECT] ⭐⭐ Found POS58ENG:",
          port.path,
          "-",
          port.friendlyName
        );
        return true;
      }

      // Priority 3: USB Serial devices with thermal printer indicators
      const usbSerialIndicators = [
        "usb serial",
        "usb-serial",
        "ftdi",
        "ch340",
        "cp210x",
        "pl2303",
      ];
      for (const indicator of usbSerialIndicators) {
        if (
          friendlyName.includes(indicator) ||
          manufacturer.includes(indicator)
        ) {
          console.log(
            "[AUTO-DETECT] ⭐⭐ Found USB Serial device:",
            port.path,
            "-",
            port.friendlyName
          );
          return true;
        }
      }

      // Priority 4: Generic USB ports that might be thermal printers
      if (path.includes("usb") || friendlyName.includes("usb")) {
        console.log(
          "[AUTO-DETECT] ⭐ Found USB port:",
          port.path,
          "-",
          port.friendlyName
        );
        return true;
      }

      // Priority 5: Thermal printer indicators
      const thermalIndicators = [
        "thermal",
        "epson",
        "printer",
        "pos",
        "receipt",
        "dot matrix",
        "line printing",
      ];
      for (const indicator of thermalIndicators) {
        if (
          friendlyName.includes(indicator) ||
          manufacturer.includes(indicator)
        ) {
          console.log(
            "[AUTO-DETECT] ⭐ Found thermal printer:",
            port.path,
            "-",
            port.friendlyName
          );
          return true;
        }
      }

      // Priority 6: Standard COM ports (COM1-COM9, excluding known Bluetooth COM ports)
      if (path.match(/^com[1-9]$/) && !friendlyName.includes("bluetooth")) {
        console.log("[AUTO-DETECT] Including standard COM port:", port.path);
        return true;
      }

      // Priority 7: Any /dev/ttyUSB* or /dev/ttyACM* on Linux-like systems
      if (path.match(/^\/dev\/tty(usb|acm)\d+$/i)) {
        console.log("[AUTO-DETECT] Including Linux USB serial:", port.path);
        return true;
      }

      console.log("[AUTO-DETECT] Skipping:", port.path, "-", port.friendlyName);
      return false;
    });

    if (validPorts.length === 0) {
      console.log(
        "[AUTO-DETECT] No valid serial ports for thermal printer found"
      );
      console.log(
        "[AUTO-DETECT] Consider checking USB connections and drivers"
      );
      return null;
    }

    // Sort ports by priority (USB serial patterns first, then POS58, then others)
    validPorts.sort((a, b) => {
      const aPath = (a.path || "").toLowerCase();
      const bPath = (b.path || "").toLowerCase();
      const aName = (a.friendlyName || "").toLowerCase();
      const bName = (b.friendlyName || "").toLowerCase();

      // USB009 or ttyUSB patterns get highest priority
      if (
        (aPath.includes("usb009") || aPath.includes("ttyusb")) &&
        !(bPath.includes("usb009") || bPath.includes("ttyusb"))
      )
        return -1;
      if (
        (bPath.includes("usb009") || bPath.includes("ttyusb")) &&
        !(aPath.includes("usb009") || aPath.includes("ttyusb"))
      )
        return 1;

      // POS58 devices get second priority
      if (
        (aName.includes("pos58") || aName.includes("ep58")) &&
        !(bName.includes("pos58") || bName.includes("ep58"))
      )
        return -1;
      if (
        (bName.includes("pos58") || bName.includes("ep58")) &&
        !(aName.includes("pos58") || aName.includes("ep58"))
      )
        return 1;

      return 0;
    });

    // Test each valid port, starting with highest priority
    for (const port of validPorts) {
      console.log("[AUTO-DETECT] Testing port:", port.path);

      try {
        // Quick test - try to open and close port
        const SPClass = SerialPort?.SerialPort || SerialPort;
        const testPort = new SPClass(
          { path: port.path, baudRate: 9600 },
          (err) => {
            if (err) {
              console.log(
                "[AUTO-DETECT] Port test failed:",
                port.path,
                err.message
              );
              return;
            }
          }
        );

        await new Promise((resolve, reject) => {
          testPort.on("open", () => {
            console.log("[AUTO-DETECT] Port opened successfully:", port.path);
            testPort.close(() => {
              console.log("[AUTO-DETECT] Port closed successfully:", port.path);
              resolve();
            });
          });

          testPort.on("error", (err) => {
            console.log("[AUTO-DETECT] Port error:", port.path, err.message);
            try {
              testPort.close(() => {});
            } catch (_) {}
            reject(err);
          });

          // Timeout after 3 seconds (increased from 2)
          setTimeout(() => {
            console.log("[AUTO-DETECT] Port test timeout:", port.path);
            try {
              testPort.close(() => {});
            } catch (_) {}
            reject(new Error("Timeout"));
          }, 3000);
        });

        // If we reach here, port is working
        console.log("[AUTO-DETECT] ✅ Found working port:", port.path);
        return port.path;
      } catch (testError) {
        console.log(
          "[AUTO-DETECT] Port test failed:",
          port.path,
          testError.message
        );
        continue;
      }
    }

    // If no port worked, return first valid port as fallback
    if (validPorts.length > 0) {
      console.log(
        "[AUTO-DETECT] No ports responded, using highest priority port:",
        validPorts[0].path
      );
      return validPorts[0].path;
    }

    return null;
  } catch (error) {
    console.error("[AUTO-DETECT] Error during auto-detection:", error);
    return null;
  }
}

// Core ESC/POS print implementation used by multiple handlers
// Contract:
// - Input payload: { portPath?, baudRate?, items[], total, orderId, businessName, address, notes, width?, cut?, drawer? }
// - Auto-detects serial port if payload.portPath not provided AND settings.preferredSerialPort missing AND autoDetectAllowed flag is true
// - Returns { success: boolean, message?, device?, mode: 'escpos' }
async function performEscPosPrint(payload, { autoDetectAllowed = false } = {}) {
  try {
    if (!SerialPort?.SerialPort || !EscPosEncoder) {
      return {
        success: false,
        message:
          "Dependensi ESC/POS tidak tersedia. Install 'serialport' dan 'esc-pos-encoder'",
      };
    }

    const settings = loadSettings();
    let portPath = payload?.portPath || settings.preferredSerialPort || null;
    const baudRate = Number(
      payload?.baudRate || settings.serialBaudRate || 9600
    );

    if (!portPath && autoDetectAllowed) {
      console.log("[ESC/POS] No port configured, attempting auto-detect...");
      try {
        portPath = await autoDetectSerialPort();
        if (portPath) {
          const next = { ...settings, preferredSerialPort: portPath };
          saveSettings(next);
          console.log("[ESC/POS] Auto-detected and saved port:", portPath);
        }
      } catch (autoDetectError) {
        console.warn(
          "[ESC/POS] Auto-detection failed:",
          autoDetectError.message
        );
      }
    }

    if (!portPath) {
      return {
        success: false,
        message:
          "Port serial belum dikonfigurasi. Gunakan auto-detect atau konfigurasi manual.",
      };
    }

    // Formatting setup
    const width = Number(payload?.width || 32);
    const items = Array.isArray(payload?.items) ? payload.items : [];
    const total = Number(payload?.total) || 0;
    const orderId = payload?.orderId || "";
    const businessName = payload?.businessName || "JS Florist";
    const address = payload?.address || "";
    const notes = payload?.notes || "Terima kasih";
    const dateStr = new Date().toLocaleString("id-ID");

    const enc = new EscPosEncoder();
    enc
      .initialize()
      .codepage("cp437")
      .align("center")
      .bold(true)
      .line(businessName)
      .bold(false);
    if (address) enc.line(address);
    enc.align("left");
    enc.newline();
    if (orderId) enc.line(`ID: ${String(orderId).padStart(6, "0")}`);
    enc.line(dateStr);
    enc.newline();
    // Items
    for (const it of items) {
      const name = String(it?.name || "Item");
      const qty = Number(it?.quantity) || 1;
      const price = Number(it?.price) || 0;
      const sub = qty * price;
      enc.line(name);
      const left = `${qty} x ${formatIDR(price)}`;
      const right = `${formatIDR(sub)}`;
      enc.line(twoCols(left, right, width));
    }
    enc.newline();
    enc
      .bold(true)
      .line(twoCols("TOTAL", formatIDR(total), width))
      .bold(false);
    enc.newline();
    if (notes) enc.align("center").line(notes).align("left");
    enc.newline();
    if (payload?.drawer && typeof enc.pulse === "function") enc.pulse();
    if (payload?.cut !== false) enc.cut();

    const data = enc.encode();

    // Write to serial port with enhanced error handling
    await new Promise((resolve, reject) => {
      const SPClass = SerialPort.SerialPort;
      let sp;

      try {
        sp = new SPClass({ path: portPath, baudRate }, (err) => {
          if (err) {
            console.error(
              "[ESC/POS] Serial port connection error:",
              err.message
            );
            return reject(err);
          }
        });
      } catch (constructorError) {
        console.error(
          "[ESC/POS] Serial port constructor error:",
          constructorError.message
        );
        return reject(constructorError);
      }

      const cleanup = () => {
        try {
          if (sp && sp.isOpen) {
            sp.close(() => {});
          }
        } catch (_) {}
      };

      const timeout = setTimeout(() => {
        console.error("[ESC/POS] Serial port operation timeout");
        cleanup();
        reject(new Error("Serial port operation timeout"));
      }, 10000); // 10 second timeout

      sp.on("open", () => {
        console.log("[ESC/POS] Serial port opened successfully");
        sp.write(Buffer.from(data), (err) => {
          if (err) {
            console.error("[ESC/POS] Write error:", err.message);
            clearTimeout(timeout);
            cleanup();
            return reject(err);
          }
          console.log("[ESC/POS] Data written successfully");
          sp.drain((drainErr) => {
            clearTimeout(timeout);
            if (drainErr) {
              console.error("[ESC/POS] Drain error:", drainErr.message);
              cleanup();
              return reject(drainErr);
            }
            console.log("[ESC/POS] Data drained successfully");
            sp.close(() => {
              console.log("[ESC/POS] Serial port closed");
              resolve();
            });
          });
        });
      });

      sp.on("error", (err) => {
        console.error("[ESC/POS] Serial port error:", err.message);
        clearTimeout(timeout);
        cleanup();
        reject(err);
      });
    });

    return { success: true, device: portPath, mode: "escpos" };
  } catch (error) {
    console.warn("[ESC/POS] Print failed:", error?.message);
    return {
      success: false,
      message: `ESC/POS print error: ${error?.message}`,
      error: error?.code || "UNKNOWN",
    };
  }
}

// Ensure Chromium does silent printing without showing dialogs
try {
  // Some devices/driver combos behave better without GPU acceleration
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch("kiosk-printing");
  app.commandLine.appendSwitch("disable-print-preview");
  console.log(
    "[PRINT] Chromium switches enabled: kiosk-printing, disable-print-preview"
  );
} catch (e) {
  console.warn("[PRINT] Failed to set Chromium switches:", e?.message);
}

// Keep a global reference of the window object
let mainWindow;
let dbHelper;

// Simple persistent settings (stored in userData/settings.json)
function getSettingsPath() {
  try {
    return path.join(app.getPath("userData"), "settings.json");
  } catch (_) {
    // Fallback to app directory if userData not available for some reason
    return path.join(__dirname, "settings.json");
  }
}

function loadSettings() {
  try {
    const p = getSettingsPath();
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, "utf8");
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn("[SETTINGS] Failed to load settings:", e.message);
  }
  return {};
}

function saveSettings(next) {
  try {
    const p = getSettingsPath();
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(next, null, 2), "utf8");
    return true;
  } catch (e) {
    console.warn("[SETTINGS] Failed to save settings:", e.message);
    return false;
  }
}

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
    icon: path.join(__dirname, "assets/icon.png"),
    show: false,
  });

  // Load the index.html of the app
  mainWindow.loadFile("renderer/index.html");

  // Show window when ready to prevent visual flash
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  // Open DevTools in development
  if (process.argv.includes("--dev")) {
    mainWindow.webContents.openDevTools();
  }

  // Emitted when the window is closed
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Set application menu
  createMenu();
}

function createMenu() {
  const template = [
    {
      label: "File",
      submenu: [
        {
          label: "Katalog Produk",
          click: () => {
            mainWindow.loadFile("renderer/index.html");
          },
        },
        {
          label: "Keranjang",
          click: () => {
            mainWindow.loadFile("renderer/cart.html");
          },
        },
        {
          label: "Admin Login",
          click: () => {
            mainWindow.loadFile("renderer/admin-login.html");
          },
        },
        { type: "separator" },
        {
          label: "Keluar",
          accelerator: "CmdOrCtrl+Q",
          click: () => {
            app.quit();
          },
        },
      ],
    },
    {
      label: "View",
      submenu: [
        {
          label: "Reload",
          accelerator: "CmdOrCtrl+R",
          click: () => {
            mainWindow.reload();
          },
        },
        {
          label: "Toggle Developer Tools",
          accelerator: "F12",
          click: () => {
            mainWindow.webContents.toggleDevTools();
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Initialize database and seed data
async function initializeDatabase() {
  try {
    dbHelper = new DatabaseHelper();
    await dbHelper.initialize();

    // Seed initial products if database is empty
    const products = await dbHelper.getAllProducts();
    if (products.length === 0) {
      await seedProducts();
    }

    // Create default admin if not exists
    const defaultAdmin = await dbHelper.getAdminByUsername("admin");
    if (!defaultAdmin) {
      await dbHelper.createAdmin("admin", "admin123");
      console.log("Default admin created: username=admin, password=admin123");
    }

    console.log("Database initialized successfully");
  } catch (error) {
    console.error("Error initializing database:", error);
  }
}

// Seed initial products
async function seedProducts() {
  const initialProducts = [
    {
      name: "Buket Mawar Merah",
      price: 150000,
      image:
        "https://via.placeholder.com/300x200/ff6b6b/ffffff?text=Buket+Mawar",
      description:
        "Buket 12 mawar merah segar melambangkan cinta dan kasih sayang. Dikemas elegan dengan pita satin merah.",
    },
    {
      name: "Lili Putih Elegan",
      price: 120000,
      image:
        "https://via.placeholder.com/300x200/95a5a6/ffffff?text=Lili+Putih",
      description:
        "Rangkaian lili putih harum yang cocok untuk hadiah penuh ketulusan dan ketenangan.",
    },
    {
      name: "Tulip Kuning",
      price: 100000,
      image:
        "https://via.placeholder.com/300x200/f1c40f/ffffff?text=Tulip+Kuning",
      description:
        "Buket tulip kuning cerah melambangkan persahabatan, keceriaan, dan harapan baru.",
    },
    {
      name: "Buket Campuran",
      price: 200000,
      image:
        "https://via.placeholder.com/300x200/9b59b6/ffffff?text=Buket+Campuran",
      description:
        "Kombinasi bunga pilihan berbagai warna untuk setiap perayaan spesial Anda.",
    },
    {
      name: "Anggrek Ungu",
      price: 180000,
      image:
        "https://via.placeholder.com/300x200/8e44ad/ffffff?text=Anggrek+Ungu",
      description:
        "Pot anggrek ungu elegan yang tahan lama dan mewah sebagai dekorasi ruang.",
    },
    {
      name: "Sunflower Bouquet",
      price: 130000,
      image: "https://via.placeholder.com/300x200/f39c12/ffffff?text=Sunflower",
      description:
        "Buket bunga matahari ceria yang membawa energi positif dan semangat baru.",
    },
  ];

  for (const product of initialProducts) {
    await dbHelper.addProduct(
      product.name,
      product.price,
      product.image,
      product.description
    );
  }

  console.log("Initial products seeded successfully");
}

// IPC handlers for database operations
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

ipcMain.handle("checkout", async (event, totalAmount) => {
  try {
    // Get current cart items for sales tracking
    const cartItems = await dbHelper.getCartItems();
    const orderId = await dbHelper.checkoutWithSales(cartItems, totalAmount);
    return orderId;
  } catch (error) {
    console.error("Error during checkout:", error);
    return false;
  }
});

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
    const uploadsDir = path.join(__dirname, "renderer", "uploads");
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

console.log(
  "[IPC] Category & Occasion handlers registered: get/add/update/delete-category, get/add/update/delete-occasion"
);

// Printing helper: render a simple receipt HTML into an offscreen window and print
async function listPrintersRobust(preferredWebContents, fallbackWebContents) {
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 5; i++) {
    try {
      const wc = preferredWebContents || fallbackWebContents;
      if (!wc) break;
      let printers = [];
      if (typeof wc.getPrintersAsync === "function") {
        printers = await wc.getPrintersAsync();
      } else {
        printers = wc.getPrinters();
      }
      if (Array.isArray(printers) && printers.length) return printers;
    } catch (_) {}
    await delay(250);
  }
  // Try the other webContents if the first attempts failed
  for (let i = 0; i < 5; i++) {
    try {
      const wc = fallbackWebContents || preferredWebContents;
      if (!wc) break;
      let printers = [];
      if (typeof wc.getPrintersAsync === "function") {
        printers = await wc.getPrintersAsync();
      } else {
        printers = wc.getPrinters();
      }
      if (Array.isArray(printers) && printers.length) return printers;
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 250));
  }
  return [];
}

// Common IPC helpers used by preload exposures
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

ipcMain.handle("get-preferred-printer", async () => {
  const s = loadSettings();
  return s.preferredPrinterName || null;
});

ipcMain.handle("set-preferred-printer", async (e, name) => {
  const s = loadSettings();
  const next = { ...s, preferredPrinterName: name };
  saveSettings(next);
  return { success: true };
});

ipcMain.handle("list-serial-ports", async () => {
  try {
    if (!SerialPort?.SerialPort)
      return {
        success: false,
        message: "serialport tidak tersedia",
        ports: [],
      };
    const ports = await SerialPort.SerialPort.list();
    return { success: true, ports };
  } catch (e) {
    console.warn("[IPC list-serial-ports]", e?.message);
    return { success: false, message: e?.message, ports: [] };
  }
});

ipcMain.handle("get-preferred-serial-port", async () => {
  const s = loadSettings();
  let portPath = s.preferredSerialPort || null;
  const baudRate = s.serialBaudRate || 9600;

  // If no preferred port is set, attempt auto-detection once and save result
  if (!portPath) {
    console.log(
      "[GET-PREFERRED] No preferred serial port set, attempting auto-detection"
    );
    try {
      const detectedPort = await autoDetectSerialPort();
      if (detectedPort) {
        console.log(
          "[GET-PREFERRED] Auto-detected port:",
          detectedPort,
          "- saving as preferred"
        );
        const updatedSettings = { ...s, preferredSerialPort: detectedPort };
        saveSettings(updatedSettings);
        portPath = detectedPort;
      } else {
        console.log(
          "[GET-PREFERRED] Auto-detection failed, no suitable port found"
        );
      }
    } catch (error) {
      console.warn("[GET-PREFERRED] Auto-detection error:", error.message);
    }
  }

  return {
    portPath,
    baudRate,
    autoDetected: !s.preferredSerialPort && !!portPath,
  };
});

ipcMain.handle("set-preferred-serial-port", async (e, portPath, baudRate) => {
  const s = loadSettings();
  const next = {
    ...s,
    preferredSerialPort: portPath,
    serialBaudRate: Number(baudRate) || 9600,
  };
  saveSettings(next);
  return { success: true };
});

ipcMain.handle("get-print-modes", async () => {
  const s = loadSettings();
  return {
    preferEscPos: !!s.preferEscPos,
    preferEscPosEvenOnSuccess: !!s.preferEscPosEvenOnSuccess,
    preferDirectUsbForPOS58: !!s.preferDirectUsbForPOS58,
  };
});

ipcMain.handle("set-print-modes", async (e, modes) => {
  const s = loadSettings();
  const next = {
    ...s,
    ...(typeof modes?.preferEscPos === "boolean"
      ? { preferEscPos: modes.preferEscPos }
      : {}),
    ...(typeof modes?.preferEscPosEvenOnSuccess === "boolean"
      ? { preferEscPosEvenOnSuccess: modes.preferEscPosEvenOnSuccess }
      : {}),
    ...(typeof modes?.preferDirectUsbForPOS58 === "boolean"
      ? { preferDirectUsbForPOS58: modes.preferDirectUsbForPOS58 }
      : {}),
  };
  saveSettings(next);
  return { success: true };
});

ipcMain.handle("print-escpos", async (e, payload) => {
  const res = await performEscPosPrint(payload, { autoDetectAllowed: false });
  return res;
});

// Helper for centering text for raw printing
function centerText(text, width = 32) {
  if (!text) return "";
  const padSize = Math.floor((width - text.length) / 2);
  if (padSize <= 0) return text;
  return " ".repeat(padSize) + text;
}

// Helper for two-column layout for raw printing
function twoColsText(left, right, width = 32) {
  const space = width - left.length - right.length;
  if (space <= 0) return `${left}${right}`;
  return `${left}${" ".repeat(space)}${right}`;
}

// New function inspired by ThermalPrinter.java to send raw text
async function printRawText(payload, printerName) {
  console.log(`[RAW-TEXT] Attempting to print raw text to: ${printerName}`);
  if (!printer) {
    return { success: false, message: "Modul 'printer' tidak tersedia." };
  }

  try {
    // Build the plain text receipt
    const width = 32;
    const items = Array.isArray(payload?.items) ? payload.items : [];
    const total = Number(payload?.total) || 0;
    const orderId = payload?.orderId || "";
    const businessName = payload?.businessName || "JS Florist";
    const address = payload?.address || "";
    const notes = payload?.notes || "Terima kasih";
    const dateStr = new Date().toLocaleString("id-ID");
    const separator = "-".repeat(width) + "\n";

    let receiptText = "";
    receiptText += centerText(businessName, width) + "\n";
    if (address) receiptText += centerText(address, width) + "\n";
    receiptText += separator;
    if (orderId) receiptText += `ID: ${String(orderId).padStart(6, "0")}\n`;
    receiptText += `${dateStr}\n`;
    receiptText += separator;

    for (const it of items) {
      const name = String(it?.name || "Item");
      const qty = Number(it?.quantity) || 1;
      const price = Number(it?.price) || 0;
      const sub = qty * price;

      receiptText += `${name}\n`;
      const left = `${qty} x ${formatIDR(price)}`;
      const right = `${formatIDR(sub)}`;
      receiptText += twoColsText(left, right, width) + "\n";
    }
    receiptText += separator;
    receiptText += twoColsText("TOTAL", formatIDR(total), width) + "\n";
    receiptText += separator;
    receiptText += "\n";
    receiptText += centerText(notes, width) + "\n";
    receiptText += "\n\n\n\n"; // Feed for cutting

    // Send to printer
    const printResult = await new Promise((resolve, reject) => {
      printer.printDirect({
        data: receiptText,
        printer: printerName,
        type: "RAW",
        success: (jobId) => {
          console.log(`[RAW-TEXT] Sent to printer with job ID: ${jobId}`);
          resolve({ success: true, jobId });
        },
        error: (err) => {
          console.error("[RAW-TEXT] Printing error:", err);
          reject(err);
        },
      });
    });

    if (printResult.success) {
      return { success: true, device: printerName, mode: "raw-text" };
    } else {
      throw new Error("printDirect reported failure");
    }
  } catch (error) {
    console.error(`[RAW-TEXT] Failed to print: ${error.message}`);
    return { success: false, message: error.message };
  }
}

// New: automatic checkout printing that prioritizes ESC/POS and auto-detects port
ipcMain.handle("print-receipt-auto", async (e, payload) => {
  console.log(
    "[AUTO-PRINT] Starting automatic printing with fallback chain v2"
  );
  console.log("[AUTO-PRINT] Payload:", {
    orderId: payload?.orderId,
    total: payload?.total,
  });

  let lastError = "No methods succeeded.";

  // --- Find Target Printer Name ---
  let targetPrinterName = null;
  try {
    const s = loadSettings();
    targetPrinterName = payload?.deviceName || s.preferredPrinterName;

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
        saveSettings({ ...s, preferredPrinterName: targetPrinterName });
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
    const rawTextResult = await printRawText(payload, targetPrinterName);
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
    const escPosResult = await performEscPosPrint(payload, {
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
    const items = Array.isArray(payload?.items) ? payload.items : [];
    const total = Number(payload?.total) || 0;
    const orderId = payload?.orderId || "";
    const dateStr = new Date().toLocaleString("id-ID");
    const businessName = payload?.businessName || "JS Florist";
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

    const printWin = new BrowserWindow({ show: false });
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
        if (!success) lastError = failureReason || "HTML print failed";
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

    if (didPrint) {
      console.warn(
        "[AUTO-PRINT] ⚠️ HTML fallback succeeded (may not be reliable)"
      );
      return {
        success: true,
        device: targetPrinterName,
        mode: "html-fallback",
        step: 3,
        method: "html-silent",
        warning: "Used HTML fallback - reliability not guaranteed",
      };
    }
  } catch (htmlErr) {
    lastError = htmlErr.message;
    console.warn("[AUTO-PRINT][HTML] Last resort fallback failed:", lastError);
  }

  // If all methods failed
  console.error("[AUTO-PRINT] ❌ All printing methods failed.");
  return {
    success: false,
    message: `Semua metode cetak gagal. Kesalahan terakhir: ${lastError}`,
    attempted: ["raw-text", "escpos-serial", "html-fallback"],
  };
});

ipcMain.handle("print-receipt", async (e, payload) => {
  console.log("[PRINT-RECEIPT] Handler called with payload:", payload);

  try {
    const items = Array.isArray(payload?.items) ? payload.items : [];
    const total = Number(payload?.total) || 0;
    const orderId = payload?.orderId || "";
    const dateStr = new Date().toLocaleString("id-ID");
    const businessName = payload?.businessName || "JS Florist";
    const address = payload?.address || "";
    const notes = payload?.notes || "Terima kasih atas kunjungan Anda";
    const explicitDevice = payload?.deviceName || null;
    const requestedMode = (payload?.printMode || "auto").toLowerCase(); // 'auto' | 'html' | 'escpos' | 'direct-usb'

    // EP58M Fix: Add hybrid and force dialog options
    const hybridMode = !!payload?.hybridMode; // Try silent first, fallback to dialog
    const forceDialog = !!payload?.forceDialog; // Always show dialog
    const useManualSettings = !!payload?.useManualSettings; // Use manual print settings
    const forceDirectUsb = !!payload?.forceDirectUsb; // Force direct USB path

    console.log(
      "[PRINT-RECEIPT] Processing print for order:",
      orderId,
      "total:",
      total,
      "| Mode:",
      requestedMode,
      "| Hybrid:",
      hybridMode,
      "| ForceDialog:",
      forceDialog,
      "| ManualSettings:",
      useManualSettings
    );

    console.log("[PRINT-RECEIPT] Creating receipt HTML...");
    // Common variations of POS58 printer names
    const POS58_VARIATIONS = [
      "POS58 Printer",
      "POS-58",
      "POS 58",
      "EP58M",
      "EPPOS",
      "Thermal Dot Line Printing",
      "USB Thermal Printer",
      "Generic / Text Only",
    ];
    const DEFAULT_PRINTER_NAME = "POS58 Printer"; // align with actual device name

    // Minimal thermal-friendly HTML (use monospace, small sizes)
    const receiptHTML = `<!DOCTYPE html><html><head><meta charset="utf-8" />
      <style>
        /* 58mm thermal paper */
        @page { size: 58mm auto; margin: 3mm; }
        body { font-family: monospace; font-size: 12px; width: 58mm; }
        .center { text-align: center; }
        .row { display:flex; justify-content:space-between; }
        hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
        .tot { font-weight: bold; font-size: 13px; }
      </style>
    </head><body>
      <div class="center">
        <div style="font-weight:bold; font-size:14px;">${businessName}</div>
        ${address ? `<div>${address}</div>` : ""}
      </div>
      <hr />
      <div>ID: ${String(orderId).padStart(6, "0")}<br/>${dateStr}</div>
      <hr />
      ${items
        .map((it) => {
          const name = (it.name || "Item").toString();
          const qty = Number(it.quantity) || 1;
          const price = Number(it.price) || 0;
          const sub = price * qty;
          return `<div>
              <div>${name}</div>
              <div class="row"><span>${qty} x ${formatIDR(
            price
          )}</span><span>${formatIDR(sub)}</span></div>
            </div>`;
        })
        .join("")}
      <hr />
      <div class="row tot"><span>Total</span><span>${formatIDR(
        total
      )}</span></div>
      <hr />
      <div class="center">${notes}</div>
    </body></html>`;

    // Helper: send ESC/POS directly via serial
    const sendEscPosSerial = async () => {
      const settings2 = loadSettings();
      const preferredPort = settings2.preferredSerialPort || null;
      const baud = settings2.serialBaudRate || 9600;
      if (!SerialPort?.SerialPort || !EscPosEncoder) {
        throw new Error(
          "Dependensi ESC/POS belum terpasang (serialport/esc-pos-encoder)"
        );
      }
      if (!preferredPort) {
        throw new Error(
          "Port serial belum disetel. Set dengan setPreferredSerialPort(COMx)"
        );
      }

      const enc = new EscPosEncoder();
      enc
        .initialize()
        .codepage("cp437")
        .align("center")
        .bold(true)
        .line(businessName)
        .bold(false);
      if (address) enc.line(address);
      enc.newline().align("left");
      enc.line(`ID: ${String(orderId).padStart(6, "0")}`);
      enc.line(dateStr);
      enc.newline();
      for (const it of items) {
        const name = String(it.name || "Item");
        const qty = Number(it.quantity) || 1;
        const price = Number(it.price) || 0;
        const sub = qty * price;
        enc.line(name);
        const left = `${qty} x ${formatIDR(price)}`;
        const right = `${formatIDR(sub)}`;
        enc.line(twoCols(left, right, 32));
      }
      enc.newline().bold(true);
      enc.line(twoCols("Total", formatIDR(total), 32));
      enc.bold(false).newline();
      if (notes) enc.align("center").line(notes).align("left");
      enc.newline().cut();

      const data = enc.encode();
      await new Promise((resolve, reject) => {
        const sp = new SerialPort.SerialPort(
          { path: preferredPort, baudRate: baud },
          (err) => {
            if (err) return reject(err);
          }
        );
        sp.on("open", () => {
          sp.write(Buffer.from(data), (err) => {
            if (err) {
              sp.close(() => reject(err));
            } else {
              sp.drain(() => {
                sp.close(() => resolve());
              });
            }
          });
        });
        sp.on("error", (err) => {
          try {
            sp.close(() => {});
          } catch (_) {}
          reject(err);
        });
      });
      return { success: true, mode: "escpos", device: preferredPort };
    };

    // Prefer ESC/POS first based on settings or explicit request
    const settings0 = loadSettings();
    const preferEscPos = !!settings0.preferEscPos;
    const preferDirectUsbForPOS58 = !!settings0.preferDirectUsbForPOS58;
    if (requestedMode === "escpos" || preferEscPos || preferDirectUsbForPOS58) {
      console.log("[PRINT-RECEIPT] Preferring ESC/POS first");
      // attempt ESC/POS with configured port (no auto-detect here; caller can use print-receipt-auto)
      const escRes = await performEscPosPrint(
        {
          ...payload,
          width: 32,
          cut: true,
        },
        { autoDetectAllowed: false }
      );
      if (escRes.success) return escRes;
      console.warn(
        "[PRINT-RECEIPT] ESC/POS first attempt failed:",
        escRes.message
      );
      // continue to HTML fallback below
    }

    console.log("[PRINT-RECEIPT] Creating hidden print window...");
    // Create a hidden window for printing
    const printWin = new BrowserWindow({
      width: 300,
      height: 600,
      show: false,
      webPreferences: { offscreen: false, backgroundThrottling: false },
    });

    console.log("[PRINT-RECEIPT] Loading HTML content...");

    try {
      // Attach verbose listeners to diagnose hangs
      const wc = printWin.webContents;
      const cleanup = [];
      cleanup.push(() => wc.removeAllListeners("did-finish-load"));
      cleanup.push(() => wc.removeAllListeners("did-fail-load"));
      cleanup.push(() => wc.removeAllListeners("console-message"));
      cleanup.push(() => wc.removeAllListeners("render-process-gone"));
      cleanup.push(() => wc.removeAllListeners("dom-ready"));
      let didFinishOnce = false;
      let domReadyOnce = false;
      wc.on("did-finish-load", () => {
        didFinishOnce = true;
        console.log("[PRINT-RECEIPT] did-finish-load");
      });
      wc.on("dom-ready", () => {
        domReadyOnce = true;
        console.log("[PRINT-RECEIPT] dom-ready");
      });
      wc.on("did-fail-load", (e, code, desc, url, isMainFrame) =>
        console.warn("[PRINT-RECEIPT] did-fail-load", {
          code,
          desc,
          url,
          isMainFrame,
        })
      );
      wc.on("console-message", (event, level, message, line, sourceId) =>
        console.log("[PRINT-RECEIPT][console]", {
          level,
          message,
          line,
          sourceId,
        })
      );
      wc.on("render-process-gone", (event, details) =>
        console.warn("[PRINT-RECEIPT] render-process-gone", details)
      );

      // Use loadURL with timeout
      await Promise.race([
        printWin.loadURL(
          "data:text/html;charset=utf-8," + encodeURIComponent(receiptHTML)
        ),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("loadURL timeout")), 7000)
        ),
      ]);

      console.log("[PRINT-RECEIPT] loadURL completed");

      // Non-blocking wait: proceed if already ready or after short timeout
      await new Promise((resolve) => {
        const proceed = () => {
          console.log("[PRINT-RECEIPT] Proceeding to print phase");
          resolve();
        };
        if (
          didFinishOnce ||
          domReadyOnce ||
          !printWin.webContents.isLoading()
        ) {
          proceed();
        } else {
          console.log(
            "[PRINT-RECEIPT] Waiting for content to finish loading..."
          );
          let settled = false;
          const t = setTimeout(() => {
            if (!settled) {
              settled = true;
              console.log("[PRINT-RECEIPT] Load wait timeout; continuing");
              proceed();
            }
          }, 800);
          wc.once("did-finish-load", () => {
            if (!settled) {
              settled = true;
              clearTimeout(t);
              console.log("[PRINT-RECEIPT] HTML content loaded via event");
              proceed();
            }
          });
          wc.once("dom-ready", () => {
            if (!settled) {
              settled = true;
              clearTimeout(t);
              console.log("[PRINT-RECEIPT] DOM ready event");
              proceed();
            }
          });
        }
      });

      // Cleanup listeners
      cleanup.forEach((fn) => {
        try {
          fn();
        } catch (_) {}
      });
    } catch (loadError) {
      console.log(
        "[PRINT-RECEIPT] loadURL failed, trying alternative method:",
        loadError.message
      );

      // Alternative: use setContent
      try {
        await printWin.webContents.setContent(receiptHTML);
        console.log("[PRINT-RECEIPT] Used setContent as fallback");
      } catch (err2) {
        console.warn("[PRINT-RECEIPT] setContent also failed:", err2?.message);
        // Last resort: write temp file and loadFile
        const tmpPath = path.join(
          app.getPath("temp"),
          `receipt-${Date.now()}.html`
        );
        fs.writeFileSync(tmpPath, receiptHTML, "utf8");
        await printWin.loadFile(tmpPath);
        console.log("[PRINT-RECEIPT] Loaded from temp file:", tmpPath);
      }

      // Small delay to ensure content is ready
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    console.log("[PRINT-RECEIPT] Getting printer list...");

    // Select printer
    const printers = await listPrintersRobust(
      (mainWindow && mainWindow.webContents) || null,
      printWin.webContents
    );
    console.log("[PRINT-RECEIPT] Available printers:", printers?.length || 0);
    for (const p of printers) {
      console.log(`  - ${p.name}${p.isDefault ? " (default)" : ""}`);
    }
    const settings = loadSettings();
    const preferredName =
      explicitDevice || settings.preferredPrinterName || DEFAULT_PRINTER_NAME;

    console.log("[PRINT-RECEIPT] Preferred printer name:", preferredName);

    // Resolve final device name strictly to avoid dialog
    // Try exact match first, then case-insensitive, then substring contains, then check variations
    const exact = printers.find(
      (p) => p.name === preferredName || p.displayName === preferredName
    );
    const ci =
      exact ||
      printers.find(
        (p) =>
          (p.name && p.name.toLowerCase() === preferredName.toLowerCase()) ||
          (p.displayName &&
            p.displayName.toLowerCase() === preferredName.toLowerCase())
      );
    const fuzzy =
      ci ||
      printers.find(
        (p) =>
          (p.name &&
            preferredName &&
            p.name.toLowerCase().includes(preferredName.toLowerCase())) ||
          (p.displayName &&
            preferredName &&
            p.displayName.toLowerCase().includes(preferredName.toLowerCase()))
      );

    // Try POS58 variations if no match found
    const pos58Fallback =
      fuzzy ||
      printers.find((p) =>
        POS58_VARIATIONS.some(
          (variation) =>
            p.name.toLowerCase().includes(variation.toLowerCase()) ||
            (p.displayName &&
              p.displayName.toLowerCase().includes(variation.toLowerCase()))
        )
      );

    const target = pos58Fallback || null;
    // Use the resolved printer name if found, otherwise omit deviceName to use system default
    const finalDeviceName = target ? target.name : undefined;
    console.log(
      "[PRINT] Preferred:",
      preferredName,
      "| Using:",
      finalDeviceName || "<system default>"
    );
    if (target && preferredName !== target.name && !explicitDevice) {
      // Persist discovered exact name for stability
      const next = { ...settings, preferredPrinterName: target.name };
      saveSettings(next);
      console.log("[PRINT-RECEIPT] Preferred printer saved:", target.name);
    }

    console.log("[PRINT-RECEIPT] Starting print process...");
    await new Promise((resolve) => setTimeout(resolve, 120));

    console.log("[PRINT-RECEIPT] Executing print command...");
    // EP58M Fix: Determine print mode based on options
    let printMode = "silent"; // default
    if (forceDialog || useManualSettings) {
      printMode = "dialog";
    } else if (hybridMode) {
      printMode = "hybrid";
    }

    console.log("[PRINT-RECEIPT] Print mode determined:", printMode);

    // Decide if we should prefer direct USB (raw ESC/POS over Windows printer queue)
    const looksLikePOS58 = !!(
      (finalDeviceName &&
        /pos\s*58|pos58|ep58m|generic\s*\/\s*text|usb\s*thermal/i.test(
          finalDeviceName
        )) ||
      POS58_VARIATIONS.some((v) =>
        (finalDeviceName || "").toLowerCase().includes(v.toLowerCase())
      )
    );

    if (forceDirectUsb || requestedMode === "direct-usb" || looksLikePOS58) {
      console.log("[PRINT-RECEIPT] Using direct USB ESC/POS path first...");
      try {
        const duRes = await directUsbPrint(
          { items, total, orderId, businessName, address, notes },
          finalDeviceName || DEFAULT_PRINTER_NAME
        );
        setTimeout(() => {
          if (!printWin.isDestroyed()) printWin.close();
        }, 150);
        return { success: true, device: duRes.printer, mode: duRes.mode };
      } catch (duErr) {
        console.warn("[PRINT-RECEIPT] Direct USB failed:", duErr?.message);
        // Continue to normal print flow
      }
    }

    // Use callback to capture success/failure; on Windows, if deviceName is invalid, printing may fail silently
    let failureReasonLast = null;
    let didPrint = false;

    if (printMode === "dialog" || printMode === "hybrid") {
      // Try dialog mode first (or as primary for dialog mode)
      console.log("[PRINT-RECEIPT] Attempting dialog print...");
      didPrint = await new Promise((resolve, reject) => {
        try {
          printWin.webContents.print(
            {
              silent: false, // Show dialog - EP58M fix!
              printBackground: false,
              landscape: false,
              // Don't specify deviceName for dialog mode - let user choose
            },
            (success, failureReason) => {
              console.log(
                "[PRINT-RECEIPT] Dialog print callback - success:",
                success,
                "failure:",
                failureReason
              );
              if (success) {
                console.log("[PRINT-RECEIPT] Dialog print successful!");
                return resolve(true);
              }
              console.warn(
                "[PRINT-RECEIPT] Dialog print failed:",
                failureReason || "unknown"
              );
              failureReasonLast = failureReason || null;
              return resolve(false);
            }
          );
        } catch (err) {
          console.error("[PRINT-RECEIPT] Dialog print error:", err);
          return resolve(false);
        }
      });
    }

    // If hybrid mode and dialog failed, or if silent mode, try silent print
    if ((printMode === "hybrid" && !didPrint) || printMode === "silent") {
      console.log("[PRINT-RECEIPT] Attempting silent print...");
      didPrint = await new Promise((resolve, reject) => {
        try {
          console.log(
            "[PRINT-RECEIPT] Calling webContents.print with device:",
            finalDeviceName || "default"
          );
          printWin.webContents.print(
            {
              silent: true,
              // If finalDeviceName is undefined, omit it to use system default printer
              ...(finalDeviceName ? { deviceName: finalDeviceName } : {}),
              printBackground: false,
              landscape: false,
              // Force 58mm page width in microns, large height to fit content
              pageSize: { width: 58000, height: 200000 },
            },
            (success, failureReason) => {
              console.log(
                "[PRINT-RECEIPT] Silent print callback - success:",
                success,
                "failure:",
                failureReason
              );
              if (success) {
                console.log("[PRINT-RECEIPT] Silent print reported success!");
                return resolve(true);
              }
              console.warn(
                "[PRINT-RECEIPT] Silent print failed:",
                failureReason || "unknown"
              );
              failureReasonLast = failureReason || null;
              return resolve(false);
            }
          );
        } catch (err) {
          console.error("[PRINT-RECEIPT] Silent print error:", err);
          return resolve(false);
        }
      });
    }

    // Some POS drivers lie about success; optionally force ESC/POS if configured
    const settingsX = loadSettings();
    console.log("[PRINT-RECEIPT] Current settings:", {
      preferEscPos: settingsX.preferEscPos,
      preferEscPosEvenOnSuccess: settingsX.preferEscPosEvenOnSuccess,
      preferDirectUsbForPOS58: settingsX.preferDirectUsbForPOS58,
      preferredSerialPort: settingsX.preferredSerialPort,
    });

    if (didPrint && settingsX.preferEscPosEvenOnSuccess) {
      console.warn(
        "[PRINT-RECEIPT] preferEscPosEvenOnSuccess is enabled; sending ESC/POS anyway"
      );
      try {
        const res = await (async () => {
          // Auto-detect serial port jika belum di-set
          const settings2 = loadSettings();
          let preferredPort = settings2.preferredSerialPort || null;

          if (!preferredPort) {
            console.log(
              "[PRINT-RECEIPT] No preferred serial port, auto-detecting for POS58ENG..."
            );
            preferredPort = await autoDetectSerialPort();

            if (preferredPort) {
              console.log(
                "[PRINT-RECEIPT] Auto-detected port:",
                preferredPort,
                "- saving as preferred"
              );
              // Save detected port
              const newSettings = {
                ...settings2,
                preferredSerialPort: preferredPort,
              };
              saveSettings(newSettings);
            } else {
              throw new Error("No suitable serial port found for EP58M");
            }
          }

          console.log(
            "[PRINT-RECEIPT] Using serial port for EP58M:",
            preferredPort
          );
          // Use short minimal ticket (same as fallback) to ensure paper comes out
          const enc = new EscPosEncoder();
          enc
            .initialize()
            .codepage("cp437")
            .align("center")
            .bold(true)
            .line(businessName)
            .bold(false);
          if (address) enc.line(address);
          enc.newline().align("left");
          enc.line(`ID: ${String(orderId).padStart(6, "0")}`);
          enc.line(new Date().toLocaleString("id-ID"));
          enc.newline();
          for (const it of items) {
            const name = String(it.name || "Item");
            const qty = Number(it.quantity) || 1;
            const price = Number(it.price) || 0;
            const sub = qty * price;
            enc.line(name);
            const left = `${qty} x ${formatIDR(price)}`;
            const right = `${formatIDR(sub)}`;
            enc.line(twoCols(left, right, 32));
          }
          enc.newline().bold(true);
          enc.line(twoCols("Total", formatIDR(total), 32));
          enc.bold(false).newline();
          if (notes) enc.align("center").line(notes).align("left");
          enc.newline().cut();
          const data = enc.encode();
          await new Promise((resolve, reject) => {
            const sp = new SerialPort.SerialPort(
              {
                path: preferredPort,
                baudRate: settings2.serialBaudRate || 9600,
              },
              (err) => {
                if (err) return reject(err);
              }
            );
            sp.on("open", () => {
              sp.write(Buffer.from(data), (err) => {
                if (err) {
                  sp.close(() => reject(err));
                } else {
                  sp.drain(() => sp.close(() => resolve()));
                }
              });
            });
            sp.on("error", (err) => {
              try {
                sp.close(() => {});
              } catch (_) {}
              reject(err);
            });
          });
          return { success: true, device: preferredPort };
        })();
        console.log("[PRINT-RECEIPT] ESC/POS (even-on-success) succeeded", res);
      } catch (errForce) {
        console.warn(
          "[PRINT-RECEIPT] ESC/POS (even-on-success) failed:",
          errForce?.message
        );
      }
    }

    // Optional: Fallback to ESC/POS serial if configured and silent print failed
    if (!didPrint) {
      const settings2 = loadSettings();
      let preferredPort = settings2.preferredSerialPort || null;

      // Auto-detect if no port set
      if (!preferredPort && SerialPort?.SerialPort && EscPosEncoder) {
        console.log(
          "[PRINT-RECEIPT] No serial port for ESC/POS fallback, auto-detecting..."
        );
        preferredPort = await autoDetectSerialPort();

        if (preferredPort) {
          console.log(
            "[PRINT-RECEIPT] Auto-detected port for fallback:",
            preferredPort
          );
          // Save detected port
          const newSettings = {
            ...settings2,
            preferredSerialPort: preferredPort,
          };
          saveSettings(newSettings);
        }
      }

      if (preferredPort && SerialPort?.SerialPort && EscPosEncoder) {
        console.warn(
          "[PRINT-RECEIPT] Silent print failed. Attempting ESC/POS via serial port:",
          preferredPort
        );
        try {
          // Prepare payload (for parity with print-escpos IPC if needed in future)
          const payload2 = {
            portPath: preferredPort,
            baudRate: settings2.serialBaudRate || 9600,
            items,
            total,
            orderId,
            businessName,
            address,
            notes,
            width: 32,
            cut: true,
            drawer: false,
          };
          // Continue to direct encode/write below
        } catch (_) {}
        try {
          // Directly reuse the encoding/writing logic
          const enc = new EscPosEncoder();
          enc
            .initialize()
            .codepage("cp437")
            .align("center")
            .bold(true)
            .line(businessName)
            .bold(false);
          if (address) enc.line(address);
          enc.newline().align("left");
          enc.line(`ID: ${String(orderId).padStart(6, "0")}`);
          enc.line(new Date().toLocaleString("id-ID"));
          enc.newline();
          for (const it of items) {
            const name = String(it.name || "Item");
            const qty = Number(it.quantity) || 1;
            const price = Number(it.price) || 0;
            const sub = qty * price;
            enc.line(name);
            const left = `${qty} x ${formatIDR(price)}`;
            const right = `${formatIDR(sub)}`;
            enc.line(twoCols(left, right, 32));
          }
          enc.newline().bold(true);
          enc.line(twoCols("Total", formatIDR(total), 32));
          enc.bold(false).newline();
          if (notes) enc.align("center").line(notes).align("left");
          enc.newline().cut();

          const data = enc.encode();
          await new Promise((resolve, reject) => {
            const sp = new SerialPort.SerialPort(
              {
                path: preferredPort,
                baudRate: settings2.serialBaudRate || 9600,
              },
              (err) => {
                if (err) return reject(err);
              }
            );
            sp.on("open", () => {
              sp.write(Buffer.from(data), (err) => {
                if (err) {
                  sp.close(() => reject(err));
                } else {
                  sp.drain(() => {
                    sp.close(() => resolve());
                  });
                }
              });
            });
            sp.on("error", (err) => {
              try {
                sp.close(() => {});
              } catch (_) {}
              reject(err);
            });
          });
          console.log("[PRINT-RECEIPT] ESC/POS serial fallback succeeded");
          didPrint = true;
        } catch (err3) {
          console.warn(
            "[PRINT-RECEIPT] ESC/POS serial fallback failed:",
            err3?.message
          );
        }
      }
    }

    // Optional debugging: if silent print failed and caller allows dialog, retry with dialog to let user confirm destination
    if (!didPrint && payload && payload.allowDialogOnFail) {
      console.warn(
        "[PRINT] Silent print failed; retrying with dialog for troubleshooting..."
      );
      await new Promise((resolve) => setTimeout(resolve, 150));
      await new Promise((resolve) => {
        printWin.webContents.print(
          {
            silent: false,
            printBackground: false,
            landscape: false,
          },
          () => resolve()
        );
      });
    }

    setTimeout(() => {
      if (!printWin.isDestroyed()) printWin.close();
    }, 200);
    return {
      success: !!didPrint,
      device: finalDeviceName || null,
      preferredAttempt: preferredName,
      printers: printers.map((p) =>
        p.isDefault ? `${p.name} (default)` : p.name
      ),
      failureReason: failureReasonLast || null,
    };
  } catch (err) {
    console.error("[PRINT-RECEIPT] ERROR:", err);
    return { success: false, message: err.message };
  }
});

// Manual print with dialog handler - untuk EP58M thermal printer
ipcMain.handle("print-receipt-manual", async (e, payload) => {
  console.log(
    "[PRINT-RECEIPT-MANUAL] Handler called for EP58M with payload:",
    payload
  );

  try {
    const items = Array.isArray(payload?.items) ? payload.items : [];
    const total = Number(payload?.total) || 0;
    const orderId = payload?.orderId || "";
    const dateStr = new Date().toLocaleString("id-ID");
    const businessName = payload?.businessName || "JS Florist";
    const address = payload?.address || "";
    const notes = payload?.notes || "Terima kasih atas kunjungan Anda";

    console.log(
      "[PRINT-RECEIPT-MANUAL] Processing manual print for EP58M, order:",
      orderId,
      "total:",
      total
    );

    // Thermal-friendly HTML untuk EP58M
    const receiptHTML = `<!DOCTYPE html><html><head><meta charset="utf-8" />
      <style>
        /* 58mm thermal paper optimal untuk EP58M */
        @page { size: 58mm auto; margin: 2mm; }
        body { 
          font-family: 'Courier New', monospace; 
          font-size: 11px; 
          width: 54mm; 
          line-height: 1.2;
          margin: 0;
          padding: 0;
        }
        .center { text-align: center; }
        .left { text-align: left; }
        .right { text-align: right; }
        .row { 
          display: flex; 
          justify-content: space-between; 
          align-items: center;
          margin: 1px 0;
        }
        .separator { 
          border: none; 
          border-top: 1px dashed #000; 
          margin: 3px 0; 
          width: 100%;
        }
        .bold { font-weight: bold; font-size: 12px; }
        .small { font-size: 10px; }
      </style>
    </head><body>
      <div class="center bold">
        ${businessName}
      </div>
      ${address ? `<div class="center small">${address}</div>` : ""}
      <hr class="separator" />
      <div class="left small">
        ID: ${String(orderId).padStart(6, "0")}<br/>
        ${dateStr}
      </div>
      <hr class="separator" />
      ${items
        .map((it) => {
          const name = (it.name || "Item").toString();
          const qty = Number(it.quantity) || 1;
          const price = Number(it.price) || 0;
          const sub = price * qty;
          return `<div class="left">
              <div>${name}</div>
              <div class="row">
                <span class="small">${qty} x ${formatIDR(price)}</span>
                <span class="small">${formatIDR(sub)}</span>
              </div>
            </div>`;
        })
        .join("")}
      <hr class="separator" />
      <div class="row bold">
        <span>TOTAL</span>
        <span>${formatIDR(total)}</span>
      </div>
      <hr class="separator" />
      <div class="center small">${notes}</div>
      <br/>
    </body></html>`;

    console.log(
      "[PRINT-RECEIPT-MANUAL] Creating print window with dialog for EP58M..."
    );

    // Create window untuk manual print
    const printWin = new BrowserWindow({
      width: 300,
      height: 600,
      show: false,
      webPreferences: {
        offscreen: false,
        backgroundThrottling: false,
      },
    });

    try {
      // Load HTML content
      await printWin.loadURL(
        "data:text/html;charset=utf-8," + encodeURIComponent(receiptHTML)
      );

      // Wait for content to load
      await new Promise((resolve) => {
        const wc = printWin.webContents;
        if (!wc.isLoading()) {
          resolve();
        } else {
          wc.once("did-finish-load", resolve);
        }
        setTimeout(resolve, 1000); // Fallback timeout
      });

      console.log("[PRINT-RECEIPT-MANUAL] Showing print dialog for EP58M...");

      // Show print dialog untuk user bisa pilih printer EP58M
      const didPrint = await new Promise((resolve) => {
        printWin.webContents.print(
          {
            silent: false, // Show dialog - KEY DIFFERENCE!
            printBackground: false,
            landscape: false,
            pageSize: { width: 58000, height: 200000 },
            // Don't specify deviceName - let user choose
          },
          (success, failureReason) => {
            console.log(
              "[PRINT-RECEIPT-MANUAL] Print dialog result - success:",
              success,
              "failure:",
              failureReason
            );
            resolve(success);
          }
        );
      });

      // Close print window
      setTimeout(() => {
        if (!printWin.isDestroyed()) printWin.close();
      }, 200);

      if (didPrint) {
        console.log("[PRINT-RECEIPT-MANUAL] Manual print successful!");
        return {
          success: true,
          mode: "manual-dialog",
          message: "Print dialog ditampilkan, user memilih printer",
        };
      } else {
        console.warn("[PRINT-RECEIPT-MANUAL] Manual print cancelled or failed");
        return {
          success: false,
          mode: "manual-dialog",
          message: "Print dibatalkan atau gagal",
        };
      }
    } catch (loadError) {
      console.error("[PRINT-RECEIPT-MANUAL] Load error:", loadError);
      return {
        success: false,
        message: "Gagal memuat konten print: " + loadError.message,
      };
    }
  } catch (err) {
    console.error("[PRINT-RECEIPT-MANUAL] ERROR:", err);
    return { success: false, message: err.message };
  }
});

// Reusable helper to print via Windows printer name using node-thermal-printer
async function directUsbPrint(payload, printerName) {
  let ThermalPrinter, PrinterTypes;
  const pName = printerName || payload?.deviceName || "POS58 Printer";
  try {
    const lib = require("node-thermal-printer");
    // Correct API for v4+: { printer: ThermalPrinter, types: PrinterTypes }
    ThermalPrinter = lib.printer || lib.ThermalPrinter || lib.thermalPrinter; // multiple fallbacks
    PrinterTypes = lib.types || lib.PrinterTypes;
    if (!ThermalPrinter || !PrinterTypes) {
      throw new Error(
        "node-thermal-printer API tidak sesuai - missing ThermalPrinter or PrinterTypes"
      );
    }
  } catch (err) {
    throw new Error(
      "Module 'node-thermal-printer' belum terpasang atau versi tidak cocok. Jalankan 'npm i node-thermal-printer'. Error: " +
        err.message
    );
  }

  // Ensure the interface is properly formatted - this fixes the "No driver set!" error
  const printerInterface = pName.startsWith("printer:")
    ? pName
    : `printer:${pName}`;
  console.log("[DIRECT-USB] Using interface:", printerInterface);

  const printer = new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: printerInterface,
    characterSet: "SLOVENIA",
    removeSpecialCharacters: false,
    lineCharacter: "=",
    width: 48, // Set appropriate width for thermal printer
  });

  try {
    const isConnected = await printer.isPrinterConnected();
    console.log("[DIRECT-USB] isPrinterConnected:", isConnected);
    // Some Windows drivers return false even when ready; continue anyway
  } catch (e) {
    console.log(
      "[DIRECT-USB] isPrinterConnected check failed; proceeding:",
      e?.message
    );
  }

  const {
    items = [],
    total = 0,
    orderId = "",
    businessName = "JS Florist",
    address = "",
    notes = "Terima kasih!",
  } = payload || {};
  const dateStr = new Date().toLocaleString("id-ID");

  try {
    printer.alignCenter();
    printer.bold(true);
    printer.println(businessName);
    printer.bold(false);
    if (address) printer.println(address);
    printer.drawLine();
    printer.alignLeft();
    if (orderId) printer.println(`ID: ${String(orderId).padStart(6, "0")}`);
    printer.println(`Tanggal: ${dateStr}`);
    printer.drawLine();

    items.forEach((it) => {
      const name = it.name || "Item";
      const qty = Number(it.quantity) || 1;
      const price = Number(it.price) || 0;
      const sub = price * qty;

      printer.println(`${name}`);
      printer.tableCustom([
        {
          text: `${qty} x ${formatIDR(price)}`,
          align: "LEFT",
          width: 0.6,
        },
        { text: formatIDR(sub), align: "RIGHT", width: 0.4 },
      ]);
    });

    printer.drawLine();
    printer.alignRight();
    printer.bold(true);
    printer.println(`TOTAL: ${formatIDR(total)}`);
    printer.bold(false);
    printer.drawLine();
    printer.alignCenter();
    if (notes) printer.println(notes);
    printer.newLine();
    printer.cut();

    await printer.execute();
    console.log("[DIRECT-USB] Print execution successful");
    return { success: true, printer: pName, mode: "direct-usb" };
  } catch (executeError) {
    console.error("[DIRECT-USB] Print execution failed:", executeError.message);
    throw new Error(`Print execution failed: ${executeError.message}`);
  }
}

ipcMain.handle("print-receipt-direct-usb", async (e, payload) => {
  console.log("[PRINT-USB] Handler cetak langsung via USB dipanggil");
  try {
    const res = await directUsbPrint(payload, payload?.deviceName);
    return { success: true, ...res };
  } catch (err) {
    return { success: false, message: err?.message };
  }
});

// Raw Windows spooler print using 'printer' module (if installed)
// Enhanced printer detection for POS58 on Windows (using system printers)
async function detectPOS58Printer() {
  try {
    // Try using Electron's webContents.getPrinters() instead of native module
    if (mainWindow && mainWindow.webContents) {
      const printers = await listPrintersRobust(mainWindow.webContents, null);
      console.log(
        "[POS58-DETECT] Found system printers:",
        printers.map((p) => p.name)
      );

      // Priority order for POS58 detection
      const POS58_NAMES = [
        "POS58 Printer",
        "POS-58",
        "POS 58",
        "EP58M",
        "EPPOS",
        "USB Receipt Printer",
        "Thermal Receipt Printer",
        "Generic / Text Only",
      ];

      // Try exact match first
      for (const targetName of POS58_NAMES) {
        const found = printers.find(
          (p) =>
            p.name === targetName ||
            p.name.toLowerCase() === targetName.toLowerCase()
        );
        if (found) {
          console.log("[POS58-DETECT] ✅ Found exact match:", found.name);
          return found.name;
        }
      }

      // Try partial match
      for (const printer of printers) {
        const printerName = printer.name.toLowerCase();
        for (const targetName of POS58_NAMES) {
          if (
            printerName.includes(targetName.toLowerCase()) ||
            targetName.toLowerCase().includes(printerName)
          ) {
            console.log("[POS58-DETECT] ✅ Found partial match:", printer.name);
            return printer.name;
          }
        }
      }

      // Fallback to first printer if only one available
      if (printers.length === 1) {
        console.log(
          "[POS58-DETECT] ⚠️ Using fallback (only printer):",
          printers[0].name
        );
        return printers[0].name;
      }

      console.log("[POS58-DETECT] ❌ No suitable printer found");
      return null;
    }

    console.log("[POS58-DETECT] Main window not available");
    return null;
  } catch (error) {
    console.error("[POS58-DETECT] Detection failed:", error.message);
    return null;
  }
}

async function rawWindowsPrintEscPos(payload, printerName) {
  console.log(
    "[RAW-WINDOWS] Attempting Windows printer spooler print for:",
    printerName
  );

  if (!EscPosEncoder) {
    throw new Error("Module 'esc-pos-encoder' tidak tersedia");
  }

  // Build receipt data same as ESC/POS but using HTML printing to target specific printer
  const width = Number(payload?.width || 32);
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const total = Number(payload?.total) || 0;
  const orderId = payload?.orderId || "";
  const businessName = payload?.businessName || "JS Florist";
  const address = payload?.address || "";
  const notes = payload?.notes || "Terima kasih";
  const dateStr = new Date().toLocaleString("id-ID");

  // Create enhanced HTML for thermal printing that mimics ESC/POS output
  const receiptHTML = `<!DOCTYPE html><html><head><meta charset="utf-8" />
    <style>
      @page { 
        size: 58mm auto; 
        margin: 1mm; 
      }
      @media print {
        body { 
          font-family: 'Courier New', monospace; 
          font-size: 10px; 
          width: 56mm; 
          margin: 0;
          padding: 0;
          -webkit-print-color-adjust: exact;
          color: black;
        }
        .no-print { display: none; }
      }
      body { 
        font-family: 'Courier New', monospace; 
        font-size: 10px; 
        width: 58mm; 
        margin: 0;
        padding: 1mm;
        line-height: 1.1;
        color: black;
      }
      .center { text-align: center; }
      .left { text-align: left; }
      .right { text-align: right; }
      .bold { font-weight: bold; font-size: 11px; }
      .row { 
        display: flex; 
        justify-content: space-between; 
        align-items: flex-start;
        margin: 0.5px 0;
      }
      .row .left-col { flex: 1; text-align: left; }
      .row .right-col { text-align: right; white-space: nowrap; padding-left: 3px; }
      .separator { 
        border: none; 
        border-top: 1px dashed #000; 
        margin: 2px 0; 
        width: 100%;
        height: 1px;
      }
      .header { 
        font-weight: bold; 
        font-size: 11px; 
        margin-bottom: 1px;
      }
      .total-line { 
        font-weight: bold; 
        font-size: 11px; 
        border-top: 1px solid #000;
        padding-top: 1px;
        margin-top: 2px;
      }
      .footer {
        margin-top: 3px;
        font-size: 9px;
      }
      .item-line {
        margin: 1px 0;
      }
    </style>
  </head><body>
    <div class="center">
      <div class="header">${businessName}</div>
      ${address ? `<div style="font-size: 9px;">${address}</div>` : ""}
    </div>
    <hr class="separator" />
    <div class="left" style="font-size: 9px;">
      ${orderId ? `ID: ${String(orderId).padStart(6, "0")}<br/>` : ""}
      ${dateStr}
    </div>
    <hr class="separator" />
    ${items
      .map((it) => {
        const name = (it.name || "Item").toString();
        const qty = Number(it.quantity) || 1;
        const price = Number(it.price) || 0;
        const sub = price * qty;
        return `<div class="item-line">
        <div class="left">${name}</div>
        <div class="row">
          <span class="left-col">${qty} x ${formatIDR(price)}</span>
          <span class="right-col">${formatIDR(sub)}</span>
        </div>
      </div>`;
      })
      .join("")}
    <hr class="separator" />
    <div class="row total-line">
      <span class="left-col bold">TOTAL</span>
      <span class="right-col bold">${formatIDR(total)}</span>
    </div>
    <hr class="separator" />
    <div class="center footer">${notes}</div>
    <div style="height: 10mm;"></div> <!-- Space for cutting -->
  </body></html>`;

  // Use HTML printing mechanism targeting the specific printer
  try {
    const printWin = new BrowserWindow({
      width: 300,
      height: 600,
      show: false,
      webPreferences: { offscreen: false, backgroundThrottling: false },
    });

    await printWin.loadURL(
      "data:text/html;charset=utf-8," + encodeURIComponent(receiptHTML)
    );

    // Wait a bit for content to be ready
    await new Promise((resolve) => setTimeout(resolve, 300));

    console.log(
      "[RAW-WINDOWS] Sending HTML print to Windows spooler via:",
      printerName
    );

    const didPrint = await new Promise((resolve) => {
      printWin.webContents.print(
        {
          silent: true,
          deviceName: printerName,
          printBackground: false,
          landscape: false,
          pageSize: { width: 58000, height: 200000 },
          margins: { marginType: "none" },
        },
        (success, failureReason) => {
          console.log("[RAW-WINDOWS] Windows spooler print result:", success);
          if (!success && failureReason) {
            console.log("[RAW-WINDOWS] Failure reason:", failureReason);
          }
          resolve(success);
        }
      );
    });

    setTimeout(() => {
      if (!printWin.isDestroyed()) printWin.close();
    }, 150);

    if (didPrint) {
      return { success: true, printer: printerName, mode: "windows-spooler" };
    } else {
      throw new Error("Windows spooler print reported failure");
    }
  } catch (error) {
    console.error("[RAW-WINDOWS] HTML printing failed:", error.message);
    throw error;
  }
}

function twoCols(left, right, width) {
  const l = String(left);
  const r = String(right);
  const space = Math.max(1, width - l.length - r.length);
  return l + " ".repeat(space) + r;
}

// Enhanced printer diagnostic and testing handlers
ipcMain.handle("detect-pos58-printer", async () => {
  try {
    const printerName = await detectPOS58Printer();
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

    const result = await rawWindowsPrintEscPos(testPayload, printerName);
    return { success: true, result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("get-installed-printers", async () => {
  try {
    if (mainWindow && mainWindow.webContents) {
      const printers = await listPrintersRobust(mainWindow.webContents, null);
      return { success: true, printers };
    } else {
      throw new Error("Main window not available");
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("printer-diagnostic", async () => {
  try {
    const diagnostic = {
      timestamp: new Date().toISOString(),
      modules: {
        serialport: !!SerialPort,
        escPosEncoder: !!EscPosEncoder,
        printer: !!printer,
      },
      printers: [],
      serialPorts: [],
      detectedPOS58: null,
      autoDetectedSerial: null,
      settings: loadSettings(),
      printingCapabilities: {
        escPosSerial: false,
        directUsb: false,
        windowsSpooler: false,
        htmlFallback: true,
      },
    };

    // Test module availability
    diagnostic.printingCapabilities.escPosSerial = !!(
      SerialPort && EscPosEncoder
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
        diagnostic.printers = await listPrintersRobust(
          mainWindow.webContents,
          null
        );
        diagnostic.detectedPOS58 = await detectPOS58Printer();
      } catch (e) {
        diagnostic.printerError = e.message;
      }
    } else {
      diagnostic.printerError = "Main window not available";
    }

    // Get serial ports and test auto-detection
    if (SerialPort) {
      try {
        const listFn =
          (SerialPort?.SerialPort && SerialPort.SerialPort.list) ||
          SerialPort?.list;
        if (listFn) {
          diagnostic.serialPorts = await listFn();

          // Test auto-detection
          try {
            diagnostic.autoDetectedSerial = await autoDetectSerialPort();
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

// App event handlers
app.whenReady().then(async () => {
  await initializeDatabase();
  createWindow();
});

app.on("window-all-closed", () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle app quit
app.on("before-quit", () => {
  if (dbHelper) {
    dbHelper.close();
  }
});

// Prevent navigation to external URLs
app.on("web-contents-created", (event, contents) => {
  contents.on("will-navigate", (event, navigationUrl) => {
    try {
      const parsedUrl = new URL(navigationUrl);
      // Allow safe internal protocols commonly used in the app:
      // - file: for app pages
      // - data: for ephemeral print receipts, etc.
      // - about: (about:blank) used for temporary/hidden windows
      // - devtools: for debugging tools
      const allowedProtocols = new Set([
        "file:",
        "data:",
        "about:",
        "devtools:",
      ]);
      if (!allowedProtocols.has(parsedUrl.protocol)) {
        console.log("🚫 Blocked external navigation:", navigationUrl);
        event.preventDefault();
      } else {
        console.log("✅ Allowed navigation:", navigationUrl);
      }
    } catch (err) {
      console.warn(
        "will-navigate parse error, blocking as precaution",
        navigationUrl,
        err
      );
      event.preventDefault();
    }
  });
});
