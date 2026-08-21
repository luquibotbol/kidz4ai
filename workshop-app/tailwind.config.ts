import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Warm off-white workbench, near-black ink, one cobalt accent.
        // Deliberately not the chunky primary palette this replaced — VOICE
        // says understatement over enthusiasm, and the UI should agree.
        canvas: "#F6F5F2",
        surface: "#FFFFFF",
        ink:  { DEFAULT: "#14151A", soft: "#5C6068", faint: "#9AA0A8" },
        line: { DEFAULT: "#E6E4DF", strong: "#D4D1CA" },
        acc:  { DEFAULT: "#2340E8", dark: "#1A31B8", wash: "#EDF0FF" },
        gain: { DEFAULT: "#0B7A55", wash: "#E4F3ED" },
        flag: { DEFAULT: "#A8500A", wash: "#FBF0E2" },
        stop: { DEFAULT: "#B3261E", wash: "#FBEAE9" },
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: { card: "14px", pill: "999px" },
      keyframes: {
        rise:  { "0%": { transform: "translateY(6px)", opacity: "0" }, "100%": { transform: "translateY(0)", opacity: "1" } },
        fadein:{ "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        tick:  { "0%": { transform: "scale(.7)", opacity: "0" }, "100%": { transform: "scale(1)", opacity: "1" } },
        fall:  { "0%": { transform: "translateY(-12px) rotate(0)", opacity: "1" },
                 "100%": { transform: "translateY(260px) rotate(400deg)", opacity: "0" } },
      },
      animation: {
        rise: "rise .28s cubic-bezier(.2,.8,.3,1)",
        fadein: "fadein .35s ease-out",
        tick: "tick .2s cubic-bezier(.34,1.4,.64,1)",
      },
    },
  },
  plugins: [],
} satisfies Config;
