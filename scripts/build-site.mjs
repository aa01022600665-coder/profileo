import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'site-dist');
// A strict public-file allowlist prevents Electron source, dependencies and local
// credentials from being uploaded with the marketing website.
const staticFiles = ['style.css', 'seo.css', 'partners.css', 'script.js', 'script.min.js', 'partners.js', 'auth.min.js', 'billing.js', 'billing.min.js', 'robots.txt', '_headers', '_redirects'];
const files = fs.readdirSync(root).filter(name => name.endsWith('.html')).concat(staticFiles);
for (const directory of ['guides', 'blog']) {
  for (const name of fs.readdirSync(path.join(root, directory))) {
    if (name.endsWith('.html')) files.push(`${directory}/${name}`);
  }
}
// Only remove this script's generated directory, after resolving its location.
if (path.dirname(output) !== root || path.basename(output) !== 'site-dist') throw new Error('Unsafe output directory');
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
for (const file of files) {
  const dest = path.join(output, file);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(root, file), dest);
}
fs.cpSync(path.join(root, 'assets'), path.join(output, 'assets'), { recursive: true });
const pages = files.filter(file => file.endsWith('.html') && file !== '404.html');
const urls = pages.map(file => {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  const canonical = html.match(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/i)?.[1];
  if (!canonical || !canonical.startsWith('https://getprofileo.com/')) throw new Error(`Missing production canonical: ${file}`);
  return canonical;
});
if (new Set(urls).size !== urls.length) throw new Error('Duplicate sitemap canonical');
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.sort().map(url => `  <url><loc>${url.replaceAll('&', '&amp;')}</loc></url>`).join('\n')}\n</urlset>\n`;
fs.writeFileSync(path.join(output, 'sitemap.xml'), sitemap);
console.log(`Built ${pages.length} indexable pages in site-dist. Desktop application files excluded.`);
