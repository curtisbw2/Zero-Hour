#!/usr/bin/env node
// Build the topic/category system from scripts/topics.json (Dronelife-style
// tags, adapted for a static site).
//
//  - topics/<slug>.html            one hub page per topic (articles + videos)
//  - articles/category/<slug>.html one page per category that has no existing
//                                  section page (others link to e.g. earnings.html)
//  - articles/*.html               tag chips between TOPICS:START/END markers,
//                                  plus keywords/articleSection in the NewsArticle JSON-LD
//  - articles.html                 category + topic browse bar between markers
//
// Videos are collected from the site's own video pages (yt-lite cards) and
// tagged by title regex, so the daily livestream/SNL cron jobs keep hubs
// current just by re-running this script. Idempotent: running it twice
// produces no diff. Hubs with fewer than MIN_INDEXABLE items get noindex
// (and generate-sitemap.js skips noindex pages).

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ORIGIN = 'https://thezerohourgroup.com';
const MIN_INDEXABLE = 3;
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'topics.json'), 'utf8'));

// Parse with LF everywhere; write back with the file's own line endings
// (Windows checkouts are CRLF, the Actions runner is LF).
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
const writeIfChanged = (f, s) => {
  const p = path.join(ROOT, f);
  const old = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
  if (old && old.includes('\r\n')) s = s.replace(/\n/g, '\r\n');
  if (old === s) return;
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, s);
  console.log('wrote', f);
};

const unesc = (s) => s.replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cleanUrl = (f) => `${ORIGIN}/${f.replace(/(^|\/)index\.html$/, '$1').replace(/\.html$/, '')}`;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = (iso) => { const d = new Date(iso); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`; };

const categoryPage = (c) => (c.href ? c.href : `articles/category/${c.slug}.html`);
const topicPage = (t) => `topics/${t.slug}.html`;
const catBySlug = Object.fromEntries(cfg.categories.map((c) => [c.slug, c]));
const topicBySlug = Object.fromEntries(cfg.topics.map((t) => [t.slug, t]));

// ---------- collect articles ----------
const listing = read('articles.html');
const articles = Object.entries(cfg.articles).map(([file, tags]) => {
  const s = read(`articles/${file}`);
  const ld = JSON.parse(s.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  const row = listing.match(new RegExp(`<a href="articles/${file.replace(/\./g, '\\.')}" class="news-row[\\s\\S]*?</a>`));
  const pick = (re) => (row && row[0].match(re) ? unesc(row[0].match(re)[1]) : null);
  return {
    kind: 'article', file, tags,
    title: unesc(s.match(/<h1 class="article-title">([\s\S]*?)<\/h1>/)[1].trim()),
    dek: pick(/<p class="news-row-dek">([\s\S]*?)<\/p>/) || ld.description,
    kicker: unesc(s.match(/class="article-kicker"[^>]*>([^<]*)</)[1].trim()),
    thumb: row ? row[0].match(/<img src="([^"]+)"/)[1] : ld.image.replace(`${ORIGIN}/`, ''),
    thumbAlt: pick(/<img [^>]*alt="([^"]*)"/) || ld.headline,
    date: ld.datePublished,
    url: cleanUrl(`articles/${file}`),
  };
});
for (const a of articles) {
  for (const c of a.tags.categories) if (!catBySlug[c]) throw new Error(`${a.file}: unknown category ${c}`);
  for (const t of a.tags.topics) if (!topicBySlug[t]) throw new Error(`${a.file}: unknown topic ${t}`);
  for (const c of a.tags.companies) if (!cfg.companies[c]) throw new Error(`${a.file}: unknown company ${c}`);
}

// ---------- collect videos from the site's video pages ----------
// Later pages win the label for duplicates (SNL episodes also appear on livestreams).
const VIDEO_PAGES = [
  ['shorts.html', 'Short'],
  ['livestreams.html', 'Livestream'],
  ['earnings.html', 'Earnings Call'],
  ['interviews.html', 'Interview'],
  ['sunday-night-live.html', 'Sunday Night Live'],
];
const videos = new Map();
for (const [page, label] of VIDEO_PAGES) {
  const s = read(page);
  const dates = {};
  for (const m of s.matchAll(/"uploadDate":\s*"([^"]+)",[\s\S]*?"embedUrl":\s*"https:\/\/www\.youtube\.com\/embed\/([\w-]+)"/g)) dates[m[2]] = m[1];
  for (const m of s.matchAll(/data-id="([\w-]+)" data-title="([^"]*)"/g)) {
    const [, id, t] = m;
    if (!dates[id]) continue;
    videos.set(id, {
      kind: 'video', id, label, date: dates[id],
      title: unesc(t),
      url: label === 'Short' ? `https://www.youtube.com/shorts/${id}` : `https://youtu.be/${id}`,
    });
  }
}
const videoList = [...videos.values()];
const videosFor = (entry) => {
  if (!entry.videoMatch) return [];
  const inc = new RegExp(entry.videoMatch, 'i');
  const exc = entry.videoExclude ? new RegExp(entry.videoExclude, 'i') : null;
  return videoList.filter((v) => inc.test(v.title) && !(exc && exc.test(v.title)));
};
const byDateDesc = (a, b) => new Date(b.date) - new Date(a.date);

// ---------- shared page chrome, lifted from articles.html ----------
const GA = listing.match(/    <!-- Google tag \(gtag\.js\) -->[\s\S]*?<\/script>\n/)[0];
const NAV = listing.match(/    <nav id="main-nav">[\s\S]*?<\/nav>\n/)[0];
const FOOTER = listing.match(/    <!-- Footer -->[\s\S]*?<\/footer>\n/)[0];
const prefix = (html, pre) => (pre ? html.replace(/(href|src)="(?!https?:|#|mailto:|\.\.\/|\/)([^"]+)"/g, `$1="${pre}$2"`) : html);

function chip(href, text, cls = '') {
  return `<a href="${href}" class="topic-chip${cls ? ' ' + cls : ''}">${esc(text)}</a>`;
}

function articleRow(a, pre) {
  return `                    <a href="${pre}articles/${a.file}" class="news-row fade-in">
                        <div class="news-row-thumb">
                            <img src="${pre}${a.thumb}" alt="${esc(a.thumbAlt)}" loading="lazy">
                        </div>
                        <div class="news-row-body">
                            <span class="article-kicker">${esc(a.kicker)}</span>
                            <h3 class="news-row-title">${esc(a.title)}</h3>
                            <p class="news-row-dek">${esc(a.dek)}</p>
                            <p class="article-byline"><strong>JT</strong> / Posted on ${fmtDate(a.date)}</p>
                        </div>
                    </a>
`;
}

function videoCard(v) {
  const t = esc(v.title);
  return `            <div class="content-card fade-in">
                <div class="content-card-thumb video-embed yt-lite" data-id="${v.id}" data-title="${t}">
                    <img src="https://i.ytimg.com/vi/${v.id}/hqdefault.jpg" alt="${t}" loading="lazy">
                    <button class="yt-lite-play" aria-label="Play: ${t}"><i class="fa-solid fa-play"></i></button>
                </div>
                <div class="content-card-body">
                    <span class="content-card-tag">${esc(v.label)}</span>
                    <h3 class="content-card-title">${t.toUpperCase()}</h3>
                    <p class="content-card-meta">${fmtDate(v.date)}</p>
                    <a href="${v.url}" target="_blank" rel="noopener" class="content-card-link">Watch on YouTube →</a>
                </div>
            </div>
`;
}

function hubPage(entry, file, crumbName, crumbHref) {
  const pre = '../'.repeat(file.split('/').length - 1);
  const arts = articles.filter((a) => a.tags.topics.includes(entry.slug) || a.tags.categories.includes(entry.slug)).sort(byDateDesc);
  const vids = videosFor(entry).sort(byDateDesc);
  const total = arts.length + vids.length;
  const url = cleanUrl(file);
  const others = [...cfg.topics.filter((t) => t.slug !== entry.slug).map((t) => [pre + topicPage(t), t.name]),
    ...cfg.categories.filter((c) => c.slug !== entry.slug).map((c) => [pre + categoryPage(c), c.name])];
  const ld = [
    {
      '@context': 'https://schema.org', '@type': 'CollectionPage', name: entry.name, url,
      description: entry.description,
      isPartOf: { '@type': 'WebSite', name: 'The Zero Hour Group', url: `${ORIGIN}/` },
      publisher: { '@id': `${ORIGIN}/#organization` },
      mainEntity: {
        '@type': 'ItemList', numberOfItems: total,
        itemListElement: [...arts, ...vids].map((it, i) => ({ '@type': 'ListItem', position: i + 1, url: it.url, name: it.title })),
      },
    },
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${ORIGIN}/` },
        { '@type': 'ListItem', position: 2, name: crumbName, item: cleanUrl(crumbHref) },
        { '@type': 'ListItem', position: 3, name: entry.name, item: url },
      ],
    },
  ];
  const ldHtml = ld.map((o) => `    <script type="application/ld+json">\n${JSON.stringify(o, null, 2)}\n    </script>\n`).join('');
  const robots = total < MIN_INDEXABLE ? '    <meta name="robots" content="noindex, follow">\n' : '';
  const title = esc(entry.title);
  const desc = esc(entry.description);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<!-- Generated by scripts/build-topics.js from scripts/topics.json - edit those, not this file. -->
${GA}
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <meta name="description" content="${desc}">
    <meta name="keywords" content="${esc(entry.name)}">
${robots}    <link rel="canonical" href="${url}">
    <link rel="stylesheet" href="${pre}styles.css">
    <link rel="icon" href="${pre}assets/zhg_emblem.png" type="image/png">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">

    <!-- Open Graph / Twitter -->
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="Zero Hour Group">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${desc}">
    <meta property="og:url" content="${url}">
    <meta property="og:image" content="${ORIGIN}/assets/images/og-default.jpg">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${desc}">
    <meta name="twitter:image" content="${ORIGIN}/assets/images/og-default.jpg">
${ldHtml}</head>
<body>

${prefix(NAV, pre)}
    <!-- Page Hero -->
    <section class="page-hero">
        <div class="page-hero-inner">
            <p class="topic-hero-crumb"><a href="${pre}${crumbHref}">${esc(crumbName)}</a></p>
            <h1 class="page-hero-title page-hero-title--topic">${esc(entry.name.toUpperCase())}</h1>
        </div>
    </section>

    <!-- Page Intro -->
    <section class="page-intro">
        <div class="page-intro-inner">
            <p class="page-intro-desc">${esc(entry.intro)}</p>
        </div>
    </section>

    <main class="articles-main">
        <div class="articles-inner">
${arts.length ? `
            <section>
                <div class="flag-bar"><h2>Articles</h2></div>
                <div class="news-list">
${arts.map((a) => articleRow(a, pre)).join('\n')}                </div>
            </section>
` : ''}${vids.length ? `
            <section>
                <div class="flag-bar"><h2>Videos</h2></div>
                <div class="content-grid">
${vids.map(videoCard).join('\n')}                </div>
            </section>
` : ''}
            <div class="topic-browse topic-browse--inline" role="navigation" aria-label="More topics">
                <span class="topic-tags-label">More topics</span>
                ${others.map(([h, n]) => chip(h, n)).join('\n                ')}
            </div>
        </div>
    </main>

${prefix(FOOTER, pre)}    <script>
        function toggleMenu() {
            const menu = document.getElementById('navMenu');
            menu.classList.toggle('active');
            if (!menu.classList.contains('active')) {
                document.querySelectorAll('.dropdown.active').forEach(d => d.classList.remove('active'));
            }
        }
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) entry.target.classList.add('visible');
            });
        }, { threshold: 0.1 });
        document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
    </script>
    <script src="${pre}site.js"></script>
</body>
</html>
`;
}

// ---------- write hub pages ----------
const counts = {};
for (const t of cfg.topics) {
  writeIfChanged(topicPage(t), hubPage(t, topicPage(t), 'Topics', 'articles.html'));
}
for (const c of cfg.categories.filter((c) => !c.href)) {
  writeIfChanged(categoryPage(c), hubPage(c, categoryPage(c), 'Articles', 'articles.html'));
}
for (const e of [...cfg.topics, ...cfg.categories]) {
  counts[e.slug] = articles.filter((a) => a.tags.topics.includes(e.slug) || a.tags.categories.includes(e.slug)).length + videosFor(e).length;
}

// ---------- marker helper ----------
function replaceBetween(s, block, anchorRe, file) {
  const b = block;
  const re = /[ \t]*<!-- TOPICS:START[\s\S]*?<!-- TOPICS:END -->\n/;
  if (re.test(s)) return s.replace(re, b);
  const m = s.match(anchorRe);
  if (!m) throw new Error(`${file}: no anchor for topic block`);
  return s.slice(0, m.index) + b + s.slice(m.index);
}

// ---------- article pages: chips + JSON-LD ----------
for (const a of articles) {
  const f = `articles/${a.file}`;
  let s = read(f);
  const cats = a.tags.categories.map((c) => catBySlug[c]);
  const tags = [
    ...a.tags.companies.map((c) => chip(`../${cfg.companies[c].href}`, cfg.companies[c].name, 'topic-chip--company')),
    ...a.tags.topics.map((t) => chip(`../${topicPage(topicBySlug[t])}`, topicBySlug[t].name)),
  ];
  const block = `            <!-- TOPICS:START - generated by scripts/build-topics.js from scripts/topics.json -->
            <div class="topic-tags" role="navigation" aria-label="Article topics">
                <div class="topic-tags-row"><span class="topic-tags-label">Filed under</span>
                    ${cats.map((c) => chip(c.href ? `../${c.href}` : `category/${c.slug}.html`, c.name, 'topic-chip--category')).join('\n                    ')}
                </div>
                <div class="topic-tags-row"><span class="topic-tags-label">Tags</span>
                    ${tags.join('\n                    ')}
                </div>
            </div>
            <!-- TOPICS:END -->
`;
  s = replaceBetween(s, block, /[ \t]*<footer class="article-footer">/, f);

  // NewsArticle JSON-LD: keywords + articleSection (schema mirror of the chips)
  s = s.replace(/(<script type="application\/ld\+json">\n)(\{[\s\S]*?"@type": "NewsArticle"[\s\S]*?\n\})(\n\s*<\/script>)/, (all, open, json, close) => {
    const o = JSON.parse(json);
    o.keywords = [...a.tags.companies.map((c) => cfg.companies[c].name), ...a.tags.topics.map((t) => topicBySlug[t].name)];
    o.articleSection = cats.map((c) => c.name);
    return open + JSON.stringify(o, null, 2) + close;
  });
  writeIfChanged(f, s);
}

// ---------- articles.html: browse bar ----------
{
  const catChips = cfg.categories.map((c) => chip(categoryPage(c), c.name, 'topic-chip--category'));
  const topicChips = cfg.topics.map((t) => chip(topicPage(t), `${t.name} (${counts[t.slug]})`));
  const block = `    <!-- TOPICS:START - generated by scripts/build-topics.js from scripts/topics.json -->
    <section class="topic-browse" aria-label="Browse articles by category and topic">
        <div class="topic-browse-inner">
            <div class="topic-tags-row"><span class="topic-tags-label">Categories</span>
                ${catChips.join('\n                ')}
            </div>
            <div class="topic-tags-row"><span class="topic-tags-label">Topics</span>
                ${topicChips.join('\n                ')}
            </div>
        </div>
    </section>
    <!-- TOPICS:END -->
`;
  writeIfChanged('articles.html', replaceBetween(listing, block, /[ \t]*<main class="articles-main">/, 'articles.html'));
}

// ---------- llms.txt: "## Topics" section (AI-crawler site guide) ----------
{
  const lines = [
    ...cfg.topics.map((t) => `- [${t.name}](${cleanUrl(topicPage(t))}): ${t.description.replace(/^.*? - /, '')}`),
    ...cfg.categories.filter((c) => !c.href).map((c) => `- [${c.name}](${cleanUrl(categoryPage(c))}): ${c.description.replace(/^.*? - /, '')}`),
  ];
  const section = `## Topics\n\nHub pages collecting our articles and videos on each theme:\n\n${lines.join('\n')}\n\n`;
  let s = read('llms.txt');
  s = /## Topics\n[\s\S]*?(?=## )/.test(s) ? s.replace(/## Topics\n[\s\S]*?(?=## )/, section) : s.replace('## Video & Audio', `${section}## Video & Audio`);
  writeIfChanged('llms.txt', s);
}

console.log(Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join('\n'));
