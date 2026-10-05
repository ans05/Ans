import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0a0a0b",
        panel: "#111113",
        edge: "#26262a",
        bone: "#ece9e1",
        dim: "#8b8880",
        signal: "#ff5a36",
        acid: "#c6ff3d",
        violet: "#b18cff",
        cyan: "#3dd6ff",
      },
      fontFamily: {
        display: ['"Bebas Neue"', "Impact", "Arial Narrow", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
