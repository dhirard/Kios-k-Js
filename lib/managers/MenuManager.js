const { Menu, app } = require("electron");

/**
 * Manager untuk handling application menu
 */
class MenuManager {
  constructor(windowManager) {
    this.windowManager = windowManager;
  }

  createApplicationMenu() {
    const template = [
      {
        label: "File",
        submenu: [
          {
            label: "Katalog Produk",
            click: () => {
              this.windowManager.loadNavigationPage("catalog");
            },
          },
          {
            label: "Keranjang",
            click: () => {
              this.windowManager.loadNavigationPage("cart");
            },
          },
          {
            label: "Admin Login",
            click: () => {
              this.windowManager.loadNavigationPage("admin");
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
              this.windowManager.reload();
            },
          },
          {
            label: "Toggle Developer Tools",
            accelerator: "F12",
            click: () => {
              this.windowManager.toggleDevTools();
            },
          },
        ],
      },
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }
}

module.exports = MenuManager;
