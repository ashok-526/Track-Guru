/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#E8F4FD",
          100: "#C5E3F9",
          200: "#8DC7F3",
          300: "#55ABED",
          400: "#1D8FE7",
          500: "#006CC4",
          600: "#005BA3",
          700: "#004A82",
          800: "#003962",
          900: "#002841",
        },
        surface: {
          50: "#F8FAFB",
          100: "#F1F4F7",
          200: "#E4E8ED",
          300: "#CDD3DB",
          400: "#9BA5B3",
          500: "#6B7789",
          600: "#4A5568",
          700: "#364152",
          800: "#1F2A3B",
          900: "#0F1724",
        },
      },
      fontFamily: {
        sans: ["'Inter'", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 2px 8px rgba(0, 0, 0, 0.04)",
        card: "0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)",
        elevated: "0 8px 30px rgba(0, 108, 196, 0.08)",
        glow: "0 0 20px rgba(0, 108, 196, 0.15)",
      },
      borderRadius: {
        xl: "0.75rem",
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
    },
  },
  plugins: [],
};
