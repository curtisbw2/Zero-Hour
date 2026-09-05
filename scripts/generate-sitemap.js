#!/usr/bin/env node
// Regenerate sitemap.xml from the git-tracked HTML pages.
//
// Inclusion is derived from git (git ls-files), so locally-untracked pages
// (beta/pitch pages like powerus.html) can never leak into the sitemap —
// committing a page is what makes it eligible. Pages carrying a
// <meta name="robots" content="noindex"> are skipped, as is anything in
// EXCLUDE below.
//
// lastmod comes from each file's last git commit date, so run this where
// git history is available (use fetch-depth: 0 in Actions checkouts).
//
// Priorities are advisory only (engines mostly ignore them); the buckets
// below just mirror the site's existing conventions.

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SITE_ROOT = path.join(__dirname, '..');
const ORIGIN = 'https://thezerohourgroup.com';

// Pages that are live on purpose but should stay out of the sitemap.
const EXCLUDE = new Set([
  'live.html', // link-in-bio / "we're live" jump page, no ranking value
]);
const EXCLUDE_DIRS = ['guest-intake/', 'netlify/', 'node_modules/'];

const PRIORITY = {
  'index.html': '1.0',
  'about.html': '0.8',
  'companies.html': '0.8',
  'articles.html': '0.8',
  'interviews.html': '0.8',
  'earnings.html': '0.7',
  'livestreams.html': '0.7',
  'shorts.html': '0.7',
  'sunday-night-live.html': '0.7',
  'contact.html': '0.5',
  'jt.html': '0.5',
  'benny.html': '0.5',
};
// articles/* → 0.7, everything else (company pages, future pages) → 0.6
function priorityFor(file) {
  if (PRIORITY[file]) return PRIORITY[file];
  if (file.startsWith('articles/')) return '0.7';
  return '0.6';
}

function git(cmd) {
  return execSync(cmd, { cwd: SITE_ROOT, encoding: 'utf8' }).trim();
}

function includedPages() {
  return git('git ls-files "*.html"')
    .split('\n')
    .map((f) => f.trim())
    .filter(Boolean)
    .filter((f) => !EXCLUDE.has(f))
    .filter((f) => !EXCLUDE_DIRS.some((d) => f.startsWith(d)))
    .filter((f) => {
      const head = fs.readFileSync(path.join(SITE_ROOT, f), 'utf8').slice(0, 4096);
      return !/name=["']robots["'][^>]*noindex/i.test(head);
    });
}

function lastmodFor(file) {
  try {
    const d = git(`git log -1 --format=%cs -- "${file}"`);
    if (d) return d;
  } catch (_) {
    /* shallow clone or new file — fall through */
  }
  return new Date(fs.statSync(path.join(SITE_ROOT, file)).mtime)
    .toISOString()
    .slice(0, 10);
}

function urlFor(file) {
  if (file === 'index.html') return `${ORIGIN}/`;
  // Clean URLs (no .html): Cloudflare Pages 308-redirects the .html form, and
  // GitHub Pages serves both, so the extensionless form is canonical on either
  // host. Keep canonicals/og:url tags in the pages aligned with this.
  return `${ORIGIN}/${file.replace(/\.html$/, '')}`;
}

function build() {
  const pages = includedPages()
    .map((f) => ({ file: f, url: urlFor(f), lastmod: lastmodFor(f), priority: priorityFor(f) }))
    .sort((a, b) => Number(b.priority) - Number(a.priority) || a.url.localeCompare(b.url));

  const rows = pages.map(
    (p) =>
      `  <url><loc>${p.url}</loc><lastmod>${p.lastmod}</lastmod><priority>${p.priority}</priority></url>`
  );
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join('\n')}\n</urlset>\n`;
}

if (require.main === module) {
  const xml = build();
  const out = path.join(SITE_ROOT, 'sitemap.xml');
  const prev = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
  if (prev === xml) {
    console.log('sitemap.xml unchanged');
  } else {
    fs.writeFileSync(out, xml);
    console.log(`sitemap.xml written (${xml.split('<url>').length - 1} URLs)`);
  }
}

module.exports = { includedPages, urlFor, ORIGIN };
