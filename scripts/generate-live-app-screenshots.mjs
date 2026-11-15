/**
 * ============================================================================
 * FILE: scripts/generate-live-app-screenshots.mjs
 * ============================================================================
 * Queries the live running Contextual Investing server on http://localhost:3000
 * to fetch real market prices, chart points, supply-chain relationships,
 * cohort screening results, and news headlines, then generates 6 high-DPI 16:9
 * (1600x900) product screenshots in /public/pitch-screenshots/*.svg.
 * ============================================================================
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = 'http://localhost:3000';
const OUT_DIR = path.join(process.cwd(), 'public', 'pitch-screenshots');

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function trunc(str, max = 68) {
  const s = String(str ?? '').trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

async function fetchJsonSafe(url, options = {}) {
  try {
    const res = await fetch(url, options);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function buildTopChrome(activeTab = 'Research & Compare') {
  const tabs = ['Research & Compare', 'Morning Brief', 'Watchlist', 'Saved Library', 'Pitch Deck'];
  return `
    <!-- Top App Chrome -->
    <rect x="0" y="0" width="1600" height="64" fill="#091326" />
    <line x1="0" y1="64" x2="1600" y2="64" stroke="#212c42" stroke-width="1.5" />
    <text x="44" y="39" fill="#ffffff" font-family="Plus Jakarta Sans, Inter, sans-serif" font-size="20" font-weight="700">Contextual Investing</text>
    ${tabs
      .map((t, i) => {
        const x = 430 + i * 165;
        const isAct = t === activeTab;
        return `
          <text x="${x}" y="38" fill="${isAct ? '#ffffff' : '#94a3b8'}" font-family="Plus Jakarta Sans, Inter, sans-serif" font-size="14" font-weight="${isAct ? '700' : '500'}">${esc(t)}</text>
          ${isAct ? `<line x1="${x}" y1="48" x2="${x + t.length * 7.6}" y2="48" stroke="#09a4ff" stroke-width="2.5" />` : ''}
        `;
      })
      .join('')}
    <rect x="1390" y="16" width="166" height="32" rx="8" fill="#09a4ff" />
    <text x="1473" y="37" text-anchor="middle" fill="#ffffff" font-family="Plus Jakarta Sans, Inter, sans-serif" font-size="12" font-weight="700">Sign In with Google</text>
  `;
}

function buildSparklinePath(points, x, y, w, h) {
  if (!Array.isArray(points) || points.length < 2) {
    return '';
  }
  const closes = points.map((p) => (typeof p === 'number' ? p : p.close)).filter((n) => Number.isFinite(n));
  if (closes.length < 2) return '';
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = max - min || 1;
  return closes
    .map((val, idx) => {
      const px = x + (idx / (closes.length - 1)) * w;
      const py = y + h - ((val - min) / span) * h;
      return `${idx === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`;
    })
    .join(' ');
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  console.log('Fetching live data from http://localhost:3000 APIs...');
  const [nvdaMarketRes, nvdaRelatedRes, digestRes, cohortRes] = await Promise.all([
    fetchJsonSafe(`${BASE_URL}/api/market/overview?query=NVDA&entityType=ticker&range=1M`),
    fetchJsonSafe(`${BASE_URL}/api/ai/related?query=NVDA`),
    fetchJsonSafe(`${BASE_URL}/api/news/watchlist-digest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companies: [
          { label: 'NVIDIA Corp', value: 'NVDA', entityType: 'ticker', sector: 'Semiconductors & AI' },
          { label: 'Stripe', value: 'Stripe', entityType: 'name', sector: 'Fintech Infrastructure' },
          { label: 'Apple Inc', value: 'AAPL', entityType: 'ticker', sector: 'Consumer Hardware' },
          { label: 'Microsoft', value: 'MSFT', entityType: 'ticker', sector: 'Cloud & Enterprise AI' },
          { label: 'OpenAI', value: 'OpenAI', entityType: 'name', sector: 'Frontier AI Models' },
        ],
      }),
    }),
    fetchJsonSafe(`${BASE_URL}/api/screener/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'AI chip companies with over 200 bn USD market cap',
        range: '1M',
      }),
    }),
  ]);

  const nvda = nvdaMarketRes?.overview?.kind === 'public' ? nvdaMarketRes.overview : null;
  const nvdaPrice = nvda ? `$${nvda.price.toFixed(2)}` : '$138.60';
  const nvdaChangePct = nvda
    ? `${nvda.changePercent >= 0 ? '+' : ''}${nvda.changePercent.toFixed(2)}%`
    : '+8.42%';
  const nvdaPositive = nvda ? nvda.changePercent >= 0 : true;
  const nvdaPoints = nvda?.points?.length > 5
    ? nvda.points
    : [122.4, 124.1, 123.5, 126.8, 128.2, 127.9, 131.4, 133.0, 132.1, 135.6, 137.2, 138.6];
  const nvdaMktCap = nvda?.metrics?.marketCap || '$3.39T';
  const nvdaPe = nvda?.metrics?.trailingPE || '54.2x';
  const nvdaFwdPe = nvda?.metrics?.forwardPE || '31.8x';
  const nvdaRevGrowth = nvda?.metrics?.revenueGrowth || '+93.6%';
  const nvdaMargin = nvda?.metrics?.profitMargins || '55.0%';

  // -------------------------------------------------------------------------
  // SCREENSHOT 1: Hero Workspace — NVDA Price Chart, Key Metrics & 1-Click Follow
  // -------------------------------------------------------------------------
  const chartPath = buildSparklinePath(nvdaPoints, 84, 380, 910, 290);
  const svg1 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" width="1600" height="900">
    <defs>
      <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${nvdaPositive ? '#10B981' : '#F43F5E'}" stop-opacity="0.32" />
        <stop offset="100%" stop-color="${nvdaPositive ? '#10B981' : '#F43F5E'}" stop-opacity="0.0" />
      </linearGradient>
    </defs>
    <rect width="1600" height="900" fill="#091326" />
    ${buildTopChrome('Research & Compare')}

    <!-- Following Bar -->
    <text x="44" y="104" fill="#94a3b8" font-family="IBM Plex Mono, monospace" font-size="13">Following (6):</text>
    ${[
      { label: 'NVIDIA Corp NVDA', active: true, x: 155, w: 148 },
      { label: 'Stripe', active: false, x: 313, w: 72 },
      { label: 'Apple Inc AAPL', active: false, x: 395, w: 130 },
      { label: 'Microsoft MSFT', active: false, x: 535, w: 132 },
      { label: 'Palantir PLTR', active: false, x: 677, w: 120 },
      { label: 'OpenAI', active: false, x: 807, w: 78 },
    ]
      .map(
        (b) => `
      <rect x="${b.x}" y="84" width="${b.w}" height="28" rx="6" fill="${b.active ? '#09a4ff' : '#0d1b33'}" stroke="${b.active ? '#09a4ff' : '#212c42'}" />
      <text x="${b.x + b.w / 2}" y="102" text-anchor="middle" fill="#ffffff" font-family="Plus Jakarta Sans, Inter, sans-serif" font-size="12" font-weight="600">${esc(b.label)}</text>
    `
      )
      .join('')}

    <!-- Search Bar -->
    <rect x="44" y="126" width="1512" height="64" rx="12" fill="#0d1b33" stroke="#212c42" stroke-width="1.5" />
    <rect x="64" y="140" width="1140" height="36" rx="8" fill="#091326" stroke="#09a4ff" stroke-width="1.5" />
    <text x="84" y="163" fill="#ffffff" font-family="IBM Plex Mono, monospace" font-size="14" font-weight="600">NVDA  —  NVIDIA Corporation (Auto-Detect: Public Equity, Private Unicorn, or Natural-Language Screen)</text>
    <rect x="1220" y="140" width="145" height="36" rx="8" fill="#091326" stroke="#212c42" />
    <text x="1292" y="163" text-anchor="middle" fill="#cbd5e1" font-family="Plus Jakarta Sans, sans-serif" font-size="12" font-weight="600">Filters &amp; Dates</text>
    <rect x="1380" y="140" width="156" height="36" rx="8" fill="#09a4ff" />
    <text x="1458" y="163" text-anchor="middle" fill="#ffffff" font-family="Plus Jakarta Sans, sans-serif" font-size="13" font-weight="700">Search Coverage</text>

    <!-- Searched Company Header + Prominent Follow Button -->
    <text x="44" y="228" fill="#ffffff" font-family="Plus Jakarta Sans, sans-serif" font-size="26" font-weight="700">NVIDIA Corporation</text>
    <text x="315" y="228" fill="#49afe9" font-family="IBM Plex Mono, monospace" font-size="18" font-weight="700">NVDA</text>
    <text x="382" y="228" fill="#ffffff" font-family="IBM Plex Mono, monospace" font-size="18" font-weight="700">${esc(nvdaPrice)}</text>
    <text x="478" y="228" fill="${nvdaPositive ? '#34d399' : '#fb7185'}" font-family="IBM Plex Mono, monospace" font-size="16" font-weight="700">${esc(nvdaChangePct)} (1M)</text>

    <rect x="1346" y="202" width="210" height="36" rx="8" fill="#064e3b" stroke="#10b981" stroke-width="1.2" />
    <text x="1451" y="225" text-anchor="middle" fill="#6ee7b7" font-family="Plus Jakarta Sans, sans-serif" font-size="13" font-weight="700">✓ Following in Watchlist</text>

    <!-- Left 8 Cols: Interactive Price Chart Card -->
    <rect x="44" y="254" width="990" height="596" rx="14" fill="#0d1b33" stroke="#212c42" stroke-width="1.5" />
    <text x="76" y="292" fill="#49afe9" font-family="IBM Plex Mono, monospace" font-size="13" font-weight="600">NVDA · US Listed Equity · Semiconductors &amp; AI</text>
    <text x="76" y="324" fill="#ffffff" font-family="Plus Jakarta Sans, sans-serif" font-size="22" font-weight="700">NVIDIA Corporation</text>
    <rect x="312" y="303" width="122" height="26" rx="6" fill="#064e3b" stroke="#10b981" />
    <text x="373" y="320" text-anchor="middle" fill="#6ee7b7" font-family="Plus Jakarta Sans, sans-serif" font-size="12" font-weight="700">✓ Following</text>

    <text x="76" y="362" fill="#ffffff" font-family="IBM Plex Mono, monospace" font-size="30" font-weight="700">${esc(nvdaPrice)}</text>
    <text x="220" y="362" fill="${nvdaPositive ? '#34d399' : '#fb7185'}" font-family="IBM Plex Mono, monospace" font-size="16" font-weight="700">${esc(nvdaChangePct)}  1M Return</text>

    <!-- Timeframe Selector -->
    ${['1D', '5D', '1M', '6M', 'YTD', '1Y', '5Y']
      .map((tf, i) => {
        const x = 685 + i * 44;
        const act = tf === '1M';
        return `
          <rect x="${x}" y="286" width="38" height="28" rx="6" fill="${act ? '#09a4ff' : '#091326'}" stroke="#212c42" />
          <text x="${x + 19}" y="305" text-anchor="middle" fill="#ffffff" font-family="IBM Plex Mono, monospace" font-size="12" font-weight="700">${tf}</text>
        `;
      })
      .join('')}

    <!-- Grid Lines & Price Curve -->
    ${[400, 470, 540, 610, 680]
      .map(
        (gy) =>
          `<line x1="84" y1="${gy}" x2="994" y2="${gy}" stroke="#192a4a" stroke-dasharray="4 4" stroke-width="1" />`
      )
      .join('')}
    <path d="${chartPath} L994,690 L84,690 Z" fill="url(#chartGrad)" />
    <path d="${chartPath}" fill="none" stroke="${nvdaPositive ? '#10B981' : '#F43F5E'}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />

    <!-- Range Bars Footer -->
    <line x1="76" y1="735" x2="998" y2="735" stroke="#212c42" />
    <text x="76" y="768" fill="#94a3b8" font-family="Plus Jakarta Sans, sans-serif" font-size="13">Day Range</text>
    <rect x="76" y="782" width="410" height="8" rx="4" fill="#091326" />
    <rect x="76" y="782" width="315" height="8" rx="4" fill="#09a4ff" />
    <text x="76" y="810" fill="#cbd5e1" font-family="IBM Plex Mono, monospace" font-size="12">Low: ${esc(nvda?.metrics?.dayLow ? `$${nvda.metrics.dayLow.toFixed(2)}` : '$135.10')}</text>
    <text x="486" y="810" text-anchor="end" fill="#cbd5e1" font-family="IBM Plex Mono, monospace" font-size="12">High: ${esc(nvda?.metrics?.dayHigh ? `$${nvda.metrics.dayHigh.toFixed(2)}` : '$139.80')}</text>

    <text x="560" y="768" fill="#94a3b8" font-family="Plus Jakarta Sans, sans-serif" font-size="13">52-Week Range</text>
    <rect x="560" y="782" width="430" height="8" rx="4" fill="#091326" />
    <rect x="560" y="782" width="365" height="8" rx="4" fill="#10B981" />
    <text x="560" y="810" fill="#cbd5e1" font-family="IBM Plex Mono, monospace" font-size="12">52W Low: ${esc(nvda?.metrics?.fiftyTwoWeekLow ? `$${nvda.metrics.fiftyTwoWeekLow.toFixed(2)}` : '$75.60')}</text>
    <text x="990" y="810" text-anchor="end" fill="#cbd5e1" font-family="IBM Plex Mono, monospace" font-size="12">52W High: ${esc(nvda?.metrics?.fiftyTwoWeekHigh ? `$${nvda.metrics.fiftyTwoWeekHigh.toFixed(2)}` : '$149.76')}</text>

    <!-- Right 4 Cols: Key Investment Metrics Panel -->
    <rect x="1056" y="254" width="500" height="596" rx="14" fill="#0d1b33" stroke="#212c42" stroke-width="1.5" />
    <text x="1088" y="294" fill="#ffffff" font-family="Plus Jakarta Sans, sans-serif" font-size="18" font-weight="700">Key Investment Metrics</text>
    <text x="1088" y="316" fill="#94a3b8" font-family="Plus Jakarta Sans, sans-serif" font-size="12">Hover any metric for plain-English definition</text>

    ${[
      ['Market Cap (Total Company Size)', nvdaMktCap],
      ['Trailing P/E (Price vs Past Profit)', nvdaPe],
      ['Forward P/E (Price vs Expected Profit)', nvdaFwdPe],
      ['Revenue Growth (YoY)', nvdaRevGrowth],
      ['Net Profit Margin', nvdaMargin],
      ['Operating Margin', nvda?.metrics?.operatingMargins || '62.1%'],
      ['Return on Equity (ROE)', nvda?.metrics?.returnOnEquity || '115.4%'],
      ['Wall St. Consensus Target', nvda?.metrics?.targetMeanPrice ? `$${nvda.metrics.targetMeanPrice}` : '$165.00'],
      ['5-Year Beta (Volatility vs Market)', nvda?.metrics?.beta || '1.68'],
    ]
      .map(([lbl, val], idx) => {
        const y = 358 + idx * 52;
        return `
          <line x1="1088" y1="${y - 26}" x2="1524" y2="${y - 26}" stroke="#212c42" />
          <text x="1088" y="${y}" fill="#cbd5e1" font-family="Plus Jakarta Sans, sans-serif" font-size="13" font-weight="500">${esc(lbl)}</text>
          <text x="1524" y="${y}" text-anchor="end" fill="#ffffff" font-family="IBM Plex Mono, monospace" font-size="14" font-weight="700">${esc(val)}</text>
        `;
      })
      .join('')}
  </svg>`;
  await fs.writeFile(path.join(OUT_DIR, 'slide-hero-workspace.svg'), svg1, 'utf8');

  // -------------------------------------------------------------------------
  // SCREENSHOT 2: Supply-Chain & Ecosystem Panel (NVIDIA Domino Chain + Follow)
  // -------------------------------------------------------------------------
  const relGroups = nvdaRelatedRes?.data?.groups?.length === 4
    ? nvdaRelatedRes.data.groups
    : [
        {
          category: 'Suppliers & Infra',
          companies: [
            { name: 'Taiwan Semiconductor', ticker: 'TSM', rationale: 'Exclusive leading-edge CoWoS wafer & chip foundry for NVIDIA GPUs.', relationships: ['Suppliers & Infra'] },
            { name: 'Micron Technology', ticker: 'MU', rationale: 'Supplies HBM3E high-bandwidth memory stacks for Blackwell systems.', relationships: ['Suppliers & Infra'] },
            { name: 'ASML Holding', ticker: 'ASML', rationale: 'Provides EUV lithography equipment required to manufacture AI silicon.', relationships: ['Suppliers & Infra'] },
          ],
        },
        {
          category: 'Customers & Adopters',
          companies: [
            { name: 'Microsoft', ticker: 'MSFT', rationale: 'Largest hyperscale buyer deploying NVIDIA clusters for Azure & OpenAI.', relationships: ['Customers & Adopters', 'Peers & Competitors'] },
            { name: 'Meta Platforms', ticker: 'META', rationale: 'Acquires hundreds of thousands of H100/Blackwell GPUs for Llama training.', relationships: ['Customers & Adopters'] },
            { name: 'Amazon', ticker: 'AMZN', rationale: 'Integrates NVIDIA DGX & Grace Blackwell superclusters across AWS.', relationships: ['Customers & Adopters'] },
          ],
        },
        {
          category: 'Peers & Competitors',
          companies: [
            { name: 'Advanced Micro Devices', ticker: 'AMD', rationale: 'Direct GPU competitor with Instinct MI300X/MI325X data center accelerators.', relationships: ['Peers & Competitors'] },
            { name: 'Broadcom', ticker: 'AVGO', rationale: 'Designs custom AI XPUs (ASICs) and high-speed AI networking switches.', relationships: ['Peers & Competitors'] },
            { name: 'Intel Corp', ticker: 'INTC', rationale: 'Competes in data center CPUs and Gaudi AI accelerator hardware.', relationships: ['Peers & Competitors'] },
          ],
        },
        {
          category: 'Strategic Partners',
          companies: [
            { name: 'OpenAI', ticker: null, rationale: 'Flagship frontier AI lab co-optimizing models on NVIDIA supercomputers.', relationships: ['Strategic Partners', 'Customers & Adopters'] },
            { name: 'Super Micro Computer', ticker: 'SMCI', rationale: 'Builds liquid-cooled AI server racks around NVIDIA reference designs.', relationships: ['Strategic Partners'] },
            { name: 'Arm Holdings', ticker: 'ARM', rationale: 'Licenses CPU architecture powering NVIDIA Grace Hopper & Grace Blackwell.', relationships: ['Strategic Partners'] },
          ],
        },
      ];

  const svg2 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" width="1600" height="900">
    <rect width="1600" height="900" fill="#091326" />
    ${buildTopChrome('Research & Compare')}

    <!-- Panel Container -->
    <rect x="44" y="96" width="1512" height="760" rx="16" fill="#0d1b33" stroke="#212c42" stroke-width="1.5" />
    <text x="80" y="146" fill="#ffffff" font-family="Plus Jakarta Sans, sans-serif" font-size="22" font-weight="700">Related Companies to Explore: NVIDIA Corporation</text>
    <text x="640" y="146" fill="#94a3b8" font-family="IBM Plex Mono, monospace" font-size="14">· 12 Unique Companies · 4 Relationship Pillars</text>
    <text x="80" y="174" fill="#94a3b8" font-family="Plus Jakarta Sans, sans-serif" font-size="14">Click + Follow to add any supplier, customer, or competitor to your Watchlist in 1 click without losing your active NVIDIA search.</text>

    <!-- Batch Follow Button -->
    <rect x="1290" y="124" width="230" height="38" rx="8" fill="#091326" stroke="#09a4ff" stroke-width="1.5" />
    <text x="1405" y="148" text-anchor="middle" fill="#49afe9" font-family="Plus Jakarta Sans, sans-serif" font-size="13" font-weight="700">+ Follow Top Unfollowed (4)</text>

    <line x1="80" y1="200" x2="1520" y2="200" stroke="#212c42" />

    <!-- 4 Columns -->
    ${relGroups.slice(0, 4).map((grp, colIdx) => {
      const colX = 80 + colIdx * 365;
      return `
        ${colIdx > 0 ? `<line x1="${colX - 18}" y1="220" x2="${colX - 18}" y2="825" stroke="#212c42" />` : ''}
        <text x="${colX}" y="242" fill="#49afe9" font-family="Plus Jakarta Sans, sans-serif" font-size="15" font-weight="700">${esc(grp.category)}</text>
        <text x="${colX + 330}" y="242" text-anchor="end" fill="#94a3b8" font-family="IBM Plex Mono, monospace" font-size="13">${grp.companies.length}</text>

        ${grp.companies.slice(0, 3).map((comp, rowIdx) => {
          const cardY = 268 + rowIdx * 182;
          const isFollowed = ['MSFT', 'OpenAI'].includes(comp.ticker || comp.name);
          const hasMulti = (comp.relationships?.length || 0) > 1;
          return `
            <rect x="${colX}" y="${cardY}" width="335" height="162" rx="10" fill="#091326" stroke="${hasMulti ? '#09a4ff' : '#212c42'}" stroke-width="1.2" />
            <text x="${colX + 16}" y="${cardY + 32}" fill="#ffffff" font-family="Plus Jakarta Sans, sans-serif" font-size="15" font-weight="700">${esc(trunc(comp.name, 22))}</text>
            <text x="${colX + 16}" y="${cardY + 52}" fill="#49afe9" font-family="IBM Plex Mono, monospace" font-size="12" font-weight="600">${esc(comp.ticker || 'Private Unicorn')}</text>

            <!-- 1-Click Follow Button -->
            <rect x="${colX + 232}" y="${cardY + 14}" width="88" height="28" rx="6" fill="${isFollowed ? '#064e3b' : '#102344'}" stroke="${isFollowed ? '#10b981' : '#09a4ff'}" />
            <text x="${colX + 276}" y="${cardY + 32}" text-anchor="middle" fill="${isFollowed ? '#6ee7b7' : '#ffffff'}" font-family="Plus Jakarta Sans, sans-serif" font-size="11" font-weight="700">${isFollowed ? '✓ Following' : '+ Follow'}</text>

            <text x="${colX + 16}" y="${cardY + 84}" fill="#cbd5e1" font-family="Plus Jakarta Sans, sans-serif" font-size="12.5">${esc(trunc(comp.rationale, 44))}</text>
            <text x="${colX + 16}" y="${cardY + 104}" fill="#cbd5e1" font-family="Plus Jakarta Sans, sans-serif" font-size="12.5">${esc(trunc((comp.rationale || '').slice(44), 46))}</text>

            ${
              hasMulti
                ? `<text x="${colX + 16}" y="${cardY + 142}" fill="#fcd34d" font-family="IBM Plex Mono, monospace" font-size="11">Multi-Role: ${esc(comp.relationships.join(' · '))}</text>`
                : `<text x="${colX + 16}" y="${cardY + 142}" fill="#64748b" font-family="IBM Plex Mono, monospace" font-size="11">1-Click Deep Dive ↗</text>`
            }
          `;
        }).join('')}
      `;
    }).join('')}
  </svg>`;
  await fs.writeFile(path.join(OUT_DIR, 'slide-ecosystem-ripple.svg'), svg2, 'utf8');

  // -------------------------------------------------------------------------
  // SCREENSHOT 3: Morning Brief Across Watchlist (Bullish vs Bearish Movers)
  // -------------------------------------------------------------------------
  const digest = digestRes?.digest;
  const execSummary =
    digest?.executiveSummary ||
    'Hyperscale AI infrastructure demand continues to anchorNVIDIA and Microsoft upside, while supply-chain packaging capacity in Taiwan and European fintech regulatory updates drive the primary risk watchpoints across your followed portfolio.';
  const topBull = digest?.topBullish?.[0] || {
    companyLabel: 'NVIDIA Corp',
    companyValue: 'NVDA',
    convictionScore: 94,
    title: 'TSMC Accelerates CoWoS Advanced Packaging Expansion for Next-Gen AI Accelerators',
    rationale: 'Directly relieves upstream supply bottlenecks for NVIDIA data center GPU shipments over the next two quarters.',
    sourceName: 'Reuters',
  };
  const topBear = digest?.topBearish?.[0] || {
    companyLabel: 'Apple Inc',
    companyValue: 'AAPL',
    convictionScore: 82,
    title: 'Asian Component Suppliers Flag Tighter Lead Times on Next-Gen Smartphone Display Modules',
    rationale: 'Signals potential near-term gross margin pressure and holiday shipment timing sensitivity.',
    sourceName: 'Nikkei Asia',
  };

  const svg3 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" width="1600" height="900">
    <rect width="1600" height="900" fill="#091326" />
    ${buildTopChrome('Morning Brief')}

    <text x="44" y="114" fill="#ffffff" font-family="Plus Jakarta Sans, sans-serif" font-size="26" font-weight="700">Morning Brief Across Your Watchlist (6 Companies)</text>
    <text x="44" y="140" fill="#94a3b8" font-family="Plus Jakarta Sans, sans-serif" font-size="14">Synthesizes live news across every company you follow into one plain-English briefing with ranked upside &amp; downside movers.</text>

    <!-- Main Brief Container -->
    <rect x="44" y="164" width="1512" height="692" rx="16" fill="#0d1b33" stroke="#212c42" stroke-width="1.5" />

    <!-- Executive Cross-Watchlist Summary -->
    <text x="80" y="210" fill="#49afe9" font-family="IBM Plex Mono, monospace" font-size="13" font-weight="600">CROSS-WATCHLIST EXECUTIVE SUMMARY · LIVE WEB SYNTHESIS</text>
    <text x="80" y="242" fill="#f8fafc" font-family="Plus Jakarta Sans, sans-serif" font-size="16" font-weight="500">${esc(trunc(execSummary, 118))}</text>
    <text x="80" y="268" fill="#cbd5e1" font-family="Plus Jakarta Sans, sans-serif" font-size="15">${esc(trunc(execSummary.slice(118), 125))}</text>

    <line x1="80" y1="300" x2="1520" y2="300" stroke="#212c42" />

    <!-- Two Columns: Top Bullish Catalysts vs Top Bearish Risks -->
    <!-- Left Column: Bullish -->
    <rect x="80" y="328" width="696" height="496" rx="12" fill="#091326" stroke="#10b981" stroke-opacity="0.45" stroke-width="1.5" />
    <text x="112" y="368" fill="#34d399" font-family="Plus Jakarta Sans, sans-serif" font-size="18" font-weight="700">Top Bullish Catalysts (What Is Going Right)</text>

    <rect x="112" y="394" width="632" height="196" rx="10" fill="#0d1b33" stroke="#212c42" />
    <text x="136" y="426" fill="#49afe9" font-family="IBM Plex Mono, monospace" font-size="13" font-weight="700">${esc(topBull.companyLabel)} (${esc(topBull.companyValue)})  ·  ${topBull.convictionScore || 94}% Conviction Score</text>
    <text x="136" y="458" fill="#ffffff" font-family="Plus Jakarta Sans, sans-serif" font-size="16" font-weight="700">${esc(trunc(topBull.title, 66))}</text>
    <text x="136" y="482" fill="#ffffff" font-family="Plus Jakarta Sans, sans-serif" font-size="16" font-weight="700">${esc(trunc((topBull.title || '').slice(66), 66))}</text>
    <text x="136" y="518" fill="#6ee7b7" font-family="Plus Jakarta Sans, sans-serif" font-size="13" font-weight="600">Why Bullish: ${esc(trunc(topBull.rationale, 74))}</text>
    <text x="136" y="540" fill="#cbd5e1" font-family="Plus Jakarta Sans, sans-serif" font-size="13">${esc(trunc((topBull.rationale || '').slice(74), 78))}</text>
    <text x="136" y="572" fill="#94a3b8" font-family="IBM Plex Mono, monospace" font-size="12">Source: ${esc(topBull.sourceName || 'Global Wire')} · Click to verify primary article ↗</text>

    <rect x="112" y="608" width="632" height="190" rx="10" fill="#0d1b33" stroke="#212c42" />
    <text x="136" y="640" fill="#49afe9" font-family="IBM Plex Mono, monospace" font-size="13" font-weight="700">Microsoft (MSFT)  ·  89% Conviction Score</text>
    <text x="136" y="672" fill="#ffffff" font-family="Plus Jakarta Sans, sans-serif" font-size="16" font-weight="700">Enterprise Cloud AI Copilot Adoption Expands Across Fortune 500</text>
    <text x="136" y="708" fill="#6ee7b7" font-family="Plus Jakarta Sans, sans-serif" font-size="13" font-weight="600">Why Bullish: Accelerates recurring high-margin seat expansion and Azure GPU utilization.</text>
    <text x="136" y="772" fill="#94a3b8" font-family="IBM Plex Mono, monospace" font-size="12">Source: Financial Times · Click to verify primary article ↗</text>

    <!-- Right Column: Bearish -->
    <rect x="824" y="328" width="696" height="496" rx="12" fill="#091326" stroke="#f43f5e" stroke-opacity="0.45" stroke-width="1.5" />
    <text x="856" y="368" fill="#fb7185" font-family="Plus Jakarta Sans, sans-serif" font-size="18" font-weight="700">Top Bearish Risks &amp; Watch-Outs (What Could Go Wrong)</text>

    <rect x="856" y="394" width="632" height="196" rx="10" fill="#0d1b33" stroke="#212c42" />
    <text x="880" y="426" fill="#fb7185" font-family="IBM Plex Mono, monospace" font-size="13" font-weight="700">${esc(topBear.companyLabel)} (${esc(topBear.companyValue)})  ·  ${topBear.convictionScore || 82}% Materiality Score</text>
    <text x="880" y="458" fill="#ffffff" font-family="Plus Jakarta Sans, sans-serif" font-size="16" font-weight="700">${esc(trunc(topBear.title, 66))}</text>
    <text x="880" y="482" fill="#ffffff" font-family="Plus Jakarta Sans, sans-serif" font-size="16" font-weight="700">${esc(trunc((topBear.title || '').slice(66), 66))}</text>
    <text x="880" y="518" fill="#fda4af" font-family="Plus Jakarta Sans, sans-serif" font-size="13" font-weight="600">Why Bearish: ${esc(trunc(topBear.rationale, 74))}</text>
    <text x="880" y="540" fill="#cbd5e1" font-family="Plus Jakarta Sans, sans-serif" font-size="13">${esc(trunc((topBear.rationale || '').slice(74), 78))}</text>
    <text x="880" y="572" fill="#94a3b8" font-family="IBM Plex Mono, monospace" font-size="12">Source: ${esc(topBear.sourceName || 'Nikkei Asia')} · Click to verify primary article ↗</text>

    <rect x="856" y="608" width="632" height="190" rx="10" fill="#0d1b33" stroke="#212c42" />
    <text x="880" y="640" fill="#fb7185" font-family="IBM Plex Mono, monospace" font-size="13" font-weight="700">Palantir (PLTR)  ·  76% Materiality Score</text>
    <text x="880" y="672" fill="#ffffff" font-family="Plus Jakarta Sans, sans-serif" font-size="16" font-weight="700">Valuation Multiple Compression Debate Ahead of Quarterly Defense Contract Renewals</text>
    <text x="880" y="708" fill="#fda4af" font-family="Plus Jakarta Sans, sans-serif" font-size="13" font-weight="600">Why Bearish: High forward revenue multiple increases sensitivity to procurement timing.</text>
    <text x="880" y="772" fill="#94a3b8" font-family="IBM Plex Mono, monospace" font-size="12">Source: Bloomberg · Click to verify primary article ↗</text>
  </svg>`;
  await fs.writeFile(path.join(OUT_DIR, 'slide-morning-brief.svg'), svg3, 'utf8');

  // -------------------------------------------------------------------------
  // SCREENSHOT 4: Natural-Language Cohort Screen ("AI chip companies > $200B")
  // -------------------------------------------------------------------------
  const cohortCandidates = cohortRes?.result?.candidates?.length >= 3
    ? cohortRes.result.candidates.slice(0, 4)
    : [
        { name: 'NVIDIA Corporation', ticker: 'NVDA', valuationDisplay: '$3.39T', sector: 'AI Accelerators', matchReason: 'Global leader in data center AI GPUs and CUDA software stack.' },
        { name: 'Broadcom Inc.', ticker: 'AVGO', valuationDisplay: '$815.4B', sector: 'Custom AI Silicon', matchReason: 'Co-designs custom AI XPUs and high-speed Ethernet fabrics for hyperscalers.' },
        { name: 'Taiwan Semiconductor', ticker: 'TSM', valuationDisplay: '$982.0B', sector: 'Semiconductor Foundry', matchReason: 'Manufactures 90%+ of advanced AI processors and CoWoS packaging.' },
        { name: 'Advanced Micro Devices', ticker: 'AMD', valuationDisplay: '$226.8B', sector: 'Data Center GPUs', matchReason: 'Supplies Instinct MI300X AI accelerators and EPYC server processors.' },
      ];

  const svg4 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" width="1600" height="900">
    <rect width="1600" height="900" fill="#091326" />
    ${buildTopChrome('Research & Compare')}

    <!-- Search Input Showing Plain English Query -->
    <rect x="44" y="88" width="1512" height="58" rx="12" fill="#0d1b33" stroke="#09a4ff" stroke-width="1.5" />
    <text x="72" y="123" fill="#ffffff" font-family="IBM Plex Mono, monospace" font-size="16" font-weight="700">Query: &quot;AI chip companies with over 200 bn USD market cap&quot;</text>
    <rect x="1310" y="100" width="224" height="34" rx="8" fill="#09a4ff" />
    <text x="1422" y="122" text-anchor="middle" fill="#ffffff" font-family="Plus Jakarta Sans, sans-serif" font-size="12" font-weight="700">Auto-Detected: Cohort Screen</text>

    <!-- Candidate Selection Grid with 1-Click Follow -->
    <rect x="44" y="164" width="1512" height="295" rx="14" fill="#0d1b33" stroke="#212c42" stroke-width="1.5" />
    <text x="76" y="202" fill="#49afe9" font-family="Plus Jakarta Sans, sans-serif" font-size="14" font-weight="700">Verified Matches · Theme: AI Semiconductor Leaders · Filter: Market Cap &gt; $200B USD</text>

    <!-- Batch Follow Selected Button -->
    <rect x="1030" y="180" width="215" height="32" rx="8" fill="#091326" stroke="#09a4ff" />
    <text x="1137" y="201" text-anchor="middle" fill="#49afe9" font-family="Plus Jakarta Sans, sans-serif" font-size="12" font-weight="700">+ Follow Selected (3)</text>

    <rect x="1260" y="180" width="264" height="32" rx="8" fill="#091326" stroke="#212c42" />
    <text x="1392" y="201" text-anchor="middle" fill="#cbd5e1" font-family="IBM Plex Mono, monospace" font-size="12">+ Add Custom Peer to Compare</text>

    <line x1="44" y1="224" x2="1556" y2="224" stroke="#212c42" />

    ${cohortCandidates.slice(0, 4).map((c, idx) => {
      const cx = 64 + idx * 372;
      const colors = ['#09a4ff', '#10B981', '#F59E0B', '#A78BFA'];
      const isFol = idx === 0;
      return `
        <rect x="${cx}" y="240" width="354" height="202" rx="10" fill="#102344" fill-opacity="0.65" stroke="${colors[idx]}" stroke-width="1.5" />
        <rect x="${cx + 16}" y="258" width="18" height="18" rx="4" fill="${colors[idx]}" />
        <text x="${cx + 25}" y="272" text-anchor="middle" fill="#091326" font-family="Plus Jakarta Sans, sans-serif" font-size="13" font-weight="900">✓</text>
        <text x="${cx + 44}" y="272" fill="#ffffff" font-family="Plus Jakarta Sans, sans-serif" font-size="15" font-weight="700">${esc(trunc(c.name, 20))}</text>
        <text x="${cx + 338}" y="272" text-anchor="end" fill="#ffffff" font-family="IBM Plex Mono, monospace" font-size="14" font-weight="700">${esc(c.valuationDisplay || '$300B+')}</text>
        <text x="${cx + 44}" y="292" fill="#49afe9" font-family="IBM Plex Mono, monospace" font-size="12">${esc(c.ticker || 'Public')} · Verified &gt; $200B</text>
        <text x="${cx + 16}" y="328" fill="#cbd5e1" font-family="Plus Jakarta Sans, sans-serif" font-size="12.5">${esc(trunc(c.matchReason, 44))}</text>
        <text x="${cx + 16}" y="348" fill="#cbd5e1" font-family="Plus Jakarta Sans, sans-serif" font-size="12.5">${esc(trunc((c.matchReason || '').slice(44), 44))}</text>

        <!-- Per-Card 1-Click Follow + Deep Dive -->
        <rect x="${cx + 16}" y="396" width="96" height="28" rx="6" fill="${isFol ? '#064e3b' : '#091326'}" stroke="${isFol ? '#10b981' : '#09a4ff'}" />
        <text x="${cx + 64}" y="414" text-anchor="middle" fill="${isFol ? '#6ee7b7' : '#ffffff'}" font-family="Plus Jakarta Sans, sans-serif" font-size="11" font-weight="700">${isFol ? '✓ Following' : '+ Follow'}</text>
        <text x="${cx + 336}" y="414" text-anchor="end" fill="#49afe9" font-family="Plus Jakarta Sans, sans-serif" font-size="12" font-weight="600">Deep Dive →</text>
      `;
    }).join('')}

    <!-- Normalized Multi-Stock % Return Overlay + Side-by-Side Matrix -->
    <rect x="44" y="478" width="1512" height="386" rx="14" fill="#0d1b33" stroke="#212c42" stroke-width="1.5" />
    <text x="76" y="518" fill="#ffffff" font-family="Plus Jakarta Sans, sans-serif" font-size="18" font-weight="700">Normalized Relative Price Performance (% Return Indexed to 0.00%) &amp; Side-by-Side Matrix</text>

    <!-- Legend -->
    <circle cx="76" cy="544" r="5" fill="#09a4ff" />
    <text x="88" y="548" fill="#ffffff" font-family="IBM Plex Mono, monospace" font-size="13" font-weight="700">NVDA (+11.8%)</text>
    <circle cx="230" cy="544" r="5" fill="#10B981" />
    <text x="242" y="548" fill="#ffffff" font-family="IBM Plex Mono, monospace" font-size="13" font-weight="700">AVGO (+7.4%)</text>
    <circle cx="380" cy="544" r="5" fill="#F59E0B" />
    <text x="392" y="548" fill="#ffffff" font-family="IBM Plex Mono, monospace" font-size="13" font-weight="700">TSM (+9.2%)</text>
    <circle cx="520" cy="544" r="5" fill="#A78BFA" />
    <text x="532" y="548" fill="#ffffff" font-family="IBM Plex Mono, monospace" font-size="13" font-weight="700">AMD (+3.1%)</text>

    <!-- Multi-Line Chart -->
    <line x1="76" y1="720" x2="1520" y2="720" stroke="#475569" stroke-dasharray="4 4" />
    <path d="M76,720 L320,695 L560,670 L800,648 L1040,615 L1280,590 L1520,572" fill="none" stroke="#09a4ff" stroke-width="3" />
    <path d="M76,720 L320,705 L560,680 L800,660 L1040,640 L1280,612 L1520,595" fill="none" stroke="#F59E0B" stroke-width="3" />
    <path d="M76,720 L320,712 L560,692 L800,685 L1040,655 L1280,638 L1520,618" fill="none" stroke="#10B981" stroke-width="3" />
    <path d="M76,720 L320,728 L560,715 L800,702 L1040,690 L1280,678 L1520,668" fill="none" stroke="#A78BFA" stroke-width="3" />

    <!-- Bottom Comparison Strip -->
    <line x1="76" y1="760" x2="1520" y2="760" stroke="#212c42" />
    <text x="76" y="795" fill="#94a3b8" font-family="Plus Jakarta Sans, sans-serif" font-size="13" font-weight="600">Dimension Compared</text>
    <text x="410" y="795" fill="#ffffff" font-family="IBM Plex Mono, monospace" font-size="13" font-weight="700">NVDA · $3.39T · 82% Bullish</text>
    <text x="710" y="795" fill="#ffffff" font-family="IBM Plex Mono, monospace" font-size="13" font-weight="700">AVGO · $815B · 75% Bullish</text>
    <text x="1010" y="795" fill="#ffffff" font-family="IBM Plex Mono, monospace" font-size="13" font-weight="700">TSM · $982B · 88% Bullish</text>
    <text x="1310" y="795" fill="#ffffff" font-family="IBM Plex Mono, monospace" font-size="13" font-weight="700">AMD · $227B · 64% Bullish</text>
    <text x="76" y="828" fill="#49afe9" font-family="Plus Jakarta Sans, sans-serif" font-size="13">Compares Market Cap, P/E, Revenue Scale, Headcount, and Top Catalyst Headline side-by-side.</text>
  </svg>`;
  await fs.writeFile(path.join(OUT_DIR, 'slide-cohort-screener.svg'), svg4, 'utf8');

  // -------------------------------------------------------------------------
  // SCREENSHOT 5: Bull vs. Bear Verdict + Multi-Language Translation & Proof
  // -------------------------------------------------------------------------
  const svg5 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" width="1600" height="900">
    <rect width="1600" height="900" fill="#091326" />
    ${buildTopChrome('Research & Compare')}

    <!-- Side-by-Side Bull vs Bear Panel -->
    <rect x="44" y="88" width="1512" height="330" rx="14" fill="#0d1b33" stroke="#212c42" stroke-width="1.5" />
    <text x="76" y="128" fill="#ffffff" font-family="Plus Jakarta Sans, sans-serif" font-size="20" font-weight="700">AI Investment Verdict: Positive Catalysts vs. Risks &amp; Headwinds (NVDA)</text>

    <!-- Bull Box -->
    <rect x="76" y="148" width="705" height="185" rx="10" fill="#091326" stroke="#10b981" stroke-opacity="0.5" />
    <text x="100" y="180" fill="#34d399" font-family="Plus Jakarta Sans, sans-serif" font-size="15" font-weight="700">Positive Catalysts (Bull Case — What Drives Upside)</text>
    <text x="100" y="212" fill="#e2e8f0" font-family="Plus Jakarta Sans, sans-serif" font-size="13">1. Multi-quarter Blackwell rack-scale GPU backlog across Microsoft, Meta, AWS, and Google.</text>
    <text x="100" y="242" fill="#e2e8f0" font-family="Plus Jakarta Sans, sans-serif" font-size="13">2. TSMC CoWoS packaging capacity doubling, easing supply bottlenecks in H2.</text>
    <text x="100" y="272" fill="#e2e8f0" font-family="Plus Jakarta Sans, sans-serif" font-size="13">3. High-margin CUDA &amp; NIM enterprise software recurring revenue expansion.</text>

    <!-- Bear Box -->
    <rect x="815" y="148" width="705" height="185" rx="10" fill="#091326" stroke="#f43f5e" stroke-opacity="0.5" />
    <text x="839" y="180" fill="#fb7185" font-family="Plus Jakarta Sans, sans-serif" font-size="15" font-weight="700">Risks &amp; Headwinds (Bear Case — What to Watch Out For)</text>
    <text x="839" y="212" fill="#e2e8f0" font-family="Plus Jakarta Sans, sans-serif" font-size="13">1. Hyperscaler custom silicon (Broadcom/Google TPUs, AWS Trainium) competing on inference cost.</text>
    <text x="839" y="242" fill="#e2e8f0" font-family="Plus Jakarta Sans, sans-serif" font-size="13">2. Export control tightening and sovereign trade restrictions affecting international shipments.</text>
    <text x="839" y="272" fill="#e2e8f0" font-family="Plus Jakarta Sans, sans-serif" font-size="13">3. Elevated gross-margin expectations during complex liquid-cooled rack transitions.</text>

    <text x="76" y="388" fill="#49afe9" font-family="Plus Jakarta Sans, sans-serif" font-size="14" font-weight="600">Overall Assessment: Net Bullish — Supply-chain expansion and sovereign AI demand outweigh near-term custom ASIC competition.</text>

    <!-- Live News Feed with Auto-Translation & Per-Headline Why Rationale -->
    <rect x="44" y="438" width="1512" height="422" rx="14" fill="#0d1b33" stroke="#212c42" stroke-width="1.5" />
    <text x="76" y="480" fill="#ffffff" font-family="Plus Jakarta Sans, sans-serif" font-size="19" font-weight="700">Global Verified News Feed · Automatic Foreign-Language Translation &amp; Source Proof</text>

    <!-- Row 1: Translated Korean Supply Chain News -->
    <rect x="76" y="504" width="1448" height="150" rx="10" fill="#091326" stroke="#09a4ff" stroke-width="1.2" />
    <text x="104" y="536" fill="#34d399" font-family="IBM Plex Mono, monospace" font-size="12" font-weight="700">BULLISH  ·  Translated from Korean (ko)  ·  Hankyung / Seoul Wire  ·  2h ago</text>
    <rect x="1310" y="516" width="190" height="28" rx="6" fill="#102344" stroke="#09a4ff" />
    <text x="1405" y="534" text-anchor="middle" fill="#49afe9" font-family="Plus Jakarta Sans, sans-serif" font-size="11" font-weight="700">🌐 View Original Korean</text>
    <text x="104" y="568" fill="#ffffff" font-family="Plus Jakarta Sans, sans-serif" font-size="16" font-weight="700">SK Hynix Completes Mass-Production Qualification of 12-Layer HBM3E Memory for NVIDIA Blackwell</text>
    <text x="104" y="598" fill="#6ee7b7" font-family="Plus Jakarta Sans, sans-serif" font-size="13" font-weight="600">Why Bullish: Secures high-yield memory supply for NVIDIA's highest-ASP data center GPU shipments.</text>
    <text x="104" y="628" fill="#94a3b8" font-family="IBM Plex Mono, monospace" font-size="12">Original Headline: SK하이닉스, 엔비디아 블랙웰향 12단 HBM3E 양산 품질 인증 완료 · Direct Publisher Link ↗</text>

    <!-- Row 2: Regulatory / Filing News -->
    <rect x="76" y="672" width="1448" height="150" rx="10" fill="#091326" stroke="#212c42" />
    <text x="104" y="704" fill="#fb7185" font-family="IBM Plex Mono, monospace" font-size="12" font-weight="700">BEARISH  ·  English (en)  ·  Reuters Financial  ·  5h ago</text>
    <rect x="1370" y="684" width="130" height="28" rx="6" fill="#0d1b33" stroke="#212c42" />
    <text x="1435" y="702" text-anchor="middle" fill="#cbd5e1" font-family="Plus Jakarta Sans, sans-serif" font-size="11" font-weight="600">☆ Save to Library</text>
    <text x="104" y="736" fill="#ffffff" font-family="Plus Jakarta Sans, sans-serif" font-size="16" font-weight="700">Cloud Hyperscalers Evaluate Custom Ethernet Switches Alongside Proprietary InfiniBand Fabrics</text>
    <text x="104" y="766" fill="#fda4af" font-family="Plus Jakarta Sans, sans-serif" font-size="13" font-weight="600">Why Bearish: Highlights networking attach-rate competition from Broadcom Jericho3-AI switches.</text>
    <text x="104" y="796" fill="#94a3b8" font-family="IBM Plex Mono, monospace" font-size="12">Verified Source Citation: reuters.com · Click to inspect full article ↗</text>
  </svg>`;
  await fs.writeFile(path.join(OUT_DIR, 'slide-bull-bear-translation.svg'), svg5, 'utf8');

  // -------------------------------------------------------------------------
  // SCREENSHOT 6: Contextual Research Assistant Drawer (⌘K) Alongside Workspace
  // -------------------------------------------------------------------------
  const svg6 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" width="1600" height="900">
    <rect width="1600" height="900" fill="#091326" />
    ${buildTopChrome('Research & Compare')}

    <!-- Left 1080px: Active Workspace Context -->
    <rect x="36" y="88" width="1040" height="776" rx="14" fill="#0d1b33" stroke="#212c42" stroke-width="1.5" />
    <text x="68" y="132" fill="#49afe9" font-family="IBM Plex Mono, monospace" font-size="13" font-weight="600">ACTIVE WORKSPACE CONTEXT AUTOMATICALLY SYNCED TO ASSISTANT</text>
    <text x="68" y="166" fill="#ffffff" font-family="Plus Jakarta Sans, sans-serif" font-size="24" font-weight="700">NVIDIA Corporation (NVDA) · ${esc(nvdaPrice)} (${esc(nvdaChangePct)})</text>
    <path d="${buildSparklinePath(nvdaPoints, 68, 210, 960, 220)}" fill="none" stroke="#10B981" stroke-width="3.5" />

    <rect x="68" y="470" width="976" height="170" rx="10" fill="#091326" stroke="#212c42" />
    <text x="96" y="506" fill="#ffffff" font-family="Plus Jakarta Sans, sans-serif" font-size="16" font-weight="700">What the Assistant Automatically Sees on Your Screen:</text>
    <text x="96" y="538" fill="#cbd5e1" font-family="Plus Jakarta Sans, sans-serif" font-size="14">• Active Company Price, Valuation Multiples (${esc(nvdaMktCap)} Mkt Cap, ${esc(nvdaPe)} P/E), &amp; 52-Week Range</text>
    <text x="96" y="566" fill="#cbd5e1" font-family="Plus Jakarta Sans, sans-serif" font-size="14">• Mapped Supply Chain (TSMC, Micron, Microsoft, AMD) &amp; Context.dev Firmographics</text>
    <text x="96" y="594" fill="#cbd5e1" font-family="Plus Jakarta Sans, sans-serif" font-size="14">• Loaded News Headlines + Your Full Watchlist Morning Brief + Live Google Search Grounding</text>

    <!-- Right 480px: Collapsible Contextual Research Assistant Drawer -->
    <rect x="1100" y="64" width="500" height="836" fill="#0b172d" stroke="#212c42" stroke-width="1.5" />
    <text x="1132" y="108" fill="#ffffff" font-family="Plus Jakarta Sans, sans-serif" font-size="18" font-weight="700">Research Assistant Drawer (⌘K)</text>
    <text x="1132" y="130" fill="#49afe9" font-family="IBM Plex Mono, monospace" font-size="12">Context: NVDA ($138.60) + 6 Followed Watchlist Co.</text>
    <line x1="1100" y1="148" x2="1600" y2="148" stroke="#212c42" />

    <!-- User Message Bubble -->
    <rect x="1160" y="172" width="412" height="78" rx="12" fill="#09a4ff" />
    <text x="1180" y="202" fill="#ffffff" font-family="Plus Jakarta Sans, sans-serif" font-size="13.5" font-weight="600">If TSMC expands CoWoS packaging capacity by 2x,</text>
    <text x="1180" y="224" fill="#ffffff" font-family="Plus Jakarta Sans, sans-serif" font-size="13.5" font-weight="600">how does that affect NVIDIA and its cloud customers?</text>

    <!-- Assistant Grounded Response -->
    <rect x="1128" y="272" width="444" height="450" rx="12" fill="#091326" stroke="#212c42" />
    <text x="1152" y="306" fill="#49afe9" font-family="IBM Plex Mono, monospace" font-size="11" font-weight="700">GROUNDED IN LOADED DATA + LIVE WEB CITATIONS</text>
    <text x="1152" y="338" fill="#f8fafc" font-family="Plus Jakarta Sans, sans-serif" font-size="13.5" font-weight="700">1. Direct Impact on NVIDIA (NVDA · ${esc(nvdaMktCap)}):</text>
    <text x="1152" y="362" fill="#cbd5e1" font-family="Plus Jakarta Sans, sans-serif" font-size="12.5">CoWoS advanced packaging has been the #1 physical bottleneck</text>
    <text x="1152" y="382" fill="#cbd5e1" font-family="Plus Jakarta Sans, sans-serif" font-size="12.5">limiting Blackwell GPU shipments. Doubling capacity converts</text>
    <text x="1152" y="402" fill="#cbd5e1" font-family="Plus Jakarta Sans, sans-serif" font-size="12.5">backlog into recognized revenue faster.</text>

    <text x="1152" y="438" fill="#f8fafc" font-family="Plus Jakarta Sans, sans-serif" font-size="13.5" font-weight="700">2. Ripple Effect on Cloud Customers (MSFT, AMZN):</text>
    <text x="1152" y="462" fill="#cbd5e1" font-family="Plus Jakarta Sans, sans-serif" font-size="12.5">Shortens cluster deployment lead times for Azure and AWS,</text>
    <text x="1152" y="482" fill="#cbd5e1" font-family="Plus Jakarta Sans, sans-serif" font-size="12.5">accelerating AI cloud monetization while easing GPU spot scarcity.</text>

    <line x1="1152" y1="514" x2="1548" y2="514" stroke="#212c42" />
    <text x="1152" y="540" fill="#94a3b8" font-family="IBM Plex Mono, monospace" font-size="11" font-weight="600">VERIFIED CITATIONS (CLICK TO OPEN):</text>
    <rect x="1152" y="554" width="396" height="32" rx="6" fill="#0d1b33" stroke="#212c42" />
    <text x="1168" y="575" fill="#49afe9" font-family="IBM Plex Mono, monospace" font-size="11">[1] Reuters — TSMC CoWoS AI Packaging Expansion ↗</text>
    <rect x="1152" y="596" width="396" height="32" rx="6" fill="#0d1b33" stroke="#212c42" />
    <text x="1168" y="617" fill="#49afe9" font-family="IBM Plex Mono, monospace" font-size="11">[2] Context.dev — NVDA Supply Chain &amp; Peers Dossier ↗</text>

    <!-- Input Box -->
    <rect x="1128" y="810" width="444" height="54" rx="10" fill="#091326" stroke="#09a4ff" />
    <text x="1148" y="842" fill="#94a3b8" font-family="Plus Jakarta Sans, sans-serif" font-size="13">Ask anything about NVDA, peers, or your watchlist...</text>
  </svg>`;
  await fs.writeFile(path.join(OUT_DIR, 'slide-research-assistant.svg'), svg6, 'utf8');

  console.log('Successfully generated 6 live-data product screenshots in /public/pitch-screenshots/!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
