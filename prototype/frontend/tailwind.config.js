/** @type {import('tailwindcss').Config} */
// Visual language modelled on Kite / Coin: flat white surfaces, thin grey rules, one calm blue for actions,
// orange for the active tab, green/red only for gains and losses.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#262b33", soft: "#555b66", faint: "#8a919c" },
        line: "#e8eaee",
        canvas: "#f7f8fa",
        brand: { DEFAULT: "#387ed1", dark: "#2a65ad", soft: "#ebf3fc", ink: "#1f5aa6" },
        accent: { DEFAULT: "#387ed1", soft: "#ebf3fc", dark: "#2a65ad" },
        kite: "#ff5722",
        up: "#1f9d55", down: "#df514c",
      },
      fontFamily: { sans: ["Inter Variable", "Inter", "Segoe UI", "system-ui", "sans-serif"] },
      boxShadow: { card: "0 1px 2px rgba(20,24,31,.04)", pop: "0 12px 32px -8px rgba(20,24,31,.22)" },
    },
  },
  plugins: [],
};
