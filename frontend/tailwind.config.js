/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Oceanic Calm Theme
        background: {
          DEFAULT: '#2E3440',
          secondary: '#3B4252',
        },
        foreground: {
          DEFAULT: '#D8DEE9',
          secondary: '#81A1C1',
        },
        primary: {
          DEFAULT: '#88C0D0',
          foreground: '#2E3440',
        },
        secondary: {
          DEFAULT: '#81A1C1',
          foreground: '#D8DEE9',
        },
        success: '#A3BE8C',
        error: '#BF616A',
        warning: '#EBCB8B',
        muted: {
          DEFAULT: '#4C566A',
          foreground: '#D8DEE9',
        },
        accent: {
          DEFAULT: '#B48EAD',
          foreground: '#D8DEE9',
        },
        border: '#4C566A',
        input: '#3B4252',
        ring: '#88C0D0',
      },
    },
  },
  plugins: [],
}
