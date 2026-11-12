import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { parseGitlabHosts } from './src/utils/repoRef.js'

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

// GitLab hosts in the CSP (docs/ESTUDO_GITLAB.md): gitlab.com plus VITE_GITLAB_HOSTS, the same list
// the app accepts (parseGitlabHosts), so an allowed instance is never blocked by the CSP and no other
// host gets in. connect-src only (REST + GraphQL): no GitLab image is shown (commits have no avatar).
// Build and dev server alike; the placeholder must appear exactly once in index.html.
const gitlabCsp = (hosts) => ({
  name: 'gitlab-csp-hosts',
  transformIndexHtml: {
    order: 'pre',
    handler(html) {
      const origins = hosts.map((h) => `https://${h}`).join(' ')
      if (html.split('__GITLAB_CONNECT_SRC__').length !== 2) {
        throw new Error('gitlab-csp-hosts: __GITLAB_CONNECT_SRC__ must appear exactly once in index.html (the CSP); update this plugin')
      }
      return html.replace('__GITLAB_CONNECT_SRC__', origins)
    },
  },
})

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), devInlineStyles, gitlabCsp(parseGitlabHosts(loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), 'VITE_').VITE_GITLAB_HOSTS))],
  // Servido na raiz de bisolhador.assertlab.com (GitHub Pages, domínio próprio).
  // assertlab.com/bisolhador/* redireciona para cá (Cloudflare, 301).
  base: '/',
}))
