#!/usr/bin/env node
// Auto-update the Sunday Night Live page from the ZHG YouTube channel RSS feed.
// No API key needed. Run: node scripts/update-snl.js
//
// - Fetches https://www.youtube.com/feeds/videos.xml?channel_id=... (last 15 videos)
// - Keeps every video whose title contains "Sunday Night Live"
// - Merges into scripts/snl-episodes.json (episodes never drop off; manual text
//   overrides in the json — meta/desc/schemaDesc — are preserved on re-runs)
// - Regenerates the card grid between <!-- SNL:START --> / <!-- SNL:END --> and
//   the VideoObject schema between <!-- SNL:SCHEMA:START --> / <!-- SNL:SCHEMA:END -->
//   in sunday-night-live.html

const fs = require('fs');
const path = require('path');

const CHANNEL_ID = 'UCUrCFFGW4AiMZ3Tc95FpHOg';
const FEED_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;
const ROOT = path.join(__dirname, '..');
const JSON_PATH = path.join(__dirname, 'snl-episodes.json');
const PAGE_PATH = path.join(ROOT, 'sunday-night-live.html');

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const unescXml = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

function fmtDate(iso) {
  const d = new Date(iso);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

function autoDesc(description) {
  // First ~2 sentences, capped near 280 chars.
  const text = description.replace(/\s+/g, ' ').trim();
  const sentences = text.split(/(?<=[.!?])\s+/);
  let out = '';
  for (const s of sentences) {
    if ((out + ' ' + s).trim().length > 280) break;
    out = (out + ' ' + s).trim();
  }
  return out || text.slice(0, 280);
}

function cardTitle(title) {
  const m = title.match(/episode\s*#?\s*(\d+)/i);
  return m ? `EPISODE #${m[1]}` : title.replace(/sunday night live with the zero hour group/i, '').trim().toUpperCase() || title.toUpperCase();
}

function autoMeta(title) {
  const m = title.match(/ft\.?\s+(.+)$/i);
  return m ? `Ft. ${m[1].trim()}` : 'Benny & JT · Live';
}

async function main() {
  const res = await fetch(FEED_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`Feed fetch failed: ${res.status}`);
  const xml = await res.text();

  const episodes = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  const known = new Map(episodes.map(e => [e.videoId, e]));
  let added = 0;

  for (const entry of xml.split('<entry>').slice(1)) {
    const title = unescXml((entry.match(/<title>([^<]*)<\/title>/) || [])[1] || '');
    if (!/sunday night live/i.test(title)) continue;
    const videoId = (entry.match(/<yt:videoId>([^<]*)<\/yt:videoId>/) || [])[1];
    if (!videoId || known.has(videoId)) continue;
    const published = (entry.match(/<published>([^<]*)<\/published>/) || [])[1];
    const description = unescXml((entry.match(/<media:description>([\s\S]*?)<\/media:description>/) || [])[1] || '');
    episodes.push({ videoId, title, published, desc: autoDesc(description), schemaDesc: autoDesc(description) });
    added++;
  }

  episodes.sort((a, b) => new Date(b.published) - new Date(a.published));

  // Click-to-play facade (.yt-lite, loader in site.js) instead of a direct
  // YouTube iframe - no red YouTube button until the viewer clicks.
  const thumbs = {};
  await Promise.all(episodes.map(async e => {
    try {
      const r = await fetch(`https://i.ytimg.com/vi/${e.videoId}/maxresdefault.jpg`, { method: 'HEAD' });
      thumbs[e.videoId] = r.ok
        ? `https://i.ytimg.com/vi/${e.videoId}/maxresdefault.jpg`
        : `https://i.ytimg.com/vi/${e.videoId}/hqdefault.jpg`;
    } catch {
      thumbs[e.videoId] = `https://i.ytimg.com/vi/${e.videoId}/hqdefault.jpg`;
    }
  }));

  const cards = episodes.map(e => `
            <div class="content-card fade-in">
                <div class="content-card-thumb video-embed yt-lite" data-id="${e.videoId}" data-title="${esc(e.title)}">
                    <img src="${thumbs[e.videoId]}" alt="${esc(e.title)}" loading="lazy">
                    <button class="yt-lite-play" aria-label="Play: ${esc(e.title)}"><i class="fa-solid fa-play"></i></button>
                </div>
                <div class="content-card-body">
                    <span class="content-card-tag">Sunday Night Live · ${fmtDate(e.published)}</span>
                    <h3 class="content-card-title">${esc(cardTitle(e.title))}</h3>
                    <p class="content-card-meta">${esc(e.meta || autoMeta(e.title))}</p>
                    <p class="content-card-desc">${esc(e.desc)}</p>
                    <a href="https://youtu.be/${e.videoId}" target="_blank" rel="noopener" class="content-card-link">Watch on YouTube →</a>
                </div>
            </div>
`).join('');

  const schemas = episodes.map(e => `    <script type="application/ld+json">
${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: e.title,
    description: e.schemaDesc || e.desc,
    thumbnailUrl: `https://i.ytimg.com/vi/${e.videoId}/hqdefault.jpg`,
    uploadDate: e.published,
    embedUrl: `https://www.youtube.com/embed/${e.videoId}`,
    contentUrl: `https://www.youtube.com/watch?v=${e.videoId}`,
    publisher: { '@id': 'https://thezerohourgroup.com/#organization' }
  }, null, 2)}
    </script>`).join('\n');

  let page = fs.readFileSync(PAGE_PATH, 'utf8');
  page = page.replace(
    /(<!-- SNL:START[^>]*-->)[\s\S]*?(<!-- SNL:END -->)/,
    `$1\n${cards}\n$2`
  );
  page = page.replace(
    /(<!-- SNL:SCHEMA:START -->)[\s\S]*?(<!-- SNL:SCHEMA:END -->)/,
    `$1\n${schemas}\n    $2`
  );

  fs.writeFileSync(PAGE_PATH, page);
  fs.writeFileSync(JSON_PATH, JSON.stringify(episodes, null, 2) + '\n');
  console.log(added ? `Added ${added} new episode(s). Total: ${episodes.length}` : `No new episodes. Total: ${episodes.length}`);
}

main().catch(err => { console.error(err); process.exit(1); });
