/** @type {import('tailwindcss').Config} */
module.exports = {
  // Ensure Tailwind utilities/components win over legacy CSS where selectors collide
  important: true,
  content: ["./renderer/**/*.{html,js}", "./*.js"],
  corePlugins: {
    preflight: false, // disable reset agar tidak bentrok style lama
  },
  theme: {
    extend: {
      fontFamily: {
        // Body font
        sans: [
          "Poppins",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "Noto Sans",
          "sans-serif",
          "Apple Color Emoji",
          "Segoe UI Emoji",
        ],
        // Display/heading font
        heading: [
          "Playfair Display",
          "ui-serif",
          "Georgia",
          "Cambria",
          "Times New Roman",
          "Times",
          "serif",
        ],
      },
      borderRadius: {
        // Jadikan rounded default = rounded-xl
        DEFAULT: "0.75rem", // rounded-xl
      },
      boxShadow: {
        // Default shadow lembut setara shadow-md
        DEFAULT:
          "0 4px 6px -1px rgb(0 0 0 / 0.10), 0 2px 4px -2px rgb(0 0 0 / 0.10)",
      },
      colors: {
        // Palet florist bertema pink elegan
        maggie: {
          bg: "#FFC0CB", // kompat: latar belakang default lama
          primary: "#D63384",
          white: "#FFFFFF",
          light: "#F8F9FA",
          dark: "#444444",
        },
        // Aksen rose gold
        "rose-gold": "#B76E79",
        // Palet florist khusus untuk gradient lembut
        florist: {
          50: "#FFF7FA",
          100: "#FFEFF5",
          200: "#FFB6C1", // pastel pink 2
          300: "#FFC0CB", // pastel pink 1
          400: "#F3A6B5",
          500: "#E68EA0",
          600: "#D9778B",
          700: "#C56579",
          800: "#A95364",
          900: "#7A3A48",
        },
        // Perbarui skala brand-pink agar konsisten dengan tema di atas
        brand: {
          pink: {
            50: "#FFF7FA",
            100: "#FFEFF5",
            200: "#FFB6C1", // pastel pink
            300: "#FFC0CB", // pastel pink
            400: "#F07FB2",
            500: "#E2559A",
            600: "#D63384", // deep pink (tombol/teks utama)
            700: "#B0246B",
            800: "#8A1D55",
            900: "#5C1238",
          },
        },
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.6s ease both",
      },
    },
  },
  plugins: [
    // Base styles non-invasif: heading bold + uppercase, body menggunakan sans modern
    function ({ addBase, theme }) {
      const sans = theme("fontFamily.sans");
      const heading = theme("fontFamily.heading");
      const fontFamilySans = Array.isArray(sans)
        ? sans.join(", ")
        : String(sans);
      const fontFamilyHeading = Array.isArray(heading)
        ? heading.join(", ")
        : String(heading);
      const fs = (k) => {
        const v = theme(`fontSize.${k}`);
        return Array.isArray(v) ? v[0] : v;
      };
      addBase({
        body: {
          fontFamily: fontFamilySans,
          // Background global ditangani di style.css (gradient),
          // tetap set fallback warna lembut
          backgroundColor: theme("colors.florist.100"),
          color: theme("colors.maggie.dark"),
        },
        h1: {
          fontFamily: fontFamilyHeading,
          fontWeight: "700",
          letterSpacing: theme("letterSpacing.normal"),
          color: theme("colors.maggie.white"),
          fontSize: fs("3xl"),
        },
        h2: {
          fontFamily: fontFamilyHeading,
          fontWeight: "700",
          letterSpacing: theme("letterSpacing.normal"),
          color: theme("colors.maggie.primary"),
          fontSize: fs("2xl"),
        },
        h3: {
          fontFamily: fontFamilyHeading,
          fontWeight: "600",
          color: theme("colors.maggie.dark"),
          fontSize: fs("xl"),
        },
        h4: {
          fontFamily: fontFamilyHeading,
          fontWeight: "500",
          color: theme("colors.maggie.dark"),
          fontSize: fs("lg"),
        },
      });
    },
  ],
};
