import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-hover": "var(--surface-hover)",
        border: "var(--border)",
        ink: "var(--text)",
        muted: "var(--text-muted)",
        faint: "var(--text-faint)",
        accent: "var(--accent)",
        "accent-soft": "var(--accent-soft)",
        "accent-hover": "var(--accent-hover)",
        "surface-alt": "var(--surface-alt)",
        info: "var(--info)",
        "info-soft": "var(--info-soft)",
        success: "var(--success)",
        "success-soft": "var(--success-soft)",
        warning: "var(--warning)",
        "warning-soft": "var(--warning-soft)",
        danger: "var(--danger)",
        "danger-soft": "var(--danger-soft)",
        milo: "var(--milo)",
      },
      borderRadius: { sm: "var(--radius-sm)", DEFAULT: "var(--radius)", lg: "var(--radius-lg)" },
      boxShadow: { soft: "var(--shadow)", lift: "var(--shadow-lg)" },
      fontFamily: {
        sans: ["var(--font-lexend)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-newsreader)", "ui-serif", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
export default config;
