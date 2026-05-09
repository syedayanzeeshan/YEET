import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        void: "#04050a",
        ink: "#090b12",
        panel: "#0d111c",
        acid: "#a7ff4f",
        pulse: "#20e4ff",
        flare: "#ff3f81",
        amber: "#ffcc66"
      },
      boxShadow: {
        glow: "0 0 30px rgba(32, 228, 255, 0.28)",
        acid: "0 0 30px rgba(167, 255, 79, 0.22)",
        flare: "0 0 30px rgba(255, 63, 129, 0.24)"
      },
      fontFamily: {
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"]
      }
    }
  },
  plugins: []
};

export default config;
