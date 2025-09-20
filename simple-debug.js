// Simple printer debug script - paste this directly into browser console

console.log("🔧 SIMPLE PRINTER DEBUG STARTED");

// Test 1: Check if electronAPI is available
console.log("1️⃣ Testing electronAPI...");
console.log("electronAPI available:", !!window.electronAPI);

if (window.electronAPI) {
  console.log("Available functions:", Object.keys(window.electronAPI));

  // Test 2: Get printers
  console.log("\n2️⃣ Getting printers...");
  window.electronAPI
    .getPrinters()
    .then((printers) => {
      console.log("✅ Printers received:", printers?.length || 0);

      if (printers && printers.length > 0) {
        console.log("\n📋 PRINTER LIST:");
        printers.forEach((p, i) => {
          console.log(
            `${i + 1}. "${p.name}" ${p.isDefault ? "(DEFAULT)" : ""}`
          );
          console.log(`   Status: ${p.status}`);
          console.log(`   Description: ${p.description || "N/A"}`);
        });

        // Test 3: Find POS58
        console.log("\n3️⃣ Looking for POS58 printers...");
        const pos58 = printers.filter((p) => {
          const name = (p.name || "").toLowerCase();
          return (
            name.includes("pos58") ||
            name.includes("pos 58") ||
            name.includes("thermal") ||
            name.includes("generic")
          );
        });

        if (pos58.length > 0) {
          console.log("✅ POS58 candidates found:");
          pos58.forEach((p) => console.log(`  - "${p.name}"`));

          // Test 4: Check current preferred
          window.electronAPI
            .getPreferredPrinter()
            .then((preferred) => {
              console.log(`\n4️⃣ Current preferred: "${preferred || "NONE"}"`);

              // Test 5: Auto-set if needed
              if (!preferred && pos58.length > 0) {
                console.log(`\n5️⃣ Setting "${pos58[0].name}" as preferred...`);
                return window.electronAPI.setPreferredPrinter(pos58[0].name);
              }
              return { success: true, message: "Already set or no candidates" };
            })
            .then((setResult) => {
              console.log("Set result:", setResult);
              if (setResult.success) {
                console.log("✅ SETUP COMPLETE!");
                console.log("\nNext steps:");
                console.log("1. Try the 'Tes Cetak' button in admin panel");
                console.log("2. Or do a real checkout to test auto print");
              } else {
                console.log("❌ Failed to set preferred printer");
              }
            })
            .catch((err) => console.error("Error setting preferred:", err));
        } else {
          console.log("⚠️ No POS58 printers found");
          console.log("Available printers:");
          printers.forEach((p) => console.log(`  - "${p.name}"`));
        }
      } else {
        console.log("❌ NO PRINTERS FOUND!");
        console.log("Troubleshooting:");
        console.log("1. Check Windows Settings → Printers & scanners");
        console.log("2. Make sure POS58 driver is installed");
        console.log("3. Restart the application");
      }
    })
    .catch((error) => {
      console.error("❌ Error getting printers:", error);
    });
} else {
  console.log("❌ electronAPI not available!");
  console.log(
    "Make sure you're running this in the Electron app, not a regular browser"
  );
}

console.log("\n🔍 Debug script completed. Check output above.");

// Simple test print function
window.quickTestPrint = function () {
  console.log("🖨️ Quick test print...");

  const payload = {
    orderId: "TEST" + Date.now(),
    total: 25000,
    items: [{ name: "Test Item", quantity: 1, price: 25000 }],
    businessName: "PRINTER TEST",
    address: new Date().toLocaleString("id-ID"),
    notes: "Test print from debug script",
  };

  window.electronAPI
    .printReceipt(payload)
    .then((result) => {
      console.log("Print result:", result);
      if (result.success) {
        console.log("✅ Print sent successfully!");
      } else {
        console.log("❌ Print failed:", result.failureReason || result.message);
      }
    })
    .catch((error) => {
      console.error("❌ Print error:", error);
    });
};

console.log("\n💡 Use quickTestPrint() to test printing");
