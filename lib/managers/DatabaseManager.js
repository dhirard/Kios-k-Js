const DatabaseHelper = require("../../db/database");

/**
 * Manager untuk handling database operations dengan seeding
 */
class DatabaseManager {
  constructor() {
    this.dbHelper = null;
  }

  async initialize() {
    try {
      this.dbHelper = new DatabaseHelper();
      await this.dbHelper.initialize();

      // Seed initial products if database is empty
      const products = await this.dbHelper.getAllProducts();
      if (products.length === 0) {
        await this.seedProducts();
      }

      // Create default admin if not exists
      const defaultAdmin = await this.dbHelper.getAdminByUsername("admin");
      if (!defaultAdmin) {
        await this.dbHelper.createAdmin("admin", "admin123");
        console.log("Default admin created: username=admin, password=admin123");
      }

      console.log("Database initialized successfully");
      return this.dbHelper;
    } catch (error) {
      console.error("Error initializing database:", error);
      throw error;
    }
  }

  // Seed initial products
  async seedProducts() {
    const initialProducts = [
      {
        name: "Buket Mawar Merah",
        price: 150000,
        image:
          "https://via.placeholder.com/300x200/ff6b6b/ffffff?text=Buket+Mawar",
        description:
          "Buket 12 mawar merah segar melambangkan cinta dan kasih sayang. Dikemas elegan dengan pita satin merah.",
      },
      {
        name: "Lili Putih Elegan",
        price: 120000,
        image:
          "https://via.placeholder.com/300x200/95a5a6/ffffff?text=Lili+Putih",
        description:
          "Rangkaian lili putih harum yang cocok untuk hadiah penuh ketulusan dan ketenangan.",
      },
      {
        name: "Tulip Kuning",
        price: 100000,
        image:
          "https://via.placeholder.com/300x200/f1c40f/ffffff?text=Tulip+Kuning",
        description:
          "Buket tulip kuning cerah melambangkan persahabatan, keceriaan, dan harapan baru.",
      },
      {
        name: "Buket Campuran",
        price: 200000,
        image:
          "https://via.placeholder.com/300x200/9b59b6/ffffff?text=Buket+Campuran",
        description:
          "Kombinasi bunga pilihan berbagai warna untuk setiap perayaan spesial Anda.",
      },
      {
        name: "Anggrek Ungu",
        price: 180000,
        image:
          "https://via.placeholder.com/300x200/8e44ad/ffffff?text=Anggrek+Ungu",
        description:
          "Pot anggrek ungu elegan yang tahan lama dan mewah sebagai dekorasi ruang.",
      },
      {
        name: "Sunflower Bouquet",
        price: 130000,
        image:
          "https://via.placeholder.com/300x200/f39c12/ffffff?text=Sunflower",
        description:
          "Buket bunga matahari ceria yang membawa energi positif dan semangat baru.",
      },
    ];

    for (const product of initialProducts) {
      await this.dbHelper.addProduct(
        product.name,
        product.price,
        product.image,
        product.description
      );
    }

    console.log("Initial products seeded successfully");
  }

  getDbHelper() {
    return this.dbHelper;
  }

  close() {
    if (this.dbHelper) {
      this.dbHelper.close();
    }
  }
}

module.exports = DatabaseManager;
