/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./index.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#1aaa86",
        "primary-foreground": "#ffffff",
        "primary-soft": "#d1fae5",
        secondary: "#0e5e70",
        muted: "#f3f4f6",
        "muted-foreground": "#6b7280",
      },
    },
  },
  plugins: [],
};
