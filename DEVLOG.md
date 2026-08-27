# Zero Hour Group — Dev Log

## Project Overview
Static website for Zero Hour Group — a defense & tech investor discovery firm.
- **Live URL:** thezerohourgroup.com
- **Stack:** Currently plain HTML/CSS (static). Rebuild target: Next.js + Tailwind CSS + Vercel.
- **Repo:** C:\wrk\Zero_Hour

## Key People / Pages
- **JT** — co-founder, Substack Bestseller, Allianz background (`jt.html`)
- **Benny** — co-founder (`benny.html`)
- **Services** — what ZHG offers (`services.html`)
- **Team** — team overview (`team.html`)

---

## Redesign Direction (PDW Reference)

Reference site: `pdw.ai/products/drone-factory-01`

Target aesthetic: dark/black-first editorial, long-form vertical scroll, cinematic feel.

### Key features to implement:
| Feature | Notes |
|---|---|
| Dark color scheme | Near-black `#0a0a0a`–`#111`, white text, orange accent |
| Stats counter strip | 3–4 key metrics, count-up animation on scroll |
| Full-bleed hero image | `object-fit: cover`, 80–100vh |
| All-caps display typography | Condensed/wide grotesque headline font + clean body |
| Marquee / ticker | Infinite CSS scroll, bold all-caps keywords |
| Feature grid | 3-col no-border layout for service breakdowns |
| Scroll animations | Fade-in / slide-up via IntersectionObserver or Framer Motion |
| Full-width inline video | Autoplay muted mp4 if b-roll available |
| Carousel | Embla or CSS scroll-snap for portfolio/content showcase |
| Mobile-first responsive | Tailwind responsive classes, collapsed nav |

---

## Session History

### 2026-03-19 — Homepage Redesign (Session 2)
- Crash in session 1 lost previous in-progress work (no commits saved).
- **Decided:** Keep plain HTML/CSS stack (no Next.js migration); stay on GitHub Pages.
- **Completed homepage redesign** with full PDW-inspired dark editorial aesthetic:
  - Stats bar (25+, 8, 30+, 20+) with ease-out count-up animation on scroll
  - Full-viewport hero (Bebas Neue display font, radial glow, scroll arrow)
  - Marquee ticker: "DEFENSE · DISCOVERY · DUE DILIGENCE · ALPHA"
  - Mission editorial block: "FINDING SIGNALS IN THE NOISE"
  - 3-column feature grid: Company Interviews / Research & Reports / Investor Discovery
  - Team preview with circular photos, Bebas Neue names, Read Bio links
  - Expanded footer: logo + Navigate / Contact / Follow columns + copyright
  - Scroll fade-in animations via IntersectionObserver
- CSS scoped under `body.homepage` — other pages (jt, benny, team, services) unaffected ✓
- Mobile: stats wrap to 2×2 grid, feature grid collapses to 1 col ✓
- **Branch:** `claude/peaceful-hodgkin`
- **Next steps:** Apply new design aesthetic to inner pages (team.html, jt.html, benny.html, services.html)

### 2026-03-19 — Inner Pages Redesign (Session 2 continued)
- Recovered session 1 inner page work (was uncommitted in main working dir) → saved to branch `session1-recovered`
- **Completed all inner page redesigns:**
  - `team.html`: page-hero + 2-col team cards with orange top border
  - `jt.html`: page-hero + aside/content bio layout (placeholder for JT photo)
  - `benny.html`: same bio layout with Benny's photo in sidebar
  - `services.html`: page-hero + editorial service blocks (Company Interviews / Research & Reports / Investor Discovery) + CTA
- Updated base CSS variables globally to `#0a0a0a` dark theme (all pages now consistent)
- Bebas Neue applied globally to `.nav-brand` — no per-page scoping needed
- All pages use shared `hp-footer` markup + consistent nav
- **Pushed to main** — live at thezerohourgroup.com
- **Next steps:** Review live site, add JT photo when available, fine-tune content/copy

### 2026-03-25 — Video Integration + Topo Pattern (Session 3)

**PDW.ai design analysis completed** — full notes taken on all sections:
- Color palette, typography (condensed display + all-caps), section rhythm, nav behavior, stat cards, topo texture, cinematic images, news feed with sequential number tags, CTA

**Video integration:**
- Added hero b-roll video (`assets/video/broll1.mp4` — 720p, ~16MB) as autoplay muted loop behind hero section
- Added interview footage (`assets/video/0325.mp4` — 720p, ~18MB, Benny + Eric Brock interview) as subtle background in mission block
- Both set to `preload="none"` with IntersectionObserver lazy-load for performance
- Interview video opacity at 0.38 — visible but subtle

**Layout changes:**
- Removed marquee ticker ("DISCOVERY · DUE DILIGENCE · ALPHA · DEFENSE")
- Moved "FINDING SIGNALS IN THE NOISE" mission block from mid-page to bottom (above footer)
- Scroll arrow now points to `#services` instead of `#marquee`

**Topographic map texture:**
- Added `assets/topographic_map_pattern.png` (generated via ChatGPT/DALL-E)
- Applied as `::before` background overlay on: `.stats-bar`, `.services-section`, `.team-preview-section`, `.hp-footer`
- NOT applied to video sections (hero, mission block) — keeps cinematic areas clean
- Opacity low (~0.08) so texture is subtle depth layer, not distracting

**Current page flow (top → bottom):**
Stats bar → Hero (b-roll video bg) → Services feature grid → Team preview → Mission/Interview block → Footer

**Pending:**
- Not yet committed/pushed — worktree changes on `claude/peaceful-hodgkin`
- JT photo still placeholder
- Typography/layout PDW-style updates (left-align hero, bigger headlines, stroke text) — started discussion, not yet implemented
- Consider numbered article cards for future "news/reports" section

### 2026-08-12 — Featured Companies + Powerus x ZHG page

**Context:** Benny pitching Powerus (head of marketing, Michael) today. If it lands, Powerus becomes our first paid "featured company." Beta-only for now — NOT pushed to prod.

**Nav (all 27 pages incl. articles/):**
- Renamed "Companies Covered" → "Covered Companies" (nav link, mega labels, breadcrumb JSON-LD, companies.html hero)
- New "Featured Companies" mega-dropdown to its right — one big showcase card (POWERUS in 4.2rem Bebas) instead of a list, since there's only one company
- `site.js` mega-dropdown handler generalized from first-match to all `.mega-dropdown`s; opening one closes the other

**New page `powerus.html`** (from company-page template):
- Hero: "POWERUS x ZHG" per Benny's spec
- Interviews: Ziv Marom co-founder interview (6ScZcTfHSic, was on YT but never on the site) + CDA Summit Part 2 (0DInzJZentU)
- Shorts: new `.shorts-row` / `.short-embed` CSS — horizontal scroll-snap rail of 9:16 rounded phone frames; first short HbdNL0cjam0
- Articles + Earnings sections present but `display:none` until content exists
- Logo is a placeholder (fa-bolt) — need real Powerus logo asset

**Deployed to beta** (zhg-beta-preview.pages.dev) via wrangler. Note: stage must also exclude nested `assets/video/_originals/` (25.1MB broll4.mp4 breaks the 25MB Pages limit).

**Round 2 (same day, Bucky feedback):**
- Hero → just "POWERUS"; dropped CDA Summit card (Ziv interview only); removed "Featured Company" labels from intro line + sector tag
- Nav now guaranteed one line: full-width container (logo flush left), `white-space: nowrap`, 0.92rem links; tighter 1025–1280px squeeze block; **hamburger breakpoint moved 768 → 1024** (nav rules split out of the old 768 media block; mega-menu + dropdown breakpoints aligned to 1024/1025)
- `.company-desc a` styled: bold white + underline, orange on hover (was default blue/purple)

**Round 3 (same day, Powerus media drop at D:\buckyy\zero_hour\broll\powerus\):**
- Hero: 15s clip of tandem_defense_hero.mov (ffmpeg trim → assets/video/powerus-hero.mp4, 1.4MB) + white-text Powerus logo (`.page-hero-brand`, generated from powerus-logo-dark.png via PIL — dark pixels → white, orange knot kept; also knot-only powerus-icon.png for the overview box, replacing the bolt placeholder)
- New PLATFORMS section from the 10 spec PDFs, grouped by division: Kaizen™ Aerospace (xFold Spy/Travel/Cinema/Dragon/DragonH500/DragonH1000 cards with compressed stills + xNav AI callout) and Agile Autonomy (Blue Sky, Blue Sky Horizon, Ghost Layer - no stills, text cards). Every card links its spec PDF (copied to assets/powerus/specs/, ~14MB total)
- Unused broll assets available for later: matrix-* stills (no specs yet), tandem/agile/kaizen sub-brand logos, 3 more videos (powerus_hero_drone.mp4, kaizen_xfold_dragon.mov, agile AI-generated one)

**Round 4 (same day): first Powerus article imported.** JT's paywalled Hidden Gems piece ("This Tiny Drone Holdings Company Has Big Ties To The White House", Aug 3) republished natively as articles/powerus-white-house-ties.html — JT owns HGR, per Bucky all HGR branding stripped (intro line reworked, subscribe/share widgets dropped, byline JT, disclosure kept). Source: Bucky's PDF export (D:\downloads\), text+images extracted via pypdf (no poppler on this machine). 6 images self-hosted under assets/articles/powerus-white-house-ties/. Card added to top of articles.html; powerus.html Articles card now links locally; sitemap updated. NOTE: livestreams.html still names Hidden Gems Research in collab stream titles (actual YouTube titles) — left as-is deliberately.

**Round 5 (same day): sizing + pitch lockdown.**
- powerus.html type scale up: section labels (PLATFORMS/INTERVIEWS/SHORTS/ARTICLES/EARNINGS) 1.5→2.1rem, brand headings 1.15→1.6rem, overview knot 120→170px, POWERUS ticker 1.8→3rem
- **PITCH LOCKDOWN** on powerus.html + articles/powerus-white-house-ties.html: `<body class="page-locked">` + marked style/script block in each head. Only clickable: spec PDFs, YouTube links, the article, and powerus.html itself (nav Featured Companies, kicker links). Footer YouTube icon stays live (matches youtube allowlist); Instagram/X/TikTok, all other nav, breadcrumb (hidden), and overview cross-links (de-styled to plain text) are dead. CSS pointer-events + capture-phase click handler backstop.
- ⚠️ REMOVE THE LOCKDOWN BEFORE PROD: delete the marked block + body class in both files (instructions in the comment).

**Round 6 (same day): mobile overview + OG card.**
- Overview sizing moved from inline styles to a `.powerus-overview-header` page style block: desktop 170px knot / 3rem ticker, vertically centered; ≤768px scales to 86px / 1.85rem so each text line stacks like desktop
- Link-preview card: new assets/powerus/og-card.jpg (1200x630, white-text logo on black, PIL-composed); og:image/twitter:image now point at it. ⚠️ URL is absolute to zhg-beta-preview.pages.dev for the pitch share — swap to thezerohourgroup.com at prod time (comment in head)

**Pending:** Benny's sign-off on overview blurb (mentions $30M UMAC investment + Aureus Greenway/PUSA merger), whether Ziv interview also goes on interviews.html, what the Matrix line is (stills but no specs — article confirms Matrix-T is Tandem Defense's FPV target drone).

---

## Notes
- `DEVLOG.md` is updated by Claude at the start/end of each session.
- Memory file: `C:\Users\bmanc\.claude\projects\C--wrk-Zero-Hour\memory\MEMORY.md`
