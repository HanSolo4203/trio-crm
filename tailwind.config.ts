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
        ink: "#192841",
        muted: "#56677f",
        line: "#dce3ed",
        page: "#f3f6fa",
        blue: "#254fbb",
        mint: "#6adfc5",
        danger: "#aa303c",
      },
    },
  },
  plugins: [],
};
export default config;
