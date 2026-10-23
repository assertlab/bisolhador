import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const CHUNK_BY_PACKAGE = {
  react: 'vendor',
  'react-dom': 'vendor',
  scheduler: 'vendor', // react-dom's runtime dependency
  '@tanstack': 'vendor',
  'chart.js': 'charts-vendor',
  'react-chartjs-2': 'charts-vendor',
  '@kurkle': 'charts-vendor', // chart.js color helper
  'html2pdf.js': 'pdf-vendor',
  jspdf: 'pdf-vendor',
  html2canvas: 'pdf-vendor',
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Servido na raiz de bisolhador.assertlab.com (GitHub Pages, domínio próprio).
  // assertlab.com/bisolhador/* redireciona para cá (Cloudflare, 301).
  base: '/',
})
