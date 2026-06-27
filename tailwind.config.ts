import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        serif: ["Instrument Serif", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      colors: {
        stone: {
          25: "#FAFAF9",
          50: "#F5F3EF",
          100: "#E8E4DC",
          200: "#D4CFC5",
          300: "#B8B1A4",
          400: "#9A9189",
          500: "#7D7469",
          600: "#635B51",
          700: "#4A4439",
          800: "#322D25",
          900: "#1A1A1A",
        },
        amber: {
          100: "#F5E6D0",
          200: "#EBD0A8",
          300: "#DEB87A",
          400: "#C8A055",
          500: "#B08040",
          600: "#8C6230",
        },
        ink: "#0A0A0A",
        canvas: "#FAFAF9",
      },
      borderRadius: {
        sm: "3px",
        DEFAULT: "5px",
        md: "7px",
        lg: "10px",
        xl: "14px",
      },
    },
  },
  plugins: [],
};
export default config;
