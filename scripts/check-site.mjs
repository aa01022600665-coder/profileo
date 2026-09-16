import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'site-dist');
const origin = 'https://getprofileo.com';
const walk = directory => fs.readdirSync(directory, {withFileTypes:true}).flatMap(entry => entry.isDirectory() ? walk(path.join(directory,entry.name)) : [path.join(directory,entry.name)]);
const files = walk(root);
const pages = files.filter(file => file.endsWith('.html'));
const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };
const resolve = pathname => {
  let target = path.join(root, decodeURIComponent(pathname));
  if (pathname === '/') target = path.join(root,'index.html');
  if (!fs.existsSync(target) && !path.extname(target)) target += '.html';
  return target;
};
const titles = new Set();
for (const file of pages) {
  const name = path.relative(root,file).replaceAll('\\','/');
  const html = fs.readFileSync(file,'utf8');
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  check(title && !titles.has(title), `${name}: missing or duplicate title`);
  titles.add(title);
  check((html.match(/<h1\b/g)||[]).length===1, `${name}: expected one H1`);
  if(name==='404.html') { check(/noindex/.test(html),'404 must be noindex'); continue; }
  const canonical = html.match(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/i)?.[1];
  check(canonical===origin+(name==='index.html'?'/':'/'+name.replace(/\.html$/,'')), `${name}: canonical does not match Cloudflare's final URL`);
  check(/<meta\b[^>]*name="description"[^>]*content="[^"]+"/.test(html),`${name}: description missing`);
  check(!/aggregateRating|"@type"\s*:\s*"SearchAction"/.test(html),`${name}: unverified rating or nonexistent site search markup`);
  for(const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(match[1]); } catch {errors.push(`${name}: invalid JSON-LD`)}
  }
  for(const match of html.matchAll(/<(a|img|script|link)\b[^>]*\b(?:href|src)="([^"]+)"[^>]*>/g)) {
    const raw=match[2];
    if(raw==='#'||raw.startsWith('mailto:')||raw.startsWith('data:'))continue;
    const url=new URL(raw,canonical);
    if(url.origin!==origin)continue;
    const target=resolve(url.pathname);
    check(fs.existsSync(target),`${name}: missing target ${raw}`);
    if(url.hash&&fs.existsSync(target)&&target.endsWith('.html')) {
      const dest=fs.readFileSync(target,'utf8');
      const id=decodeURIComponent(url.hash.slice(1));
      check(dest.includes(`id="${id}"`)||dest.includes(`name="${id}"`),`${name}: missing anchor ${raw}`);
    }
  }
  check(!/href="#" class="guide-item"/.test(html),`${name}: placeholder guide link`);
}
const sitemap=fs.readFileSync(path.join(root,'sitemap.xml'),'utf8');
const sitemapUrls=[...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match=>match[1]);
check(sitemapUrls.length===pages.length-1,'Sitemap must include all indexable pages and exclude 404');
for(const url of sitemapUrls)check(fs.existsSync(resolve(new URL(url).pathname)),`Sitemap missing file: ${url}`);
check(fs.readFileSync(path.join(root,'robots.txt'),'utf8').includes(`Sitemap: ${origin}/sitemap.xml`),'Robots sitemap reference missing');
check(!fs.existsSync(path.join(root,'electron'))&&!fs.existsSync(path.join(root,'package.json'))&&!fs.existsSync(path.join(root,'.git')),'Private/application files leaked into public build');
assert.equal(errors.length,0,errors.join('\n'));
console.log(`PASS: ${pages.length} pages; canonical URLs, metadata, JSON-LD, local links, fragments, sitemap and public-file allowlist.`);
