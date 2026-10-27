import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The shipped CSP (index.html) has `style-src 'self'`: no inline styles. The Vite dev client injects
// <style> elements for HMR/CSS, so only the dev server gets 'unsafe-inline' (apply: 'serve'); the
// production build and `vite preview` keep the strict policy, which is what `npm run smoke:csp` proves.
const devInlineStyles = {
  name: 'dev-csp-inline-styles',
  apply: 'serve',
  transformIndexHtml(html) {
    const relaxed = html.replace(/style-src 'self'(?=;)/, "style-src 'self' 'unsafe-inline'")
    if (relaxed === html) throw new Error("dev-csp-inline-styles: `style-src 'self'` not found in index.html; update this plugin")
    return relaxed
  },
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), devInlineStyles],
  // Servido na raiz de bisolhador.assertlab.com (GitHub Pages, domínio próprio).
  // assertlab.com/bisolhador/* redireciona para cá (Cloudflare, 301).
  base: '/',
})
