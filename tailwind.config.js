/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./renderer/**/*.{html,js}", "./*.js"],
  corePlugins: {
    preflight: false, // disable reset agar tidak bentrok style lama
  },
  theme: {
    extend: {
      colors: {
        brand: {
          pink: {
            50: "#fff5fa",
            100: "#ffe9f3",
            200: "#ffd3e8",
            300: "#ffb0d7",
            400: "#ff8cc8",
            500: "#ff5fb1",
            600: "#ff2f92",
            700: "#e01376",
            800: "#b00b5c",
            900: "#76023c",
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
  plugins: [],
};
