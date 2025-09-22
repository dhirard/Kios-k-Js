const fs = require("fs");
const path = require("path");
const { app } = require("electron");

/**
 * Manager untuk handling settings aplikasi
 */
class SettingsManager {
  constructor() {
    this.settingsPath = this.getSettingsPath();
  }

  getSettingsPath() {
    try {
      return path.join(app.getPath("userData"), "settings.json");
    } catch (_) {
      // Fallback to app directory if userData not available for some reason
      return path.join(__dirname, "..", "..", "settings.json");
    }
  }

  loadSettings() {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const raw = fs.readFileSync(this.settingsPath, "utf8");
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn("[SETTINGS] Failed to load settings:", e.message);
    }
    return {};
  }

  saveSettings(settings) {
    try {
      fs.mkdirSync(path.dirname(this.settingsPath), { recursive: true });
      fs.writeFileSync(
        this.settingsPath,
        JSON.stringify(settings, null, 2),
        "utf8"
      );
      return true;
    } catch (e) {
      console.warn("[SETTINGS] Failed to save settings:", e.message);
      return false;
    }
  }

  updateSettings(updates) {
    const current = this.loadSettings();
    const next = { ...current, ...updates };
    return this.saveSettings(next);
  }

  getSetting(key, defaultValue = null) {
    const settings = this.loadSettings();
    return settings[key] !== undefined ? settings[key] : defaultValue;
  }

  setSetting(key, value) {
    const settings = this.loadSettings();
    settings[key] = value;
    return this.saveSettings(settings);
  }
}

module.exports = SettingsManager;
