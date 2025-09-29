const { BrowserWindow } = require("electron");
const path = require("path");

/**
 * Manager untuk handling window creation dan management
 */
class WindowManager {
  constructor() {
    this.mainWindow = null;
  }

  createMainWindow() {
    // Create the browser window
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, "..", "..", "preload.js"),
      },
      icon: path.join(__dirname, "..", "..", "assets", "icon.png"),
      show: false,
    });

    // Load the florist selection screen first (before welcome)
    this.mainWindow.loadFile("renderer/florist-select.html");

    // Show window when ready to prevent visual flash
    this.mainWindow.once("ready-to-show", () => {
      this.mainWindow.show();
    });

    // Open DevTools in development
    if (process.argv.includes("--dev")) {
      this.mainWindow.webContents.openDevTools();
    }

    // Emitted when the window is closed
    this.mainWindow.on("closed", () => {
      this.mainWindow = null;
    });

    return this.mainWindow;
  }

  getMainWindow() {
    return this.mainWindow;
  }

  createPrintWindow(options = {}) {
    const defaultOptions = {
      width: 300,
      height: 600,
      show: false,
      webPreferences: {
        offscreen: false,
        backgroundThrottling: false,
      },
    };

    const mergedOptions = { ...defaultOptions, ...options };

    return new BrowserWindow(mergedOptions);
  }

  loadNavigationPage(page) {
    if (!this.mainWindow) return;

    const pageMap = {
      "florist-select": "renderer/florist-select.html",
      welcome: "renderer/welcome.html",
      catalog: "renderer/index.html",
      cart: "renderer/cart.html",
      admin: "renderer/admin-login.html",
    };

    const targetPage = pageMap[page];
    if (targetPage) {
      this.mainWindow.loadFile(targetPage);
    }
  }

  toggleDevTools() {
    if (this.mainWindow) {
      this.mainWindow.webContents.toggleDevTools();
    }
  }

  reload() {
    if (this.mainWindow) {
      this.mainWindow.reload();
    }
  }
}

module.exports = WindowManager;
