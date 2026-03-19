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

---

## Notes
- `DEVLOG.md` is updated by Claude at the start/end of each session.
- Memory file: `C:\Users\bmanc\.claude\projects\C--wrk-Zero-Hour\memory\MEMORY.md`
