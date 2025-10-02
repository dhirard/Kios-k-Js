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
        // Poppy-inspired brand palette + stem greens
        maggie: {
          bg: "#FAF3E0", // warm cream background
          primary: "#E14D4D", // poppy
          white: "#FFFFFF",
          light: "#F8F9FA",
          dark: "#3A2B22",
        },
        "rose-gold": "#B76E79", // keep for subtle accents if needed
        // Soft neutrals/creams
        florist: {
          50: "#FFF8EF",
          100: "#FFF2E5",
          200: "#F6E9DA",
          300: "#ECDD C8".replace(/\s/g, ""),
          400: "#F7C7C0",
          500: "#F0B2A8",
          600: "#E79C90",
          700: "#CF8C82",
          800: "#B5796E",
          900: "#8C5A4F",
        },
        brand: {
          pink: {
            50: "#FFF8EF", // very light cream
            100: "#FFF2E5", // cream
            200: "#F6E9DA", // light border
            300: "#F7C7C0", // soft poppy tint
            400: "#F26B6B", // salmon/poppy mid-light
            500: "#F26B6B", // kept same for smoother gradients
            600: "#E14D4D", // primary poppy
            700: "#C43D3D",
            800: "#9F3333",
            900: "#6C2222",
          },
          stem: {
            50: "#EEF7F1",
            100: "#DBEFE3",
            200: "#C4E6D2",
            300: "#A8D5BA",
            400: "#8CCFA9",
            500: "#5AA469",
            600: "#3E7C59",
            700: "#2F5E44",
            800: "#244A36",
            900: "#183324",
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
          backgroundColor: theme("colors.maggie.bg"),
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
