#!/usr/bin/env node
// Auto-update the Livestreams and Earnings pages from the ZHG YouTube channel RSS feed.
// No API key needed. Run: node scripts/update-livestreams.js
//
// - Fetches https://www.youtube.com/feeds/videos.xml?channel_id=... (last 15 uploads)
// - For each unknown video, fetches the watch page and keeps it only if
//   "isLiveContent":true (i.e. it was a livestream; shorts/uploads are skipped).
//   Streams that are still live or upcoming are skipped until the VOD is ready.
// - Classifies each stream: earnings call -> earnings.html, everything else ->
//   livestreams.html. CEO interviews are never picked up here (they are uploads,
//   not livestreams) and are curated by hand.
// - Merges into scripts/livestreams.json (entries never drop off; manual text
//   overrides in the json - tag/meta/desc - are preserved on re-runs; auto:false
//   entries block re-adding without rendering, hidden:true hides an auto entry)
// - Regenerates cards between <!-- STREAMS:AUTO:START/END --> in livestreams.html
//   and <!-- EARNINGS:AUTO:START/END --> in earnings.html, plus the VideoObject
//   schema between the matching *:SCHEMA:START/END markers in each head.

const fs = require('fs');
const path = require('path');

const CHANNEL_ID = 'UCUrCFFGW4AiMZ3Tc95FpHOg';
const FEED_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;
const ROOT = process.env.ZHG_SITE_ROOT || path.join(__dirname, '..');
const JSON_PATH = process.env.ZHG_STREAMS_JSON || path.join(__dirname, 'livestreams.json');
const STREAMS_PAGE = path.join(ROOT, 'livestreams.html');
const EARNINGS_PAGE = path.join(ROOT, 'earnings.html');

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const unescXml = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function fmtDate(iso, long) {
  const d = new Date(iso);
  const months = long ? MONTHS_LONG : MONTHS_SHORT;
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

function autoDesc(description, kind) {
  const text = description
    .replace(/https?:\/\/\S+/g, '')
    .replace(/#\w+/g, '')
    .replace(/\s*—\s*/g, ' - ')
    .replace(/\s+/g, ' ')
    .trim();
  const sentences = text.split(/(?<=[.!?])\s+/);
  let out = '';
  for (const s of sentences) {
    if ((out + ' ' + s).trim().length > 280) break;
    out = (out + ' ' + s).trim();
  }
  out = out || text.slice(0, 280);
  if (out.length >= 40) return out;
  return kind === 'earnings'
    ? 'Live coverage and breakdown as the numbers come in.'
    : 'Full livestream recording from The Zero Hour Group.';
}

function classify(title) {
  if (/sunday night live/i.test(title)) return 'stream';
  if (/^zero hour (group )?today/i.test(title)) return 'stream';
  if (/earnings/i.test(title)) return 'earnings';
  if (/q[1-4]\s*20\d\d/i.test(title) && /revenue|results/i.test(title)) return 'earnings';
  return 'stream';
}

const COMPANIES = [
  [/kopin|\bkopn\b/i, 'Kopin Corporation · $KOPN'],
  [/ondas|\bonds\b/i, 'Ondas Inc. · $ONDS'],
  [/unusual machines|\bumac\b/i, 'Unusual Machines · $UMAC'],
  [/safe ?pro|\bspai\b/i, 'Safe Pro Group · $SPAI'],
  [/amprius|\bampx\b/i, 'Amprius Technologies · $AMPX'],
  [/volatus|\btakof\b/i, 'Volatus Aerospace · $TAKOF'],
  [/lightpath|\blpth\b/i, 'LightPath Technologies · $LPTH'],
  [/lantronix|\bltrx\b/i, 'Lantronix · $LTRX'],
  [/palantir|\bpltr\b/i, 'Palantir Technologies · $PLTR'],
  [/powerus/i, 'Powerus · Featured Company'],
];

function autoTag(title, kind) {
  if (/sunday night live/i.test(title)) return 'Sunday Night Live · Podcast';
  if (/^zero hour (group )?today/i.test(title)) return 'Zero Hour Today · Market Recap';
  for (const [re, tag] of COMPANIES) {
    if (re.test(title)) return kind === 'earnings' ? tag : tag;
  }
  return kind === 'earnings' ? 'Earnings · Live Coverage' : 'The Zero Hour Group · Live';
}

async function bestThumb(videoId) {
  try {
    const r = await fetch(`https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`, { method: 'HEAD' });
    if (r.ok) return `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
  } catch (e) { /* fall through */ }
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

function card(e) {
  const title = e.title.replace(/\s+/g, ' ').trim();
  const meta = e.meta || `${fmtDate(e.published, e.kind === 'earnings')} · ${e.kind === 'earnings' ? 'Live Coverage' : 'Live Recording'}`;
  return `            <div class="content-card fade-in">
                <div class="content-card-thumb video-embed yt-lite" data-id="${e.videoId}" data-title="${esc(title)}">
                    <img src="${e.thumb}" alt="${esc(title)}" loading="lazy">
                    <button class="yt-lite-play" aria-label="Play: ${esc(title)}"><i class="fa-solid fa-play"></i></button>
                </div>
                <div class="content-card-body">
                    <span class="content-card-tag">${esc(e.tag)}</span>
                    <h3 class="content-card-title">${esc(title.toUpperCase())}</h3>
                    <p class="content-card-meta">${esc(meta)}</p>
                    <p class="content-card-desc">${esc(e.desc)}</p>
                    <a href="https://youtu.be/${e.videoId}" target="_blank" rel="noopener" class="content-card-link">Watch on YouTube →</a>
                </div>
            </div>
`;
}

function schema(e) {
  return `    <script type="application/ld+json">
${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: e.title,
    description: e.desc,
    thumbnailUrl: e.thumb,
    uploadDate: e.published,
    embedUrl: `https://www.youtube.com/embed/${e.videoId}`,
    contentUrl: `https://www.youtube.com/watch?v=${e.videoId}`,
    publisher: { '@id': 'https://thezerohourgroup.com/#organization' }
  }, null, 2)}
    </script>`;
}

function renderRegion(page, name, entries, pagePath) {
  const cards = entries.map(card).join('\n');
  const schemas = entries.map(schema).join('\n');
  const cardRe = new RegExp(`(<!-- ${name}:AUTO:START -->)[\\s\\S]*?(<!-- ${name}:AUTO:END -->)`);
  const schemaRe = new RegExp(`(<!-- ${name}:SCHEMA:START -->)[\\s\\S]*?(<!-- ${name}:SCHEMA:END -->)`);
  if (!cardRe.test(page) || !schemaRe.test(page)) {
    throw new Error(`${pagePath}: missing ${name} markers`);
  }
  page = page.replace(cardRe, (m, a, b) => `${a}\n${cards ? '\n' + cards + '\n' : ''}            ${b}`);
  page = page.replace(schemaRe, (m, a, b) => `${a}${schemas ? '\n' + schemas : ''}\n    ${b}`);
  return page;
}

async function main() {
  const res = await fetch(FEED_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`Feed fetch failed: ${res.status}`);
  const xml = await res.text();

  const manifest = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  const known = new Set(manifest.map(e => e.videoId));
  let added = 0;

  for (const entry of xml.split('<entry>').slice(1)) {
    const videoId = (entry.match(/<yt:videoId>([^<]*)<\/yt:videoId>/) || [])[1];
    if (!videoId || known.has(videoId)) continue;
    const title = unescXml((entry.match(/<title>([^<]*)<\/title>/) || [])[1] || '');
    const published = (entry.match(/<published>([^<]*)<\/published>/) || [])[1];
    const description = unescXml((entry.match(/<media:description>([\s\S]*?)<\/media:description>/) || [])[1] || '');

    const watch = await fetch(`https://www.youtube.com/watch?v=${videoId}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!watch.ok) { console.warn(`watch page failed for ${videoId}: ${watch.status}`); continue; }
    const html = await watch.text();
    if (!/"isLiveContent"\s*:\s*true/.test(html)) continue; // not a livestream
    if (/"isLive"\s*:\s*true/.test(html) || /"isUpcoming"\s*:\s*true/.test(html)) {
      console.log(`skipping ${videoId} (still live/upcoming): ${title}`);
      continue;
    }

    const kind = classify(title);
    manifest.push({
      videoId,
      title,
      published,
      kind,
      tag: autoTag(title, kind),
      desc: autoDesc(description, kind),
      thumb: await bestThumb(videoId),
      auto: true,
    });
    known.add(videoId);
    added++;
    console.log(`added (${kind}): ${title}`);
  }

  const autos = manifest.filter(e => e.auto && !e.hidden);
  autos.sort((a, b) => new Date(b.published) - new Date(a.published));

  for (const [pagePath, name, kind] of [[STREAMS_PAGE, 'STREAMS', 'stream'], [EARNINGS_PAGE, 'EARNINGS', 'earnings']]) {
    const entries = autos.filter(e => e.kind === kind);
    const page = fs.readFileSync(pagePath, 'utf8');
    fs.writeFileSync(pagePath, renderRegion(page, name, entries, pagePath));
  }
  fs.writeFileSync(JSON_PATH, JSON.stringify(manifest, null, 2) + '\n');
  console.log(added ? `Added ${added} new stream(s). Manifest total: ${manifest.length}` : `No new streams. Manifest total: ${manifest.length}`);
}

main().catch(err => { console.error(err); process.exit(1); });
