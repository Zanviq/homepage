import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "rgb(var(--paper-rgb) / <alpha-value>)",
        "paper-2": "rgb(var(--paper-2-rgb) / <alpha-value>)",
        ink: "rgb(var(--ink-rgb) / <alpha-value>)",
        "ink-soft": "rgb(var(--ink-soft-rgb) / <alpha-value>)",
        leaf: "rgb(var(--leaf-rgb) / <alpha-value>)",
        "leaf-deep": "rgb(var(--leaf-deep-rgb) / <alpha-value>)",
        tangerine: "rgb(var(--tangerine-rgb) / <alpha-value>)",
        butter: "rgb(var(--butter-rgb) / <alpha-value>)",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        body: ["var(--font-body)", "Pretendard", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      boxShadow: {
        block: "6px 6px 0 0 var(--ink)",
        "block-lg": "10px 10px 0 0 var(--ink)",
        "block-leaf": "6px 6px 0 0 var(--leaf-deep)",
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
