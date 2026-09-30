import type { Config } from "tailwindcss";

const rgb = (name: string) => `rgb(var(--${name}-rgb) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: rgb("paper"),
        sheet: rgb("sheet"),
        ink: rgb("ink"),
        soft: rgb("soft"),
        line: rgb("line"),
        lav: rgb("lav"),
        deep: rgb("deep"),
        pale: rgb("pale"),
        // older names (admin screens), mapped onto the lavender palette
        "paper-2": rgb("pale"),
        "ink-soft": rgb("soft"),
        leaf: rgb("deep"),
        "leaf-deep": rgb("deep"),
        tangerine: rgb("deep"),
        butter: rgb("pale"),
      },
      fontFamily: {
        ui: ["var(--font-ui)", "IBM Plex Sans KR", "system-ui", "sans-serif"],
        display: ["var(--font-ui)", "IBM Plex Sans KR", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "Pretendard", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "IBM Plex Mono", "var(--font-ui)", "IBM Plex Sans KR", "monospace"],
      },
      boxShadow: {
        lift: "var(--lift)",
        // the old hard offset shadows all become the one soft shadow
        block: "var(--lift)",
        "block-lg": "var(--lift)",
        "block-leaf": "var(--lift)",
      },
      keyframes: {
        "rise-in": {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slow-spin": {
          to: { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "rise-in": "rise-in 0.7s cubic-bezier(0.22, 1, 0.36, 1) both",
        "slow-spin": "slow-spin 24s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
