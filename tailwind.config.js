/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    colors: {
      transparent: "transparent",
      current: "currentColor",
      white: "#ffffff",
      black: "#000000",
      bg: "var(--bg)",
      surface: { DEFAULT: "var(--surface)", 2: "var(--surface-2)", 3: "var(--surface-3)", press: "var(--surface-press)" },
      line: { DEFAULT: "var(--line)", strong: "var(--line-strong)" },
      ink: { DEFAULT: "var(--ink)", 2: "var(--ink-2)", 3: "var(--ink-3)", 4: "var(--ink-4)", inverse: "var(--ink-inverse)" },
      accent: { DEFAULT: "var(--accent)", soft: "var(--accent-soft)", ink: "var(--accent-ink)", press: "var(--accent-press)" },
      positive: { DEFAULT: "var(--positive)", soft: "var(--positive-soft)" },
      negative: { DEFAULT: "var(--negative)", soft: "var(--negative-soft)" },
      warning: { DEFAULT: "var(--warning)", soft: "var(--warning-soft)" },
      scrim: "var(--scrim)"
    },
    fontFamily: {
      sans: ["-apple-system", "BlinkMacSystemFont", '"SF Pro Text"', '"SF Pro Display"', '"Helvetica Neue"', "Inter", "system-ui", "sans-serif"],
      mono: ['"SF Mono"', "ui-monospace", "Menlo", "monospace"]
    },
    fontSize: {
      display: ["40px", { lineHeight: "44px", letterSpacing: "-0.035em" }],
      "title-1": ["30px", { lineHeight: "36px", letterSpacing: "-0.028em" }],
      "title-2": ["22px", { lineHeight: "28px", letterSpacing: "-0.022em" }],
      "title-3": ["19px", { lineHeight: "24px", letterSpacing: "-0.018em" }],
      headline: ["17px", { lineHeight: "22px", letterSpacing: "-0.014em" }],
      body: ["16px", { lineHeight: "22px", letterSpacing: "-0.011em" }],
      callout: ["15px", { lineHeight: "20px", letterSpacing: "-0.009em" }],
      subhead: ["14px", { lineHeight: "19px", letterSpacing: "-0.006em" }],
      footnote: ["13px", { lineHeight: "18px", letterSpacing: "-0.003em" }],
      caption: ["12px", { lineHeight: "16px", letterSpacing: "0" }],
      micro: ["11px", { lineHeight: "13px", letterSpacing: "0.02em" }]
    },
    borderRadius: {
      none: "0",
      xs: "6px",
      sm: "10px",
      md: "14px",
      lg: "18px",
      xl: "22px",
      "2xl": "28px",
      full: "9999px"
    },
    extend: {
      spacing: {
        "safe-t": "var(--safe-top)",
        "safe-b": "var(--safe-bottom)",
        tabbar: "var(--tabbar-h)"
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0.22, 1, 0.36, 1)"
      },
      boxShadow: {
        card: "var(--shadow-card)",
        sheet: "var(--shadow-sheet)",
        pop: "var(--shadow-pop)"
      }
    }
  },
  plugins: []
};
