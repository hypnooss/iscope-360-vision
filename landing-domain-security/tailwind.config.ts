import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        heading: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        brand: {
          DEFAULT: "hsl(175, 80%, 45%)",
          light: "hsl(175, 80%, 55%)",
          dark: "hsl(175, 80%, 35%)",
          glow: "hsl(175, 80%, 60%)",
        },
        accent: {
          DEFAULT: "hsl(220, 70%, 55%)",
          light: "hsl(220, 70%, 65%)",
        },
        surface: {
          DEFAULT: "hsl(220, 18%, 8%)",
          raised: "hsl(220, 18%, 11%)",
          overlay: "hsl(220, 18%, 14%)",
          border: "hsl(220, 15%, 20%)",
        },
        text: {
          DEFAULT: "hsl(0, 0%, 95%)",
          muted: "hsl(220, 10%, 55%)",
          dim: "hsl(220, 10%, 40%)",
        },
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s ease-out forwards",
        "glow-pulse": "glow-pulse 3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
