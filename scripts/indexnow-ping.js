#!/usr/bin/env node
// Notify IndexNow (Bing, and every engine on the protocol) about changed pages
// so they get recrawled within minutes instead of days. Google does not use
// IndexNow — it discovers changes via the sitemap as before.
//
// Which URLs get submitted:
//   1. HTML files changed between BASE_SHA (env, e.g. github.event.before) and HEAD
//   2. falling back to the last commit (HEAD^..HEAD)
//   3. falling back to every sitemap-eligible page (harmless for a site this size)
// Only sitemap-eligible pages (per generate-sitemap.js rules) are ever submitted.
//
// The key is public by design: the <key>.txt file at the site root is how
// engines confirm the pings really come from this domain.

const { execSync } = require('child_process');
const { includedPages, urlFor, ORIGIN } = require('./generate-sitemap.js');

const KEY = 'e9c25d97965bae37ecf7c3a9e9527be3';
const HOST = 'thezerohourgroup.com';

function changedFiles(range) {
  try {
    return execSync(`git diff --name-only ${range}`, {
      cwd: `${__dirname}/..`,
      encoding: 'utf8',
    })
      .trim()
      .split('\n')
      .filter(Boolean);
  } catch (_) {
    return null;
  }
}

async function main() {
  const eligible = new Set(includedPages());

  const base = process.env.BASE_SHA;
  let changed =
    (base && !/^0+$/.test(base) && changedFiles(`${base} HEAD`)) ||
    changedFiles('HEAD^ HEAD');

  let urls;
  if (changed) {
    urls = changed.filter((f) => eligible.has(f)).map(urlFor);
  } else {
    console.log('No usable diff range; submitting all sitemap pages');
    urls = [...eligible].map(urlFor);
  }

  if (urls.length === 0) {
    console.log('No indexable pages changed; skipping IndexNow ping');
    return;
  }

  const body = {
    host: HOST,
    key: KEY,
    keyLocation: `${ORIGIN}/${KEY}.txt`,
    urlList: urls,
  };
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });
  // 200/202 = accepted. Anything else is logged but must not fail the build.
  console.log(`IndexNow: submitted ${urls.length} URL(s), HTTP ${res.status}`);
  urls.forEach((u) => console.log(`  ${u}`));
}

main().catch((err) => {
  console.error(`IndexNow ping failed (non-fatal): ${err.message}`);
});
