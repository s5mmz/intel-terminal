# INTEL TERMINAL

> A real-time geopolitical intelligence feed with a cyber-terminal interface.
> Aggregates verified news from multiple international sources, filters for signal over noise, and presents both sides of active conflicts in a clean, personal dashboard.

---

## Overview

**Intel Terminal** is a self-hosted, browser-based intelligence dashboard built for tracking active geopolitical conflicts. It pulls live articles from trusted international news sources, auto-classifies them by type and severity, and renders them in a minimal cyber-terminal UI — no backend, no API keys, no subscriptions.

The current active topic is the **Iran / United States** conflict, covering military operations, nuclear developments, diplomatic activity, economic sanctions, and proxy warfare. The architecture is built to be extended to any future conflict or topic.

---

## Features

| Feature | Description |
|---|---|
| **Live RSS Feeds** | Pulls from 7 curated feed sources on load, auto-refreshes every 15 minutes |
| **Both Sides** | Includes Western press (BBC, Reuters, AP) and Iranian state media (IRNA, Press TV) |
| **Signal Filter** | Keyword-based relevance filter strips unrelated articles automatically |
| **Auto-Classification** | Each article is tagged by type (Military / Nuclear / Diplomatic / Economic / Cyber) and severity (Low → Critical) |
| **Perspective Tagging** | Each event is tagged US / Iran / Neutral based on its source |
| **Deduplication** | Same story appearing across multiple feeds is collapsed to a single card |
| **Search + Filter** | Real-time search; filter by perspective, type, severity, source, and date range |
| **Manual Events** | Pin your own events with full metadata via the ADD panel |
| **Compact Mode** | Toggle between full cards and compact headlines-only view |
| **Zero Dependencies** | Pure HTML / CSS / JS — no frameworks, no build step, no server |

---

## Sources

### Western / International (Neutral)
- **Google News** — aggregated search across Reuters, AP, NYT, Washington Post, FT, and others
- **BBC Middle East** — `feeds.bbci.co.uk`
- **Al Jazeera** — `aljazeera.com`
- **Reuters World** — `feeds.reuters.com`

### Iranian State / Aligned
- **IRNA** (Islamic Republic News Agency) — official Iranian state media in English
- **Press TV** — Iran's English-language state broadcaster

> Including Iranian state sources is intentional. Understanding how the Iranian government frames events is essential for a complete picture. These sources are clearly labeled.

---

## Usage

```bash
# Clone the repo
git clone https://github.com/s5mmz/intel-terminal.git

# Open in browser — no server required
open intel-terminal/index.html
```

Or visit the live version at: **[s5mmz.github.io/intel-terminal](https://s5mmz.github.io/intel-terminal)**

---

## Interface

```
┌─────────────────────────────────────────────────────────────┐
│ CONFLICT INTEL TERMINAL          UTC 2026-03-04 // 14:22:07 │
│ ● FEEDS ACTIVE  ● SYNCED 2m AGO  ● 47 EVENTS      [REFRESH]│
├─────────────────────────────────────────────────────────────┤
│ TOPIC:// [◈ IRAN / US]  [⊕ NEW TOPIC]                      │
├──────────────┬──────────────────────────────────────────────┤
│ PERSPECTIVE  │ TOTAL  CRITICAL  MILITARY  NUCLEAR  US  IRAN │
│ [ALL][US]    ├──────────────────────────────────────────────┤
│ [IRAN][NEUT] │ ⌕ SEARCH EVENTS...                  47 EVENTS│
│              ├──────────────────────────────────────────────┤
│ EVENT TYPE   │ 2026-MAR-04 12:31 UTC · 2h AGO              │
│ [ALL]        │ ☢ NUCLEAR  IRAN  CRITICAL                    │
│ [⚔ MILITARY] │ Iran Accelerates Uranium Enrichment...       │
│ [☢ NUCLEAR]  │ Stockpile now exceeds breakout threshold...  │
│ [◎ DIPLOMAT] │ #ENRICHMENT #IAEA #URANIUM  ✓ Reuters  ✓ BBC│
│ [◈ ECONOMIC] ├──────────────────────────────────────────────┤
│ [⚡ CYBER]   │ 2026-MAR-03 08:15 UTC · 1d AGO              │
│              │ ⚔ MILITARY  US  HIGH                        │
│ SEVERITY     │ CENTCOM Conducts Strikes on Houthi Positions │
│ [ALL]        │ ...                                          │
│ [CRITICAL]   │                                              │
│ [HIGH]       │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

---

## Architecture

```
intel-terminal/
├── index.html       # Layout and DOM structure
├── styles.css       # Cyber-terminal theme (no frameworks)
├── app.js           # RSS fetch engine, classifier, state, renderer
└── README.md
```

**How the feed engine works:**

1. On load, fetches all configured RSS feeds in parallel via a CORS proxy (`allorigins.win`)
2. Parses RSS XML using `DOMParser`
3. Filters each article against a keyword list — only Iran/US-relevant items pass
4. Auto-classifies type and severity via regex pattern matching on title + description
5. Assigns perspective based on source name mapping
6. Deduplicates stories appearing across multiple feeds
7. Sorts newest-first, renders as cards

---

## Extending to New Topics

To add a new conflict or topic, edit `app.js`:

```js
// 1. Add feeds targeting the new topic
const FEEDS = [
  ...existingFeeds,
  {
    id: 'gnews-china-taiwan',
    name: 'Google News: China-Taiwan',
    url: 'https://news.google.com/rss/search?q=china+taiwan+military&hl=en-US&gl=US&ceid=US:en',
    perspective: 'neutral',
    trusted: true,
  },
];

// 2. Add relevant keywords to MUST_MATCH
const MUST_MATCH = [
  ...existingKeywords,
  'taiwan', 'pla', 'strait of taiwan', 'china military',
];
```

Then add a topic tab in `index.html` and wire it to toggle feed sets.

---

## Tech Stack

- **Vanilla JS** — no React, no Vue, no build toolchain
- **CSS Custom Properties** — full theme via variables
- **Web Fonts** — Orbitron (display) + Share Tech Mono (body)
- **CORS Proxy** — `allorigins.win` with `codetabs.com` fallback
- **RSS / XML** — parsed via native `DOMParser`

---

## Disclaimer

This tool aggregates publicly available news articles from third-party sources. It does not generate, alter, or editorialize content. Source attribution is preserved on every card. Iranian state media sources are included for perspective completeness and are labeled accordingly.

---

*Built for personal intelligence tracking. Not affiliated with any government agency or news organization.*
