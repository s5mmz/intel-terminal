/* ================================================================
   CONFLICT INTEL TERMINAL — Live RSS Feed Engine
   No API keys required. Uses public RSS + CORS proxy.
   ================================================================ */

'use strict';

// ── CORS PROXIES (tried in order on failure) ──────────────────
const PROXIES = [
  url => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
  url => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

// ── TRUSTED RSS FEEDS ─────────────────────────────────────────
// Perspective: 'neutral' = Western/intl press, 'iran' = Iranian state/aligned, 'us' = US official
const FEEDS = [
  // Google News topic searches — aggregates from ALL reliable publishers
  {
    id: 'gnews-conflict',
    name: 'Google News: Iran-US',
    url: 'https://news.google.com/rss/search?q=iran+united+states+military+OR+sanctions+OR+nuclear&hl=en-US&gl=US&ceid=US:en',
    perspective: 'neutral', trusted: true,
  },
  {
    id: 'gnews-nuclear',
    name: 'Google News: Iran Nuclear',
    url: 'https://news.google.com/rss/search?q=iran+nuclear+enrichment+OR+IAEA+OR+JCPOA&hl=en-US&gl=US&ceid=US:en',
    perspective: 'neutral', trusted: true,
  },
  {
    id: 'gnews-houthi',
    name: 'Google News: Houthis',
    url: 'https://news.google.com/rss/search?q=houthi+iran+OR+yemen+iran+US&hl=en-US&gl=US&ceid=US:en',
    perspective: 'neutral', trusted: true,
  },
  // Direct source feeds — both sides of the story
  {
    id: 'bbc-mideast',
    name: 'BBC Middle East',
    url: 'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml',
    perspective: 'neutral', trusted: true,
  },
  {
    id: 'aljazeera',
    name: 'Al Jazeera',
    url: 'https://www.aljazeera.com/xml/rss/all.xml',
    perspective: 'neutral', trusted: true,
  },
  {
    id: 'irna',
    name: 'IRNA (Iran State)',
    url: 'https://en.irna.ir/rss',
    perspective: 'iran', trusted: true,
  },
  {
    id: 'presstv',
    name: 'Press TV (Iran)',
    url: 'https://www.presstv.ir/rss',
    perspective: 'iran', trusted: true,
  },
  {
    id: 'reuters-world',
    name: 'Reuters World',
    url: 'https://feeds.reuters.com/reuters/worldNews',
    perspective: 'neutral', trusted: true,
  },
];

// ── KEYWORD FILTER — only show Iran/US relevant items ─────────
const MUST_MATCH = [
  'iran', 'iranian', 'irgc', 'tehran', 'khamenei', 'pezeshkian',
  'quds force', 'quds', 'hormuz', 'strait of hormuz',
  'nuclear deal', 'jcpoa', 'enrichment', 'centrifuge', 'iaea iran',
  'iran sanction', 'maximum pressure',
  'houthi', 'hezbollah iran', 'kataib', 'iran proxy',
  'trump iran', 'us iran', 'iran us', 'america iran',
  'iran missile', 'iran drone', 'iran strike',
  'centcom iran', 'pentagon iran', 'iran navy',
  'iran israel', 'iran war', 'iran attack',
  'islamic republic', 'revolutionary guard',
];

// ── SOURCE PERSPECTIVE MAP (override auto-detect) ─────────────
const SOURCE_PERSPECTIVE = {
  'irna':       'iran',
  'press tv':   'iran',
  'presstv':    'iran',
  'mehr':       'iran',
  'tehran times': 'iran',
  'tasnim':     'iran',
  'fars news':  'iran',
  'bbc':        'neutral',
  'reuters':    'neutral',
  'ap':         'neutral',
  'associated press': 'neutral',
  'al jazeera': 'neutral',
  'guardian':   'neutral',
  'ft':         'neutral',
  'financial times': 'neutral',
  'axios':      'neutral',
  'politico':   'neutral',
  'nyt':        'neutral',
  'new york times': 'neutral',
  'washington post': 'neutral',
  'npr':        'neutral',
  'cnn':        'neutral',
  'state department': 'us',
  'pentagon':   'us',
  'centcom':    'us',
  'fox news':   'us',
  'ny post':    'us',
};

// ── AUTO-CLASSIFY TYPE ────────────────────────────────────────
function classifyType(text) {
  const t = text.toLowerCase();
  if (/nuclear|enrichment|iaea|centrifuge|jcpoa|plutonium|uranium/.test(t)) return 'nuclear';
  if (/cyber|hack|malware|ransomware|breach.*system|attack.*infrastructure/.test(t)) return 'cyber';
  if (/sanction|tariff|oil export|economy|rial|currency|trade|embargo/.test(t)) return 'economic';
  if (/negotiat|diplomat|talk|deal|agreement|treaty|minister|summit|envoy/.test(t)) return 'diplomatic';
  if (/strike|missile|drone|bomb|kill|troops|soldier|navy|warship|airstrike|rocket|attack|military/.test(t)) return 'military';
  return 'diplomatic';
}

// ── AUTO-CLASSIFY SEVERITY ────────────────────────────────────
function classifySeverity(text) {
  const t = text.toLowerCase();
  if (/nuclear.*weapon|war|direct.*attack|killed|dead|airstrike.*iran|iran.*strike|ballistic missile|invasion/.test(t)) return 'critical';
  if (/missile|drone.*attack|sanction.*oil|military.*action|threat|explosion|shoot down/.test(t)) return 'high';
  if (/warning|tension|dispute|protest|condemn|retaliation|standoff|pressure/.test(t)) return 'medium';
  return 'low';
}

// ── DETECT SOURCE PERSPECTIVE ─────────────────────────────────
function getPerspective(sourceName, feedPerspective) {
  if (feedPerspective === 'iran') return 'iran';
  const s = (sourceName || '').toLowerCase();
  for (const [key, val] of Object.entries(SOURCE_PERSPECTIVE)) {
    if (s.includes(key)) return val;
  }
  return 'neutral';
}

// ── EXTRACT CLEAN SOURCE NAME from Google News title ─────────
function parseGoogleNewsTitle(rawTitle) {
  // Google News appends " - Source Name" at end
  const match = rawTitle.match(/^(.+?)\s+-\s+([^-]+)$/);
  if (match) return { title: match[1].trim(), source: match[2].trim() };
  return { title: rawTitle, source: '' };
}

// ── FORMAT DATE ───────────────────────────────────────────────
function fmtDate(dateStr) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' }).toUpperCase()
      + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) + ' UTC';
  } catch { return dateStr; }
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'JUST NOW';
  if (m < 60) return `${m}m AGO`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h AGO`;
  const d = Math.floor(h / 24);
  return `${d}d AGO`;
}

// ================================================================
//   FETCH + PARSE
// ================================================================

async function fetchWithProxy(url, proxyIdx = 0) {
  if (proxyIdx >= PROXIES.length) throw new Error('All proxies failed');
  const proxyUrl = PROXIES[proxyIdx](url);
  const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  // allorigins wraps in {contents}, codetabs returns raw text
  return data.contents || data;
}

function parseRSSXML(xmlStr) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlStr, 'text/xml');
  const items = doc.querySelectorAll('item');
  return Array.from(items).map(item => {
    const get = tag => item.querySelector(tag)?.textContent?.trim() || '';
    return {
      title:       get('title'),
      link:        get('link') || item.querySelector('guid')?.textContent?.trim() || '',
      pubDate:     get('pubDate'),
      description: get('description').replace(/<[^>]+>/g, '').trim(),
      sourceName:  get('source') || get('dc\\:creator') || '',
    };
  });
}

async function fetchFeed(feed) {
  let xmlStr;
  try {
    xmlStr = await fetchWithProxy(feed.url, 0);
  } catch {
    try { xmlStr = await fetchWithProxy(feed.url, 1); } catch { return []; }
  }

  if (!xmlStr || typeof xmlStr !== 'string') return [];

  const raw = parseRSSXML(xmlStr);
  const results = [];

  for (const item of raw) {
    if (!item.title) continue;

    // For Google News: split title & source
    let headline = item.title;
    let sourceName = item.sourceName || feed.name;
    if (feed.id.startsWith('gnews')) {
      const parsed = parseGoogleNewsTitle(item.title);
      headline = parsed.title;
      if (parsed.source) sourceName = parsed.source;
    }

    const fullText = (headline + ' ' + item.description).toLowerCase();

    // Filter: must match at least one Iran/US keyword
    const relevant = MUST_MATCH.some(kw => fullText.includes(kw));
    if (!relevant) continue;

    const perspective = getPerspective(sourceName, feed.perspective);
    const type        = classifyType(fullText);
    const severity    = classifySeverity(fullText);
    const pubDate     = item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString();

    // Extract tags from headline words
    const tags = MUST_MATCH
      .filter(kw => fullText.includes(kw))
      .slice(0, 5)
      .map(t => t.toUpperCase());

    results.push({
      id:          `${feed.id}-${Math.abs(hashCode(headline))}`,
      date:        pubDate,
      headline,
      summary:     item.description.slice(0, 400) || '',
      type, perspective, severity,
      sources:     [{ name: sourceName, url: item.link, verified: feed.trusted }],
      tags,
      live:        true,
    });
  }

  return results;
}

function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  return h;
}

// Dedup by headline similarity (same story from different feeds)
function deduplicate(items) {
  const seen = new Map();
  return items.filter(item => {
    const key = item.headline.toLowerCase()
      .replace(/[^a-z0-9 ]/g, '')
      .split(' ').slice(0, 6).join(' ');
    if (seen.has(key)) {
      // Keep the one with more source info
      const existing = seen.get(key);
      if (item.sources.length > existing.sources.length) {
        seen.set(key, item);
        return true; // swap — remove existing (can't easily; just skip duplicate)
      }
      return false;
    }
    seen.set(key, item);
    return true;
  });
}

// ================================================================
//   STATE
// ================================================================
const state = {
  items:         [],   // from RSS feeds
  pinnedItems:   [],   // manually added
  loading:       false,
  lastRefresh:   null,
  compact:       false,
  filters: {
    perspective: 'all',
    type:        'all',
    severity:    'all',
    source:      'all',
    search:      '',
    dateFrom:    '',
    dateTo:      '',
  },
};

function allItems() {
  return [...state.pinnedItems, ...state.items];
}

function getFiltered() {
  const { perspective, type, severity, source, search, dateFrom, dateTo } = state.filters;
  return allItems().filter(ev => {
    if (perspective !== 'all' && ev.perspective !== perspective) return false;
    if (type !== 'all' && ev.type !== type) return false;
    if (severity !== 'all' && ev.severity !== severity) return false;
    if (source !== 'all') {
      const match = ev.sources.some(s => s.name.toLowerCase().includes(source.toLowerCase()));
      if (!match) return false;
    }
    if (dateFrom && ev.date.slice(0,10) < dateFrom) return false;
    if (dateTo   && ev.date.slice(0,10) > dateTo)   return false;
    if (search) {
      const q = search.toLowerCase();
      if (!(ev.headline.toLowerCase().includes(q)
         || ev.summary.toLowerCase().includes(q)
         || ev.tags.some(t => t.toLowerCase().includes(q)))) return false;
    }
    return true;
  }).sort((a, b) => new Date(b.date) - new Date(a.date));
}

// ================================================================
//   RENDER
// ================================================================

const PERSP_META = {
  us:      { color: 'var(--us)',   label: 'US' },
  iran:    { color: 'var(--iran)', label: 'IRAN' },
  neutral: { color: 'var(--neut)',  label: 'NEUTRAL' },
  both:    { color: '#b399ff',     label: 'BOTH' },
};

const SEV_META = {
  critical: { color: 'var(--crit)', label: 'CRITICAL' },
  high:     { color: 'var(--high)', label: 'HIGH' },
  medium:   { color: 'var(--med)',  label: 'MEDIUM' },
  low:      { color: 'var(--low)',  label: 'LOW' },
};

const TYPE_META = {
  military:   '⚔ MILITARY',
  nuclear:    '☢ NUCLEAR',
  diplomatic: '◎ DIPLOMATIC',
  economic:   '◈ ECONOMIC',
  cyber:      '⚡ CYBER',
};

function renderCard(ev) {
  const pm = PERSP_META[ev.perspective] || PERSP_META.neutral;
  const sm = SEV_META[ev.severity]   || SEV_META.medium;
  const compact = state.compact ? 'compact' : '';

  const sourcesHTML = ev.sources.map(s =>
    `<a href="${s.url}" target="_blank" rel="noopener" class="src-link">${s.verified ? '✓ ' : ''}${s.name}</a>`
  ).join('');

  const tagsHTML = ev.tags.slice(0,6).map(t =>
    `<span class="tag">#${t.replace(/\s+/g,'_')}</span>`
  ).join('');

  return `
  <article class="event-card sev-${ev.severity} ${compact}" data-id="${ev.id}">
    <div class="card-top">
      <span class="card-date">${fmtDate(ev.date)} · ${timeAgo(ev.date)}</span>
      <div class="card-badges">
        <span class="badge badge-type">${TYPE_META[ev.type] || ev.type.toUpperCase()}</span>
        <span class="badge badge-persp" style="color:${pm.color};border-color:${pm.color}">${pm.label}</span>
        <span class="badge badge-sev"   style="color:${sm.color};border-color:${sm.color}">${sm.label}</span>
        ${ev.live    ? '<span class="badge badge-live">● LIVE</span>' : ''}
        ${ev.pinned  ? '<span class="badge badge-pinned">📌 PINNED</span>' : ''}
      </div>
    </div>
    <h3 class="card-headline">
      ${ev.sources[0]?.url ? `<a href="${ev.sources[0].url}" target="_blank" rel="noopener">${ev.headline}</a>` : ev.headline}
    </h3>
    ${ev.summary ? `<p class="card-summary">${ev.summary.slice(0,380)}${ev.summary.length > 380 ? '…' : ''}</p>` : ''}
    <div class="card-footer">
      <div class="card-tags">${tagsHTML}</div>
      <div class="card-sources">${sourcesHTML}</div>
    </div>
  </article>`;
}

function renderFeed() {
  const filtered = getFiltered();
  const feed = document.getElementById('event-feed');

  // Update stats
  const all = allItems();
  document.getElementById('s-total').textContent    = filtered.length;
  document.getElementById('s-critical').textContent = filtered.filter(e => e.severity === 'critical').length;
  document.getElementById('s-military').textContent = filtered.filter(e => e.type === 'military').length;
  document.getElementById('s-nuclear').textContent  = filtered.filter(e => e.type === 'nuclear').length;
  document.getElementById('s-us').textContent       = filtered.filter(e => e.perspective === 'us').length;
  document.getElementById('s-iran').textContent     = filtered.filter(e => e.perspective === 'iran').length;
  document.getElementById('result-count').textContent = `${filtered.length} EVENT${filtered.length !== 1 ? 'S' : ''}`;
  document.getElementById('event-count').textContent  = `${all.length} EVENTS`;

  if (filtered.length === 0) {
    feed.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">◈</div>
        <div class="empty-text">NO EVENTS MATCH FILTERS</div>
        <div class="empty-sub">Clear filters or wait for next refresh</div>
      </div>`;
    return;
  }

  feed.innerHTML = filtered.map(renderCard).join('');
}

// Populate dynamic source filter buttons
function buildSourceFilters() {
  const sources = new Set();
  allItems().forEach(ev => ev.sources.forEach(s => {
    if (s.name && s.name.length < 30) sources.add(s.name);
  }));

  const container = document.getElementById('source-filters');
  const existing  = container.querySelector('[data-val="all"]');
  container.innerHTML = '';
  container.appendChild(existing);

  Array.from(sources).slice(0, 10).forEach(name => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn';
    btn.dataset.key = 'source';
    btn.dataset.val = name;
    btn.textContent = name.toUpperCase().slice(0, 14);
    btn.title = name;
    if (state.filters.source === name) btn.classList.add('active');
    btn.addEventListener('click', () => {
      state.filters.source = name;
      document.querySelectorAll('[data-key="source"]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderFeed();
    });
    container.appendChild(btn);
  });
}

// ================================================================
//   FETCH ORCHESTRATION
// ================================================================

async function fetchAllFeeds() {
  state.loading = true;
  showState('loading');

  try {
    const results = await Promise.allSettled(FEEDS.map(fetchFeed));
    let allFetched = [];

    results.forEach((r, i) => {
      if (r.status === 'fulfilled') allFetched = allFetched.concat(r.value);
      else console.warn(`Feed ${FEEDS[i].name} failed:`, r.reason);
    });

    state.items = deduplicate(allFetched);
    state.lastRefresh = new Date();

    updateRefreshStatus();
    buildSourceFilters();
    showState('feed');
    renderFeed();

    document.getElementById('feed-status').textContent =
      state.items.length > 0 ? 'FEEDS ACTIVE' : 'NO RESULTS';

  } catch (err) {
    console.error('Fetch failed:', err);
    showState('error');
    document.getElementById('feed-status').textContent = 'FEED ERROR';
  }

  state.loading = false;
  document.getElementById('refresh-icon').className = '';
  document.getElementById('refresh-icon').textContent = '↻';
}

function showState(which) {
  document.getElementById('loading-state').style.display = which === 'loading' ? '' : 'none';
  document.getElementById('error-state').style.display   = which === 'error'   ? '' : 'none';
  document.getElementById('event-feed').style.display    = which === 'feed'    ? '' : 'none';
}

function updateRefreshStatus() {
  if (!state.lastRefresh) return;
  document.getElementById('last-refresh').textContent =
    'SYNCED ' + timeAgo(state.lastRefresh.toISOString());
}

// Auto-refresh every 15 minutes
setInterval(() => { if (!state.loading) fetchAllFeeds(); }, 15 * 60 * 1000);
// Update "X min ago" every 30 seconds
setInterval(updateRefreshStatus, 30000);

// ================================================================
//   FILTER UI
// ================================================================
function initFilters() {
  document.querySelectorAll('[data-key]').forEach(btn => {
    if (btn.dataset.key === 'source') return; // handled dynamically
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      const val = btn.dataset.val;
      state.filters[key] = val;
      document.querySelectorAll(`[data-key="${key}"]`).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderFeed();
    });
  });

  // Search
  document.getElementById('search-input').addEventListener('input', e => {
    state.filters.search = e.target.value.trim();
    renderFeed();
  });

  // Date range
  document.getElementById('date-from').addEventListener('change', e => {
    state.filters.dateFrom = e.target.value; renderFeed();
  });
  document.getElementById('date-to').addEventListener('change', e => {
    state.filters.dateTo = e.target.value; renderFeed();
  });

  // Clear
  document.getElementById('btn-clear').addEventListener('click', () => {
    state.filters = { perspective:'all', type:'all', severity:'all', source:'all', search:'', dateFrom:'', dateTo:'' };
    document.getElementById('search-input').value = '';
    document.getElementById('date-from').value = '';
    document.getElementById('date-to').value = '';
    document.querySelectorAll('[data-key]').forEach(b => {
      b.classList.toggle('active', b.dataset.val === 'all');
    });
    renderFeed();
  });

  // Compact toggle
  document.getElementById('btn-compact').addEventListener('click', function() {
    state.compact = !state.compact;
    this.textContent = state.compact ? '⊞ EXPAND' : '⊟ COMPACT';
    renderFeed();
  });

  // Refresh
  document.getElementById('btn-refresh').addEventListener('click', () => {
    if (state.loading) return;
    document.getElementById('refresh-icon').className = 'spinning';
    fetchAllFeeds();
  });
}

// ================================================================
//   ADD MANUAL EVENT
// ================================================================
function initModal() {
  const modal  = document.getElementById('add-modal');
  const form   = document.getElementById('add-form');
  const open   = document.getElementById('btn-add');
  const close  = document.getElementById('modal-close');
  const cancel = document.getElementById('modal-cancel');

  // Default date to today
  const today = new Date().toISOString().slice(0,10);
  form.querySelector('[name="date"]').value = today;

  const openModal  = () => { modal.classList.add('open'); document.body.style.overflow = 'hidden'; };
  const closeModal = () => { modal.classList.remove('open'); document.body.style.overflow = ''; };

  open.addEventListener('click', openModal);
  close.addEventListener('click', closeModal);
  cancel.addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(form);
    const ev = {
      id:          `pinned-${Date.now()}`,
      date:        new Date(fd.get('date')).toISOString(),
      headline:    fd.get('headline'),
      summary:     fd.get('summary') || '',
      type:        fd.get('type'),
      perspective: fd.get('perspective'),
      severity:    fd.get('severity'),
      sources:     fd.get('sourceUrl')
        ? [{ name: fd.get('sourceName') || 'Custom', url: fd.get('sourceUrl'), verified: false }]
        : [],
      tags:        fd.get('tags').split(',').map(t => t.trim().toUpperCase()).filter(Boolean),
      live:        false,
      pinned:      true,
    };
    state.pinnedItems.unshift(ev);
    closeModal();
    form.reset();
    form.querySelector('[name="date"]').value = today;
    buildSourceFilters();
    renderFeed();
  });
}

// ================================================================
//   MATRIX RAIN
// ================================================================
function initMatrix() {
  const canvas = document.getElementById('matrix-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, cols, drops;
  const CHARS = '01アイウエオカキクケコ◈◇⚡☢⚔◎サシスセソタチツ';
  const COL_W = 18;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    cols  = Math.floor(W / COL_W);
    drops = drops ? drops.slice(0, cols) : [];
    while (drops.length < cols) drops.push(Math.random() * -50);
  }

  function draw() {
    ctx.fillStyle = 'rgba(6,10,14,0.06)';
    ctx.fillRect(0, 0, W, H);
    ctx.font = '13px monospace';
    for (let i = 0; i < cols; i++) {
      const y = drops[i] * COL_W;
      // Bright leading character
      ctx.fillStyle = 'rgba(150,255,180,0.55)';
      ctx.fillText(CHARS[Math.floor(Math.random() * CHARS.length)], i * COL_W, y);
      // Trail
      ctx.fillStyle = 'rgba(0,200,80,0.13)';
      ctx.fillText(CHARS[Math.floor(Math.random() * CHARS.length)], i * COL_W, y - COL_W);
      if (y > H && Math.random() > 0.97) drops[i] = 0;
      drops[i] += 0.5;
    }
  }

  resize();
  window.addEventListener('resize', resize);
  setInterval(draw, 60);
}

// ================================================================
//   LIVE CLOCK
// ================================================================
function startClock() {
  const el = document.getElementById('live-clock');
  function tick() {
    const now = new Date();
    const hh  = now.getUTCHours().toString().padStart(2,'0');
    const mm  = now.getUTCMinutes().toString().padStart(2,'0');
    const ss  = now.getUTCSeconds().toString().padStart(2,'0');
    const dd  = now.toUTCString().slice(0,16).replace(',','').trim().toUpperCase();
    el.textContent = `UTC ${dd} // ${hh}:${mm}:${ss}`;
  }
  tick();
  setInterval(tick, 1000);
}

// ================================================================
//   INIT
// ================================================================
document.addEventListener('DOMContentLoaded', () => {
  initMatrix();
  startClock();
  initFilters();
  initModal();
  fetchAllFeeds();
});

// Expose refresh for error retry button
window.app = { refresh: fetchAllFeeds };
