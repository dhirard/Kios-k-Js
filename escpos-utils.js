// Enhanced ESC/POS Testing and Auto-setup for EPPOS 58
// Add this to admin dashboard console or create dedicated test page

// Advanced ESC/POS testing functions
window.escposUtils = {
  // Auto-detect and setup EPPOS 58 printer
  async autoSetupEPPOS58() {
    console.log("🔧 Auto-setup EPPOS 58...");

    try {
      // 1. Enable ESC/POS preferences
      console.log("1️⃣ Setting ESC/POS preferences...");
      const prefResult = await window.electronAPI.setPrintModes({
        preferEscPos: true,
        preferEscPosEvenOnSuccess: true,
      });
      console.log("ESC/POS preferences:", prefResult);

      // 2. List available serial ports
      console.log("2️⃣ Scanning serial ports...");
      const portsResult = await window.electronAPI.listSerialPorts();
      console.log("Serial ports scan:", portsResult);

      if (!portsResult.success || !portsResult.ports.length) {
        console.warn(
          "⚠️ No serial ports detected. EPPOS 58 should create virtual COM port."
        );
        console.log("Troubleshooting:");
        console.log("- Check Windows Device Manager → Ports (COM & LPT)");
        console.log("- Look for USB Serial Port or similar");
        console.log("- Reinstall EPPOS 58 drivers if needed");
        return { success: false, reason: "NO_SERIAL_PORTS" };
      }

      // 3. Test each port (be careful - this will attempt to send data)
      console.log("3️⃣ Testing available ports...");
      for (const port of portsResult.ports) {
        console.log(
          `Testing ${port.path} (${port.friendlyName || "Unknown device"})...`
        );

        // Skip Bluetooth ports
        if (
          port.friendlyName &&
          port.friendlyName.toLowerCase().includes("bluetooth")
        ) {
          console.log(`Skipping Bluetooth port: ${port.path}`);
          continue;
        }

        try {
          const testResult = await this.testPort(port.path);
          if (testResult.success) {
            console.log(`✅ Port ${port.path} responded successfully!`);

            // Save this port as preferred
            await window.electronAPI.setPreferredSerialPort(port.path, 9600);
            console.log(`🎯 Saved ${port.path} as preferred serial port`);

            return {
              success: true,
              port: port.path,
              device: port.friendlyName,
            };
          }
        } catch (testError) {
          console.log(`❌ Port ${port.path} failed: ${testError.message}`);
        }
      }

      return { success: false, reason: "NO_WORKING_PORTS" };
    } catch (error) {
      console.error("Auto-setup failed:", error);
      return { success: false, error: error.message };
    }
  },

  // Test specific port
  async testPort(portPath, baudRate = 9600) {
    const testPayload = {
      portPath: portPath,
      baudRate: baudRate,
      orderId: "AUTO_TEST_" + Date.now(),
      total: 1000,
      items: [{ name: "Port Test", quantity: 1, price: 1000 }],
      businessName: "AUTO SETUP TEST",
      address: `Testing ${portPath}`,
      notes: "Auto-detection test",
      cut: true,
      drawer: false,
    };

    return await window.electronAPI.printEscPos(testPayload);
  },

  // Test with current print-receipt handler (force ESC/POS)
  async testPrintReceiptESCPOS() {
    console.log("🧪 Testing print-receipt with ESC/POS mode...");

    const testPayload = {
      orderId: "ESC_RECEIPT_" + Date.now(),
      total: 75000,
      items: [{ name: "EPPOS 58 Test Item", quantity: 1, price: 75000 }],
      businessName: "ESC/POS Receipt Test",
      address: "Direct ESC/POS via print-receipt",
      notes: "Test cetak langsung ESC/POS",
      printMode: "escpos", // Force ESC/POS mode
      allowDialogOnFail: true,
    };

    try {
      const result = await window.electronAPI.printReceipt(testPayload);
      console.log("print-receipt ESC/POS result:", result);
      return result;
    } catch (error) {
      console.error("print-receipt ESC/POS error:", error);
      return { success: false, error: error.message };
    }
  },

  // Get current settings status
  async getStatus() {
    try {
      const [ports, printModes, preferredPort] = await Promise.all([
        window.electronAPI.listSerialPorts(),
        window.electronAPI.getPrintModes(),
        window.electronAPI.getPreferredSerialPort(),
      ]);

      return {
        serialPorts: ports,
        printModes: printModes,
        preferredSerialPort: preferredPort,
        timestamp: new Date().toLocaleString("id-ID"),
      };
    } catch (error) {
      return { error: error.message };
    }
  },

  // Full diagnostic
  async runDiagnostic() {
    console.log("🔍 Running full ESC/POS diagnostic...");

    const status = await this.getStatus();
    console.log("Current status:", status);

    if (status.printModes && !status.printModes.preferEscPos) {
      console.log("⚠️ ESC/POS preference not enabled. Auto-enabling...");
      await window.electronAPI.setPrintModes({
        preferEscPos: true,
        preferEscPosEvenOnSuccess: true,
      });
    }

    if (!status.preferredSerialPort) {
      console.log("⚠️ No preferred serial port set. Running auto-setup...");
      return await this.autoSetupEPPOS58();
    }

    console.log(`ℹ️ Using preferred port: ${status.preferredSerialPort}`);
    console.log("✅ Ready for ESC/POS printing");

    return { success: true, ready: true };
  },
};

// Convenience functions
window.setupEPPOS58 = () => window.escposUtils.autoSetupEPPOS58();
window.testESCPOS = () => window.escposUtils.testPrintReceiptESCPOS();
window.escposStatus = () => window.escposUtils.getStatus();
window.escposDiagnostic = () => window.escposUtils.runDiagnostic();

console.log("🚀 ESC/POS Utils loaded! Available commands:");
console.log("- setupEPPOS58() - Auto-detect and setup EPPOS 58");
console.log("- testESCPOS() - Test ESC/POS via print-receipt handler");
console.log("- escposStatus() - Get current ESC/POS settings");
console.log("- escposDiagnostic() - Run full diagnostic");
console.log("");
console.log("💡 Quick start: Run setupEPPOS58() first, then testESCPOS()");
