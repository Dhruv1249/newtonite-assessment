import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: "#e0e5ec",
        "surface-deep": "#d1d9e6",
        "surface-raised": "#e8edf4",
        accent: {
          DEFAULT: "#74a57f",
          hover: "#628d6c",
          light: "rgba(116, 165, 127, 0.20)",
        },
        text: {
          primary: "#4a5568",
          secondary: "#718096",
          muted: "#a0aec0",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
