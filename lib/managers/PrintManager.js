const { BrowserWindow } = require("electron");
const { generateReceipt } = require("../../receiptTemplate");
const {
  formatIDR,
  centerText,
  twoColsText,
  twoCols,
  sanitizeForEscPos,
} = require("../utils/formatters");

/**
 * Manager untuk semua fungsi printing
 */
class PrintManager {
  constructor(settingsManager, serialPortManager) {
    this.settingsManager = settingsManager;
    this.serialPortManager = serialPortManager;
    this.initializePrintModules();
  }

  initializePrintModules() {
    // Initialize ESC/POS encoder
    try {
      this.EscPosEncoder = require("esc-pos-encoder");
      console.log("[DEBUG] EscPosEncoder loaded:", !!this.EscPosEncoder);
    } catch (e) {
      console.warn("[DEBUG] Failed to load esc-pos-encoder:", e?.message);
    }

    // Initialize printer module
    try {
      this.printer = require("printer");
      console.log("[DEBUG] Printer module loaded:", !!this.printer);
    } catch (e) {
      console.warn(
        "[DEBUG] Printer module not available (this is OK):",
        e?.message
      );
      this.printer = null;
    }
  }

  // Core ESC/POS print implementation used by multiple handlers
  async performEscPosPrint(payload, { autoDetectAllowed = false } = {}) {
    try {
      if (
        !this.serialPortManager.SerialPort?.SerialPort ||
        !this.EscPosEncoder
      ) {
        return {
          success: false,
          message:
            "Dependensi ESC/POS tidak tersedia. Install 'serialport' dan 'esc-pos-encoder'",
        };
      }

      const settings = this.settingsManager.loadSettings();
      let portPath = payload?.portPath || settings.preferredSerialPort || null;
      const baudRate = Number(
        payload?.baudRate || settings.serialBaudRate || 9600
      );

      if (!portPath && autoDetectAllowed) {
        console.log("[ESC/POS] No port configured, attempting auto-detect...");
        try {
          portPath = await this.serialPortManager.autoDetectSerialPort();
          if (portPath) {
            this.settingsManager.setSetting("preferredSerialPort", portPath);
            console.log("[ESC/POS] Auto-detected and saved port:", portPath);
          }
        } catch (autoDetectError) {
          console.warn(
            "[ESC/POS] Auto-detection failed:",
            autoDetectError.message
          );
        }
      }

      if (!portPath) {
        return {
          success: false,
          message:
            "Port serial belum dikonfigurasi. Gunakan auto-detect atau konfigurasi manual.",
        };
      }

      // Formatting setup
      const width = Number(payload?.width || 32);
      const items = Array.isArray(payload?.items) ? payload.items : [];
      const total = Number(payload?.total) || 0;
      const orderId = payload?.orderId || "";
      const businessName = payload?.businessName || "JS Florist";
      const address = payload?.address || "";
      const website = payload?.website || payload?.contact?.website || "";
      const whatsapp = payload?.whatsapp || payload?.contact?.whatsapp || "";
      const instagram = payload?.instagram || payload?.contact?.instagram || "";
      const paymentMethod = payload?.paymentMethod
        ? String(payload.paymentMethod).toUpperCase()
        : undefined;
      const buyerName = payload?.buyer?.name || "";
      const buyerPhone = payload?.buyer?.phone || "";
      const recipientName = payload?.recipient?.name || "";
      const servedByFlorist =
        payload?.servedByFlorist || payload?.floristNumber || null;
      const deliveryType = payload?.delivery?.type || ""; // delivery | pickup
      const deliveryAddress = payload?.delivery?.address || "";
      const deliveryDt = payload?.delivery?.datetime || "";
      const customerNotes = payload?.customerNotes || payload?.notes || "";
      const dateStr = new Date().toLocaleString("id-ID");

      const enc = new this.EscPosEncoder();
      enc
        .initialize()
        .codepage("cp437")
        .align("center")
        .bold(true)
        .line(sanitizeForEscPos(businessName))
        .bold(false);
      if (address) enc.line(sanitizeForEscPos(address));
      if (website) enc.line(sanitizeForEscPos(`Web: ${website}`));
      if (whatsapp) enc.line(sanitizeForEscPos(`WA: ${whatsapp}`));
      if (instagram) enc.line(sanitizeForEscPos(`IG: ${instagram}`));
      enc.align("left");
      enc.newline();
      if (orderId)
        enc.line(sanitizeForEscPos(`ID: ${String(orderId).padStart(6, "0")}`));
      enc.line(sanitizeForEscPos(dateStr));
      if (buyerName) enc.line(sanitizeForEscPos(`Pembeli : ${buyerName}`));
      if (buyerPhone) enc.line(sanitizeForEscPos(`Telepon : ${buyerPhone}`));
      if (recipientName)
        enc.line(sanitizeForEscPos(`Penerima: ${recipientName}`));
      if (servedByFlorist)
        enc.line(sanitizeForEscPos(`Florist : ${servedByFlorist}`));
      if (deliveryType)
        enc.line(
          sanitizeForEscPos(
            `Tipe    : ${
              deliveryType === "pickup" ? "Ambil di tempat" : "Antar ke alamat"
            }`
          )
        );
      if (deliveryDt)
        enc.line(
          sanitizeForEscPos(
            `Antar   : ${new Date(deliveryDt).toLocaleString("id-ID")}`
          )
        );
      if (deliveryAddress)
        enc.line(sanitizeForEscPos(`Alamat  : ${deliveryAddress}`));
      if (paymentMethod)
        enc.line(sanitizeForEscPos(`Bayar   : ${paymentMethod}`));
      enc.newline();
      // Items
      for (const it of items) {
        const name = sanitizeForEscPos(String(it?.name || "Item"));
        const qty = Number(it?.quantity) || 1;
        const price = Number(it?.price) || 0;
        const sub = qty * price;
        enc.line(name);
        // Optional custom breakdown details under the item name
        if (Array.isArray(it?.details) && it.details.length) {
          for (const d of it.details) {
            const dLine = sanitizeForEscPos(String(d));
            if (dLine) enc.line(`  - ${dLine}`);
          }
        }
        const left = sanitizeForEscPos(`${qty} x ${formatIDR(price)}`);
        const right = sanitizeForEscPos(`${formatIDR(sub)}`);
        enc.line(twoCols(left, right, width));
      }
      enc.newline();
      enc
        .bold(true)
        .line(
          twoCols(
            sanitizeForEscPos("TOTAL"),
            sanitizeForEscPos(formatIDR(total)),
            width
          )
        )
        .bold(false);
      enc.newline();
      if (customerNotes)
        enc
          .align("center")
          .line(sanitizeForEscPos(customerNotes))
          .align("left");
      enc
        .align("center")
        .line(sanitizeForEscPos("Bawa ini ke kasir untuk pembayaran"));
      enc.align("left");
      enc.newline();
      if (payload?.drawer && typeof enc.pulse === "function") enc.pulse();
      if (payload?.cut !== false) enc.cut();

      const data = enc.encode();

      // Write to serial port with enhanced error handling
      await new Promise((resolve, reject) => {
        const SPClass = this.serialPortManager.SerialPort.SerialPort;
        let sp;

        try {
          sp = new SPClass({ path: portPath, baudRate }, (err) => {
            if (err) {
              console.error(
                "[ESC/POS] Serial port connection error:",
                err.message
              );
              return reject(err);
            }
          });
        } catch (constructorError) {
          console.error(
            "[ESC/POS] Serial port constructor error:",
            constructorError.message
          );
          return reject(constructorError);
        }

        const cleanup = () => {
          try {
            if (sp && sp.isOpen) {
              sp.close(() => {});
            }
          } catch (_) {}
        };

        const timeout = setTimeout(() => {
          console.error("[ESC/POS] Serial port operation timeout");
          cleanup();
          reject(new Error("Serial port operation timeout"));
        }, 10000); // 10 second timeout

        sp.on("open", () => {
          console.log("[ESC/POS] Serial port opened successfully");
          sp.write(Buffer.from(data), (err) => {
            if (err) {
              console.error("[ESC/POS] Write error:", err.message);
              clearTimeout(timeout);
              cleanup();
              return reject(err);
            }
            console.log("[ESC/POS] Data written successfully");
            sp.drain((drainErr) => {
              clearTimeout(timeout);
              if (drainErr) {
                console.error("[ESC/POS] Drain error:", drainErr.message);
                cleanup();
                return reject(drainErr);
              }
              console.log("[ESC/POS] Data drained successfully");
              sp.close(() => {
                console.log("[ESC/POS] Serial port closed");
                resolve();
              });
            });
          });
        });

        sp.on("error", (err) => {
          console.error("[ESC/POS] Serial port error:", err.message);
          clearTimeout(timeout);
          cleanup();
          reject(err);
        });
      });

      return { success: true, device: portPath, mode: "escpos" };
    } catch (error) {
      console.warn("[ESC/POS] Print failed:", error?.message);
      return {
        success: false,
        message: `ESC/POS print error: ${error?.message}`,
        error: error?.code || "UNKNOWN",
      };
    }
  }

  // Helper untuk render list printers dengan robust error handling
  async listPrintersRobust(preferredWebContents, fallbackWebContents) {
    const delay = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0; i < 5; i++) {
      try {
        const wc = preferredWebContents || fallbackWebContents;
        if (!wc) break;
        let printers = [];
        if (typeof wc.getPrintersAsync === "function") {
          printers = await wc.getPrintersAsync();
        } else {
          printers = wc.getPrinters();
        }
        if (Array.isArray(printers) && printers.length) return printers;
      } catch (_) {}
      await delay(250);
    }
    // Try the other webContents if the first attempts failed
    for (let i = 0; i < 5; i++) {
      try {
        const wc = fallbackWebContents || preferredWebContents;
        if (!wc) break;
        let printers = [];
        if (typeof wc.getPrintersAsync === "function") {
          printers = await wc.getPrintersAsync();
        } else {
          printers = wc.getPrinters();
        }
        if (Array.isArray(printers) && printers.length) return printers;
      } catch (_) {}
      await new Promise((r) => setTimeout(r, 250));
    }
    return [];
  }

  // New function untuk raw text printing
  async printRawText(payload, printerName) {
    console.log(`[RAW-TEXT] Attempting to print raw text to: ${printerName}`);
    if (!this.printer) {
      return { success: false, message: "Modul 'printer' tidak tersedia." };
    }

    try {
      // Build the plain text receipt
      const width = 32;
      const items = Array.isArray(payload?.items) ? payload.items : [];
      const total = Number(payload?.total) || 0;
      const orderId = payload?.orderId || "";
      const businessName = payload?.businessName || "JS Florist";
      const address = payload?.address || "";
      const website = payload?.website || payload?.contact?.website || "";
      const whatsapp = payload?.whatsapp || payload?.contact?.whatsapp || "";
      const instagram = payload?.instagram || payload?.contact?.instagram || "";
      const paymentMethod = payload?.paymentMethod
        ? String(payload.paymentMethod).toUpperCase()
        : undefined;
      const buyerName = payload?.buyer?.name || "";
      const buyerPhone = payload?.buyer?.phone || "";
      const recipientName = payload?.recipient?.name || "";
      const servedByFlorist =
        payload?.servedByFlorist || payload?.floristNumber || null;
      const deliveryType = payload?.delivery?.type || "";
      const deliveryAddress = payload?.delivery?.address || "";
      const deliveryDt = payload?.delivery?.datetime || "";
      const customerNotes = payload?.customerNotes || payload?.notes || "";
      const dateStr = new Date().toLocaleString("id-ID");
      const separator = "-".repeat(width) + "\n";

      let receiptText = "";
      const sBusiness = sanitizeForEscPos(businessName);
      const sAddress = sanitizeForEscPos(address);
      const sDate = sanitizeForEscPos(dateStr);
      const sOrder = orderId
        ? sanitizeForEscPos(`ID: ${String(orderId).padStart(6, "0")}`)
        : "";

      receiptText += centerText(sBusiness, width) + "\n";
      if (address) receiptText += centerText(sAddress, width) + "\n";
      if (website)
        receiptText +=
          centerText(sanitizeForEscPos(`Web: ${website}`), width) + "\n";
      if (whatsapp)
        receiptText +=
          centerText(sanitizeForEscPos(`WA: ${whatsapp}`), width) + "\n";
      if (instagram)
        receiptText +=
          centerText(sanitizeForEscPos(`IG: ${instagram}`), width) + "\n";
      receiptText += separator;
      if (orderId) receiptText += `${sOrder}\n`;
      receiptText += `${sDate}\n`;
      if (buyerName)
        receiptText += `Pembeli : ${sanitizeForEscPos(buyerName)}\n`;
      if (buyerPhone)
        receiptText += `Telepon : ${sanitizeForEscPos(buyerPhone)}\n`;
      if (recipientName)
        receiptText += `Penerima: ${sanitizeForEscPos(recipientName)}\n`;
      if (servedByFlorist)
        receiptText += `Florist : ${sanitizeForEscPos(servedByFlorist)}\n`;
      if (deliveryType)
        receiptText += `Tipe    : ${sanitizeForEscPos(
          deliveryType === "pickup" ? "Ambil di tempat" : "Antar ke alamat"
        )}\n`;
      if (deliveryDt)
        receiptText += `Antar   : ${sanitizeForEscPos(
          new Date(deliveryDt).toLocaleString("id-ID")
        )}\n`;
      if (deliveryAddress)
        receiptText += `Alamat  : ${sanitizeForEscPos(deliveryAddress)}\n`;
      if (paymentMethod)
        receiptText += `Bayar   : ${sanitizeForEscPos(paymentMethod)}\n`;
      receiptText += separator;

      for (const it of items) {
        const name = sanitizeForEscPos(String(it?.name || "Item"));
        const qty = Number(it?.quantity) || 1;
        const price = Number(it?.price) || 0;
        const sub = qty * price;

        receiptText += `${name}\n`;
        // Optional custom breakdown details
        if (Array.isArray(it?.details) && it.details.length) {
          for (const d of it.details) {
            const dLine = sanitizeForEscPos(String(d));
            if (dLine) receiptText += `  - ${dLine}\n`;
          }
        }
        const left = sanitizeForEscPos(`${qty} x ${formatIDR(price)}`);
        const right = sanitizeForEscPos(`${formatIDR(sub)}`);
        receiptText += twoColsText(left, right, width) + "\n";
      }
      receiptText += separator;
      receiptText +=
        twoColsText(
          sanitizeForEscPos("TOTAL"),
          sanitizeForEscPos(formatIDR(total)),
          width
        ) + "\n";
      receiptText += separator;
      receiptText += "\n";
      if (customerNotes)
        receiptText +=
          centerText(sanitizeForEscPos(customerNotes), width) + "\n";
      receiptText +=
        centerText(
          sanitizeForEscPos("Bawa ini ke kasir untuk pembayaran"),
          width
        ) + "\n";
      receiptText += "\n\n\n\n"; // Feed for cutting

      // Send to printer
      const printResult = await new Promise((resolve, reject) => {
        this.printer.printDirect({
          data: receiptText,
          printer: printerName,
          type: "RAW",
          success: (jobId) => {
            console.log(`[RAW-TEXT] Sent to printer with job ID: ${jobId}`);
            resolve({ success: true, jobId });
          },
          error: (err) => {
            console.error("[RAW-TEXT] Printing error:", err);
            reject(err);
          },
        });
      });

      if (printResult.success) {
        return { success: true, device: printerName, mode: "raw-text" };
      } else {
        throw new Error("printDirect reported failure");
      }
    } catch (error) {
      console.error(`[RAW-TEXT] Failed to print: ${error.message}`);
      return { success: false, message: error.message };
    }
  }

  // Enhanced printer detection for POS58 on Windows
  async detectPOS58Printer(mainWindow) {
    try {
      // Try using Electron's webContents.getPrinters() instead of native module
      if (mainWindow && mainWindow.webContents) {
        const printers = await this.listPrintersRobust(
          mainWindow.webContents,
          null
        );
        console.log(
          "[POS58-DETECT] Found system printers:",
          printers.map((p) => p.name)
        );

        // Priority order for POS58 detection
        const POS58_NAMES = [
          "POS58 Printer",
          "POS-58",
          "POS 58",
          "EP58M",
          "EPPOS",
          "USB Receipt Printer",
          "Thermal Receipt Printer",
          "Generic / Text Only",
        ];

        // Try exact match first
        for (const targetName of POS58_NAMES) {
          const found = printers.find(
            (p) =>
              p.name === targetName ||
              p.name.toLowerCase() === targetName.toLowerCase()
          );
          if (found) {
            console.log("[POS58-DETECT] ✅ Found exact match:", found.name);
            return found.name;
          }
        }

        // Try partial match
        for (const printer of printers) {
          const printerName = printer.name.toLowerCase();
          for (const targetName of POS58_NAMES) {
            if (
              printerName.includes(targetName.toLowerCase()) ||
              targetName.toLowerCase().includes(printerName)
            ) {
              console.log(
                "[POS58-DETECT] ✅ Found partial match:",
                printer.name
              );
              return printer.name;
            }
          }
        }

        // Fallback to first printer if only one available
        if (printers.length === 1) {
          console.log(
            "[POS58-DETECT] ⚠️ Using fallback (only printer):",
            printers[0].name
          );
          return printers[0].name;
        }

        console.log("[POS58-DETECT] ❌ No suitable printer found");
        return null;
      }

      console.log("[POS58-DETECT] Main window not available");
      return null;
    } catch (error) {
      console.error("[POS58-DETECT] Detection failed:", error.message);
      return null;
    }
  }

  // Reusable helper to print via Windows printer name using node-thermal-printer
  async directUsbPrint(payload, printerName) {
    let ThermalPrinter, PrinterTypes;
    const pName = printerName || payload?.deviceName || "POS58 Printer";
    try {
      const lib = require("node-thermal-printer");
      // Correct API for v4+: { printer: ThermalPrinter, types: PrinterTypes }
      ThermalPrinter = lib.printer || lib.ThermalPrinter || lib.thermalPrinter; // multiple fallbacks
      PrinterTypes = lib.types || lib.PrinterTypes;
      if (!ThermalPrinter || !PrinterTypes) {
        throw new Error(
          "node-thermal-printer API tidak sesuai - missing ThermalPrinter or PrinterTypes"
        );
      }
    } catch (err) {
      throw new Error(
        "Module 'node-thermal-printer' belum terpasang atau versi tidak cocok. Jalankan 'npm i node-thermal-printer'. Error: " +
          err.message
      );
    }

    // Ensure the interface is properly formatted - this fixes the "No driver set!" error
    const printerInterface = pName.startsWith("printer:")
      ? pName
      : `printer:${pName}`;
    console.log("[DIRECT-USB] Using interface:", printerInterface);

    const printer = new ThermalPrinter({
      type: PrinterTypes.EPSON,
      interface: printerInterface,
      characterSet: "SLOVENIA",
      removeSpecialCharacters: false,
      lineCharacter: "=",
      width: 48, // Set appropriate width for thermal printer
    });

    try {
      const isConnected = await printer.isPrinterConnected();
      console.log("[DIRECT-USB] isPrinterConnected:", isConnected);
      // Some Windows drivers return false even when ready; continue anyway
    } catch (e) {
      console.log(
        "[DIRECT-USB] isPrinterConnected check failed; proceeding:",
        e?.message
      );
    }

    const {
      items = [],
      total = 0,
      orderId = "",
      businessName = "JS Florist",
      address = "",
      website = "",
      whatsapp = "",
      instagram = "",
      paymentMethod,
      buyer = {},
      recipient = {},
      delivery = {},
      customerNotes,
      notes,
    } = payload || {};
    const dateStr = new Date().toLocaleString("id-ID");
    const sBusiness = sanitizeForEscPos(businessName);
    const sAddress = sanitizeForEscPos(address);
    const sDate = sanitizeForEscPos(dateStr);
    const sOrder = orderId
      ? sanitizeForEscPos(`ID: ${String(orderId).padStart(6, "0")}`)
      : "";
    const sBuyer = buyer?.name ? sanitizeForEscPos(buyer.name) : "";
    const sPhone = buyer?.phone ? sanitizeForEscPos(buyer.phone) : "";
    const sRecipient = recipient?.name ? sanitizeForEscPos(recipient.name) : "";
    const servedByFlorist =
      payload?.servedByFlorist || payload?.floristNumber || null;
    const sDelType = delivery?.type
      ? sanitizeForEscPos(
          delivery.type === "pickup" ? "Ambil di tempat" : "Antar ke alamat"
        )
      : "";
    const sDelDt = delivery?.datetime
      ? sanitizeForEscPos(new Date(delivery.datetime).toLocaleString("id-ID"))
      : "";
    const sDelAddr = delivery?.address
      ? sanitizeForEscPos(delivery.address)
      : "";
    const sPay = paymentMethod
      ? sanitizeForEscPos(String(paymentMethod).toUpperCase())
      : "";
    const sNotes = customerNotes
      ? sanitizeForEscPos(customerNotes)
      : notes
      ? sanitizeForEscPos(notes)
      : "";

    try {
      printer.alignCenter();
      printer.bold(true);
      printer.println(sBusiness);
      printer.bold(false);
      if (address) printer.println(sAddress);
      if (website) printer.println(sanitizeForEscPos(`Web: ${website}`));
      if (whatsapp) printer.println(sanitizeForEscPos(`WA: ${whatsapp}`));
      if (instagram) printer.println(sanitizeForEscPos(`IG: ${instagram}`));
      printer.drawLine();
      printer.alignLeft();
      if (orderId) printer.println(sOrder);
      printer.println(sanitizeForEscPos(`Tanggal: ${sDate}`));
      if (sBuyer) printer.println(`Pembeli : ${sBuyer}`);
      if (sPhone) printer.println(`Telepon : ${sPhone}`);
      if (sRecipient) printer.println(`Penerima: ${sRecipient}`);
      if (servedByFlorist)
        printer.println(`Florist : ${sanitizeForEscPos(servedByFlorist)}`);
      if (sDelType) printer.println(`Tipe    : ${sDelType}`);
      if (sDelDt) printer.println(`Antar   : ${sDelDt}`);
      if (sDelAddr) printer.println(`Alamat  : ${sDelAddr}`);
      if (sPay) printer.println(`Bayar   : ${sPay}`);
      printer.drawLine();

      items.forEach((it) => {
        const name = sanitizeForEscPos(it.name || "Item");
        const qty = Number(it.quantity) || 1;
        const price = Number(it.price) || 0;
        const sub = price * qty;

        printer.println(`${name}`);
        // Optional custom details
        if (Array.isArray(it?.details) && it.details.length) {
          for (const d of it.details) {
            const dLine = sanitizeForEscPos(String(d));
            if (dLine) printer.println(`  - ${dLine}`);
          }
        }
        printer.tableCustom([
          {
            text: sanitizeForEscPos(`${qty} x ${formatIDR(price)}`),
            align: "LEFT",
            width: 0.6,
          },
          {
            text: sanitizeForEscPos(formatIDR(sub)),
            align: "RIGHT",
            width: 0.4,
          },
        ]);
      });

      printer.drawLine();
      printer.alignRight();
      printer.bold(true);
      printer.println(sanitizeForEscPos(`TOTAL: ${formatIDR(total)}`));
      printer.bold(false);
      printer.drawLine();
      printer.alignCenter();
      if (sNotes) printer.println(sNotes);
      printer.println(sanitizeForEscPos("Bawa ini ke kasir untuk pembayaran"));
      printer.newLine();
      printer.cut();

      await printer.execute();
      console.log("[DIRECT-USB] Print execution successful");
      return { success: true, printer: pName, mode: "direct-usb" };
    } catch (executeError) {
      console.error(
        "[DIRECT-USB] Print execution failed:",
        executeError.message
      );
      throw new Error(`Print execution failed: ${executeError.message}`);
    }
  }

  // Raw Windows spooler print using enhanced HTML
  async rawWindowsPrintEscPos(payload, printerName) {
    console.log(
      "[RAW-WINDOWS] Attempting Windows printer spooler print for:",
      printerName
    );

    if (!this.EscPosEncoder) {
      throw new Error("Module 'esc-pos-encoder' tidak tersedia");
    }

    // Build receipt data
    const width = Number(payload?.width || 32);
    const items = Array.isArray(payload?.items) ? payload.items : [];
    const total = Number(payload?.total) || 0;
    const orderId = payload?.orderId || "";
    const businessName = payload?.businessName || "JS Florist";
    const address = payload?.address || "";
    const website = payload?.website || payload?.contact?.website || "";
    const whatsapp = payload?.whatsapp || payload?.contact?.whatsapp || "";
    const instagram = payload?.instagram || payload?.contact?.instagram || "";
    const paymentMethod = payload?.paymentMethod
      ? String(payload.paymentMethod).toUpperCase()
      : "";
    const buyerName = payload?.buyer?.name || "";
    const buyerPhone = payload?.buyer?.phone || "";
    const recipientName = payload?.recipient?.name || "";
    const servedByFlorist =
      payload?.servedByFlorist || payload?.floristNumber || null;
    const deliveryType = payload?.delivery?.type || "";
    const deliveryAddress = payload?.delivery?.address || "";
    const deliveryDt = payload?.delivery?.datetime || "";
    const customerNotes = payload?.customerNotes || payload?.notes || "";
    const dateStr = new Date().toLocaleString("id-ID");

    // Create enhanced HTML for thermal printing that mimics ESC/POS output
    const receiptHTML = `<!DOCTYPE html><html><head><meta charset="utf-8" />
      <style>
        @page { 
          size: 58mm auto; 
          margin: 1mm; 
        }
        @media print {
          body { 
            font-family: 'Courier New', monospace; 
            font-size: 10px; 
            width: 56mm; 
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact;
            color: black;
          }
          .no-print { display: none; }
        }
        body { 
          font-family: 'Courier New', monospace; 
          font-size: 10px; 
          width: 58mm; 
          margin: 0;
          padding: 1mm;
          line-height: 1.1;
          color: black;
        }
        .center { text-align: center; }
        .left { text-align: left; }
        .right { text-align: right; }
        .bold { font-weight: bold; font-size: 11px; }
        .row { 
          display: flex; 
          justify-content: space-between; 
          align-items: flex-start;
          margin: 0.5px 0;
        }
        .row .left-col { flex: 1; text-align: left; }
        .row .right-col { text-align: right; white-space: nowrap; padding-left: 3px; }
        .separator { 
          border: none; 
          border-top: 1px dashed #000; 
          margin: 2px 0; 
          width: 100%;
          height: 1px;
        }
        .header { 
          font-weight: bold; 
          font-size: 11px; 
          margin-bottom: 1px;
        }
        .total-line { 
          font-weight: bold; 
          font-size: 11px; 
          border-top: 1px solid #000;
          padding-top: 1px;
          margin-top: 2px;
        }
        .footer {
          margin-top: 3px;
          font-size: 9px;
        }
        .item-line {
          margin: 1px 0;
        }
      </style>
    </head><body>
      <div class="center">
        <div class="header">${businessName}</div>
        ${address ? `<div style="font-size: 9px;">${address}</div>` : ""}
        ${website ? `<div style="font-size: 9px;">Web: ${website}</div>` : ""}
        ${whatsapp ? `<div style="font-size: 9px;">WA: ${whatsapp}</div>` : ""}
        ${
          instagram ? `<div style="font-size: 9px;">IG: ${instagram}</div>` : ""
        }
      </div>
      <hr class="separator" />
      <div class="left" style="font-size: 9px;">
        ${orderId ? `ID: ${String(orderId).padStart(6, "0")}<br/>` : ""}
        ${dateStr}<br/>
        ${buyerName ? `Pembeli : ${buyerName}<br/>` : ""}
        ${buyerPhone ? `Telepon : ${buyerPhone}<br/>` : ""}
        ${recipientName ? `Penerima: ${recipientName}<br/>` : ""}
        ${servedByFlorist ? `Florist : ${servedByFlorist}<br/>` : ""}
        ${
          deliveryType
            ? `Tipe    : ${
                deliveryType === "pickup"
                  ? "Ambil di tempat"
                  : "Antar ke alamat"
              }<br/>`
            : ""
        }
        ${
          deliveryDt
            ? `Antar   : ${new Date(deliveryDt).toLocaleString("id-ID")}<br/>`
            : ""
        }
        ${deliveryAddress ? `Alamat  : ${deliveryAddress}<br/>` : ""}
        ${paymentMethod ? `Bayar   : ${paymentMethod}<br/>` : ""}
      </div>
      <hr class="separator" />
      ${items
        .map((it) => {
          const name = (it.name || "Item").toString();
          const qty = Number(it.quantity) || 1;
          const price = Number(it.price) || 0;
          const sub = price * qty;
          const detailsHtml =
            Array.isArray(it.details) && it.details.length
              ? it.details
                  .map(
                    (d) =>
                      `<div style="font-size:9px;margin-left:6px;">- ${String(
                        d
                      ).replace(
                        /[<>]/g,
                        (c) => ({ "<": "&lt;", ">": "&gt;" }[c])
                      )}</div>`
                  )
                  .join("")
              : "";
          return `<div class="item-line">
          <div class="left">${name}</div>
          ${detailsHtml}
          <div class="row">
            <span class="left-col">${qty} x ${formatIDR(price)}</span>
            <span class="right-col">${formatIDR(sub)}</span>
          </div>
        </div>`;
        })
        .join("")}
      <hr class="separator" />
      <div class="row total-line">
        <span class="left-col bold">TOTAL</span>
        <span class="right-col bold">${formatIDR(total)}</span>
      </div>
      <hr class="separator" />
      <div class="center footer">${customerNotes || ""}</div>
      <div class="center footer" style="margin-top:2px;">Bawa ini ke kasir untuk pembayaran</div>
      <div style="height: 10mm;"></div> <!-- Space for cutting -->
    </body></html>`;

    // Use HTML printing mechanism targeting the specific printer
    try {
      const printWin = new BrowserWindow({
        width: 300,
        height: 600,
        show: false,
        webPreferences: { offscreen: false, backgroundThrottling: false },
      });

      await printWin.loadURL(
        "data:text/html;charset=utf-8," + encodeURIComponent(receiptHTML)
      );

      // Wait a bit for content to be ready
      await new Promise((resolve) => setTimeout(resolve, 300));

      console.log(
        "[RAW-WINDOWS] Sending HTML print to Windows spooler via:",
        printerName
      );

      const didPrint = await new Promise((resolve) => {
        printWin.webContents.print(
          {
            deviceName: printerName,
            printBackground: false,
            landscape: false,
            pageSize: { width: 58000, height: 200000 },
            margins: { marginType: "none" },
          },
          (success, failureReason) => {
            console.log("[RAW-WINDOWS] Windows spooler print result:", success);
            if (!success && failureReason) {
              console.log("[RAW-WINDOWS] Failure reason:", failureReason);
            }
            resolve(success);
          }
        );
      });

      setTimeout(() => {
        if (!printWin.isDestroyed()) printWin.close();
      }, 150);

      if (didPrint) {
        return { success: true, printer: printerName, mode: "windows-spooler" };
      } else {
        throw new Error("Windows spooler print reported failure");
      }
    } catch (error) {
      console.error("[RAW-WINDOWS] HTML printing failed:", error.message);
      throw error;
    }
  }

  // Generate HTML receipt and print silently to a specific device
  async printReceipt(transactionData, deviceName) {
    const { title, items, total, ...meta } = transactionData || {};
    const html = generateReceipt(
      title || "STRUK PEMBAYARAN",
      items || [],
      total || 0,
      meta
    );
    return this.printHtmlToDevice(html, deviceName);
  }

  // Generic HTML to device printer with silent mode and 58mm optimization
  async printHtmlToDevice(html, deviceName, show = false) {
    const printWin = new BrowserWindow({
      show,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    });

    await printWin.loadURL("about:blank");
    await printWin.webContents.executeJavaScript(
      "document.write(`" + html.replace(/`/g, "\\`") + "`); document.close();"
    );

    return new Promise((resolve, reject) => {
      try {
        let printOptions = {
          silent: true,
          deviceName: deviceName,
          printBackground: true,
          margins: { marginType: "none" },
        };
        if (
          typeof deviceName === "string" &&
          (deviceName.includes("POS") ||
            deviceName.toLowerCase().includes("thermal"))
        ) {
          printOptions.pageSize = { width: 58000, height: 200000 };
        } else {
          printOptions.pageSize = "A4";
        }

        printWin.webContents.print(printOptions, (success, failureReason) => {
          if (!success) {
            reject(new Error(`Print failed: ${failureReason || "unknown"}`));
          } else {
            resolve(true);
          }
          if (!printWin.isDestroyed()) printWin.close();
        });
      } catch (err) {
        if (!printWin.isDestroyed()) printWin.close();
        reject(err);
      }
    });
  }

  // New: Direct USB ESC/POS printing using 'escpos' + 'escpos-usb' (same method as test.js)
  async printEscposUsb(payload, usbOptions = {}) {
    let escpos;
    try {
      escpos = require("escpos");
      escpos.USB = require("escpos-usb");
    } catch (e) {
      throw new Error(
        "Module 'escpos' atau 'escpos-usb' belum terpasang. Jalankan: npm i escpos escpos-usb"
      );
    }

    const device =
      usbOptions && usbOptions.vendorId && usbOptions.productId
        ? new escpos.USB(usbOptions.vendorId, usbOptions.productId)
        : new escpos.USB();

    const printer = new escpos.Printer(device);

    const width = Number(payload?.width || 32);
    const items = Array.isArray(payload?.items) ? payload.items : [];
    const total = Number(payload?.total) || 0;
    const orderId = payload?.orderId || "";
    const businessName = payload?.businessName || "JS Florist";
    const address = payload?.address || "";
    const paymentMethod = payload?.paymentMethod
      ? String(payload.paymentMethod).toUpperCase()
      : undefined;
    const buyerName = payload?.buyer?.name || "";
    const buyerPhone = payload?.buyer?.phone || "";
    const recipientName = payload?.recipient?.name || "";
    const servedByFlorist =
      payload?.servedByFlorist || payload?.floristNumber || null;
    const deliveryType = payload?.delivery?.type || "";
    const deliveryAddress = payload?.delivery?.address || "";
    const deliveryDt = payload?.delivery?.datetime || "";
    const customerNotes = payload?.customerNotes || payload?.notes || "";
    const dateStr = new Date().toLocaleString("id-ID");
    const sBusiness = sanitizeForEscPos(businessName);
    const sAddress = sanitizeForEscPos(address);
    const sDate = sanitizeForEscPos(dateStr);
    const sOrder = orderId
      ? sanitizeForEscPos(`ID: ${String(orderId).padStart(6, "0")}`)
      : "";

    const line = "-".repeat(width);

    return new Promise((resolve, reject) => {
      try {
        device.open(() => {
          try {
            printer.align("CT").style("B").text(sBusiness).style("NORMAL");
            if (address) printer.text(sAddress);
            printer
              .align("LT")
              .text(line)
              .text(orderId ? sOrder : "")
              .text(sDate)
              .text(
                buyerName ? `Pembeli : ${sanitizeForEscPos(buyerName)}` : ""
              )
              .text(
                buyerPhone ? `Telepon : ${sanitizeForEscPos(buyerPhone)}` : ""
              )
              .text(
                recipientName
                  ? `Penerima: ${sanitizeForEscPos(recipientName)}`
                  : ""
              )
              .text(
                servedByFlorist
                  ? `Florist : ${sanitizeForEscPos(servedByFlorist)}`
                  : ""
              )
              .text(
                deliveryType
                  ? `Tipe    : ${
                      deliveryType === "pickup"
                        ? "Ambil di tempat"
                        : "Antar ke alamat"
                    }`
                  : ""
              )
              .text(
                deliveryDt
                  ? `Antar   : ${sanitizeForEscPos(
                      new Date(deliveryDt).toLocaleString("id-ID")
                    )}`
                  : ""
              )
              .text(
                deliveryAddress
                  ? `Alamat  : ${sanitizeForEscPos(deliveryAddress)}`
                  : ""
              )
              .text(paymentMethod ? `Bayar   : ${paymentMethod}` : "")
              .text(line);

            for (const it of items) {
              const name = sanitizeForEscPos(String(it?.name || "Item"));
              const qty = Number(it?.quantity ?? it?.qty ?? 1) || 1;
              const price = Number(it?.price) || 0;
              const sub = qty * price;
              printer.text(name);
              // Optional custom details lines
              if (Array.isArray(it?.details) && it.details.length) {
                for (const d of it.details) {
                  const dLine = sanitizeForEscPos(String(d));
                  if (dLine) printer.text(`  - ${dLine}`);
                }
              }
              printer.tableCustom([
                {
                  text: sanitizeForEscPos(`${qty} x ${formatIDR(price)}`),
                  align: "LEFT",
                  width: 0.6,
                },
                {
                  text: `${sanitizeForEscPos(formatIDR(sub))}`,
                  align: "RIGHT",
                  width: 0.4,
                },
              ]);
            }

            printer
              .text(line)
              .align("RT")
              .style("B")
              .text(sanitizeForEscPos(`TOTAL: ${formatIDR(total)}`))
              .style("NORMAL")
              .align("CT");
            if (customerNotes) printer.text(sanitizeForEscPos(customerNotes));
            printer.text(
              sanitizeForEscPos("Bawa ini ke kasir untuk pembayaran")
            );
            printer.feed(2).cut().close();

            resolve({ success: true, mode: "escpos-usb" });
          } catch (err) {
            try {
              printer.close();
            } catch (_) {}
            reject(err);
          }
        });
      } catch (openErr) {
        reject(openErr);
      }
    });
  }
}

module.exports = PrintManager;
