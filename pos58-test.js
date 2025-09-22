// POS58 Printer Testing & Diagnostic Script
// Load this script in admin console: copy and paste, or add to admin-dashboard.html

window.POS58Test = {
  // Main diagnostic function
  async runFullDiagnostic() {
    console.log("🔍 Running POS58 Printer Full Diagnostic...");
    console.log("=".repeat(50));

    try {
      // 1. Module availability check
      console.log("1️⃣ Checking module availability...");
      const diagnostic = await window.electronAPI.printerDiagnostic();

      if (!diagnostic.success) {
        console.error("❌ Diagnostic failed:", diagnostic.error);
        return;
      }

      console.log("📦 Modules status:");
      console.log(
        "- SerialPort:",
        diagnostic.diagnostic.modules.serialport ? "✅" : "❌"
      );
      console.log(
        "- ESC/POS Encoder:",
        diagnostic.diagnostic.modules.escPosEncoder ? "✅" : "❌"
      );
      console.log(
        "- Printer:",
        diagnostic.diagnostic.modules.printer ? "✅" : "❌"
      );

      // 2. Installed printers
      console.log("\n2️⃣ Installed printers:");
      if (
        diagnostic.diagnostic.printers &&
        diagnostic.diagnostic.printers.length > 0
      ) {
        diagnostic.diagnostic.printers.forEach((printer, index) => {
          console.log(`${index + 1}. ${printer.name}`);
          if (printer.status) console.log(`   Status: ${printer.status}`);
        });
      } else {
        console.log("❌ No printers found or printer module not available");
      }

      // 3. Auto-detected POS58
      console.log("\n3️⃣ POS58 Auto-detection:");
      if (diagnostic.diagnostic.detectedPOS58) {
        console.log("✅ POS58 detected:", diagnostic.diagnostic.detectedPOS58);
      } else {
        console.log("❌ No POS58 printer auto-detected");
      }

      // 4. Serial ports
      console.log("\n4️⃣ Available serial ports:");
      if (
        diagnostic.diagnostic.serialPorts &&
        diagnostic.diagnostic.serialPorts.length > 0
      ) {
        diagnostic.diagnostic.serialPorts.forEach((port, index) => {
          console.log(
            `${index + 1}. ${port.path} - ${port.friendlyName || "Unknown"}`
          );
          if (port.manufacturer)
            console.log(`   Manufacturer: ${port.manufacturer}`);
        });
      } else {
        console.log("❌ No serial ports found");
      }

      // 5. Current settings
      console.log("\n5️⃣ Current settings:");
      console.log(
        "Preferred printer:",
        diagnostic.diagnostic.settings.preferredPrinterName || "Not set"
      );
      console.log(
        "Preferred serial port:",
        diagnostic.diagnostic.settings.preferredSerialPort || "Not set"
      );
      console.log(
        "Serial baud rate:",
        diagnostic.diagnostic.settings.serialBaudRate || "Default (9600)"
      );

      return diagnostic.diagnostic;
    } catch (error) {
      console.error("❌ Diagnostic failed:", error);
      return null;
    }
  },

  // Test direct printer detection
  async testDetection() {
    console.log("🔍 Testing POS58 detection...");
    try {
      const result = await window.electronAPI.detectPOS58Printer();
      if (result.success && result.printerName) {
        console.log("✅ POS58 detected:", result.printerName);
        return result.printerName;
      } else {
        console.log("❌ No POS58 printer detected");
        return null;
      }
    } catch (error) {
      console.error("❌ Detection failed:", error);
      return null;
    }
  },

  // Test direct printing to specific printer
  async testDirectPrint(printerName) {
    if (!printerName) {
      printerName = await this.testDetection();
      if (!printerName) {
        console.error("❌ No printer name provided and auto-detection failed");
        return;
      }
    }

    console.log("🖨️ Testing direct print to:", printerName);
    try {
      const result = await window.electronAPI.testPrinterDirect(printerName);
      if (result.success) {
        console.log("✅ Direct print test successful!");
        console.log("Check your printer for test receipt.");
        return true;
      } else {
        console.error("❌ Direct print test failed:", result.error);
        return false;
      }
    } catch (error) {
      console.error("❌ Direct print test error:", error);
      return false;
    }
  },

  // Test regular print-receipt handler
  async testPrintReceipt() {
    console.log("🧾 Testing print-receipt handler...");

    const testPayload = {
      orderId: "TEST_RECEIPT_" + Date.now(),
      total: 50000,
      items: [{ name: "Test Item POS58", quantity: 2, price: 25000 }],
      businessName: "RECEIPT TEST",
      address: "Via print-receipt handler",
      notes: "Test sukses jika struk tercetak",
    };

    try {
      const result = await window.electronAPI.printReceipt(testPayload);
      console.log("Print receipt result:", result);

      if (result.success) {
        console.log("✅ Print receipt test successful!");
        console.log("Mode:", result.mode);
        console.log("Device:", result.device);
        return true;
      } else {
        console.error("❌ Print receipt test failed:", result.message);
        return false;
      }
    } catch (error) {
      console.error("❌ Print receipt test error:", error);
      return false;
    }
  },

  // Quick test sequence
  async quickTest() {
    console.log("⚡ Running quick POS58 test...");
    console.log("=".repeat(30));

    // 1. Run diagnostic
    const diagnostic = await this.runFullDiagnostic();

    if (!diagnostic) {
      console.error("❌ Diagnostic failed, aborting tests");
      return;
    }

    // 2. Test detection
    console.log("\n🔍 Testing detection...");
    const detectedPrinter = await this.testDetection();

    if (detectedPrinter) {
      // 3. Test direct print
      console.log("\n🖨️ Testing direct print...");
      await this.testDirectPrint(detectedPrinter);
    }

    // 4. Test print receipt handler
    console.log("\n🧾 Testing print receipt handler...");
    await this.testPrintReceipt();

    console.log("\n✅ Quick test completed!");
  },

  // Manual printer test with specific name
  async testSpecificPrinter(printerName) {
    if (!printerName) {
      console.error("❌ Please provide printer name");
      console.log("Available printers:");
      const printers = await window.electronAPI.getInstalledPrinters();
      if (printers.success) {
        printers.printers.forEach((p, i) => {
          console.log(`${i + 1}. ${p.name}`);
        });
      }
      return;
    }

    console.log("🖨️ Testing specific printer:", printerName);
    return await this.testDirectPrint(printerName);
  },
};

// Convenience functions for console
window.pos58Test = () => window.POS58Test.quickTest();
window.pos58Diagnostic = () => window.POS58Test.runFullDiagnostic();
window.pos58Direct = (printerName) =>
  window.POS58Test.testDirectPrint(printerName);
window.pos58Receipt = () => window.POS58Test.testPrintReceipt();
window.pos58Specific = (printerName) =>
  window.POS58Test.testSpecificPrinter(printerName);

console.log("🚀 POS58 Test Suite loaded!");
console.log("Available commands:");
console.log("- pos58Test() - Run complete test sequence");
console.log("- pos58Diagnostic() - Run diagnostic only");
console.log(
  "- pos58Direct(printerName) - Test direct print to specific printer"
);
console.log("- pos58Receipt() - Test via print-receipt handler");
console.log("- pos58Specific('Printer Name') - Test specific printer by name");
console.log("");
console.log("💡 Quick start: Run pos58Test() to test everything");
