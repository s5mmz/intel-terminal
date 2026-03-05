'use strict';
/* ================================================================
   INTEL TERMINAL — Live RSS Feed Engine
   Feed-first. Infinite scroll. Zero filters required.
   ================================================================ */

// ── CORS PROXIES ─────────────────────────────────────────────
const PROXIES = [
  u => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
  u => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
];

// ── RSS FEEDS ─────────────────────────────────────────────────
const FEEDS = [
  // Google News searches — most reliable, always fresh
  {
    id: 'gn-main',
    name: 'Google News',
    url: 'https://news.google.com/rss/search?q=iran+united+states+military+OR+nuclear+OR+sanctions&hl=en-US&gl=US&ceid=US:en',
    perspective: 'neutral', trusted: true,
  },
  {
    id: 'gn-nuclear',
    name: 'Google News',
    url: 'https://news.google.com/rss/search?q=iran+nuclear+IAEA+OR+enrichment+OR+JCPOA&hl=en-US&gl=US&ceid=US:en',
    perspective: 'neutral', trusted: true,
  },
  {
    id: 'gn-houthi',
    name: 'Google News',
    url: 'https://news.google.com/rss/search?q=houthi+iran+OR+iran+proxy+OR+iran+hezbollah&hl=en-US&gl=US&ceid=US:en',
    perspective: 'neutral', trusted: true,
  },
  {
    id: 'gn-strike',
    name: 'Google News',
    url: 'https://news.google.com/rss/search?q=iran+airstrike+OR+iran+missile+OR+iran+drone+attack&hl=en-US&gl=US&ceid=US:en',
    perspective: 'neutral', trusted: true,
  },
  // Direct feeds
  {
    id: 'bbc',
    name: 'BBC Middle East',
    url: 'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml',
    perspective: 'neutral', trusted: true,
  },
  {
    id: 'alj',
    name: 'Al Jazeera',
    url: 'https://www.aljazeera.com/xml/rss/all.xml',
    perspective: 'neutral', trusted: true,
  },
  {
    id: 'irna',
    name: 'IRNA',
    url: 'https://en.irna.ir/rss',
    perspective: 'iran', trusted: true,
  },
  {
    id: 'ptv',
    name: 'Press TV',
    url: 'https://www.presstv.ir/rss',
    perspective: 'iran', trusted: true,
  },
  {
    id: 'reuters',
    name: 'Reuters',
    url: 'https://feeds.reuters.com/reuters/worldNews',
    perspective: 'neutral', trusted: true,
  },
];

// ── RELEVANCE KEYWORDS ────────────────────────────────────────
const KEYWORDS = [
  'iran','iranian','irgc','tehran','khamenei','pezeshkian','rouhani',
  'quds','quds force','hormuz','strait of hormuz',
  'jcpoa','nuclear deal','enrichment','iaea','centrifuge','uranium',
  'maximum pressure','iran sanction',
  'houthi','hezbollah','kataib','iran proxy','islamic resistance',
  'iran missile','iran drone','iran attack','iran strike','iran navy',
  'trump iran','us iran','iran us','america iran','centcom iran',
  'islamic republic','revolutionary guard','persian gulf',
];

// ── SOURCE → PERSPECTIVE MAP ──────────────────────────────────
const SRC_PERSP = {
  'irna':'iran','press tv':'iran','presstv':'iran','mehr news':'iran',
  'tehran times':'iran','tasnim':'iran','fars news':'iran',
  'bbc':'neutral','reuters':'neutral','ap ':'neutral',
  'associated press':'neutral','al jazeera':'neutral',
  'guardian':'neutral','financial times':'neutral','ft.com':'neutral',
  'axios':'neutral','politico':'neutral','new york times':'neutral',
  'washington post':'neutral','npr':'neutral','cnn':'neutral',
  'bloomberg':'neutral','time':'neutral','wsj':'neutral',
  'wall street journal':'neutral',
  'pentagon':'us','centcom':'us','state department':'us',
};

// ── CLASSIFIERS ───────────────────────────────────────────────
function classifyType(t) {
  if (/nuclear|enrichment|iaea|centrifuge|jcpoa|uranium|plutonium/.test(t)) return 'nuclear';
  if (/cyber|hack|malware|breach|ransomware/.test(t))                        return 'cyber';
  if (/sanction|embargo|oil export|economy|rial|trade|tariff/.test(t))       return 'economic';
  if (/negotiat|diplomat|talk|deal|treaty|summit|envoy|agreement/.test(t))   return 'diplomatic';
  return 'military';
}

function classifySeverity(t) {
  if (/nuclear weapon|ballistic|direct attack|killed|airstrike|invasion|war declaration/.test(t)) return 'critical';
  if (/missile|drone attack|sanction.*oil|military action|shoot down|explosion|casualties/.test(t)) return 'high';
  if (/tension|warning|condemn|protest|retaliation|standoff|dispute/.test(t)) return 'medium';
  return 'low';
}

function getPerspective(srcName, feedPersp) {
  if (feedPersp === 'iran') return 'iran';
  const s = (srcName || '').toLowerCase();
  for (const [k, v] of Object.entries(SRC_PERSP)) { if (s.includes(k)) return v; }
  return 'neutral';
}

// ── PARSE GOOGLE NEWS TITLE "Headline - Source" ───────────────
function splitGnTitle(raw) {
  const m = raw.match(/^(.+?)\s+-\s+([^-]{2,40})$/);
  return m ? { title: m[1].trim(), source: m[2].trim() } : { title: raw, source: '' };
}

// ── EXTRACT IMAGE FROM RSS ITEM ───────────────────────────────
function extractImage(item) {
  // media:content
  const mc = item.querySelector('content');
  if (mc?.getAttribute('url')?.match(/\.(jpg|jpeg|png|webp)/i)) return mc.getAttribute('url');
  // enclosure
  const enc = item.querySelector('enclosure');
  if (enc?.getAttribute('type')?.startsWith('image')) return enc.getAttribute('url');
  // og:image in description HTML
  const desc = item.querySelector('description')?.textContent || '';
  const imgM  = desc.match(/<img[^>]+src=["']([^"']+\.(jpg|jpeg|png|webp))[^"']*["']/i);
  if (imgM) return imgM[1];
  return null;
}

// ── HELPERS ───────────────────────────────────────────────────
function hashCode(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  return Math.abs(h).toString(36);
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'JUST NOW';
  if (m < 60) return `${m}m AGO`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h AGO`;
  const d = Math.floor(h / 24);
  return `${d}d AGO`;
}

function fmtFull(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { year:'numeric', month:'short', day:'2-digit' }).toUpperCase();
}

function stripHtml(s) { return s.replace(/<[^>]+>/g,'').replace(/&[a-z]+;/gi,' ').trim(); }

// ── FETCH ─────────────────────────────────────────────────────
async function fetchWithProxy(url, idx = 0) {
  if (idx >= PROXIES.length) throw new Error('proxies exhausted');
  const r = await fetch(PROXIES[idx](url), { signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  return d.contents || d;
}

function parseItems(xmlStr, feed) {
  const doc   = new DOMParser().parseFromString(xmlStr, 'text/xml');
  const items = doc.querySelectorAll('item');
  const out   = [];

  for (const item of items) {
    const g   = t => item.querySelector(t)?.textContent?.trim() || '';
    let title = g('title');
    let link  = g('link') || item.querySelector('guid')?.textContent?.trim() || '';
    let desc  = stripHtml(g('description')).slice(0, 600);
    let srcName = g('source') || feed.name;
    let pubDate = g('pubDate') || g('dc\\:date') || new Date().toISOString();

    // Google News: split title
    if (feed.id.startsWith('gn')) {
      const s = splitGnTitle(title);
      title   = s.title;
      if (s.source) srcName = s.source;
    }

    const fullText = (title + ' ' + desc).toLowerCase();
    if (!KEYWORDS.some(kw => fullText.includes(kw))) continue;

    const perspective = getPerspective(srcName, feed.perspective);
    const type        = classifyType(fullText);
    const severity    = classifySeverity(fullText);
    const date        = (() => { try { return new Date(pubDate).toISOString(); } catch { return new Date().toISOString(); } })();
    const img         = extractImage(item);

    const tags = [...new Set(KEYWORDS.filter(kw => fullText.includes(kw)).map(k => k.toUpperCase()))].slice(0, 6);

    out.push({
      id: hashCode(title),
      date, title, summary: desc, type, severity, perspective,
      source: { name: srcName, url: link, trusted: feed.trusted },
      tags, img, live: true, pinned: false,
    });
  }
  return out;
}

async function fetchFeed(feed) {
  let xml;
  try       { xml = await fetchWithProxy(feed.url, 0); }
  catch (e) { try { xml = await fetchWithProxy(feed.url, 1); } catch { return []; } }
  if (!xml || typeof xml !== 'string') return [];
  return parseItems(xml, feed);
}

function deduplicate(items) {
  const seen = new Map();
  return items.filter(ev => {
    const key = ev.title.toLowerCase().replace(/[^a-z0-9 ]/g,'').split(' ').slice(0,7).join(' ');
    if (seen.has(key)) return false;
    seen.set(key, true);
    return true;
  });
}

// ================================================================
//   STATE
// ================================================================
const S = {
  all:      [],  // all fetched items + pinned
  pinned:   [],
  loading:  false,
  refreshed: null,

  // infinite scroll
  feedPage:    0,
  explorePage: 0,
  PAGE:        12,

  // explore filters
  filters: { perspective:'all', type:'all', severity:'all', search:'', dateFrom:'', dateTo:'' },

  activeTab: 'feed',
};

function allItems()     { return [...S.pinned, ...S.all]; }
function feedItems()    { return allItems().sort((a,b) => new Date(b.date)-new Date(a.date)); }
function filteredItems() {
  const { perspective, type, severity, search, dateFrom, dateTo } = S.filters;
  return allItems().filter(ev => {
    if (perspective !== 'all' && ev.perspective !== perspective) return false;
    if (type        !== 'all' && ev.type        !== type)        return false;
    if (severity    !== 'all' && ev.severity    !== severity)    return false;
    if (dateFrom && ev.date.slice(0,10) < dateFrom) return false;
    if (dateTo   && ev.date.slice(0,10) > dateTo)   return false;
    if (search) {
      const q = search.toLowerCase();
      if (!(ev.title.toLowerCase().includes(q) || ev.summary.toLowerCase().includes(q)
         || ev.tags.some(t => t.toLowerCase().includes(q)))) return false;
    }
    return true;
  }).sort((a,b) => new Date(b.date)-new Date(a.date));
}

// ================================================================
//   RENDER — single card
// ================================================================
const PERSP = {
  us:      { label:'US',      color:'var(--us)' },
  iran:    { label:'IRAN',    color:'var(--iran)' },
  neutral: { label:'NEUTRAL', color:'var(--neut)' },
  both:    { label:'BOTH',    color:'#b399ff' },
};
const SEV = {
  critical:{ label:'CRITICAL', color:'var(--crit)' },
  high:    { label:'HIGH',     color:'var(--high)' },
  medium:  { label:'MEDIUM',   color:'var(--med)' },
  low:     { label:'LOW',      color:'var(--low)' },
};
const TYPE_ICON = { military:'⚔', nuclear:'☢', diplomatic:'◎', economic:'◈', cyber:'⚡' };

function srcClass(p) { return p==='iran'?'iran-src':p==='us'?'us-src':''; }

function renderCard(ev) {
  const pm = PERSP[ev.perspective] || PERSP.neutral;
  const sm = SEV[ev.severity]      || SEV.medium;
  const ti = TYPE_ICON[ev.type]    || '◆';

  const imgHtml = ev.img
    ? `<img class="card-image" src="${ev.img}" alt="" loading="lazy" onerror="this.remove()">`
    : '';

  const tagsHtml = ev.tags.slice(0,5).map(t=>`<span class="tag">#${t.replace(/\s+/g,'_')}</span>`).join('');

  return `
<article class="event-card sev-${ev.severity}" data-id="${ev.id}">
  <div class="card-meta">
    <span class="card-source ${srcClass(ev.perspective)}">${ev.source.name.toUpperCase()}</span>
    <span class="meta-dot">·</span>
    <span class="card-time">${fmtFull(ev.date)} · ${timeAgo(ev.date)}</span>
    <div class="meta-badges">
      <span class="badge badge-type">${ti} ${ev.type.toUpperCase()}</span>
      <span class="badge badge-persp" style="color:${pm.color};border-color:${pm.color}">${pm.label}</span>
      <span class="badge badge-sev"   style="color:${sm.color};border-color:${sm.color}">${sm.label}</span>
      ${ev.live   ? '<span class="badge badge-live">● LIVE</span>' : ''}
      ${ev.pinned ? '<span class="badge badge-pinned">📌</span>'   : ''}
    </div>
  </div>
  <h3 class="card-headline">
    ${ev.source.url
      ? `<a href="${ev.source.url}" target="_blank" rel="noopener noreferrer">${ev.title}</a>`
      : ev.title}
  </h3>
  ${imgHtml}
  ${ev.summary ? `<p class="card-body">${ev.summary}</p>` : ''}
  <div class="card-footer">
    <div class="card-tags">${tagsHtml}</div>
    ${ev.source.url
      ? `<a href="${ev.source.url}" target="_blank" rel="noopener noreferrer" class="read-link">READ FULL ARTICLE →</a>`
      : ''}
  </div>
</article>`;
}

// ================================================================
//   RENDER — feed (paginated)
// ================================================================
function renderFeedPage(reset) {
  const stream = document.getElementById('feed-stream');
  const items  = feedItems();

  if (reset) {
    S.feedPage = 0;
    stream.innerHTML = '';
  }

  if (items.length === 0) {
    stream.innerHTML = `
      <div class="empty-state">
        <div class="e-icon">◈</div>
        <div class="e-text">NO EVENTS YET</div>
      </div>`;
    return;
  }

  const start = S.feedPage * S.PAGE;
  const slice = items.slice(start, start + S.PAGE);
  slice.forEach(ev => { stream.insertAdjacentHTML('beforeend', renderCard(ev)); });
  S.feedPage++;
}

// ================================================================
//   RENDER — explore (paginated + filtered)
// ================================================================
function renderExplorePage(reset) {
  const stream = document.getElementById('explore-stream');
  const items  = filteredItems();

  if (reset) {
    S.explorePage = 0;
    stream.innerHTML = '';
  }

  document.getElementById('explore-count').textContent =
    `${items.length} event${items.length !== 1 ? 's' : ''}`;

  if (items.length === 0) {
    stream.innerHTML = `
      <div class="empty-state">
        <div class="e-icon">◈</div>
        <div class="e-text">NO MATCHES</div>
      </div>`;
    return;
  }

  const start = S.explorePage * S.PAGE;
  const slice = items.slice(start, start + S.PAGE);
  slice.forEach(ev => { stream.insertAdjacentHTML('beforeend', renderCard(ev)); });
  S.explorePage++;
}

// ================================================================
//   INFINITE SCROLL — IntersectionObserver
// ================================================================
function initScrollObserver() {
  const opts = { rootMargin: '200px' };

  const feedObs = new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) return;
    const items = feedItems();
    if (S.feedPage * S.PAGE < items.length) renderFeedPage(false);
  }, opts);
  feedObs.observe(document.getElementById('sentinel'));

  const exploreObs = new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) return;
    const items = filteredItems();
    if (S.explorePage * S.PAGE < items.length) renderExplorePage(false);
  }, opts);
  exploreObs.observe(document.getElementById('explore-sentinel'));
}

// ================================================================
//   FETCH ORCHESTRATION
// ================================================================
function showFeedState(which) {
  document.getElementById('feed-loading').style.display = which === 'loading' ? '' : 'none';
  document.getElementById('feed-error').style.display   = which === 'error'   ? '' : 'none';
  document.getElementById('feed-stream').style.display  = which === 'stream'  ? '' : 'none';
}

async function fetchAllFeeds() {
  if (S.loading) return;
  S.loading = true;
  showFeedState('loading');
  setStatus('SYNCING...', 'amber');
  document.getElementById('btn-refresh').classList.add('spinning');

  try {
    const results = await Promise.allSettled(FEEDS.map(fetchFeed));
    let fetched = [];
    results.forEach((r,i) => {
      if (r.status === 'fulfilled') fetched = fetched.concat(r.value);
      else console.warn(`[${FEEDS[i].name}] failed`);
    });

    S.all = deduplicate(fetched);
    S.refreshed = new Date();

    setStatus(`FEEDS ACTIVE · ${S.all.length} EVENTS`, 'green');
    showFeedState('stream');
    renderFeedPage(true);

    // re-render explore if it was already visible
    if (S.activeTab === 'explore') renderExplorePage(true);

  } catch (err) {
    console.error(err);
    showFeedState('error');
    setStatus('FEED ERROR', 'red');
  }

  S.loading = false;
  document.getElementById('btn-refresh').classList.remove('spinning');
}

function setStatus(text, color) {
  document.getElementById('status-text').textContent = text;
  const dot = document.getElementById('dot-status');
  dot.className = 'dot' + (color !== 'green' ? ` ${color}` : '');
}

// Auto-refresh every 15 min
setInterval(() => { if (!S.loading) fetchAllFeeds(); }, 15 * 60 * 1000);

// ================================================================
//   TABS
// ================================================================
function initTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const t = tab.dataset.tab;
      S.activeTab = t;
      document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('view-feed').style.display    = t === 'feed'    ? '' : 'none';
      document.getElementById('view-explore').style.display = t === 'explore' ? '' : 'none';
      if (t === 'explore') renderExplorePage(true);
    });
  });
}

// ================================================================
//   EXPLORE FILTERS
// ================================================================
function initExplore() {
  // pill filters
  document.querySelectorAll('[data-key]').forEach(pill => {
    pill.addEventListener('click', () => {
      const key = pill.dataset.key;
      const val = pill.dataset.val;
      S.filters[key] = val;
      document.querySelectorAll(`[data-key="${key}"]`).forEach(b => b.classList.remove('active'));
      pill.classList.add('active');
      renderExplorePage(true);
    });
  });

  // search
  document.getElementById('explore-search').addEventListener('input', e => {
    S.filters.search = e.target.value.trim();
    renderExplorePage(true);
  });

  // date range
  document.getElementById('ex-date-from').addEventListener('change', e => { S.filters.dateFrom = e.target.value; renderExplorePage(true); });
  document.getElementById('ex-date-to').addEventListener('change',   e => { S.filters.dateTo   = e.target.value; renderExplorePage(true); });

  // clear
  document.getElementById('btn-clear-filters').addEventListener('click', () => {
    S.filters = { perspective:'all', type:'all', severity:'all', search:'', dateFrom:'', dateTo:'' };
    document.getElementById('explore-search').value = '';
    document.getElementById('ex-date-from').value = '';
    document.getElementById('ex-date-to').value = '';
    document.querySelectorAll('[data-key]').forEach(b => b.classList.toggle('active', b.dataset.val === 'all'));
    renderExplorePage(true);
  });
}

// ================================================================
//   ADD / PIN MANUAL EVENT
// ================================================================
function initModal() {
  const modal  = document.getElementById('add-modal');
  const form   = document.getElementById('add-form');
  const open   = document.getElementById('btn-add');
  const close  = document.getElementById('modal-close');
  const cancel = document.getElementById('modal-cancel');
  form.querySelector('[name="date"]').value = new Date().toISOString().slice(0,10);

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
      id:          'pin-' + Date.now(),
      date:        new Date(fd.get('date')).toISOString(),
      title:       fd.get('headline'),
      summary:     fd.get('summary') || '',
      type:        fd.get('type'),
      perspective: fd.get('perspective'),
      severity:    fd.get('severity'),
      source:      { name: fd.get('sourceName') || 'MANUAL', url: fd.get('sourceUrl') || '', trusted: false },
      tags:        fd.get('tags').split(',').map(t=>t.trim().toUpperCase()).filter(Boolean),
      img:         null, live: false, pinned: true,
    };
    S.pinned.unshift(ev);
    closeModal(); form.reset();
    form.querySelector('[name="date"]').value = new Date().toISOString().slice(0,10);
    if (S.activeTab === 'feed')    renderFeedPage(true);
    if (S.activeTab === 'explore') renderExplorePage(true);
  });
}

// ================================================================
//   MATRIX RAIN
// ================================================================
function initMatrix() {
  const cv  = document.getElementById('matrix-canvas');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  let W, H, drops;
  const W_COL = 18;
  const CHARS = '01アイウエカキクコサシスタチ◈◇⚡☢⚔◎';

  function resize() {
    W = cv.width  = window.innerWidth;
    H = cv.height = window.innerHeight;
    const cols = Math.floor(W / W_COL);
    drops = drops ? drops.slice(0, cols) : [];
    while (drops.length < cols) drops.push(Math.random() * -60);
  }

  function draw() {
    ctx.fillStyle = 'rgba(6,10,14,0.065)';
    ctx.fillRect(0, 0, W, H);
    ctx.font = '13px monospace';
    for (let i = 0; i < drops.length; i++) {
      const y = drops[i] * W_COL;
      ctx.fillStyle = 'rgba(130,255,160,0.5)';
      ctx.fillText(CHARS[Math.floor(Math.random() * CHARS.length)], i * W_COL, y);
      ctx.fillStyle = 'rgba(0,190,70,0.11)';
      ctx.fillText(CHARS[Math.floor(Math.random() * CHARS.length)], i * W_COL, y - W_COL);
      if (y > H && Math.random() > 0.975) drops[i] = 0;
      drops[i] += 0.45;
    }
  }

  resize();
  window.addEventListener('resize', resize);
  setInterval(draw, 60);
}

// ================================================================
//   CLOCK
// ================================================================
function startClock() {
  const el = document.getElementById('live-clock');
  const tick = () => {
    const n = new Date();
    const pad = x => String(x).padStart(2,'0');
    el.textContent = `${pad(n.getUTCHours())}:${pad(n.getUTCMinutes())}:${pad(n.getUTCSeconds())} UTC`;
  };
  tick(); setInterval(tick, 1000);
}

// ================================================================
//   INIT
// ================================================================
document.addEventListener('DOMContentLoaded', () => {
  initMatrix();
  startClock();
  initTabs();
  initExplore();
  initModal();

  document.getElementById('btn-refresh').addEventListener('click', () => {
    if (!S.loading) fetchAllFeeds();
  });

  fetchAllFeeds();
});

window.App = { refresh: fetchAllFeeds };
