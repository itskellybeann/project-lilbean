/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0a0a0a",
          900: "#111113",
          800: "#1a1a1d",
          700: "#242428",
          600: "#333338",
        },
        bean: {
          50: "#fff0f6",
          100: "#ffd6e8",
          200: "#ffadd2",
          300: "#ff85bd",
          400: "#ff5ca8",
          500: "#f5348c",
          600: "#d81b70",
          700: "#ad1259",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
