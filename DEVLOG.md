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

---

## Notes
- `DEVLOG.md` is updated by Claude at the start/end of each session.
- Memory file: `C:\Users\bmanc\.claude\projects\C--wrk-Zero-Hour\memory\MEMORY.md`
