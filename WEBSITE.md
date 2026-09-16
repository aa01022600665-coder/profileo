# Profileo public website

The root HTML files and the `guides/`, `blog/`, and `assets/` directories contain the marketing website. The desktop application remains in `src/` and `electron/`.

## Build and validate

Run with Node.js 22 or newer. No dependency installation is needed for the website:

```
node scripts/build-site.mjs
node scripts/check-site.mjs
```

Publish only `site-dist/`. Never publish the repository root, desktop sources, dependencies or local configuration.

Cloudflare Pages settings:

- Build command: `node scripts/build-site.mjs && node scripts/check-site.mjs`
- Build output: `site-dist`
- Production branch: `main`
- Build environment: `SKIP_DEPENDENCY_INSTALL=true`, `NODE_VERSION=22`

Cloudflare serves HTML pages at extensionless URLs and redirects old `.html` addresses automatically. Canonicals, internal links, and the generated sitemap use those final URLs. A real `404.html` prevents unknown addresses from becoming copies of the homepage.

The sitemap is generated from the pages' canonical URLs. Add a unique title, description, canonical URL, one H1 and useful visible content when adding pages. Link to new pages from the guides or relevant existing content. Only add review markup if it represents real, visible reviews.

## Search Console

Property: `sc-domain:getprofileo.com`. Submit `https://getprofileo.com/sitemap.xml` after deployment. Inspect the homepage and new pages; request indexing where appropriate. A successful submission or indexing request is not a guarantee of indexing or search ranking.

Use Performance to compare clicks, impressions, queries and landing pages across equal periods. Do not replace the public installer with a local custom build as part of website work.
