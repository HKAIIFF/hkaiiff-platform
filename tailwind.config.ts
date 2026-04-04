import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      keyframes: {
        'marquee-left':  { '0%': { transform: 'translateX(0%)' },    '100%': { transform: 'translateX(-50%)' } },
        'marquee-right': { '0%': { transform: 'translateX(-50%)' },  '100%': { transform: 'translateX(0%)' }   },
      },
      animation: {
        'marquee-left-fast':    'marquee-left 40s linear infinite',
        'marquee-left-slow':    'marquee-left 60s linear infinite',
        'marquee-right-medium': 'marquee-right 50s linear infinite',
      },
      colors: {
        void: "#050505",
        /** 深色底（#050505）上的語義化正文色階：主文 / 次文 / 提示 / 最弱提示（仍保持可讀對比） */
        "void-fg": "#f0f0f0",
        "void-muted": "#d0d0d0",
        "void-hint": "#b8b8b8",
        "void-subtle": "#949494",
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
