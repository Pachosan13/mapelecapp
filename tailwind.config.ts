import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#f0f1f5",
          100: "#d9dce6",
          200: "#b3b9cd",
          300: "#8d96b4",
          400: "#67739b",
          500: "#415082",
          600: "#2e3a62",
          700: "#1a2347",
          800: "#131a35",
          900: "#0c1123",
        },
        gold: {
          50: "#faf6f0",
          100: "#f2e8d8",
          200: "#e8d5b5",
          300: "#d9be8e",
          400: "#c5a47e",
          500: "#b08a5e",
          600: "#8c6e4a",
          700: "#685237",
          800: "#443623",
          900: "#221b12",
        },
      },
    },
  },
  plugins: [],
};
export default config;
