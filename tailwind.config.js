/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        shark: '#0f172a', // Nosso azul escuro institucional
        ocean: '#0ea5e9', // Azul vibrante (Botões/Links)
        coral: '#f97316', // Laranja (Alertas/Crunch)
      }
    },
  },
  plugins: [],
}