# Kios-k-Js - Refactored Architecture

## Struktur Project Setelah Refactoring

Project ini telah di-refactor dari file `main.js` tunggal yang berisi 3000+ baris menjadi struktur yang lebih modular dan mudah di-maintain.

### Struktur Folder

```
kios-k-js/
├── main.js                          # Entry point (refactored, ~150 baris)
├── main-original-backup.js          # Backup file original
├── lib/
│   ├── managers/                    # Manager classes
│   │   ├── SettingsManager.js       # Manage aplikasi settings
│   │   ├── SerialPortManager.js     # Manage serial port operations
│   │   ├── PrintManager.js          # Manage semua fungsi printing
│   │   ├── WindowManager.js         # Manage window creation & lifecycle
│   │   ├── MenuManager.js           # Manage application menu
│   │   ├── DatabaseManager.js       # Manage database operations & seeding
│   │   └── IPCHandlers.js           # Manage semua IPC handlers
│   └── utils/
│       └── formatters.js            # Utility functions (currency, text formatting)
├── db/
│   └── database.js                  # Database helper (existing)
├── renderer/                        # Frontend files (existing)
└── ...                              # Other existing files
```

### Penjelasan Manager Classes

#### 1. **SettingsManager.js**

- Mengelola load/save settings aplikasi
- Menyediakan methods untuk get/set individual settings
- Handles userData path management

#### 2. **SerialPortManager.js**

- Mengelola deteksi dan operasi serial port untuk thermal printer
- Auto-detection untuk POS58/EP58M printer
- Manage preferred serial port settings

#### 3. **PrintManager.js**

- Semua fungsi printing (ESC/POS, thermal, HTML printing)
- Support multiple print methods dengan fallback chain
- Printer detection dan diagnostics

#### 4. **WindowManager.js**

- Create dan manage browser windows
- Navigation between pages
- Print window creation untuk receipt printing

#### 5. **MenuManager.js**

- Setup application menu
- Menu actions dan keyboard shortcuts

#### 6. **DatabaseManager.js**

- Wrapper untuk database operations
- Initial data seeding
- Database lifecycle management

#### 7. **IPCHandlers.js**

- Semua IPC main process handlers
- Organized by categories (database, printing, settings, etc.)
- Centralized IPC management

#### 8. **formatters.js**

- Utility functions untuk formatting
- Currency formatting, text alignment
- Reusable across managers

### Benefits dari Refactoring

#### ✅ **Maintainability**

- Code terorganisir dalam modules yang focused
- Easier debugging - bisa focus ke specific manager
- Separation of concerns

#### ✅ **Scalability**

- Mudah menambah fitur baru tanpa mengubah core structure
- Manager classes bisa di-extend atau di-replace
- Modular testing

#### ✅ **Readability**

- Main.js sekarang hanya ~150 baris vs 3000+ baris sebelumnya
- Setiap manager punya responsibility yang jelas
- Better code organization

#### ✅ **Debugging**

- Easier untuk isolate issues ke specific manager
- Consistent error handling per manager
- Better logging dengan context

### Migration Notes

1. **File original** di-backup sebagai `main-original-backup.js`
2. **Semua functionality** dipertahankan, hanya dipindah ke managers
3. **No breaking changes** untuk renderer/frontend
4. **Settings dan database** tetap compatible

### Development Workflow

#### Debugging Specific Feature:

- **Database issues** → `DatabaseManager.js`
- **Printing problems** → `PrintManager.js`
- **Serial port issues** → `SerialPortManager.js`
- **Window/UI issues** → `WindowManager.js`
- **Settings problems** → `SettingsManager.js`

#### Adding New Features:

1. Identifikasi manager yang relevan
2. Extend manager atau buat manager baru
3. Update IPC handlers jika perlu
4. Test individual manager

#### Common Debug Commands:

```bash
# Test database operations
node -e "const DbMgr = require('./lib/managers/DatabaseManager'); const db = new DbMgr(); db.initialize().then(() => console.log('DB OK'))"

# Test serial port detection
node -e "const SPMgr = require('./lib/managers/SerialPortManager'); const SettingsMgr = require('./lib/managers/SettingsManager'); const sp = new SPMgr(new SettingsMgr()); sp.autoDetectSerialPort().then(console.log)"
```

### Next Steps

1. **Test semua functionality** untuk ensure no regression
2. **Add unit tests** untuk individual managers
3. **Consider TypeScript migration** untuk better type safety
4. **Add JSDoc** untuk better documentation

### Rollback Instructions

Jika ada issues, bisa rollback dengan:

```bash
cp main-original-backup.js main.js
rm -rf lib/
```

Tapi lebih baik fix issues dalam structure baru untuk long-term maintainability.
