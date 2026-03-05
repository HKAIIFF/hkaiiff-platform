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
        void: "#050505",
        panel: "#111111",
        signal: "#CCFF00",
        accent: "#00F0FF",
        purple: "#9D00FF",
        honey: "#FFC107",
        danger: "#FF3333",
        aif: "#00E599",
      },
      fontFamily: {
        heavy: ['"Oswald"', "sans-serif"],
        mono: ['"Space Mono"', "monospace"],
        zh: ['"Noto Sans TC"', "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
