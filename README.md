# JS Florist - Aplikasi Desktop Toko Bunga

Aplikasi desktop offline untuk toko bunga yang dibangun dengan Electron.js dan SQLite.

## 🌸 Fitur Utama

- **Katalog Produk**: Menampilkan daftar bunga dengan gambar, nama, dan harga
- **Keranjang Belanja**: Tambah, edit, dan hapus produk dari keranjang
- **Checkout**: Proses pembayaran dengan berbagai metode (Tunai, Kartu, QRIS)
- **Panel Admin**: Login admin untuk mengelola produk dan melihat laporan
- **Laporan Penjualan**: Dashboard dengan statistik dan laporan lengkap
- **Database Offline**: Menggunakan SQLite untuk penyimpanan data lokal
- **Responsive Design**: Tampilan modern yang responsif

## 📁 Struktur Project

```
florist-kiosk/
├── main.js                      # Entry point Electron
├── preload.js                  # Bridge antara main dan renderer process
├── package.json                # NPM configuration
├── db/
│   ├── database.js             # Helper database SQLite
│   └── florist.db              # File database (dibuat otomatis)
├── renderer/
│   ├── index.html              # Halaman katalog produk
│   ├── cart.html               # Halaman keranjang
│   ├── checkout.html           # Halaman checkout
│   ├── admin-login.html        # Halaman login admin
│   ├── admin-dashboard.html    # Dashboard admin
│   ├── admin-dashboard.js      # JavaScript untuk admin
│   ├── style.css               # Styling untuk seluruh aplikasi
│   └── renderer.js             # Utility functions frontend
└── assets/                     # (Optional) Icon dan gambar
```

## 🗄️ Database Schema

### Table: products

```sql
CREATE TABLE products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    image TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Table: cart

```sql
CREATE TABLE cart (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products (id)
);
```

### Table: orders

```sql
CREATE TABLE orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    total_amount REAL NOT NULL
);
```

## 🚀 Cara Menjalankan

### Prerequisites

- Node.js (v14 atau lebih baru)
- NPM

### Instalasi

1. Clone atau download project ini
2. Buka terminal di folder project
3. Install dependencies:
   ```bash
   npm install
   ```

### Menjalankan Aplikasi

```bash
npm start
```

### Login Admin

Untuk mengakses panel admin, Anda bisa menggunakan salah satu cara berikut:

**Cara 1: Melalui Menu Aplikasi** (Direkomendasikan)

1. Klik menu "File" → "Admin Login"

**Cara 2: Melalui Navigation Bar** (Cara Cepat)

1. Klik tombol "🔐 Admin" di navigation bar (tersedia di semua halaman)

**Cara 3: URL Manual**

1. Navigasi langsung ke `admin-login.html`

**Kredensial Default:**

- **Username**: admin
- **Password**: admin123

### Mode Development (dengan DevTools)

```bash
npm run dev
```

## 🛠️ Fitur Detail

### 1. Halaman Katalog (index.html)

- Menampilkan grid produk bunga
- Tombol "Tambah ke Keranjang" di setiap produk
- Counter keranjang di navigation
- Notifikasi saat produk ditambahkan

### 2. Halaman Keranjang (cart.html)

- Daftar produk dalam keranjang
- Kontrol quantity (+ / -)
- Tombol hapus produk
- Ringkasan total harga
- Tombol checkout

### 3. Halaman Checkout (checkout.html)

- Ringkasan pesanan
- Pilihan metode pembayaran:
  - 💵 Tunai
  - 💳 Kartu Debit/Kredit
  - 📱 QRIS
- Konfirmasi pembayaran
- Modal sukses dengan ID pesanan

### 4. Panel Admin

#### Login Admin (admin-login.html)

- Username: admin
- Password: admin123
- Session management dengan localStorage

#### Dashboard Admin (admin-dashboard.html)

- **Tab Dashboard**: Statistik penjualan dan produk terlaris
- **Tab Kelola Produk**: CRUD produk (tambah, edit, hapus)
- **Tab Laporan Penjualan**: Filter berdasarkan tanggal

#### Fitur Admin:

- 📊 Dashboard dengan statistik real-time
- 📦 Management produk lengkap
- 📈 Laporan penjualan dengan filter tanggal
- 🏆 Produk terlaris
- 💰 Total pendapatan dan rata-rata pesanan

### 5. Database Features

- Auto-seed produk awal saat pertama kali dijalankan
- CRUD operations untuk produk dan keranjang
- Penyimpanan transaksi
- Pembersihan keranjang otomatis setelah checkout

## 🎨 Design Features

- **Modern UI**: Gradient background dan card-based layout
- **Responsive**: Mendukung berbagai ukuran layar
- **Animations**: Hover effects dan smooth transitions
- **Notifications**: Toast notifications untuk feedback user
- **Loading States**: Spinner dan loading indicators
- **Error Handling**: Graceful error handling dengan pesan yang informatif

## 🔧 Konfigurasi

### Menambah Produk Baru

Edit file `main.js` di fungsi `seedProducts()` untuk menambah produk awal:

```javascript
const initialProducts = [
  {
    name: "Nama Bunga",
    price: 150000,
    image: "URL_GAMBAR",
  },
  // Tambah produk lainnya...
];
```

### Mengubah Styling

Edit file `renderer/style.css` untuk mengubah tampilan aplikasi.

### Database Location

File database SQLite disimpan di `db/florist.db` dan akan dibuat otomatis saat aplikasi pertama kali dijalankan.

## 📝 API Documentation

### Electron API (preload.js)

- `electronAPI.getProducts()` - Ambil semua produk
- `electronAPI.addToCart(productId, quantity)` - Tambah ke keranjang
- `electronAPI.getCartItems()` - Ambil item keranjang
- `electronAPI.updateCartItem(cartId, quantity)` - Update quantity
- `electronAPI.removeFromCart(cartId)` - Hapus dari keranjang
- `electronAPI.checkout(totalAmount)` - Proses checkout
- `electronAPI.formatCurrency(amount)` - Format mata uang

## 🐛 Troubleshooting

### Error: electron command not found

```bash
npm install electron --save-dev
```

### Error: sqlite3 not found

```bash
npm install sqlite3
```

### GPU Process Errors

Error GPU dapat diabaikan dan tidak mempengaruhi fungsionalitas aplikasi.

### Database Permission Error

Pastikan folder `db/` memiliki permission write untuk membuat file database.

## 🔮 Future Enhancements

- [ ] Laporan penjualan
- [ ] Management produk dari UI
- [ ] Export data ke Excel/PDF
- [ ] Backup dan restore database
- [ ] Print receipt
- [ ] Multi-language support
- [ ] Dark mode theme

## 📄 License

MIT License

## 👨‍💻 Author

Dibuat dengan ❤️ untuk toko bunga

---

**Happy Coding! 🌸**
