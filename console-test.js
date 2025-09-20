// Quick Test Script untuk Console Browser
// Copy-paste ini ke browser console saat di admin dashboard

console.log("🔧 Testing ESC/POS Quick Setup...");

// Test function
async function quickESCPOSTest() {
  try {
    // 1. Check available serial ports
    console.log("1️⃣ Checking serial ports...");
    const portsResult = await window.electronAPI.listSerialPorts();
    console.log("Serial ports:", portsResult);

    if (!portsResult.success) {
      console.error("❌ Failed to get serial ports:", portsResult.message);
      return;
    }

    // 2. Enable ESC/POS preferences
    console.log("2️⃣ Enabling ESC/POS...");
    await window.electronAPI.setPrintModes({
      preferEscPos: true,
      preferEscPosEvenOnSuccess: true,
    });

    // 3. Try ESC/POS mode with print-receipt
    console.log("3️⃣ Testing ESC/POS print...");
    const printResult = await window.electronAPI.printReceipt({
      orderId: "CONSOLE_TEST_" + Date.now(),
      total: 25000,
      items: [{ name: "Console Test Item", quantity: 1, price: 25000 }],
      businessName: "CONSOLE TEST",
      address: "Quick ESC/POS Test from Console",
      notes: "Test dari console browser",
      printMode: "escpos", // Force ESC/POS
      allowDialogOnFail: true,
    });

    console.log("Print result:", printResult);

    if (printResult.success) {
      console.log("✅ ESC/POS test successful!");
    } else {
      console.log("❌ Print failed, will try port-by-port test...");

      // 4. Test each port individually
      for (const port of portsResult.ports) {
        if (
          port.friendlyName &&
          port.friendlyName.toLowerCase().includes("bluetooth")
        ) {
          console.log(`Skipping Bluetooth: ${port.path}`);
          continue;
        }

        console.log(
          `Testing port: ${port.path} (${port.friendlyName || "Unknown"})`
        );

        try {
          // Set this port as preferred
          await window.electronAPI.setPreferredSerialPort(port.path, 9600);

          // Test print
          const testResult = await window.electronAPI.printReceipt({
            orderId: "PORT_TEST_" + Date.now(),
            total: 1000,
            items: [{ name: "Port Test", quantity: 1, price: 1000 }],
            businessName: "PORT TEST",
            address: `Testing ${port.path}`,
            notes: "Port detection test",
            printMode: "escpos",
            allowDialogOnFail: false,
          });

          if (testResult.success) {
            console.log(`✅ SUCCESS! Port ${port.path} works!`);
            console.log("🎯 This port has been saved as preferred");
            break;
          } else {
            console.log(
              `❌ Port ${port.path} failed: ${
                testResult.message || "Unknown error"
              }`
            );
          }

          // Small delay between tests
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (portError) {
          console.log(`❌ Port ${port.path} error: ${portError.message}`);
        }
      }
    }
  } catch (error) {
    console.error("❌ Quick test failed:", error);
  }
}

// Run the test
quickESCPOSTest();

// Also expose for manual use
window.quickESCPOSTest = quickESCPOSTest;
