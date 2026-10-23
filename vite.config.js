import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Servido na raiz de bisolhador.assertlab.com (GitHub Pages, domínio próprio).
  // assertlab.com/bisolhador/* redireciona para cá (Cloudflare, 301).
  base: '/',
})
