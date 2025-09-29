const { app, BrowserWindow } = require("electron");
const path = require("path");

// Import all managers
const SettingsManager = require("./lib/managers/SettingsManager");
const SerialPortManager = require("./lib/managers/SerialPortManager");
const PrintManager = require("./lib/managers/PrintManager");
const WindowManager = require("./lib/managers/WindowManager");
const MenuManager = require("./lib/managers/MenuManager");
const DatabaseManager = require("./lib/managers/DatabaseManager");
const IPCHandlers = require("./lib/managers/IPCHandlers");

console.log("[MAIN] JS Florist main.js loaded (refactored version)");

// Basic Chromium setup for printing (hardware acceleration disabled for better thermal printer compatibility)
try {
  app.disableHardwareAcceleration();
  console.log(
    "[PRINT] Hardware acceleration disabled for thermal printer compatibility"
  );
} catch (e) {
  console.warn("[PRINT] Failed to set Chromium switches:", e?.message);
}

/**
 * Main Application Class
 * Mengkoordinasikan semua manager dan lifecycle aplikasi
 */
class FloristKioskApp {
  constructor() {
    this.managers = {};
    this.isReady = false;
  }

  async initialize() {
    try {
      console.log("[APP] Initializing JS Florist Application...");

      // Initialize managers in order
      this.managers.settings = new SettingsManager();
      this.managers.serialPort = new SerialPortManager(this.managers.settings);
      this.managers.print = new PrintManager(
        this.managers.settings,
        this.managers.serialPort
      );
      this.managers.window = new WindowManager();
      this.managers.menu = new MenuManager(this.managers.window);
      this.managers.database = new DatabaseManager();

      // Initialize database
      await this.managers.database.initialize();

      // Setup IPC handlers BEFORE loading any renderer to avoid race where
      // renderer invokes a channel that hasn't been registered yet.
      this.managers.ipc = new IPCHandlers(
        this.managers.database,
        this.managers.print,
        this.managers.serialPort,
        this.managers.settings,
        this.managers.window
      );

      // Create main window (after IPC is ready)
      this.managers.window.createMainWindow();

      // Create application menu
      this.managers.menu.createApplicationMenu();

      // Setup security
      this.setupSecurity();

      this.isReady = true;
      console.log("[APP] ✅ JS Florist Application initialized successfully");
    } catch (error) {
      console.error("[APP] ❌ Failed to initialize application:", error);
      throw error;
    }
  }

  setupSecurity() {
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
  }

  cleanup() {
    console.log("[APP] Cleaning up application...");
    if (this.managers.database) {
      this.managers.database.close();
    }
  }
}

// Global app instance
let floristApp = null;

// App event handlers
app.whenReady().then(async () => {
  try {
    floristApp = new FloristKioskApp();
    await floristApp.initialize();
  } catch (error) {
    console.error("[APP] Failed to start application:", error);
    app.quit();
  }
});

app.on("window-all-closed", () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", async () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    if (floristApp && floristApp.isReady) {
      floristApp.managers.window.createMainWindow();
    }
  }
});

// Handle app quit
app.on("before-quit", () => {
  if (floristApp) {
    floristApp.cleanup();
  }
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("[APP] Uncaught Exception:", error);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[APP] Unhandled Rejection at:", promise, "reason:", reason);
});

module.exports = FloristKioskApp;
