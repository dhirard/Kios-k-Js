// Admin Dashboard JavaScript
let currentTab = "dashboard";
let products = [];
let editingProductId = null;
let categories = [];
let occasions = [];
let selectedImageFile = null; // added for file upload
let components = []; // master components for BOM
let currentBom = []; // working BOM in modal [{component_id, name, price, quantity}]
let currentVariants = []; // working variants [{name, price|null, image|null}]
let selectedVariantImageFile = null; // temporary for adding a variant image via file
let serviceFeeRules = []; // [{mode, min, max|null, fee}]
let artificialItems = [];
let artSelectedImageFile = null;

document.addEventListener("DOMContentLoaded", () => {
  checkAdminAuth();
  setupEventListeners();
  loadDashboardData();
  initPrinterSettings();

  // Add printer debugging tools to global scope for console debugging
  window.debugPrinters = async function () {
    console.log("🔍 STARTING PRINTER DEBUG...");

    try {
      console.log("1️⃣ Getting printer list...");
      const printers = await window.electronAPI.getPrinters();
      console.log("Raw printers result:", printers);

      if (!printers || printers.length === 0) {
        console.log("❌ TIDAK ADA PRINTER TERDETEKSI!");
        console.log("Troubleshooting:");
        console.log("1. Buka Windows Settings → Printers & scanners");
        console.log("2. Pastikan POS58 Printer muncul dan status Ready");
        console.log("3. Restart aplikasi dan coba lagi");
        return "NO_PRINTERS";
      }

      console.log(`📋 DAFTAR ${printers.length} PRINTER:`);
      printers.forEach((p, i) => {
        console.log(`${i + 1}. "${p.name}" ${p.isDefault ? "(DEFAULT)" : ""}`);
        console.log(`   Status: ${p.status || "Unknown"}`);
        console.log(`   Description: ${p.description || "N/A"}`);
      });

      console.log("2️⃣ Checking current preferred printer...");
      const preferred = await window.electronAPI.getPreferredPrinter();
      console.log(`🎯 Current preferred: "${preferred || "TIDAK ADA"}"`);

      console.log("3️⃣ Looking for POS58 candidates...");
      const pos58 = printers.filter((p) => {
        const name = (p.name || "").toLowerCase();
        return (
          name.includes("pos58") ||
          name.includes("pos 58") ||
          name.includes("pos-58") ||
          name.includes("thermal") ||
          (name.includes("generic") && name.includes("text"))
        );
      });

      if (pos58.length > 0) {
        console.log("✅ PRINTER POS58 KANDIDAT DITEMUKAN:");
        pos58.forEach((p, i) => console.log(`  ${i + 1}. "${p.name}"`));

        if (!preferred || !pos58.find((p) => p.name === preferred)) {
          const candidate = pos58[0];
          console.log(`4️⃣ Setting "${candidate.name}" as preferred...`);
          const result = await window.electronAPI.setPreferredPrinter(
            candidate.name
          );
          console.log("Set result:", result);

          if (result.success) {
            console.log("✅ BERHASIL! Printer berhasil diset.");
            console.log("5️⃣ Refreshing UI...");
            if (typeof initPrinterSettings === "function") {
              await initPrinterSettings();
            }
            return "SUCCESS";
          } else {
            console.log("❌ GAGAL SET PRINTER:", result.message);
            return "FAILED_TO_SET";
          }
        } else {
          console.log("✅ Printer sudah diset dengan benar");
          return "ALREADY_SET";
        }
      } else {
        console.log("⚠️ TIDAK MENEMUKAN PRINTER POS58!");
        console.log("Printer yang tersedia:");
        printers.forEach((p) => console.log(`  - "${p.name}"`));
        console.log("\nCoba set manual dengan:");
        console.log(
          `await window.electronAPI.setPreferredPrinter("NAMA_PRINTER_YANG_BENAR")`
        );
        return "NO_POS58_FOUND";
      }
    } catch (error) {
      console.error("❌ ERROR SAAT DEBUG:", error);
      console.error("Error details:", error.message, error.stack);
      return "ERROR";
    }
  };

  window.testQuickPrint = async function () {
    console.log("🖨️ STARTING QUICK TEST PRINT...");

    try {
      console.log("1️⃣ Calling testPrintReceipt function...");
      const result = await testPrintReceipt();
      console.log("Test print completed with result:", result);
      return result;
    } catch (error) {
      console.error("❌ TEST PRINT ERROR:", error);
      return "ERROR";
    }
  };

  // Simple printer list function
  window.listPrinters = async function () {
    console.log("📋 LISTING PRINTERS...");
    try {
      const printers = await window.electronAPI.getPrinters();
      console.log("Printers found:", printers?.length || 0);
      if (printers && printers.length > 0) {
        printers.forEach((p, i) => {
          console.log(`${i + 1}. "${p.name}" (${p.status})`);
        });
      } else {
        console.log("❌ No printers found");
      }
      return printers;
    } catch (error) {
      console.error("❌ Error listing printers:", error);
      return [];
    }
  };

  // Simple test function
  window.simpleTest = function () {
    console.log("✅ Simple test - this should always work");
    console.log("electronAPI available:", !!window.electronAPI);
    console.log("Functions available:", Object.keys(window.electronAPI || {}));
    return "OK";
  };

  // Add quickTestPrint as alias for testQuickPrint
  window.quickTestPrint = function () {
    console.log("🖨️ Running quick test print (alias for testQuickPrint)...");
    window
      .testQuickPrint()
      .then((result) => {
        console.log("✅ Quick test completed:", result);
      })
      .catch((error) => {
        console.error("❌ Quick test error:", error);
      });
  };

  // Force console output version
  window.printTest = async function () {
    console.log("🖨️ FORCE PRINT TEST STARTED");

    try {
      const payload = {
        orderId: "FORCE_TEST_" + Date.now(),
        total: 25000,
        items: [{ name: "TEST ITEM", quantity: 1, price: 25000 }],
        businessName: "PRINTER TEST",
        address: "Force test - " + new Date().toLocaleString("id-ID"),
        notes: "Tes print paksa dari console",
        allowDialogOnFail: true,
      };

      console.log("📤 Sending print payload:", payload);
      const result = await window.electronAPI.printReceipt(payload);
      console.log("📨 Print result received:", result);

      if (result.success) {
        console.log("✅ PRINT SUCCESS! Device:", result.device || "default");
        alert("Print berhasil dikirim! Cek printer Anda.");
      } else {
        console.log("❌ PRINT FAILED:", result.failureReason || result.message);
        console.log("Available printers:", result.printers);
        alert("Print gagal: " + (result.failureReason || result.message));
      }

      return result;
    } catch (error) {
      console.error("❌ PRINT ERROR:", error);
      alert("Error: " + error.message);
      throw error;
    }
  };

  // Enhanced printer finder specifically for EPPOS EP58M
  window.findEPPOSPrinter = async function () {
    console.log("🔍 Looking specifically for EPPOS EP58M printer...");
    try {
      const printers = await window.electronAPI.getPrinters();
      console.log("📋 All printers:");
      printers.forEach((p, i) => {
        console.log(`${i + 1}. "${p.name}" ${p.isDefault ? "(DEFAULT)" : ""}`);
      });

      // Look for EPPOS variations
      const eppos = printers.filter((p) => {
        const name = (p.name || "").toLowerCase();
        return (
          name.includes("eppos") ||
          name.includes("ep58") ||
          name.includes("thermal dot") ||
          name.includes("pos58") ||
          name.includes("pos 58") ||
          (name.includes("thermal") && name.includes("printer"))
        );
      });

      if (eppos.length > 0) {
        console.log("✅ EPPOS/Thermal candidates found:");
        eppos.forEach((p) => console.log(`  - "${p.name}"`));

        // Auto set the first one
        const candidate = eppos[0];
        console.log(`🔧 Setting "${candidate.name}" as preferred printer...`);
        const result = await window.electronAPI.setPreferredPrinter(
          candidate.name
        );

        if (result.success) {
          console.log("✅ SUCCESS! Printer set successfully");
          console.log("Now try: quickTestPrint()");
          return candidate.name;
        } else {
          console.log("❌ Failed to set:", result.message);
          return null;
        }
      } else {
        console.log("❌ No EPPOS/thermal printer found");
        console.log("Try setting manually with one of these:");
        printers.forEach((p) => {
          console.log(
            `await window.electronAPI.setPreferredPrinter("${p.name}")`
          );
        });
        return null;
      }
    } catch (error) {
      console.error("❌ Error finding EPPOS printer:", error);
      return null;
    }
  };

  console.log("🛠️ PRINTER DEBUG TOOLS LOADED");
  console.log("Available functions:");
  console.log("- simpleTest() - test basic functionality");
  console.log("- listPrinters() - list all available printers");
  console.log("- findEPPOSPrinter() - find and setup EPPOS EP58M printer");
  console.log("- debugPrinters() - full printer setup and debug");
  console.log("- testQuickPrint() or quickTestPrint() - test print receipt");
  console.log("- printTest() - FORCE print test with console output + alert");
  console.log("");
  console.log(
    "🎯 QUICK FIX for EPPOS EP58M: Run printTest() for immediate test!"
  );
});

function checkAdminAuth() {
  const adminSession = localStorage.getItem("adminSession");
  if (!adminSession) {
    window.electronAPI.navigateTo("admin-login.html");
    return;
  }

  try {
    const session = JSON.parse(adminSession);
    document.getElementById("admin-name").textContent = session.admin.username;
  } catch (error) {
    console.error("Error parsing admin session:", error);
    window.electronAPI.navigateTo("admin-login.html");
  }
}

function setupEventListeners() {
  // Tab navigation
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      switchTab(e.target.dataset.tab);
    });
  });

  // Logout button
  document.getElementById("logout-btn").addEventListener("click", logout);

  // Product management
  document.getElementById("add-product-btn").addEventListener("click", () => {
    showProductModal();
  });

  document
    .getElementById("product-form")
    .addEventListener("submit", saveProduct);
  document
    .getElementById("cancel-product")
    .addEventListener("click", hideProductModal);

  // Delete confirmation
  document
    .getElementById("cancel-delete")
    .addEventListener("click", hideDeleteModal);
  document
    .getElementById("confirm-delete")
    .addEventListener("click", deleteProduct);

  // Sales filter
  document
    .getElementById("filter-sales")
    .addEventListener("click", filterSales);
  document
    .getElementById("reset-filter")
    .addEventListener("click", resetSalesFilter);

  // Close notification
  document
    .getElementById("notification-close")
    .addEventListener("click", () => {
      document.getElementById("notification").classList.remove("show");
    });

  // Close modals when clicking outside
  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("modal")) {
      e.target.style.display = "none";
    }
  });

  // Category actions
  const addCatBtn = document.getElementById("add-category-btn");
  if (addCatBtn) {
    addCatBtn.addEventListener("click", addCategory);
  }
  const addOccBtn = document.getElementById("add-occasion-btn");
  if (addOccBtn) {
    addOccBtn.addEventListener("click", addOccasion);
  }
  // File upload additions
  const fileInput = document.getElementById("product-image-file");
  const clearBtn = document.getElementById("clear-image-file");
  if (fileInput) fileInput.addEventListener("change", handleImageFileChange);
  if (clearBtn)
    clearBtn.addEventListener("click", () => {
      selectedImageFile = null;
      fileInput.value = "";
      hideImagePreview();
    });

  // Printer settings actions
  const savePrinterBtn = document.getElementById("save-printer");
  const testPrintBtn = document.getElementById("test-print");
  const refreshPrintersBtn = document.getElementById("refresh-printers");
  if (savePrinterBtn)
    savePrinterBtn.addEventListener("click", savePreferredPrinter);
  if (testPrintBtn) testPrintBtn.addEventListener("click", testPrintReceipt);
  if (refreshPrintersBtn)
    refreshPrintersBtn.addEventListener("click", initPrinterSettings);

  // ESC/POS settings actions
  const refreshPortsBtn = document.getElementById("refresh-ports");
  const testEscPosBtn = document.getElementById("test-escpos");
  if (refreshPortsBtn)
    refreshPortsBtn.addEventListener("click", initEscPosSettings);
  if (testEscPosBtn) testEscPosBtn.addEventListener("click", testEscPosPrint);

  // Components tab actions
  const addComponentBtn = document.getElementById("add-component-btn");
  if (addComponentBtn)
    addComponentBtn.addEventListener("click", onAddComponent);

  // Artificial tab actions
  const artAddBtn = document.getElementById("art-add-btn");
  if (artAddBtn) artAddBtn.addEventListener("click", onAddArtificial);
  const artImgFile = document.getElementById("art-image-file");
  if (artImgFile)
    artImgFile.addEventListener("change", (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) {
        artSelectedImageFile = null;
        hideArtPreview();
        return;
      }
      if (!/^image\//i.test(f.type)) {
        showNotification("File harus berupa gambar", "error");
        e.target.value = "";
        artSelectedImageFile = null;
        hideArtPreview();
        return;
      }
      artSelectedImageFile = f;
      showArtPreview(f);
    });

  // Fees tab actions
  const addFeeRowBtn = document.getElementById("add-fee-row");
  if (addFeeRowBtn) addFeeRowBtn.addEventListener("click", addFeeRow);
  const saveFeesBtn = document.getElementById("save-fees");
  if (saveFeesBtn) saveFeesBtn.addEventListener("click", saveServiceFees);
  const reloadFeesBtn = document.getElementById("reload-fees");
  if (reloadFeesBtn) reloadFeesBtn.addEventListener("click", loadServiceFees);

  // Variant editor actions
  const variantAddBtn = document.getElementById("variant-add");
  if (variantAddBtn)
    variantAddBtn.addEventListener("click", addVariantFromInputs);
  const varImgFile = document.getElementById("variant-image-file");
  if (varImgFile)
    varImgFile.addEventListener("change", (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) {
        selectedVariantImageFile = null;
        return;
      }
      if (!/^image\//i.test(f.type)) {
        showNotification("File varian harus berupa gambar", "error");
        e.target.value = "";
        selectedVariantImageFile = null;
        return;
      }
      selectedVariantImageFile = f;
    });

  // Component modal events
  const compType = document.getElementById("component-type");
  if (compType)
    compType.addEventListener("change", applyComponentTypeVisibility);
  const cancelComp = document.getElementById("cancel-component");
  if (cancelComp) cancelComp.addEventListener("click", closeComponentModal);
  const compForm = document.getElementById("component-form");
  if (compForm) compForm.addEventListener("submit", saveComponentFromModal);
}

function switchTab(tabName) {
  // Update tab buttons
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.remove("active");
  });
  document.querySelector(`[data-tab="${tabName}"]`).classList.add("active");

  // Update tab content
  document.querySelectorAll(".tab-content").forEach((content) => {
    content.classList.remove("active");
  });
  document.getElementById(`${tabName}-tab`).classList.add("active");

  currentTab = tabName;

  // Load tab-specific data
  switch (tabName) {
    case "dashboard":
      loadDashboardData();
      break;
    case "products":
      loadProducts();
      break;
    case "sales":
      loadSalesReport();
      break;
    case "categories":
      loadCategories();
      break;
    case "occasions":
      loadOccasions();
      break;
    case "components":
      loadComponents();
      break;
    case "fees":
      loadServiceFees();
      break;
    case "artificial":
      loadArtificialItems();
      break;
  }
}

async function loadDashboardData() {
  try {
    // Load sales summary
    const summary = await window.electronAPI.getSalesSummary();
    if (summary) {
      document.getElementById("total-orders").textContent =
        summary.total_orders || 0;
      document.getElementById("total-items").textContent =
        summary.total_items_sold || 0;
      document.getElementById("total-revenue").textContent =
        window.electronAPI.formatCurrency(summary.total_revenue || 0);
      document.getElementById("avg-order").textContent =
        window.electronAPI.formatCurrency(summary.average_order_value || 0);
    }

    // Load top products
    loadTopProducts();
  } catch (error) {
    console.error("Error loading dashboard data:", error);
    showNotification("Gagal memuat data dashboard", "error");
  }
}

/* =============================
   SERVICE FEE RULES MANAGEMENT
   ============================= */
async function loadServiceFees() {
  try {
    const rules = await window.electronAPI.getServiceFeeRules();
    serviceFeeRules = Array.isArray(rules)
      ? rules.map((r) => ({
          mode: r.mode,
          min: r.min || 0,
          max: r.max ?? null,
          fee: r.fee || 0,
        }))
      : [];
    renderServiceFees();
  } catch (e) {
    console.error("loadServiceFees error", e);
    serviceFeeRules = [];
    renderServiceFees();
  }
}

function renderServiceFees() {
  const body = document.getElementById("fees-body");
  if (!body) return;
  if (!serviceFeeRules.length) {
    body.innerHTML =
      '<tr><td colspan="5" class="no-data">Belum ada aturan</td></tr>';
    return;
  }
  body.innerHTML = serviceFeeRules
    .map(
      (r, idx) => `
      <tr data-fee-idx="${idx}">
        <td>
          <select class="inline-edit fee-mode">
            <option value="custom-komponen" ${
              r.mode === "custom-komponen" ? "selected" : ""
            }>Custom Bunga</option>
            <option value="custom-bucket-produk" ${
              r.mode === "custom-bucket-produk" ? "selected" : ""
            }>Custom Produk</option>
          </select>
        </td>
        <td><input type="number" min="0" value="${
          r.min
        }" class="inline-edit fee-min" style="width:100px" /></td>
        <td><input type="number" min="0" value="${
          r.max == null ? "" : r.max
        }" placeholder="Tanpa batas" class="inline-edit fee-max" style="width:120px" /></td>
        <td><input type="number" min="0" step="500" value="${
          r.fee
        }" class="inline-edit fee-fee" style="width:140px" /></td>
        <td><button class="btn btn-danger btn-small" onclick="removeFeeRow(${idx})">Hapus</button></td>
      </tr>
    `
    )
    .join("");
  // Wire edits
  body.querySelectorAll("tr").forEach((tr) => {
    const idx = parseInt(tr.getAttribute("data-fee-idx"), 10);
    tr.querySelector(".fee-mode").addEventListener("change", (e) => {
      serviceFeeRules[idx].mode = e.target.value;
    });
    tr.querySelector(".fee-min").addEventListener("input", (e) => {
      serviceFeeRules[idx].min = Math.max(
        0,
        parseInt(e.target.value || "0", 10)
      );
    });
    tr.querySelector(".fee-max").addEventListener("input", (e) => {
      const v = e.target.value;
      serviceFeeRules[idx].max =
        v === "" ? null : Math.max(0, parseInt(v || "0", 10));
    });
    tr.querySelector(".fee-fee").addEventListener("input", (e) => {
      serviceFeeRules[idx].fee = Math.max(0, Number(e.target.value || 0) || 0);
    });
  });
}

function addFeeRow() {
  serviceFeeRules.push({ mode: "custom-komponen", min: 0, max: null, fee: 0 });
  renderServiceFees();
}

function removeFeeRow(idx) {
  serviceFeeRules.splice(idx, 1);
  renderServiceFees();
}

async function saveServiceFees() {
  // basic normalization: ensure numbers
  const normalized = serviceFeeRules.map((r) => ({
    mode:
      r.mode === "custom-bucket-produk"
        ? "custom-bucket-produk"
        : "custom-komponen",
    min: Math.max(0, parseInt(r.min || 0, 10)),
    max:
      r.max == null || r.max === ""
        ? null
        : Math.max(0, parseInt(r.max || 0, 10)),
    fee: Math.max(0, Number(r.fee) || 0),
  }));
  try {
    const res = await window.electronAPI.setServiceFeeRules(normalized);
    if (res && res.success) {
      showNotification("Aturan jasa tersimpan", "success");
      loadServiceFees();
    } else {
      showNotification(res?.message || "Gagal menyimpan aturan", "error");
    }
  } catch (e) {
    console.error("saveServiceFees error", e);
    showNotification("Terjadi kesalahan saat menyimpan", "error");
  }
}

async function loadTopProducts() {
  const loading = document.getElementById("top-products-loading");
  const list = document.getElementById("top-products-list");

  try {
    loading.style.display = "flex";
    const topProducts = await window.electronAPI.getTopProducts(5);

    if (topProducts.length === 0) {
      list.innerHTML = '<div class="no-data">Belum ada data penjualan</div>';
    } else {
      list.innerHTML = topProducts
        .map(
          (p, i) => `
            <div class="top-product-item">
              <div class="rank">#${i + 1}</div>
              <div class="product-info">
                <img src="${p.image || "assets/no-image.png"}" alt="${
            p.name
          }" class="product-thumb" />
                <div class="product-details">
                  <h4>${p.name}</h4>
                  <p>${window.electronAPI.formatCurrency(p.price)}</p>
                </div>
              </div>
              <div class="product-stats">
                <div class="stat"><span class="label">Terjual:</span><span class="value">${
                  p.total_sold
                }</span></div>
                <div class="stat"><span class="label">Revenue:</span><span class="value">${window.electronAPI.formatCurrency(
                  p.total_revenue
                )}</span></div>
              </div>
            </div>`
        )
        .join("");
    }
  } catch (error) {
    console.error("Error loading top products:", error);
    list.innerHTML =
      '<div class="error">Gagal memuat data produk terlaris</div>';
  } finally {
    loading.style.display = "none";
  }
}

async function loadProducts() {
  const loading = document.getElementById("products-loading");
  const container = document.getElementById("products-table-container");
  const tbody = document.getElementById("products-table-body");

  try {
    loading.style.display = "flex";
    container.style.display = "none";

    products = await window.electronAPI.getProducts();

    if (products.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="8" class="no-data">Belum ada produk</td></tr>';
    } else {
      tbody.innerHTML = products
        .map(
          (p) => `
          <tr>
            <td>${p.id}</td>
            <td><img src="${p.image || "assets/no-image.png"}" alt="${
            p.name
          }" class="product-thumb" /></td>
            <td>${p.name}</td>
            <td>${p.category_name || "-"}</td>
            <td>${p.occasion_name || "-"}</td>
            <td>${window.electronAPI.formatCurrency(p.price)}</td>
            <td>${new Date(p.created_at).toLocaleDateString("id-ID")}</td>
            <td class="action-buttons">
              <button class="btn-secondary btn-small" onclick="editProduct(${
                p.id
              })">Edit</button>
              <button class="btn-danger btn-small" onclick="confirmDeleteProduct(${
                p.id
              }, '${p.name.replace(/'/g, "&apos;")}')">Hapus</button>
            </td>
          </tr>`
        )
        .join("");
    }

    container.style.display = "block";
  } catch (error) {
    console.error("Error loading products:", error);
    showNotification("Gagal memuat produk", "error");
  } finally {
    loading.style.display = "none";
  }
}

async function loadSalesReport(startDate = null, endDate = null) {
  const loading = document.getElementById("sales-loading");
  const container = document.getElementById("sales-table-container");
  const tbody = document.getElementById("sales-table-body");

  try {
    loading.style.display = "flex";
    container.style.display = "none";

    const sales = await window.electronAPI.getSalesReport(startDate, endDate);

    if (sales.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="7" class="no-data">Tidak ada data penjualan</td></tr>';
    } else {
      tbody.innerHTML = sales
        .map((sale) => {
          const name = sale.product_name || "-";
          const detailsArr = Array.isArray(sale.details) ? sale.details : [];
          const detailsHtml = detailsArr.length
            ? `<div class="small-note" style="white-space: pre-wrap;">${detailsArr
                .map((d) => escapeHtml(String(d)))
                .join("\n")}</div>`
            : "-";
          return `
            <tr>
              <td>${new Date(sale.sale_date).toLocaleDateString("id-ID")}</td>
              <td>${escapeHtml(name)}</td>
              <td>${detailsHtml}</td>
              <td>${sale.quantity}</td>
              <td>${window.electronAPI.formatCurrency(sale.unit_price)}</td>
              <td>${window.electronAPI.formatCurrency(sale.subtotal)}</td>
              <td>${window.electronAPI.formatCurrency(sale.order_total)}</td>
            </tr>`;
        })
        .join("");
    }

    container.style.display = "block";
  } catch (error) {
    console.error("Error loading sales report:", error);
    showNotification("Gagal memuat laporan penjualan", "error");
  } finally {
    loading.style.display = "none";
  }
}

function showProductModal(productId = null) {
  const modal = document.getElementById("product-modal");
  const title = document.getElementById("product-modal-title");

  editingProductId = productId;

  // Ensure selects are populated (in case user opens modal before visiting tabs)
  if (!categories.length) loadCategories();
  if (!occasions.length) loadOccasions();

  const idField = document.getElementById("product-id");
  const nameField = document.getElementById("product-name");
  const priceField = document.getElementById("product-price");
  const imageField = document.getElementById("product-image");
  const fileInput = document.getElementById("product-image-file");
  selectedImageFile = null;
  if (fileInput) fileInput.value = "";
  hideImagePreview();
  const descField = document.getElementById("product-description");
  const catSelect = document.getElementById("product-category");
  const occSelect = document.getElementById("product-occasion");
  // Prepare BOM UI
  currentBom = [];
  currentVariants = [];
  ensureComponentsLoaded();
  populateBomSelect();
  renderBomTable();
  renderVariantTable();
  const bomAdd = document.getElementById("bom-add");
  if (bomAdd) bomAdd.onclick = addBomRowFromSelect;
  const variantAddBtn2 = document.getElementById("variant-add");
  if (variantAddBtn2) variantAddBtn2.onclick = addVariantFromInputs;

  if (productId) {
    const product = products.find((p) => p.id === productId);
    if (product) {
      title.textContent = "Edit Produk";
      idField.value = product.id;
      nameField.value = product.name;
      priceField.value = product.price;
      imageField.value = product.image || "";
      descField.value = product.description || "";
      if (product.category_id) catSelect.value = product.category_id;
      else catSelect.value = "";
      if (product.occasion_id) occSelect.value = product.occasion_id;
      else occSelect.value = "";
      // Load BOM for product
      loadProductBom(product.id);
      // Load variants
      loadProductVariants(product.id);
    }
  } else {
    title.textContent = "Tambah Produk";
    idField.value = "";
    nameField.value = "";
    priceField.value = "";
    imageField.value = "";
    descField.value = "";
    catSelect.value = "";
    occSelect.value = "";
    currentBom = [];
    renderBomTable();
    currentVariants = [];
    renderVariantTable();
  }

  modal.style.display = "flex";
}

async function saveProduct(e) {
  e.preventDefault();
  const name = document.getElementById("product-name").value.trim();
  const price = parseFloat(document.getElementById("product-price").value);
  const imageUrlValue = document.getElementById("product-image").value.trim();
  const description = document
    .getElementById("product-description")
    .value.trim();
  const categoryId = document.getElementById("product-category").value || null;
  const occasionId = document.getElementById("product-occasion").value || null;
  const saveBtn = document.getElementById("save-product");
  if (!name || !price || price <= 0) {
    showNotification("Mohon isi nama dan harga produk dengan benar", "error");
    return;
  }
  try {
    saveBtn.textContent = "Menyimpan...";
    saveBtn.disabled = true;
    let finalImagePath = imageUrlValue || null;
    if (selectedImageFile) {
      const dataUrl = await fileToDataUrl(selectedImageFile);
      console.log(
        "[DBG saveProduct] uploading file",
        selectedImageFile.name,
        "size",
        selectedImageFile.size
      );
      const saveRes = await window.electronAPI.saveImage(
        selectedImageFile.name,
        dataUrl
      );
      if (saveRes && saveRes.success) {
        finalImagePath = saveRes.relativePath;
        console.log("[DBG saveProduct] image saved as", finalImagePath);
      } else {
        showNotification(
          `Gagal menyimpan gambar: ${saveRes?.message || "Unknown"}`,
          "error"
        );
        return;
      }
    }
    console.log("[DBG saveProduct] sending product data", {
      editingProductId,
      name,
      price,
      finalImagePath,
      categoryId,
      occasionId,
    });
    let success;
    if (editingProductId) {
      success = await window.electronAPI.adminUpdateProduct(
        editingProductId,
        name,
        price,
        finalImagePath,
        description,
        categoryId ? parseInt(categoryId, 10) : null,
        occasionId ? parseInt(occasionId, 10) : null
      );
      // Save BOM mapping after product update
      if (success && currentBom.length) {
        await window.electronAPI.setProductComponents(
          editingProductId,
          currentBom.map((it) => ({
            component_id: it.component_id,
            quantity: it.quantity,
          }))
        );
      } else if (success && currentBom.length === 0) {
        await window.electronAPI.setProductComponents(editingProductId, []);
      }
      // Save variants after product update
      if (success) {
        await window.electronAPI.setProductVariants(
          editingProductId,
          currentVariants.map((v) => ({
            name: v.name,
            price: v.price,
            image: v.image || null,
          }))
        );
      }
    } else {
      success = await window.electronAPI.adminAddProduct(
        name,
        price,
        finalImagePath,
        description,
        categoryId ? parseInt(categoryId, 10) : null,
        occasionId ? parseInt(occasionId, 10) : null
      );
      // When adding: success returns {id}
      if (success && success.id) {
        await window.electronAPI.setProductComponents(
          success.id,
          currentBom.map((it) => ({
            component_id: it.component_id,
            quantity: it.quantity,
          }))
        );
        await window.electronAPI.setProductVariants(
          success.id,
          currentVariants.map((v) => ({
            name: v.name,
            price: v.price,
            image: v.image || null,
          }))
        );
      }
    }
    console.log("[DBG saveProduct] result", success);
    if (success) {
      showNotification(
        editingProductId
          ? "Produk berhasil diperbarui"
          : "Produk berhasil ditambahkan",
        "success"
      );
      hideProductModal();
      loadProducts();
    } else {
      showNotification("Gagal menyimpan produk", "error");
    }
  } catch (err) {
    console.error("Error saving product:", err);
    showNotification("Terjadi kesalahan sistem", "error");
  } finally {
    saveBtn.textContent = "Simpan";
    saveBtn.disabled = false;
  }
}

function hideProductModal() {
  const modal = document.getElementById("product-modal");
  if (modal) modal.style.display = "none";
}

/* =============================
   CATEGORY & OCCASION MANAGEMENT
   ============================= */
async function loadCategories() {
  try {
    categories = await window.electronAPI.getCategories();
    renderCategories();
    populateCategorySelect();
  } catch (e) {
    console.error("loadCategories error", e);
  }
}
function renderCategories() {
  const body = document.getElementById("categories-body");
  if (!categories.length) {
    body.innerHTML =
      '<tr><td colspan="3" class="no-data">Belum ada kategori</td></tr>';
    return;
  }
  body.innerHTML = categories
    .map(
      (c) => `<tr>
        <td>${c.id}</td>
        <td><input data-cat-id="${c.id}" value="${c.name}" class="inline-edit" style="width:100%; padding:.35rem .5rem; border:1px solid #ddd; border-radius:6px;" /></td>
        <td>
          <button class="btn-secondary btn-small" onclick="updateCategory(${c.id})">Simpan</button>
          <button class="btn-danger btn-small" onclick="deleteCategory(${c.id})">Hapus</button>
        </td>
      </tr>`
    )
    .join("");
}
async function addCategory() {
  const input = document.getElementById("new-category-name");
  const name = input.value.trim();
  if (!name) return;
  const btn = document.getElementById("add-category-btn");
  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = "...";
  try {
    const res = await window.electronAPI.addCategory(name);
    if (res) {
      input.value = "";
      loadCategories();
      showNotification("Kategori ditambahkan", "success");
    } else {
      showNotification("Gagal menambah kategori", "error");
    }
  } catch (e) {
    console.error("addCategory error", e);
    const msg = /UNIQUE/i.test(e.message || "")
      ? "Kategori sudah ada"
      : "Terjadi kesalahan menambah kategori";
    showNotification(msg, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}
async function updateCategory(id) {
  const f = document.querySelector(`input[data-cat-id='${id}']`);
  if (!f) return;
  const name = f.value.trim();
  const res = await window.electronAPI.updateCategory(id, name);
  if (res) showNotification("Kategori diperbarui", "success");
}
async function deleteCategory(id) {
  if (!confirm("Hapus kategori ini? Produk akan kehilangan kategori.")) return;
  const res = await window.electronAPI.deleteCategory(id);
  if (res) {
    showNotification("Kategori dihapus", "success");
    loadCategories();
  }
}
function populateCategorySelect() {
  const sel = document.getElementById("product-category");
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML =
    '<option value="">-- Pilih Kategori --</option>' +
    categories
      .map((c) => `<option value="${c.id}">${c.name}</option>`)
      .join("");
  if (current) sel.value = current;
}

async function loadOccasions() {
  try {
    occasions = await window.electronAPI.getOccasions();
    renderOccasions();
    populateOccasionSelect();
  } catch (e) {
    console.error(e);
  }
}
function renderOccasions() {
  const body = document.getElementById("occasions-body");
  if (!occasions.length) {
    body.innerHTML =
      '<tr><td colspan="3" class="no-data">Belum ada occasion</td></tr>';
    return;
  }
  body.innerHTML = occasions
    .map(
      (o) => `<tr>
    <td>${o.id}</td>
    <td><input data-occ-id="${o.id}" value="${o.name}" class="inline-edit" style="width:100%; padding:.35rem .5rem; border:1px solid #ddd; border-radius:6px;" /></td>
    <td>
      <button class="btn-secondary btn-small" onclick="updateOccasion(${o.id})">Simpan</button>
      <button class="btn-danger btn-small" onclick="deleteOccasion(${o.id})">Hapus</button>
    </td>
  </tr>`
    )
    .join("");
}
async function addOccasion() {
  const input = document.getElementById("new-occasion-name");
  const name = input.value.trim();
  if (!name) return;
  const btn = document.getElementById("add-occasion-btn");
  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = "...";
  try {
    const res = await window.electronAPI.addOccasion(name);
    if (res) {
      input.value = "";
      loadOccasions();
      showNotification("Occasion ditambahkan", "success");
    } else {
      showNotification("Gagal menambah occasion", "error");
    }
  } catch (e) {
    console.error("addOccasion error", e);
    const msg = /UNIQUE/i.test(e.message || "")
      ? "Occasion sudah ada"
      : "Terjadi kesalahan menambah occasion";
    showNotification(msg, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}
async function updateOccasion(id) {
  const f = document.querySelector(`input[data-occ-id='${id}']`);
  if (!f) return;
  const name = f.value.trim();
  const res = await window.electronAPI.updateOccasion(id, name);
  if (res) showNotification("Occasion diperbarui", "success");
}
async function deleteOccasion(id) {
  if (!confirm("Hapus occasion ini? Produk akan kehilangan occasion.")) return;
  const res = await window.electronAPI.deleteOccasion(id);
  if (res) {
    showNotification("Occasion dihapus", "success");
    loadOccasions();
  }
}
function populateOccasionSelect() {
  const sel = document.getElementById("product-occasion");
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML =
    '<option value="">-- Pilih Occasion --</option>' +
    occasions.map((o) => `<option value="${o.id}">${o.name}</option>`).join("");
  if (current) sel.value = current;
}

/* =============================
   COMPONENTS (MASTER) MANAGEMENT
   ============================= */
async function ensureComponentsLoaded() {
  if (!components.length) {
    try {
      components = await window.electronAPI.getComponents();
    } catch (e) {
      console.error("getComponents error", e);
      components = [];
    }
  }
}

async function loadComponents() {
  try {
    components = await window.electronAPI.getComponents();
    renderComponentsTable();
  } catch (e) {
    console.error("loadComponents error", e);
  }
}

function renderComponentsTable() {
  const body = document.getElementById("components-body");
  if (!body) return;
  if (!components.length) {
    body.innerHTML =
      '<tr><td colspan="7" class="no-data">Belum ada komponen</td></tr>';
    return;
  }
  body.innerHTML = components
    .map(
      (c) => `<tr>
        <td>${c.id}</td>
        <td><input data-comp-id="${c.id}" data-k="name" value="${escapeHtml(
        c.name
      )}" class="inline-edit" /></td>
        <td>
          <select data-comp-id="${c.id}" data-k="type" class="inline-edit">
            <option value="material" ${
              c.type !== "service" ? "selected" : ""
            }>Material</option>
            <option value="service" ${
              c.type === "service" ? "selected" : ""
            }>Jasa</option>
          </select>
        </td>
        <td><input data-comp-id="${c.id}" data-k="unit" value="${escapeHtml(
        c.unit || ""
      )}" class="inline-edit" style="width:90px" /></td>
        <td><input data-comp-id="${
          c.id
        }" data-k="price" type="number" step="100" value="${
        Number(c.price) || 0
      }" class="inline-edit" style="width:120px" /></td>
        <td>${
          c.type === "service"
            ? "-"
            : `<input data-comp-id="${
                c.id
              }" data-k="stock" type="number" step="1" value="${
                Number(c.stock) || 0
              }" class="inline-edit" style="width:100px" />`
        }</td>
        <td>
          <button class="btn-secondary btn-small" onclick="updateComponent(${
            c.id
          })">Simpan</button>
          <button class="btn-danger btn-small" onclick="deleteComponent(${
            c.id
          })">Hapus</button>
        </td>
      </tr>`
    )
    .join("");
}

/* =============================
   ARTIFICIAL ITEMS MANAGEMENT
   ============================= */
async function loadArtificialItems() {
  try {
    const body = document.getElementById("art-body");
    if (body) body.innerHTML = '<tr><td colspan="5">Memuat...</td></tr>';
    artificialItems = await window.electronAPI.getArtificialItems();
    renderArtificialTable();
  } catch (e) {
    console.error("loadArtificialItems", e);
    renderArtificialTable();
  }
}

function renderArtificialTable() {
  const body = document.getElementById("art-body");
  if (!body) return;
  if (!artificialItems || artificialItems.length === 0) {
    body.innerHTML =
      '<tr><td colspan="5" class="no-data">Belum ada data</td></tr>';
    return;
  }
  body.innerHTML = artificialItems
    .map(
      (it) => `<tr data-art-id="${it.id}">
        <td>${it.id}</td>
        <td>
          <div style="display:flex;align-items:center;gap:6px">
            <img src="${
              it.image || "assets/no-image.png"
            }" alt="thumb" style="width:42px;height:42px;object-fit:cover;border:1px solid #ddd;border-radius:6px" onerror="this.src='assets/no-image.png'" />
            <input class="inline-edit" data-k="image" value="${escapeHtml(
              it.image || ""
            )}" placeholder="URL gambar" />
          </div>
        </td>
        <td><input class="inline-edit" data-k="name" value="${escapeHtml(
          it.name
        )}" /></td>
        <td><input class="inline-edit" data-k="price" type="number" min="0" step="1000" value="${
          Number(it.price) || 0
        }" style="width:140px" /></td>
        <td>${new Date(it.created_at || Date.now()).toLocaleString(
          "id-ID"
        )}</td>
        <td>
          <button class="btn btn-secondary btn-small" data-art-act="save">Simpan</button>
          <button class="btn btn-danger btn-small" data-art-act="del">Hapus</button>
        </td>
      </tr>`
    )
    .join("");
  // Wire actions
  body.querySelectorAll("[data-art-act='save']").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const tr = btn.closest("tr");
      const id = parseInt(tr.getAttribute("data-art-id"), 10);
      const name = tr.querySelector('[data-k="name"]').value.trim();
      const price =
        Number(tr.querySelector('[data-k="price"]').value || 0) || 0;
      const image =
        (tr.querySelector('[data-k="image"]').value || "").trim() || null;
      const res = await window.electronAPI.adminUpdateArtificial(id, {
        name,
        price,
        image,
      });
      if (res && res.changes) showNotification("Tersimpan", "success");
    });
  });
  body.querySelectorAll("[data-art-act='del']").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Hapus item artificial ini?")) return;
      const tr = btn.closest("tr");
      const id = parseInt(tr.getAttribute("data-art-id"), 10);
      const res = await window.electronAPI.adminDeleteArtificial(id);
      if (res && res.changes) {
        showNotification("Dihapus", "success");
        artificialItems = artificialItems.filter((x) => x.id !== id);
        renderArtificialTable();
      }
    });
  });
}

async function onAddArtificial() {
  const nameEl = document.getElementById("art-name");
  const priceEl = document.getElementById("art-price");
  const urlEl = document.getElementById("art-image");
  const name = (nameEl?.value || "").trim();
  const price = Number(priceEl?.value || 0) || 0;
  if (!name || price <= 0) {
    showNotification("Isi nama dan harga yang benar", "error");
    return;
  }
  try {
    let finalImage = (urlEl?.value || "").trim() || null;
    if (artSelectedImageFile) {
      const dataUrl = await fileToDataUrl(artSelectedImageFile);
      const up = await window.electronAPI.saveImage(
        artSelectedImageFile.name,
        dataUrl
      );
      if (up && up.success) finalImage = up.relativePath;
    }
    const res = await window.electronAPI.adminAddArtificial(
      name,
      price,
      finalImage
    );
    if (res && res.id) {
      showNotification("Artificial ditambahkan", "success");
      if (nameEl) nameEl.value = "";
      if (priceEl) priceEl.value = "";
      if (urlEl) urlEl.value = "";
      const fileEl = document.getElementById("art-image-file");
      if (fileEl) fileEl.value = "";
      artSelectedImageFile = null;
      hideArtPreview();
      await loadArtificialItems();
    } else {
      showNotification("Gagal menambah", "error");
    }
  } catch (e) {
    console.error("adminAddArtificial", e);
    showNotification("Terjadi kesalahan", "error");
  }
}

function showArtPreview(file) {
  const box = document.getElementById("art-img-preview");
  const img = document.getElementById("art-img-preview-img");
  if (!box || !img) return;
  const url = URL.createObjectURL(file);
  img.src = url;
  box.style.display = "block";
}
function hideArtPreview() {
  const box = document.getElementById("art-img-preview");
  const img = document.getElementById("art-img-preview-img");
  if (img) img.src = "";
  if (box) box.style.display = "none";
}

// Open the Add Component modal
function onAddComponent() {
  openComponentModal();
}

function openComponentModal() {
  const modal = document.getElementById("component-modal");
  if (!modal) return;
  // reset form fields
  const nameEl = document.getElementById("component-name");
  const typeEl = document.getElementById("component-type");
  const unitEl = document.getElementById("component-unit");
  const priceEl = document.getElementById("component-price");
  const stockEl = document.getElementById("component-stock");
  if (nameEl) nameEl.value = "";
  if (typeEl) typeEl.value = "material";
  if (unitEl) unitEl.value = "";
  if (priceEl) priceEl.value = "";
  if (stockEl) stockEl.value = "0";
  applyComponentTypeVisibility();
  modal.style.display = "flex";
}

function closeComponentModal() {
  const modal = document.getElementById("component-modal");
  if (modal) modal.style.display = "none";
}

function applyComponentTypeVisibility() {
  const typeEl = document.getElementById("component-type");
  const unitGroup = document.getElementById("unit-group");
  const stockGroup = document.getElementById("stock-group");
  const isService = typeEl && typeEl.value === "service";
  if (unitGroup) unitGroup.style.display = isService ? "none" : "block";
  if (stockGroup) stockGroup.style.display = isService ? "none" : "block";
}

async function saveComponentFromModal(e) {
  e.preventDefault();
  const name = (document.getElementById("component-name")?.value || "").trim();
  const type = document.getElementById("component-type")?.value || "material";
  const unit =
    type === "service"
      ? ""
      : (document.getElementById("component-unit")?.value || "").trim();
  const price =
    Number(document.getElementById("component-price")?.value || 0) || 0;
  const stock =
    type === "service"
      ? 0
      : Number(document.getElementById("component-stock")?.value || 0) || 0;

  if (!name) {
    showNotification("Nama komponen/jasa wajib diisi", "error");
    return;
  }
  if (price < 0) {
    showNotification("Harga tidak boleh negatif", "error");
    return;
  }

  try {
    const res = await window.electronAPI.addComponent(
      name,
      unit,
      price,
      stock,
      type
    );
    if (res && res.id) {
      showNotification("Komponen ditambahkan", "success");
      closeComponentModal();
      // refresh components list and BOM selector if present
      components = await window.electronAPI.getComponents();
      renderComponentsTable();
      populateBomSelect();
    } else {
      showNotification("Gagal menambah komponen", "error");
    }
  } catch (err) {
    console.error("addComponent error", err);
    showNotification("Terjadi kesalahan menambah komponen", "error");
  }
}

async function updateComponent(id) {
  const fields = {};
  document.querySelectorAll(`[data-comp-id='${id}']`).forEach((el) => {
    const k = el.getAttribute("data-k");
    let v = el.value;
    if (k === "price" || k === "stock") v = Number(v) || 0;
    fields[k] = v;
  });
  const res = await window.electronAPI.updateComponent(id, fields);
  if (res && res.changes) {
    showNotification("Komponen diperbarui", "success");
    loadComponents();
  } else {
    showNotification("Gagal memperbarui", "error");
  }
}

async function deleteComponent(id) {
  if (!confirm("Hapus komponen ini? Akan dihapus dari semua produk.")) return;
  const res = await window.electronAPI.deleteComponent(id);
  if (res && res.changes) {
    showNotification("Komponen dihapus", "success");
    loadComponents();
  } else {
    showNotification("Gagal menghapus komponen", "error");
  }
}

/* =============================
   BOM EDITOR (inside product modal)
   ============================= */
function populateBomSelect() {
  const sel = document.getElementById("bom-component-select");
  if (!sel) return;
  sel.innerHTML = components
    .map(
      (c) =>
        `<option value="${c.id}">${escapeHtml(c.name)} (${
          c.type === "service" ? "jasa" : c.unit || "-"
        })</option>`
    )
    .join("");
}

async function loadProductBom(productId) {
  try {
    const bomItems = await window.electronAPI.getProductComponents(productId);
    currentBom = bomItems.map((it) => ({
      component_id: it.component_id,
      name: it.name,
      price: Number(it.price) || 0,
      quantity: Number(it.quantity) || 1,
    }));
    renderBomTable();
  } catch (e) {
    console.error("loadProductBom error", e);
  }
}

function addBomRowFromSelect() {
  const sel = document.getElementById("bom-component-select");
  const qtyEl = document.getElementById("bom-qty");
  if (!sel || !qtyEl || !sel.value) return;
  const compId = parseInt(sel.value, 10);
  const comp = components.find((c) => c.id === compId);
  if (!comp) return;
  const qty = Math.max(1, parseInt(qtyEl.value || "1", 10));
  const existing = currentBom.find((b) => b.component_id === compId);
  if (existing) existing.quantity += qty;
  else
    currentBom.push({
      component_id: comp.id,
      name: comp.name,
      price: Number(comp.price) || 0,
      quantity: qty,
    });
  renderBomTable();
}

function renderBomTable() {
  const body = document.getElementById("bom-body");
  const totalEl = document.getElementById("bom-total");
  if (!body || !totalEl) return;
  if (!currentBom.length) {
    body.innerHTML =
      '<tr><td colspan="5" class="no-data">Belum ada komponen</td></tr>';
    totalEl.textContent = formatCurrencyIDR(0);
    return;
  }
  let total = 0;
  body.innerHTML = currentBom
    .map((it) => {
      const sub = (Number(it.price) || 0) * (Number(it.quantity) || 0);
      total += sub;
      return `<tr>
        <td>${escapeHtml(it.name)}</td>
        <td><input type="number" min="1" step="1" value="${
          it.quantity
        }" style="width:80px" data-bom-id="${
        it.component_id
      }" class="bom-qty" /></td>
        <td>${formatCurrencyIDR(it.price)}</td>
        <td>${formatCurrencyIDR(sub)}</td>
        <td><button type="button" class="btn btn-danger btn-small" data-bom-remove="${
          it.component_id
        }">Hapus</button></td>
      </tr>`;
    })
    .join("");
  totalEl.textContent = formatCurrencyIDR(total);
  // Wire qty changes and remove
  body.querySelectorAll(".bom-qty").forEach((el) => {
    el.addEventListener("input", () => {
      const id = parseInt(el.getAttribute("data-bom-id"), 10);
      const row = currentBom.find((b) => b.component_id === id);
      if (row) {
        row.quantity = Math.max(1, parseInt(el.value || "1", 10));
        renderBomTable();
      }
    });
  });
  body.querySelectorAll("[data-bom-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = parseInt(btn.getAttribute("data-bom-remove"), 10);
      currentBom = currentBom.filter((b) => b.component_id !== id);
      renderBomTable();
    });
  });
}

/* =============================
   VARIANT EDITOR (inside product modal)
   ============================= */
async function loadProductVariants(productId) {
  try {
    const items = await window.electronAPI.getProductVariants(productId);
    currentVariants = (items || []).map((v) => ({
      name: v.name,
      price: typeof v.price === "number" ? v.price : null,
      image: v.image || null,
    }));
    renderVariantTable();
  } catch (e) {
    console.error("loadProductVariants error", e);
  }
}

function addVariantFromInputs() {
  const nameEl = document.getElementById("variant-name");
  const priceEl = document.getElementById("variant-price");
  const urlEl = document.getElementById("variant-image");
  if (!nameEl) return;
  const name = (nameEl.value || "").trim();
  let priceRaw = priceEl ? priceEl.value : "";
  if (!name) {
    showNotification("Nama varian wajib diisi", "error");
    return;
  }
  const price = priceRaw === "" ? null : Number(priceRaw) || 0;
  // handle image: prefer uploaded file -> save -> use returned path; else use URL input if provided
  const finishPush = (imagePath) => {
    currentVariants.push({
      name,
      price,
      image: imagePath || urlEl?.value?.trim() || null,
    });
    nameEl.value = "";
    if (priceEl) priceEl.value = "";
    if (urlEl) urlEl.value = "";
    const f = document.getElementById("variant-image-file");
    if (f) f.value = "";
    selectedVariantImageFile = null;
    renderVariantTable();
  };

  if (selectedVariantImageFile) {
    fileToDataUrl(selectedVariantImageFile)
      .then((dataUrl) =>
        window.electronAPI.saveImage(selectedVariantImageFile.name, dataUrl)
      )
      .then((res) => {
        if (res && res.success) finishPush(res.relativePath);
        else {
          showNotification("Gagal menyimpan gambar varian", "error");
          finishPush(null);
        }
      })
      .catch((err) => {
        console.error("save variant image error", err);
        finishPush(null);
      });
  } else {
    finishPush(null);
  }
}

function renderVariantTable() {
  const body = document.getElementById("variant-body");
  if (!body) return;
  if (!currentVariants.length) {
    body.innerHTML =
      '<tr><td colspan="4" class="no-data">Belum ada varian</td></tr>';
    return;
  }
  body.innerHTML = currentVariants
    .map((v, idx) => {
      const priceStr =
        v.price == null ? "Ikuti harga utama" : formatCurrencyIDR(v.price);
      return `<tr>
        <td><input type="text" value="${escapeHtml(
          v.name
        )}" data-var-k="name" data-var-i="${idx}" class="inline-edit" /></td>
        <td><input type="number" min="0" step="1000" value="${
          v.price == null ? "" : v.price
        }" placeholder="Kosong=ikut harga utama" data-var-k="price" data-var-i="${idx}" class="inline-edit" style="width:160px" /></td>
        <td>
          <div style="display:flex; align-items:center; gap:6px">
            <img src="${
              v.image || "assets/no-image.png"
            }" alt="varian" style="width:42px;height:42px;object-fit:cover;border-radius:6px;border:1px solid #ddd" onerror="this.src='assets/no-image.png'"/>
            <input type="text" value="${escapeHtml(
              v.image || ""
            )}" placeholder="URL/Path gambar" data-var-k="image" data-var-i="${idx}" class="inline-edit" />
          </div>
        </td>
        <td><button type="button" class="btn btn-danger btn-small" data-var-remove="${idx}">Hapus</button></td>
      </tr>`;
    })
    .join("");
  // Wire edits
  body.querySelectorAll("[data-var-k]").forEach((el) => {
    el.addEventListener("input", () => {
      const i = parseInt(el.getAttribute("data-var-i"), 10);
      const k = el.getAttribute("data-var-k");
      if (!currentVariants[i]) return;
      if (k === "name") currentVariants[i].name = el.value;
      if (k === "price")
        currentVariants[i].price =
          el.value === "" ? null : Number(el.value) || 0;
      if (k === "image")
        currentVariants[i].image = (el.value || "").trim() || null;
    });
  });
  body.querySelectorAll("[data-var-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = parseInt(btn.getAttribute("data-var-remove"), 10);
      currentVariants.splice(i, 1);
      renderVariantTable();
    });
  });
}

function formatCurrencyIDR(n) {
  try {
    return window.electronAPI.formatCurrency(Number(n) || 0);
  } catch {
    return `Rp ${Number(n) || 0}`;
  }
}

// Safe HTML escaping for inline editing outputs
function escapeHtml(str) {
  return String(str).replace(
    /[&"'<>]/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c])
  );
}

function editProduct(productId) {
  showProductModal(productId);
}

function confirmDeleteProduct(productId, productName) {
  const modal = document.getElementById("confirm-delete-modal");
  const message = document.getElementById("delete-message");

  message.textContent = `Apakah Anda yakin ingin menghapus produk "${productName}"? Tindakan ini tidak dapat dibatalkan.`;
  modal.style.display = "flex";

  // Store product ID for deletion
  document.getElementById("confirm-delete").onclick = () =>
    deleteProduct(productId);
}

function hideDeleteModal() {
  document.getElementById("confirm-delete-modal").style.display = "none";
}

async function deleteProduct(productId) {
  try {
    const success = await window.electronAPI.adminDeleteProduct(productId);

    if (success) {
      showNotification("Produk berhasil dihapus", "success");
      hideDeleteModal();
      loadProducts();
    } else {
      showNotification("Gagal menghapus produk", "error");
    }
  } catch (error) {
    console.error("Error deleting product:", error);
    showNotification("Terjadi kesalahan sistem", "error");
  }
}

function filterSales() {
  const startDate = document.getElementById("start-date").value;
  const endDate = document.getElementById("end-date").value;

  loadSalesReport(startDate || null, endDate || null);
}

function resetSalesFilter() {
  document.getElementById("start-date").value = "";
  document.getElementById("end-date").value = "";
  loadSalesReport();
}

function logout() {
  localStorage.removeItem("adminSession");
  showNotification("Logout berhasil", "success");
  setTimeout(() => {
    window.electronAPI.navigateTo("admin-login.html");
  }, 1000);
}

function showNotification(message, type = "info") {
  const notification = document.getElementById("notification");
  const notificationText = document.getElementById("notification-text");

  notificationText.textContent = message;
  notification.className = `notification show ${type}`;

  setTimeout(() => {
    notification.classList.remove("show");
  }, 3000);
}

// Image upload utilities (appended)
function handleImageFileChange(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) {
    selectedImageFile = null;
    hideImagePreview();
    return;
  }
  if (!/^image\//i.test(file.type)) {
    showNotification("File harus berupa gambar", "error");
    e.target.value = "";
    selectedImageFile = null;
    hideImagePreview();
    return;
  }
  selectedImageFile = file;
  showImagePreview(file);
}
function fileToDataUrl(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}
function showImagePreview(file) {
  const c = document.getElementById("product-image-preview");
  const img = document.getElementById("product-image-preview-img");
  if (!c || !img) return;
  const url = URL.createObjectURL(file);
  img.src = url;
  c.style.display = "block";
}
function hideImagePreview() {
  const c = document.getElementById("product-image-preview");
  const img = document.getElementById("product-image-preview-img");
  if (img) img.src = "";
  if (c) c.style.display = "none";
}

/* =============================
   PRINTER SETTINGS
   ============================= */
async function initPrinterSettings() {
  const select = document.getElementById("printer-select");
  const status = document.getElementById("printer-status");
  if (!select) return;
  try {
    status.textContent = "Memuat daftar printer...";
    const [printers, preferred] = await Promise.all([
      window.electronAPI.getPrinters(),
      window.electronAPI.getPreferredPrinter(),
    ]);
    const opts = (printers || []).map((p) => ({
      value: p.name,
      label: p.displayName || p.name,
    }));
    select.innerHTML = opts
      .map((o) => `<option value="${o.value}">${o.label}</option>`)
      .join("");
    if (preferred) {
      const found = opts.find((o) => o.value === preferred);
      select.value = found ? found.value : preferred;
      status.textContent = `Default saat ini: ${preferred}`;
    } else {
      status.textContent = opts.length
        ? `Pilih printer lalu klik Simpan`
        : `Tidak ada printer terdeteksi`;
    }
  } catch (e) {
    console.error("initPrinterSettings error", e);
    status.textContent = "Gagal memuat printer";
  }
}

/* =============================
     ESC/POS SETTINGS
     ============================= */
async function initEscPosSettings() {
  const select = document.getElementById("serial-port-select");
  const status = document.getElementById("escpos-status");
  if (!select) return;
  try {
    status.textContent = "Memuat port serial...";
    const res = await window.electronAPI.listSerialPorts();
    if (!res.success) throw new Error(res.message || "Gagal memuat port");
    const ports = res.ports || [];
    select.innerHTML = ports
      .map(
        (p) =>
          `<option value="${p.path}">${p.path} ${
            p.friendlyName ? `- ${p.friendlyName}` : ""
          }</option>`
      )
      .join("");
    status.textContent = ports.length
      ? `Ditemukan ${ports.length} port`
      : "Tidak ada port terdeteksi";
  } catch (e) {
    console.error("initEscPosSettings error", e);
    status.textContent = "Gagal memuat port serial";
  }
}

async function testEscPosPrint() {
  const select = document.getElementById("serial-port-select");
  const status = document.getElementById("escpos-status");
  if (!select || !select.value) {
    showNotification("Pilih port serial terlebih dahulu (mis. COM3)", "error");
    return;
  }
  try {
    status.textContent = `Mencetak ke ${select.value}...`;
    const payload = {
      portPath: select.value,
      baudRate: 9600,
      orderId: 999,
      total: 12345,
      items: [
        { name: "Tes A", quantity: 1, price: 2345 },
        { name: "Tes B", quantity: 2, price: 5000 },
      ],
      businessName: "JS Florist",
      website: "",
      whatsapp: "",
      instagram: "",
      notes: "Tes ESC/POS",
      cut: true,
      drawer: false,
    };
    const res = await window.electronAPI.printEscPos(payload);
    if (res && res.success) {
      status.textContent = `Berhasil mengirim data ke ${select.value}`;
      showNotification("ESC/POS terkirim", "success");
    } else {
      status.textContent = `Gagal: ${res?.message || "unknown"}`;
      showNotification(`Gagal: ${res?.message || "unknown"}`, "error");
    }
  } catch (e) {
    console.error("testEscPosPrint error", e);
    status.textContent = `Error: ${e.message}`;
    showNotification("Gagal mengirim ESC/POS", "error");
  }
}

async function savePreferredPrinter() {
  const select = document.getElementById("printer-select");
  const status = document.getElementById("printer-status");
  if (!select || !select.value) return;
  try {
    const res = await window.electronAPI.setPreferredPrinter(select.value);
    if (res && res.success) {
      status.textContent = `Default tersimpan: ${select.value}`;
      showNotification("Printer default disimpan", "success");
    } else {
      showNotification(res?.message || "Gagal menyimpan printer", "error");
    }
  } catch (e) {
    console.error("savePreferredPrinter error", e);
    showNotification("Gagal menyimpan printer", "error");
  }
}

async function testPrintReceipt() {
  const select = document.getElementById("printer-select");
  const selectedPrinter = select?.value;
  const serialSelect = document.getElementById("serial-port-select");
  const selectedPort = serialSelect?.value;

  console.log("🖨️ Testing print:", {
    printer: selectedPrinter || "default",
    serialPort: selectedPort || "(auto)",
  });

  try {
    const payload = {
      orderId: "TEST" + Date.now(),
      total: 50000,
      items: [
        { name: "Buket Mawar Merah", quantity: 1, price: 35000 },
        { name: "Lili Putih", quantity: 1, price: 15000 },
      ],
      businessName: "JS Florist",
      address: "Test Print - " + new Date().toLocaleString("id-ID"),
      website: "",
      whatsapp: "",
      instagram: "",
      notes: "Tes cetak struk thermal",
      deviceName: selectedPrinter,
      allowDialogOnFail: true,
      printMode: "escpos",
    };

    // Show loading
    showNotification("Mengirim ke printer...", "info");

    let res;
    if (selectedPort) {
      // Prefer direct ESC/POS using selected serial port
      res = await window.electronAPI.printEscPos({
        ...payload,
        portPath: selectedPort,
        baudRate: 9600,
      });
    } else {
      // Use auto ESC/POS-first route
      res = await window.electronAPI.printReceiptAuto(payload);
    }

    console.log("🖨️ Print test result:", res);

    if (res && res.success) {
      showNotification(
        `✅ Tes cetak berhasil ke perangkat: ${
          res.device || selectedPrinter || "default"
        }`,
        "success"
      );
    } else {
      console.warn("Print failed with result:", res);
      let errorMsg = "Tes cetak gagal";
      if (res && res.message) errorMsg += `: ${res.message}`;
      showNotification(errorMsg, "error");
    }
  } catch (e) {
    console.error("❌ Test print error:", e);
    showNotification("Error saat tes cetak: " + e.message, "error");
  }
}

// Simple debugging functions added at end of file
window.debugTest = function () {
  console.log("🔧 DEBUG TEST STARTED");
  console.log("electronAPI available:", !!window.electronAPI);

  if (window.electronAPI) {
    console.log("Available functions:", Object.keys(window.electronAPI));

    // Test simple function first
    console.log("Testing getPrinters...");
    window.electronAPI
      .getPrinters()
      .then((printers) => {
        console.log(
          "✅ getPrinters SUCCESS:",
          printers?.length || 0,
          "printers found"
        );
        if (printers && printers.length > 0) {
          console.log("First printer:", printers[0].name);
        }

        // Now test print with minimal payload
        console.log("Testing printReceipt...");
        const simplePayload = {
          orderId: "DEBUG" + Date.now(),
          total: 1000,
          items: [{ name: "Debug Test", quantity: 1, price: 1000 }],
          businessName: "DEBUG TEST",
          notes: "Debug print test",
        };

        return window.electronAPI.printReceipt(simplePayload);
      })
      .then((result) => {
        console.log("✅ PRINT RESULT:", result);
        if (result && result.success) {
          console.log("🎉 PRINT SUCCESS!");
          alert("Print berhasil! Cek printer Anda.");
        } else {
          console.log(
            "⚠️ Print failed:",
            result?.failureReason || result?.message
          );
          alert(
            "Print gagal: " +
              (result?.failureReason || result?.message || "Unknown")
          );
        }
      })
      .catch((error) => {
        console.error("❌ DEBUG ERROR:", error);
        alert("Debug error: " + error.message);
      });
  } else {
    console.log("❌ electronAPI not found");
    alert("electronAPI tidak tersedia");
  }
};

window.manualPrint = function () {
  // Direct call without async/await complications
  console.log("🖨️ MANUAL PRINT TEST");

  const testPayload = {
    orderId: "MANUAL" + Date.now(),
    total: 5000,
    items: [{ name: "Manual Test Item", quantity: 1, price: 5000 }],
    businessName: "MANUAL TEST",
    address: "Manual test address",
    notes: "Manual print test dari console",
  };

  console.log("Payload:", testPayload);

  window.electronAPI
    .printReceipt(testPayload)
    .then((result) => {
      console.log("Manual print result:", result);
      alert(
        "Manual print completed. Result: " +
          (result?.success ? "SUCCESS" : "FAILED")
      );
    })
    .catch((error) => {
      console.error("Manual print error:", error);
      alert("Manual print error: " + error.message);
    });
};
