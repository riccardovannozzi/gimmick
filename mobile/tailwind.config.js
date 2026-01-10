/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: {
          1: '#1E1E1E',
          2: '#252526',
        },
        primary: '#F5F5F5',
        secondary: '#9CA3AF',
        accent: '#528BFF',
        border: '#3E3E42',
        success: '#22C55E',
        error: '#EF4444',
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
