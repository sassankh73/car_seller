/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        charcoal: {
          900: "#1A1A1A",
          800: "#222222",
          700: "#333333",
          600: "#4A4A4A",
          500: "#666666",
          400: "#999999",
          300: "#CCCCCC",
          200: "#E5E5E5",
          100: "#F5F5F5",
        },
        red: {
          700: "#8B1A1A",
          600: "#B71C1C",
          500: "#D62828",
          400: "#E74C3C",
          300: "#F07070",
          200: "#F5A0A0",
          100: "#FDE8E8",
          50: "#FFF5F5",
        },
        warm: {
          cream: "#FAF8F5",
          sand: "#F7F4EF",
          beige: "#F4E6D4",
          stone: "#D6CCC2",
          clay: "#E8DDD4",
        },
        accent: {
          coral: "#E76F51",
          terracotta: "#C75B39",
          gold: "#C4956A",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        display: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      borderRadius: {
        "2xl": "16px",
        "3xl": "24px",
        "4xl": "32px",
      },
      boxShadow: {
        "card-sm":
          "0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)",
        card: "0 4px 6px rgba(0, 0, 0, 0.03), 0 2px 4px rgba(0, 0, 0, 0.04)",
        "card-lg":
          "0 10px 25px rgba(0, 0, 0, 0.05), 0 4px 10px rgba(0, 0, 0, 0.03)",
        "card-hover":
          "0 12px 30px rgba(0, 0, 0, 0.07), 0 6px 12px rgba(0, 0, 0, 0.04)",
        "red-glow": "0 0 20px rgba(214, 40, 40, 0.15), 0 0 40px rgba(214, 40, 40, 0.05)",
      },
      animation: {
        "fade-in": "fadeIn 0.8s ease-out forwards",
        "fade-in-up": "fadeInUp 0.8s ease-out forwards",
        "fade-in-down": "fadeInDown 0.6s ease-out forwards",
        float: "float 6s ease-in-out infinite",
        "float-slow": "float 8s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(30px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeInDown: {
          "0%": { opacity: "0", transform: "translateY(-20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "hero-warm":
          "radial-gradient(ellipse at 70% 30%, rgba(214, 40, 40, 0.04) 0%, transparent 50%), radial-gradient(ellipse at 30% 70%, rgba(214, 108, 86, 0.04) 0%, transparent 50%)",
        "dot-warm":
          "radial-gradient(rgba(0, 0, 0, 0.04) 0.5px, transparent 0.5px)",
      },
      backgroundSize: {
        dot: "24px 24px",
      },
      spacing: {
        18: "4.5rem",
        22: "5.5rem",
        30: "7.5rem",
      },
      fontSize: {
        hero: [
          "clamp(2.5rem, 5vw, 4.25rem)",
          { lineHeight: "1.08", letterSpacing: "-0.03em", fontWeight: "600" },
        ],
        "hero-sub": [
          "clamp(1rem, 2vw, 1.25rem)",
          { lineHeight: "1.6", letterSpacing: "-0.01em" },
        ],
        section: [
          "clamp(2rem, 4vw, 3.25rem)",
          { lineHeight: "1.12", letterSpacing: "-0.02em", fontWeight: "600" },
        ],
      },
    },
  },
  plugins: [],
};