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
        navy: "#122342",
        ink: "#17181c",
        muted: "#6b7280",
        line: "#e5e7eb",
        page: "#f7f8fa",
        blue: "#2f6fed",
        mint: "#6adfc5",
        danger: "#aa303c",
        accentFrom: "#8b5cf6",
        accentTo: "#ec4899",
      },
      boxShadow: {
        card: "0 1px 2px rgb(18 35 66 / 0.04), 0 8px 20px -12px rgb(18 35 66 / 0.12)",
      },
    },
  },
  plugins: [],
};
export default config;
