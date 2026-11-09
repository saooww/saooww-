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
      accent: { DEFAULT: "var(--accent)", soft: "var(--accent-soft)", ink: "var(--accent-ink)", press: "var(--accent-press)", hi: "var(--accent-hi)", lo: "var(--accent-lo)" },
      positive: { DEFAULT: "var(--positive)", soft: "var(--positive-soft)" },
      gold: "var(--gold)",
      negative: { DEFAULT: "var(--negative)", soft: "var(--negative-soft)" },
      warning: { DEFAULT: "var(--warning)", soft: "var(--warning-soft)" },
      scrim: "var(--scrim)"
    },
    fontFamily: {
      sans: ["-apple-system", "BlinkMacSystemFont", '"SF Pro Text"', '"SF Pro Display"', '"Helvetica Neue"', "Inter", "system-ui", "sans-serif"],
      mono: ['"SF Mono"', "ui-monospace", "Menlo", "monospace"]
    },
    fontSize: {
      display: ["calc(40px * var(--text-scale))", { lineHeight: "calc(44px * var(--text-scale))", letterSpacing: "-0.035em" }],
      "title-1": ["calc(30px * var(--text-scale))", { lineHeight: "calc(36px * var(--text-scale))", letterSpacing: "-0.028em" }],
      "title-2": ["calc(22px * var(--text-scale))", { lineHeight: "calc(28px * var(--text-scale))", letterSpacing: "-0.022em" }],
      "title-3": ["calc(19px * var(--text-scale))", { lineHeight: "calc(24px * var(--text-scale))", letterSpacing: "-0.018em" }],
      headline: ["calc(17px * var(--text-scale))", { lineHeight: "calc(22px * var(--text-scale))", letterSpacing: "-0.014em" }],
      body: ["calc(16px * var(--text-scale))", { lineHeight: "calc(22px * var(--text-scale))", letterSpacing: "-0.011em" }],
      callout: ["calc(15px * var(--text-scale))", { lineHeight: "calc(20px * var(--text-scale))", letterSpacing: "-0.009em" }],
      subhead: ["calc(14px * var(--text-scale))", { lineHeight: "calc(19px * var(--text-scale))", letterSpacing: "-0.006em" }],
      footnote: ["calc(13px * var(--text-scale))", { lineHeight: "calc(18px * var(--text-scale))", letterSpacing: "-0.003em" }],
      caption: ["calc(12px * var(--text-scale))", { lineHeight: "calc(16px * var(--text-scale))", letterSpacing: "0" }],
      micro: ["calc(11px * var(--text-scale))", { lineHeight: "calc(13px * var(--text-scale))", letterSpacing: "0.02em" }]
    },
    borderRadius: {
      none: "0",
      xs: "6px",
      sm: "10px",
      md: "14px",
      lg: "20px",
      xl: "24px",
      "2xl": "30px",
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
        pop: "var(--shadow-pop)",
        panel: "var(--shadow-panel)"
      }
    }
  },
  plugins: []
};
