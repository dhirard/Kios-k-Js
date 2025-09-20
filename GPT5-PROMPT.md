# Prompt untuk GPT-5: Perbaikan Auto Print Thermal Printer

## Masalah Utama

Aplikasi Electron.js florist kiosk tidak bisa auto print ke thermal printer EPPOS EP58M. Print handler dipanggil tapi tidak ada output fisik ke printer.

## Status Saat Ini

- ✅ Printer terdeteksi: "POS58 Printer" (default)
- ✅ IPC handler `print-receipt` dipanggil dengan payload benar
- ✅ HTML receipt dibuat tanpa error
- ✅ BrowserWindow print window dibuat
- ❌ Proses terhenti di loadURL/setContent - tidak ada struk keluar
- ❌ Promise hanging, tidak ada callback result

## Info Hardware

- **Printer**: EPPOS EP58M (Thermal Dot Line Printing)
- **Koneksi**: USB
- **Driver**: Terinstall sebagai "POS58 Printer" di Windows
- **Status**: Ready, bisa print test page dari Windows

## Struktur Kode

### File main.js - Print Handler

```javascript
ipcMain.handle("print-receipt", async (e, payload) => {
  console.log("[PRINT-RECEIPT] Handler called with payload:", payload);

  try {
    // Process payload
    const items = Array.isArray(payload?.items) ? payload.items : [];
    const total = Number(payload?.total) || 0;

    // Create thermal receipt HTML
    const receiptHTML = `<!DOCTYPE html>...`;

    // Create hidden print window
    const printWin = new BrowserWindow({
      width: 300, height: 600, show: false,
      webPreferences: { offscreen: false, backgroundThrottling: false }
    });

    // Load content (MASALAH DI SINI)
    await printWin.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(receiptHTML));

    // Get printers & select POS58
    const printers = await listPrintersRobust(...);
    const finalDeviceName = "POS58 Printer";

    // Execute print (TIDAK PERNAH SAMPAI SINI)
    const didPrint = await new Promise((resolve) => {
      printWin.webContents.print({
        silent: true,
        deviceName: finalDeviceName,
        printBackground: false,
        landscape: false
      }, (success, failureReason) => {
        resolve(success);
      });
    });

    return { success: didPrint, device: finalDeviceName };
  } catch (err) {
    return { success: false, message: err.message };
  }
});
```

### File preload.js - IPC Bridge

```javascript
contextBridge.exposeInMainWorld("electronAPI", {
  printReceipt: (payload) => ipcRenderer.invoke("print-receipt", payload),
  // ... other functions
});
```

### File checkout.html - Auto Print Call

```javascript
// Di dalam processPayment() setelah checkout sukses
try {
  const payload = {
    orderId,
    total: totalAmount,
    items: cartItems.map((it) => ({
      name: it.name,
      quantity: it.quantity,
      price: it.price,
    })),
    businessName: "Florist Kiosk",
    notes: "Terima kasih atas kunjungan Anda",
  };
  const printRes = await window.electronAPI.printReceipt(payload);
  console.log("print receipt result:", printRes);
} catch (e) {
  console.warn("auto print failed", e);
}
```

## Log Debug Terakhir

```
[PRINT-RECEIPT] Handler called with payload: {orderId: 'MANUAL...', total: 5000, ...}
[PRINT-RECEIPT] Processing print for order: MANUAL... total: 5000
[PRINT-RECEIPT] Creating receipt HTML...
[PRINT-RECEIPT] Creating hidden print window...
[PRINT-RECEIPT] Loading HTML content...
// BERHENTI DI SINI - tidak ada log selanjutnya
```

## Yang Sudah Dicoba

1. ✅ Menggunakan loadURL dengan data URI
2. ✅ Menggunakan setContent sebagai fallback
3. ✅ Timeout handling untuk loadURL
4. ✅ Menambah delay sebelum print
5. ✅ Verifikasi printer name detection
6. ❌ Testing dengan dialog print (allowDialogOnFail: true)

## Kemungkinan Root Cause

1. **BrowserWindow webContents issue** - loadURL hanging dengan data URI yang complex
2. **Print API compatibility** - webContents.print tidak compatible dengan thermal driver
3. **Silent print restriction** - Windows blocking silent print ke thermal printer
4. **Electron version issue** - incompatibility dengan print API

## Request ke GPT-5

Sebagai expert Electron.js dan thermal printing, tolong analisis dan berikan solusi untuk:

### 1. **Diagnosa Masalah**

- Kenapa loadURL hanging dengan data URI receipt HTML?
- Apakah ada alternative untuk BrowserWindow print approach?
- Bagaimana handle thermal printer yang berbeda dari printer biasa?

### 2. **Solusi Alternative**

- **Node.js thermal printing** - Gunakan library seperti `escpos`, `node-thermal-printer`
- **Direct ESC/POS commands** - Kirim raw ESC/POS ke USB/Serial
- **External print service** - Spawn process ke utility print external
- **File-based printing** - Generate file, print via system command

### 3. **Implementation Code**

Berikan implementasi lengkap yang working untuk:

- Print receipt ke thermal printer EPPOS EP58M
- Auto print setelah checkout tanpa dialog
- Error handling yang robust
- Cross-platform compatibility (fokus Windows)

### 4. **Debugging Strategy**

- Tools untuk debug thermal printer communication
- Logging strategy untuk troubleshoot print issues
- Testing methodology untuk verify print functionality

### 5. **Dependencies & Setup**

- Package.json dependencies yang dibutuhkan
- Configuration settings
- Installation steps untuk production

## Harapan Output

- **Working code** yang bisa langsung diimplementasi
- **Step-by-step guide** untuk setup dan testing
- **Error handling** untuk production readiness
- **Alternative approaches** jika primary solution gagal

## Context Tambahan

- Aplikasi ini untuk kiosk offline retail
- User tidak boleh lihat print dialog
- Speed printing penting untuk UX
- Reliability critical untuk business operation

Tolong berikan solusi yang most reliable dan proven untuk thermal printer auto print di Electron.js environment.
