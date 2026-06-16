/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#09090b",
          raised: "#18181b",
          overlay: "#1c1c21",
          border: "#27272a",
        },
        "text-primary": "#fafafa",
        "text-secondary": "#a1a1aa",
        "text-tertiary": "#71717a",
        "text-disabled": "#52525b",
        accent: {
          violet: "#8b5cf6",
          "violet-muted": "rgba(139, 92, 246, 0.15)",
          "violet-border": "rgba(139, 92, 246, 0.3)",
          emerald: "#34d399",
          "emerald-muted": "rgba(52, 211, 153, 0.15)",
          "emerald-border": "rgba(52, 211, 153, 0.3)",
          red: "#f87171",
          "red-muted": "rgba(248, 113, 113, 0.15)",
          "red-border": "rgba(248, 113, 113, 0.3)",
          amber: "#fbbf24",
          "amber-muted": "rgba(251, 191, 36, 0.15)",
          "amber-border": "rgba(251, 191, 36, 0.3)",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      fontSize: {
        "xs-meta": ["11px", { lineHeight: "16px" }],
        xs: ["12px", { lineHeight: "16px" }],
        sm: ["13px", { lineHeight: "20px" }],
        base: ["14px", { lineHeight: "20px" }],
      },
      boxShadow: {
        "glow-violet": "0 0 12px rgba(139, 92, 246, 0.25)",
        "glow-emerald": "0 0 12px rgba(52, 211, 153, 0.25)",
        elevated: "0 4px 24px rgba(0, 0, 0, 0.4)",
      },
      keyframes: {
        "pulse-record": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-down": {
          from: { opacity: "0", transform: "translateY(-8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "pulse-record": "pulse-record 1.5s ease-in-out infinite",
        "fade-in": "fade-in 200ms ease-out",
        "slide-up": "slide-up 200ms ease-out",
        "slide-down": "slide-down 200ms ease-out",
      },
    },
  },
  plugins: [],
};
