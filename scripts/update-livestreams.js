#!/usr/bin/env node
// Auto-update the Livestreams and Earnings pages from the ZHG YouTube channel RSS feed.
// No API key needed. Run: node scripts/update-livestreams.js
//
// - Candidates = the channel RSS feed (last 15 uploads) + the channel Streams tab.
// - A video counts as a livestream if its watch page says "isLiveContent":true, or,
//   when the watch page is bot-walled (usual on GitHub Actions), if it is listed on
//   the Streams tab. Streams still live/upcoming are skipped until the VOD is ready.
//   Anything that cannot be classified is logged as a workflow warning, not dropped.
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

// Dates are shown in US Eastern: an 8:30pm ET Sunday Night Live is already Monday in UTC.
function fmtDate(iso, long) {
  const [y, m, d] = new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/New_York' }).split('-').map(Number);
  const months = long ? MONTHS_LONG : MONTHS_SHORT;
  return `${months[m - 1]} ${d}, ${y}`;
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

const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36', 'Accept-Language': 'en-US,en;q=0.9' };
const warn = msg => console.log(process.env.GITHUB_ACTIONS ? `::warning::${msg}` : `WARNING: ${msg}`);

// The channel's Streams tab lists every livestream (newest ~30) with a duration
// badge once the VOD is ready ("LIVE"/"UPCOMING" otherwise). It is one request
// and, unlike individual watch pages, is served normally to datacenter IPs, so
// it is the primary livestream signal. Returns Map(videoId -> {title, done}) or
// null if the tab could not be read.
async function streamsTab() {
  try {
    const r = await fetch(`https://www.youtube.com/channel/${CHANNEL_ID}/streams`, { headers: UA });
    if (!r.ok) { warn(`streams tab fetch failed: ${r.status}`); return null; }
    const m = (await r.text()).match(/var ytInitialData = (\{[\s\S]*?\});<\/script>/);
    if (!m) { warn('streams tab: ytInitialData not found (bot wall?)'); return null; }
    const out = new Map();
    (function walk(o) {
      if (!o || typeof o !== 'object') return;
      if (o.lockupViewModel && o.lockupViewModel.contentId) {
        const v = o.lockupViewModel;
        const title = v.metadata?.lockupMetadataViewModel?.title?.content || '';
        const badges = [];
        (function b(x) { if (x && typeof x === 'object') { if (x.thumbnailBadgeViewModel) badges.push(x.thumbnailBadgeViewModel.text || ''); for (const k in x) b(x[k]); } })(v.contentImage);
        out.set(v.contentId, { title, done: badges.some(t => /^\d+(:\d\d)+$/.test(t)) });
      }
      for (const k in o) walk(o[k]);
    })(JSON.parse(m[1]));
    if (!out.size) { warn('streams tab parsed but listed 0 videos'); return null; }
    return out;
  } catch (e) { warn(`streams tab error: ${e.message}`); return null; }
}

// Watch page details. Returns null when YouTube serves a bot wall / consent page
// (no videoDetails), which is common from GitHub Actions runners.
async function watchInfo(videoId) {
  try {
    const r = await fetch(`https://www.youtube.com/watch?v=${videoId}`, { headers: UA });
    if (!r.ok) return null;
    const html = await r.text();
    if (!/"videoDetails"\s*:/.test(html)) return null;
    const str = re => { const m = html.match(re); return m ? JSON.parse(`"${m[1]}"`) : ''; };
    return {
      isLiveContent: /"isLiveContent"\s*:\s*true/.test(html),
      liveNow: /"isLive"\s*:\s*true/.test(html) || /"isUpcoming"\s*:\s*true/.test(html),
      title: str(/"videoDetails"\s*:\s*\{[^}]*?"title"\s*:\s*"((?:[^"\\]|\\.)*)"/),
      description: str(/"shortDescription"\s*:\s*"((?:[^"\\]|\\.)*)"/),
      started: str(/"startTimestamp"\s*:\s*"([^"]*)"/),
      published: str(/"(?:publishDate|uploadDate)"\s*:\s*"((?:[^"\\]|\\.)*)"/),
    };
  } catch (e) { return null; }
}

async function main() {
  const res = await fetch(FEED_URL, { headers: UA });
  if (!res.ok) throw new Error(`Feed fetch failed: ${res.status}`);
  const xml = await res.text();

  // Candidates = last 15 feed uploads + everything on the Streams tab (the tab
  // also backfills streams that scrolled out of the feed's 15-entry window).
  const candidates = new Map();
  for (const entry of xml.split('<entry>').slice(1)) {
    const videoId = (entry.match(/<yt:videoId>([^<]*)<\/yt:videoId>/) || [])[1];
    if (!videoId) continue;
    candidates.set(videoId, {
      title: unescXml((entry.match(/<title>([^<]*)<\/title>/) || [])[1] || ''),
      published: (entry.match(/<published>([^<]*)<\/published>/) || [])[1],
      description: unescXml((entry.match(/<media:description>([\s\S]*?)<\/media:description>/) || [])[1] || ''),
    });
  }
  const tab = await streamsTab();
  if (tab) for (const [id, t] of tab) if (!candidates.has(id)) candidates.set(id, { title: t.title });

  const manifest = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  const known = new Set(manifest.map(e => e.videoId));
  let added = 0;

  for (const [videoId, c] of candidates) {
    if (known.has(videoId)) continue;
    const w = await watchInfo(videoId);
    const t = tab && tab.get(videoId);
    let isStream, finished;
    if (w) { isStream = w.isLiveContent; finished = !w.liveNow; }
    else if (tab) { isStream = !!t; finished = !!(t && t.done); }
    else { warn(`cannot classify ${videoId} (watch page walled, streams tab unavailable): ${c.title}`); continue; }
    if (!isStream) continue; // shorts/uploads
    const title = c.title || (w && w.title) || '';
    if (!finished) { console.log(`skipping ${videoId} (still live/upcoming): ${title}`); continue; }
    // Broadcast start beats the feed/publish date (a VOD often finalises hours later).
    const published = (w && w.started) || c.published || (w && w.published);
    if (!published) { warn(`no publish date for ${videoId} (watch page walled): ${title}; will retry next run`); continue; }
    const description = c.description || (w && w.description) || '';

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
