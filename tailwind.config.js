/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.tsx",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        "primary-orange": "#FF8C00",
        "secondary-orange": "#FCC880",
        "input-background": "#F8F5EE",
        "key-bg": "#FCF1D3",
        "key-border": "#401F40",
        // Figma brand colors
        "figma-purple": "#401F40",
        "figma-gold": "#FEC880",
        "figma-crimson": "#F54160",
        "figma-cream": "#FCFAF4",
        // Tile states
        "tile-correct": "#401F40",
        "tile-partial": "#FEC880",
        "tile-incorrect": "#F54160",
      },
      screens: {
        // Custom breakpoints for mobile-first responsive design
        xs: "320px", // Small phones
        sm: "375px", // Standard phones
        md: "600px", // Small tablets / large phones in landscape
        lg: "768px", // Standard tablets
        xl: "1024px", // Large tablets
      },
      spacing: {
        // Custom spacing for responsive design
        18: "4.5rem",
        88: "22rem",
        92: "23rem",
        96: "24rem",
        104: "26rem",
        112: "28rem",
        120: "30rem",
        128: "32rem",
        136: "34rem",
        144: "36rem",
      },
      fontSize: {
        // Additional responsive font sizes
        xxs: "0.625rem", // 10px
        tiny: "0.6875rem", // 11px
      },
    },
  },
  plugins: [],
};
