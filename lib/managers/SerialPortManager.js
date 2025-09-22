/**
 * Manager untuk handling serial port operations
 */
class SerialPortManager {
  constructor(settingsManager) {
    this.settingsManager = settingsManager;
    this.SerialPort = null;
    this.initializeSerialPort();
  }

  initializeSerialPort() {
    try {
      this.SerialPort = require("serialport");
      console.log(
        "[DEBUG] SerialPort loaded, available properties:",
        Object.keys(this.SerialPort || {})
      );
      console.log(
        "[DEBUG] SerialPort.SerialPort exists:",
        !!this.SerialPort?.SerialPort
      );
      console.log("[DEBUG] SerialPort.list exists:", !!this.SerialPort?.list);
    } catch (e) {
      console.warn("[DEBUG] Failed to load serialport:", e?.message);
    }
  }

  // Helper function untuk auto-detect dan set serial port untuk EP58M
  async autoDetectSerialPort() {
    console.log("[AUTO-DETECT] Scanning for POS58ENG thermal printer ports...");
    console.log(
      "[AUTO-DETECT] Looking for USB009 and other thermal printer ports"
    );

    try {
      if (!this.SerialPort?.SerialPort && !this.SerialPort) {
        console.log("[AUTO-DETECT] SerialPort not available");
        return null;
      }

      const listFn =
        (this.SerialPort?.SerialPort && this.SerialPort.SerialPort.list) ||
        this.SerialPort?.list;
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

        console.log(
          "[AUTO-DETECT] Skipping:",
          port.path,
          "-",
          port.friendlyName
        );
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
          const SPClass = this.SerialPort?.SerialPort || this.SerialPort;
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
                console.log(
                  "[AUTO-DETECT] Port closed successfully:",
                  port.path
                );
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

  async listSerialPorts() {
    try {
      if (!this.SerialPort?.SerialPort)
        return {
          success: false,
          message: "serialport tidak tersedia",
          ports: [],
        };
      const ports = await this.SerialPort.SerialPort.list();
      return { success: true, ports };
    } catch (e) {
      console.warn("[SERIAL-PORT] list ports error:", e?.message);
      return { success: false, message: e?.message, ports: [] };
    }
  }

  async getPreferredSerialPort() {
    let portPath = this.settingsManager.getSetting("preferredSerialPort");
    const baudRate = this.settingsManager.getSetting("serialBaudRate", 9600);

    // If no preferred port is set, attempt auto-detection once and save result
    if (!portPath) {
      console.log(
        "[GET-PREFERRED] No preferred serial port set, attempting auto-detection"
      );
      try {
        const detectedPort = await this.autoDetectSerialPort();
        if (detectedPort) {
          console.log(
            "[GET-PREFERRED] Auto-detected port:",
            detectedPort,
            "- saving as preferred"
          );
          this.settingsManager.setSetting("preferredSerialPort", detectedPort);
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
      autoDetected:
        !this.settingsManager.getSetting("preferredSerialPort") && !!portPath,
    };
  }

  setPreferredSerialPort(portPath, baudRate) {
    const updates = {
      preferredSerialPort: portPath,
      serialBaudRate: Number(baudRate) || 9600,
    };
    return this.settingsManager.updateSettings(updates);
  }
}

module.exports = SerialPortManager;
