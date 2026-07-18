import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // hex literals so Tailwind opacity modifiers (e.g. text-ink/60) work;
      // the same tokens live as CSS variables in globals.css for custom CSS
      colors: {
        cream: "#FDFBF7",
        card: "#FFFFFF",
        ink: "#1A1A1A",
        pinky: "#FF8BA0",
        bluey: "#5B9BFF",
        sage: "#A8C3A0",
        cherry: "#E5484D",
        butter: "#F7D774",
        blush: "#F6C6CF",
        muted: "#9A938A",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        round: ["var(--font-round)", "var(--font-inter)", "sans-serif"],
      },
      boxShadow: {
        soft: "0 8px 30px rgba(26, 26, 26, 0.07)",
        lift: "0 14px 40px rgba(26, 26, 26, 0.12)",
      },
      keyframes: {
        floaty: {
          "0%, 100%": { transform: "translate(0, 0) rotate(-2deg)" },
          "50%": { transform: "translate(10px, -14px) rotate(2deg)" },
        },
        floaty2: {
          "0%, 100%": { transform: "translate(0, 0) rotate(2deg)" },
          "50%": { transform: "translate(-12px, 10px) rotate(-3deg)" },
        },
        stripscroll: {
          "0%": { transform: "translateY(0)" },
          "100%": { transform: "translateY(-50%)" },
        },
        flash: {
          "0%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
        pop: {
          "0%": { transform: "scale(0.6)", opacity: "0" },
          "70%": { transform: "scale(1.08)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        pulse2: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
        playerin: {
          "0%": { transform: "translateX(-120%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        trackin: {
          "0%": { transform: "translateY(6px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
      animation: {
        floaty: "floaty 7s ease-in-out infinite",
        floaty2: "floaty2 9s ease-in-out infinite",
        stripscroll: "stripscroll 22s linear infinite",
        flash: "flash 0.5s ease-out forwards",
        pop: "pop 0.35s ease-out both",
        pulse2: "pulse2 1.6s ease-in-out infinite",
        playerin: "playerin 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
        trackin: "trackin 0.45s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
