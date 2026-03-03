/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: {
          1: 'rgb(var(--color-background-1) / <alpha-value>)',
          2: 'rgb(var(--color-background-2) / <alpha-value>)',
        },
        primary: 'rgb(var(--color-primary) / <alpha-value>)',
        secondary: 'rgb(var(--color-secondary) / <alpha-value>)',
        accent: 'rgb(var(--color-accent) / <alpha-value>)',
        border: 'rgb(var(--color-border) / <alpha-value>)',
        success: 'rgb(var(--color-success) / <alpha-value>)',
        error: 'rgb(var(--color-error) / <alpha-value>)',
        warning: 'rgb(var(--color-warning) / <alpha-value>)',
        capture: {
          photo: '#3B82F6',
          text: '#22C55E',
          voice: '#EF4444',
          file: '#F59E0B',
          gallery: '#8B5CF6',
        },
      },
    },
  },
  plugins: [],
};
