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

    // Load splash screen first, then it will navigate to welcome
    this.mainWindow.loadFile("renderer/splash.html");

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
      splash: "renderer/splash.html",
      welcome: "renderer/welcome.html",
      catalog: "renderer/index.html",
      cart: "renderer/cart.html",
      admin: "renderer/admin-login.html",
    };

    const targetPage = pageMap[page];
    if (targetPage) {
      // Always route via splash, pass next param to show splash before the page
      const nextPath = targetPage.replace(/^renderer\//, "");
      this.mainWindow.loadFile(pageMap.splash, {
        query: { next: nextPath },
      });
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
