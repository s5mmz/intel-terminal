'use strict';
/* ================================================================
   INTEL TERMINAL — Live RSS Feed Engine
   Primary:  rss2json.com  (JSON, no XML parsing, includes images)
   Fallback: allorigins.win (raw XML)
   ================================================================ */

// ── FETCH STRATEGIES ─────────────────────────────────────────
// rss2json converts RSS → clean JSON. Free tier: 50 items/feed, no key needed.
const RSS2JSON  = u => `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(u)}&count=50&order_by=pubDate`;
const ALLORIGINS = u => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`;
const CORSPROXY  = u => `https://corsproxy.io/?${encodeURIComponent(u)}`;

// ── RSS FEEDS ─────────────────────────────────────────────────
const FEEDS = [
  // Google News topic searches — always fresh, aggregates reliable publishers
  {
    id: 'gn-conflict',
    name: 'Google News',
    url: 'https://news.google.com/rss/search?q=iran+united+states+conflict+OR+war+OR+strike+OR+sanctions&hl=en-US&gl=US&ceid=US:en',
    perspective: 'neutral', trusted: true,
  },
  {
    id: 'gn-nuclear',
    name: 'Google News',
    url: 'https://news.google.com/rss/search?q=iran+nuclear+IAEA+OR+enrichment+OR+bomb&hl=en-US&gl=US&ceid=US:en',
    perspective: 'neutral', trusted: true,
  },
  {
    id: 'gn-proxy',
    name: 'Google News',
    url: 'https://news.google.com/rss/search?q=houthi+iran+OR+hezbollah+iran+OR+iran+proxy&hl=en-US&gl=US&ceid=US:en',
    perspective: 'neutral', trusted: true,
  },
  {
    id: 'gn-trump',
    name: 'Google News',
    url: 'https://news.google.com/rss/search?q=trump+iran+OR+iran+trump+sanctions+2025+OR+2026&hl=en-US&gl=US&ceid=US:en',
    perspective: 'neutral', trusted: true,
  },
  // Direct outlet feeds
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

// ── RELEVANCE — any ONE match includes the article ────────────
const KEYWORDS = [
  'iran','iranian','irgc','tehran','khamenei','pezeshkian',
  'quds','hormuz','jcpoa','nuclear deal','enrichment','iaea',
  'maximum pressure','houthi','hezbollah','kataib',
  'iran missile','iran drone','iran attack','iran strike',
  'islamic republic','revolutionary guard','persian gulf',
  'iran sanction','iran nuclear','iran us','us iran',
  'trump iran','iran war','iran israel',
];

// ── SOURCE PERSPECTIVE MAP ────────────────────────────────────
const SRC_PERSP = {
  'irna':'iran','press tv':'iran','presstv':'iran',
  'mehr':'iran','tasnim':'iran','fars':'iran','tehran times':'iran',
  'bbc':'neutral','reuters':'neutral','associated press':'neutral',
  'al jazeera':'neutral','guardian':'neutral','ft':'neutral',
  'financial times':'neutral','axios':'neutral','politico':'neutral',
  'new york times':'neutral','washington post':'neutral',
  'nyt':'neutral','cnn':'neutral','bloomberg':'neutral','npr':'neutral',
  'pentagon':'us','centcom':'us','state department':'us',
};

// ── CLASSIFIERS ───────────────────────────────────────────────
function classifyType(t) {
  if (/nuclear|enrichment|iaea|centrifuge|jcpoa|uranium|plutonium/.test(t))  return 'nuclear';
  if (/cyber|hack|malware|ransomware|breach/.test(t))                         return 'cyber';
  if (/sanction|embargo|oil export|economy|rial|trade|tariff/.test(t))        return 'economic';
  if (/negotiat|diplomat|talk|deal|treaty|summit|envoy|agreement/.test(t))    return 'diplomatic';
  return 'military';
}
function classifySeverity(t) {
  if (/ballistic missile|direct attack|killed|airstrike|invasion|war declaration|nuclear weapon/.test(t)) return 'critical';
  if (/missile|drone attack|shoot down|explosion|casualties|military action/.test(t))                     return 'high';
  if (/tension|warning|condemn|protest|standoff|dispute|retaliation/.test(t))                             return 'medium';
  return 'low';
}
function getPerspective(srcName, feedPersp) {
  if (feedPersp === 'iran') return 'iran';
  const s = (srcName || '').toLowerCase();
  for (const [k, v] of Object.entries(SRC_PERSP)) { if (s.includes(k)) return v; }
  return 'neutral';
}

// ── UTILS ─────────────────────────────────────────────────────
function stripHtml(s) {
  return (s || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}
function hashId(s) {
  let h = 0;
  for (let i = 0; i < Math.min(s.length, 100); i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  return Math.abs(h).toString(36);
}
function timeAgo(iso) {
  const m = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (m < 1)   return 'JUST NOW';
  if (m < 60)  return `${m}m AGO`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h AGO`;
  return `${Math.floor(h / 24)}d AGO`;
}
function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'2-digit' }).toUpperCase();
}
function safeIso(str) {
  try { const d = new Date(str); return isNaN(d) ? new Date().toISOString() : d.toISOString(); }
  catch { return new Date().toISOString(); }
}
function splitGnTitle(raw) {
  const m = raw.match(/^(.+?)\s+-\s+([^-]{2,45})$/);
  return m ? { title: m[1].trim(), src: m[2].trim() } : { title: raw, src: '' };
}
function isRelevant(text) {
  const t = text.toLowerCase();
  return KEYWORDS.some(k => t.includes(k));
}

// ── EXTRACT IMAGE from HTML string ───────────────────────────
function extractImg(htmlStr) {
  if (!htmlStr) return null;
  const m = htmlStr.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

// ================================================================
//   FETCH — Strategy 1: rss2json.com (JSON response)
// ================================================================
async function fetchViaRss2Json(feed) {
  const url = RSS2JSON(feed.url);
  const r   = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`rss2json HTTP ${r.status}`);
  const d = await r.json();
  if (d.status !== 'ok') throw new Error(d.message || 'rss2json returned error');

  const out = [];
  for (const item of (d.items || [])) {
    let title   = (item.title || '').trim();
    let srcName = item.author || d.feed?.title || feed.name;
    let link    = item.link  || item.guid || '';
    let desc    = stripHtml(item.description || item.content || '').slice(0, 700);
    let date    = safeIso(item.pubDate);
    let img     = item.thumbnail || extractImg(item.content) || extractImg(item.description) || null;

    // Google News: "Headline - Source" format
    if (feed.id.startsWith('gn')) {
      const s = splitGnTitle(title);
      title   = s.title;
      if (s.src) srcName = s.src;
    }

    const combined = (title + ' ' + desc).toLowerCase();
    if (!isRelevant(combined)) continue;

    out.push({
      id:          hashId(title),
      date, title, summary: desc, img,
      type:        classifyType(combined),
      severity:    classifySeverity(combined),
      perspective: getPerspective(srcName, feed.perspective),
      source:      { name: srcName, url: link, trusted: feed.trusted },
      tags:        KEYWORDS.filter(k => combined.includes(k)).slice(0,6).map(k => k.toUpperCase()),
      live: true, pinned: false,
    });
  }
  return out;
}

// ================================================================
//   FETCH — Strategy 2: allorigins / corsproxy + XML parse
// ================================================================
async function fetchViaProxy(proxyFn, feed) {
  const r = await fetch(proxyFn(feed.url), { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`proxy HTTP ${r.status}`);
  const d   = await r.json();
  const xml = d.contents || d;
  if (!xml || typeof xml !== 'string') throw new Error('empty proxy response');

  const doc   = new DOMParser().parseFromString(xml, 'text/xml');
  const items = Array.from(doc.querySelectorAll('item'));
  if (!items.length) throw new Error('no <item> tags found');

  const out = [];
  for (const item of items) {
    // Helper — handles both namespace'd and plain tags
    const g = (...tags) => {
      for (const t of tags) {
        const el = item.querySelector(t);
        if (el?.textContent?.trim()) return el.textContent.trim();
      }
      return '';
    };

    let title   = g('title');
    let link    = g('link') || item.querySelector('guid')?.textContent?.trim() || '';
    let desc    = stripHtml(g('description', 'summary')).slice(0, 700);
    let srcName = g('source') || feed.name;
    let date    = safeIso(g('pubDate', 'published', 'dc\\:date', 'updated'));
    let img     = item.querySelector('[url]')?.getAttribute('url')
               || extractImg(g('description', 'content\\:encoded')) || null;

    if (feed.id.startsWith('gn')) {
      const s = splitGnTitle(title);
      title   = s.title;
      if (s.src) srcName = s.src;
    }

    const combined = (title + ' ' + desc).toLowerCase();
    if (!isRelevant(combined)) continue;

    out.push({
      id:          hashId(title),
      date, title, summary: desc, img,
      type:        classifyType(combined),
      severity:    classifySeverity(combined),
      perspective: getPerspective(srcName, feed.perspective),
      source:      { name: srcName, url: link, trusted: feed.trusted },
      tags:        KEYWORDS.filter(k => combined.includes(k)).slice(0,6).map(k => k.toUpperCase()),
      live: true, pinned: false,
    });
  }
  return out;
}

// ── FETCH ONE FEED — try all strategies in order ─────────────
async function fetchFeed(feed) {
  // 1. rss2json (best: returns clean JSON + images)
  try {
    const items = await fetchViaRss2Json(feed);
    console.log(`[${feed.name}] rss2json ✓ ${items.length} items`);
    return items;
  } catch (e) { console.warn(`[${feed.name}] rss2json failed:`, e.message); }

  // 2. allorigins XML
  try {
    const items = await fetchViaProxy(ALLORIGINS, feed);
    console.log(`[${feed.name}] allorigins ✓ ${items.length} items`);
    return items;
  } catch (e) { console.warn(`[${feed.name}] allorigins failed:`, e.message); }

  // 3. corsproxy XML
  try {
    const items = await fetchViaProxy(CORSPROXY, feed);
    console.log(`[${feed.name}] corsproxy ✓ ${items.length} items`);
    return items;
  } catch (e) { console.warn(`[${feed.name}] corsproxy failed:`, e.message); }

  return [];
}

// ── DEDUP by headline ─────────────────────────────────────────
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
  all:      [],
  pinned:   [],
  loading:  false,
  feedPage: 0,
  expPage:  0,
  PAGE:     12,
  activeTab:'feed',
  filters:  { perspective:'all', type:'all', severity:'all', search:'', dateFrom:'', dateTo:'' },
};

const allItems    = () => [...S.pinned, ...S.all];
const feedItems   = () => allItems().sort((a,b) => new Date(b.date) - new Date(a.date));
const filteredItems = () => {
  const { perspective, type, severity, search, dateFrom, dateTo } = S.filters;
  return allItems().filter(ev => {
    if (perspective !== 'all' && ev.perspective !== perspective) return false;
    if (type        !== 'all' && ev.type        !== type)        return false;
    if (severity    !== 'all' && ev.severity    !== severity)    return false;
    if (dateFrom && ev.date.slice(0,10) < dateFrom) return false;
    if (dateTo   && ev.date.slice(0,10) > dateTo)   return false;
    if (search) {
      const q = search.toLowerCase();
      if (!(ev.title.toLowerCase().includes(q) ||
            ev.summary.toLowerCase().includes(q) ||
            ev.tags.some(t => t.toLowerCase().includes(q)))) return false;
    }
    return true;
  }).sort((a,b) => new Date(b.date) - new Date(a.date));
};

// ================================================================
//   RENDER CARD
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
const TICON = { military:'⚔', nuclear:'☢', diplomatic:'◎', economic:'◈', cyber:'⚡' };
const srcCls = p => p==='iran'?'iran-src':p==='us'?'us-src':'';

function renderCard(ev) {
  const pm = PERSP[ev.perspective] || PERSP.neutral;
  const sm = SEV[ev.severity]      || SEV.medium;
  const ic = TICON[ev.type]        || '◆';

  // Validate image URL before rendering
  const imgHtml = ev.img && ev.img.startsWith('http')
    ? `<img class="card-image" src="${ev.img}" alt="" loading="lazy" onerror="this.style.display='none'">`
    : '';

  const tagsHtml = ev.tags.slice(0,5).map(t =>
    `<span class="tag">#${t.replace(/\s+/g,'_')}</span>`).join('');

  const articleLink = ev.source?.url;

  return `
<article class="event-card sev-${ev.severity}">
  <div class="card-meta">
    <span class="card-source ${srcCls(ev.perspective)}">${(ev.source?.name||'').toUpperCase()}</span>
    <span class="meta-dot">·</span>
    <span class="card-time">${fmtDate(ev.date)} · ${timeAgo(ev.date)}</span>
    <div class="meta-badges">
      <span class="badge badge-type">${ic} ${ev.type.toUpperCase()}</span>
      <span class="badge badge-persp" style="color:${pm.color};border-color:${pm.color}">${pm.label}</span>
      <span class="badge badge-sev"   style="color:${sm.color};border-color:${sm.color}">${sm.label}</span>
      ${ev.live   ? '<span class="badge badge-live">● LIVE</span>' : ''}
      ${ev.pinned ? '<span class="badge badge-pinned">📌</span>'   : ''}
    </div>
  </div>
  <h3 class="card-headline">
    ${articleLink
      ? `<a href="${articleLink}" target="_blank" rel="noopener noreferrer">${ev.title}</a>`
      : ev.title}
  </h3>
  ${imgHtml}
  ${ev.summary ? `<p class="card-body">${ev.summary}</p>` : ''}
  <div class="card-footer">
    <div class="card-tags">${tagsHtml}</div>
    ${articleLink
      ? `<a href="${articleLink}" target="_blank" rel="noopener noreferrer" class="read-link">READ FULL ARTICLE →</a>`
      : ''}
  </div>
</article>`;
}

// ================================================================
//   RENDER FEED (paginated)
// ================================================================
function renderFeedPage(reset) {
  const stream = document.getElementById('feed-stream');
  if (reset) { S.feedPage = 0; stream.innerHTML = ''; }

  const items = feedItems();
  if (!items.length) {
    stream.innerHTML = `
      <div class="empty-state">
        <div class="e-icon">◈</div>
        <div class="e-text">NO EVENTS LOADED</div>
        <div class="e-sub">Feeds may be blocked by network. Try refreshing or open in Chrome.</div>
      </div>`;
    return;
  }

  const slice = items.slice(S.feedPage * S.PAGE, (S.feedPage + 1) * S.PAGE);
  slice.forEach(ev => stream.insertAdjacentHTML('beforeend', renderCard(ev)));
  S.feedPage++;
}

// ================================================================
//   RENDER EXPLORE (paginated + filtered)
// ================================================================
function renderExplorePage(reset) {
  const stream = document.getElementById('explore-stream');
  if (reset) { S.expPage = 0; stream.innerHTML = ''; }

  const items = filteredItems();
  document.getElementById('explore-count').textContent = `${items.length} events`;

  if (!items.length) {
    stream.innerHTML = `<div class="empty-state"><div class="e-icon">◈</div><div class="e-text">NO MATCHES</div></div>`;
    return;
  }

  const slice = items.slice(S.expPage * S.PAGE, (S.expPage + 1) * S.PAGE);
  slice.forEach(ev => stream.insertAdjacentHTML('beforeend', renderCard(ev)));
  S.expPage++;
}

// ================================================================
//   INFINITE SCROLL
// ================================================================
function initScrollObserver() {
  const obs = new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) return;
    if (S.activeTab === 'feed'    && S.feedPage * S.PAGE < feedItems().length)     renderFeedPage(false);
    if (S.activeTab === 'explore' && S.expPage  * S.PAGE < filteredItems().length) renderExplorePage(false);
  }, { rootMargin: '300px' });

  obs.observe(document.getElementById('sentinel'));
  obs.observe(document.getElementById('explore-sentinel'));
}

// ================================================================
//   FETCH ORCHESTRATION
// ================================================================
function showFeedState(which) {
  document.getElementById('feed-loading').style.display = which === 'loading' ? '' : 'none';
  document.getElementById('feed-error').style.display   = which === 'error'   ? '' : 'none';
  document.getElementById('feed-stream').style.display  = which === 'stream'  ? '' : 'none';
}
function setStatus(text, color) {
  document.getElementById('status-text').textContent = text;
  document.getElementById('dot-status').className = 'dot' + (color !== 'green' ? ` ${color}` : '');
}

async function fetchAllFeeds() {
  if (S.loading) return;
  S.loading = true;
  showFeedState('loading');
  setStatus('SYNCING FEEDS...', 'amber');
  document.getElementById('btn-refresh').classList.add('spinning');

  try {
    const results = await Promise.allSettled(FEEDS.map(fetchFeed));
    let all = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') { all = all.concat(r.value); }
      else console.error(`Feed "${FEEDS[i].name}" threw:`, r.reason);
    });

    S.all = deduplicate(all);
    console.log(`[INTEL] Total after dedup: ${S.all.length} events`);

    if (S.all.length === 0) {
      // Still show stream view with empty state message
      showFeedState('stream');
      setStatus('0 EVENTS — CHECK CONSOLE', 'amber');
    } else {
      setStatus(`LIVE · ${S.all.length} EVENTS`, 'green');
      showFeedState('stream');
    }

    renderFeedPage(true);
    if (S.activeTab === 'explore') renderExplorePage(true);

  } catch (err) {
    console.error('[INTEL] Fatal fetch error:', err);
    showFeedState('error');
    setStatus('FETCH FAILED', 'red');
  }

  S.loading = false;
  document.getElementById('btn-refresh').classList.remove('spinning');
}

// Auto-refresh every 15 minutes
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
  document.querySelectorAll('[data-key]').forEach(pill => {
    pill.addEventListener('click', () => {
      const { key, val } = pill.dataset;
      S.filters[key] = val;
      document.querySelectorAll(`[data-key="${key}"]`).forEach(b => b.classList.remove('active'));
      pill.classList.add('active');
      renderExplorePage(true);
    });
  });
  document.getElementById('explore-search').addEventListener('input', e => {
    S.filters.search = e.target.value.trim();
    renderExplorePage(true);
  });
  document.getElementById('ex-date-from').addEventListener('change', e => { S.filters.dateFrom = e.target.value; renderExplorePage(true); });
  document.getElementById('ex-date-to').addEventListener('change',   e => { S.filters.dateTo   = e.target.value; renderExplorePage(true); });
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
//   MANUAL EVENT MODAL
// ================================================================
function initModal() {
  const modal  = document.getElementById('add-modal');
  const form   = document.getElementById('add-form');
  const openM  = () => { modal.classList.add('open');    document.body.style.overflow = 'hidden'; };
  const closeM = () => { modal.classList.remove('open'); document.body.style.overflow = ''; };
  form.querySelector('[name="date"]').value = new Date().toISOString().slice(0,10);
  document.getElementById('btn-add').addEventListener('click', openM);
  document.getElementById('modal-close').addEventListener('click', closeM);
  document.getElementById('modal-cancel').addEventListener('click', closeM);
  modal.addEventListener('click', e => { if (e.target === modal) closeM(); });
  form.addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(form);
    S.pinned.unshift({
      id: 'pin-' + Date.now(),
      date:        new Date(fd.get('date')).toISOString(),
      title:       fd.get('headline'),
      summary:     fd.get('summary') || '',
      type:        fd.get('type'),
      perspective: fd.get('perspective'),
      severity:    fd.get('severity'),
      source:      { name: fd.get('sourceName') || 'MANUAL', url: fd.get('sourceUrl') || '', trusted: false },
      tags:        (fd.get('tags')||'').split(',').map(t=>t.trim().toUpperCase()).filter(Boolean),
      img: null, live: false, pinned: true,
    });
    closeM(); form.reset();
    form.querySelector('[name="date"]').value = new Date().toISOString().slice(0,10);
    renderFeedPage(true);
    if (S.activeTab === 'explore') renderExplorePage(true);
  });
}

// ================================================================
//   MATRIX RAIN
// ================================================================
function initMatrix() {
  const cv = document.getElementById('matrix-canvas');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  let W, H, drops;
  const CW = 18;
  const CH = '01アイウエカキクコ◈◇⚡☢⚔◎サシスタチ';
  function resize() {
    W = cv.width = window.innerWidth; H = cv.height = window.innerHeight;
    const n = Math.floor(W / CW);
    drops = drops ? drops.slice(0,n) : [];
    while (drops.length < n) drops.push(Math.random() * -60);
  }
  function draw() {
    ctx.fillStyle = 'rgba(6,10,14,0.065)'; ctx.fillRect(0,0,W,H);
    ctx.font = '13px monospace';
    drops.forEach((y,i) => {
      ctx.fillStyle = 'rgba(130,255,160,0.48)';
      ctx.fillText(CH[Math.floor(Math.random()*CH.length)], i*CW, y*CW);
      ctx.fillStyle = 'rgba(0,190,70,0.10)';
      ctx.fillText(CH[Math.floor(Math.random()*CH.length)], i*CW, y*CW - CW);
      if (y*CW > H && Math.random() > 0.975) drops[i] = 0;
      drops[i] += 0.45;
    });
  }
  resize(); window.addEventListener('resize', resize);
  setInterval(draw, 60);
}

// ================================================================
//   CLOCK
// ================================================================
function startClock() {
  const el = document.getElementById('live-clock');
  const p  = n => String(n).padStart(2,'0');
  const tick = () => {
    const d = new Date();
    el.textContent = `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} UTC`;
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
  initScrollObserver();
  document.getElementById('btn-refresh').addEventListener('click', () => { if (!S.loading) fetchAllFeeds(); });
  fetchAllFeeds();
});

window.App = { refresh: fetchAllFeeds };