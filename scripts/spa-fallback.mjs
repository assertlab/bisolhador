// GitHub Pages has no SPA rewrite: opening or reloading a client-side route
// (/ranking, /benchmark, /timeline/owner/repo) used to return GitHub's 404.
// Pages serves 404.html for unknown paths, so shipping the app's own
// index.html as 404.html lets React Router render the route. (The HTTP
// status stays 404; the page works.)
import { copyFileSync } from 'node:fs';

copyFileSync('dist/index.html', 'dist/404.html');
console.log('spa-fallback: dist/404.html written');
