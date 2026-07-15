const path = require('path');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');

GlobalFonts.registerFromPath(
  path.join(__dirname, 'fonts', 'NotoSansJP-Regular.ttf'),
  'NotoSansJP'
);

const CHART_W = 2800;

// Coerce possibly-string / missing option values to a finite number.
function num(v, d) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function getTileWidthFraction(i, grid, cols, length) {
  if (grid) return 1 / cols;
  const tile3Start = length === 100 ? 28 : 22;
  const tile4Start = length === 100 ? 58 : 52;
  if (i >= tile4Start) return 1 / 14;
  if (i >= tile3Start) return 0.10;
  if (i >= 10) return 1 / 6;
  return 0.20;
}

function computeLayout(options) {
  // Sanitize: charts made by other users (or imported JSON) may carry option
  // values as strings, be missing, or be out of range. Bad numbers here would
  // produce a NaN/huge canvas and crash the render (500), so clamp them.
  const grid = !!options.grid;
  const rows = Math.min(12, Math.max(1, Math.floor(num(options.rows, 3))));
  const cols = Math.min(12, Math.max(1, Math.floor(num(options.cols, 3))));
  const length = Math.min(100, Math.max(1, Math.floor(num(options.length, 42))));
  const outerPadding = Math.max(0, num(options.outerPadding, 0));
  const innerPadding = Math.max(0, num(options.innerPadding, 0));
  const outerPad = (outerPadding * 0.2 / 100) * CHART_W;
  const tileCount = grid ? rows * cols : length;
  const contentW = CHART_W - 2 * outerPad;
  // innerPadding % is relative to parent width (contentW), same as browser CSS
  const innerPad = (innerPadding * 0.15 / 100) * contentW;

  const tileSizes = Array.from({ length: tileCount }, (_, i) => {
    const frac = getTileWidthFraction(i, grid, cols, length);
    // Tile % widths are relative to contentW (the flex container's inner width)
    const w = frac * contentW;
    return { w, h: w };
  });

  // Simulate flexbox flex-wrap: wrap; justify-content: center
  const rowGroups = [];
  let curRow = [];
  let curRowWidth = 0;

  for (let i = 0; i < tileCount; i++) {
    const tw = tileSizes[i].w;
    if (curRow.length > 0 && curRowWidth + tw > contentW + 0.5) {
      rowGroups.push({ tiles: curRow, totalW: curRowWidth });
      curRow = [];
      curRowWidth = 0;
    }
    curRow.push({ idx: i, w: tw, h: tileSizes[i].h });
    curRowWidth += tw;
  }
  if (curRow.length > 0) rowGroups.push({ tiles: curRow, totalW: curRowWidth });

  const positions = {};
  let y = outerPad;

  for (const row of rowGroups) {
    const offset = (contentW - row.totalW) / 2;
    let x = outerPad + offset;
    let rowH = 0;
    for (const t of row.tiles) {
      positions[t.idx] = { x, y, w: t.w, h: t.h };
      x += t.w;
      if (t.h > rowH) rowH = t.h;
    }
    y += rowH;
  }
  y += outerPad;

  return { positions, totalH: y, outerPad, innerPad, tileCount, contentW };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).end('Method Not Allowed');
    return;
  }

  let body = '';
  for await (const chunk of req) body += chunk;

  let data;
  try {
    data = JSON.parse(body);
  } catch (_) {
    res.status(400).end('Invalid JSON');
    return;
  }

  const { chart, format = 'png' } = data;
  if (!chart || !chart.options) {
    res.status(400).end('Missing chart data');
    return;
  }

  try {
  const layout = computeLayout(chart.options);
  const { positions, totalH, innerPad, tileCount, outerPad } = layout;

  // Title rendering setup — NotoSansJP covers Latin + Japanese
  const fontFamily = `NotoSansJP, sans-serif`;
  const rawTitles = (chart.titles || []).slice(0, tileCount);
  const nonEmptyTitles = rawTitles.filter(t => t && t.length > 0);
  const showTitles = chart.options.titles && nonEmptyTitles.length > 0;

  // Lay out titles across the region from the TOP of the first titled tile to
  // the BOTTOM of the last titled tile (tile sizes differ a lot between tiers,
  // so edge anchoring beats center anchoring). Titles fill that region, with
  // EXTRA space inserted wherever the tiles wrap to a new row so they group by
  // row and read more easily. If those gaps would push the list past the
  // bottom, the font is shrunk so everything still fits.
  let titleColW = 0;
  let fontSize = 14;
  let titleLayout = [];

  if (showTitles) {
    const titledIdx = [];
    for (let i = 0; i < tileCount; i++) {
      if (rawTitles[i] && positions[i]) titledIdx.push(i);
    }
    const N = titledIdx.length;
    const fp = positions[titledIdx[0]];
    const lp = positions[titledIdx[titledIdx.length - 1]];
    const top = fp.y;
    const bottom = lp.y + lp.h;
    const H = bottom - top;

    // Tiles in the same row share pos.y — count the row boundaries.
    const rowKeys = titledIdx.map(i => Math.round(positions[i].y));
    let transitions = 0;
    for (let k = 1; k < N; k++) if (rowKeys[k] !== rowKeys[k - 1]) transitions++;

    // Base font, then shrink only if the lines + row-boundary gaps would not
    // fit within H. GAP is the row-boundary gap as a fraction of in-row spacing.
    const GAP = 0.6;
    const W = (N - 1) + GAP * transitions;
    fontSize = Math.round(CHART_W / 64);
    let lineH = fontSize * 1.35;
    if (N > 1) {
      const maxLineH = H / (W + 1);
      if (lineH > maxLineH) {
        lineH = maxLineH;
        fontSize = lineH / 1.35;
      }
    }

    // Column width measured with the final font size (no horizontal squeeze).
    const measureCtx = createCanvas(1, 1).getContext('2d');
    measureCtx.font = `${fontSize}px ${fontFamily}`;
    let maxW = 0;
    for (const t of nonEmptyTitles) {
      const w = measureCtx.measureText(t).width;
      if (w > maxW) maxW = w;
    }
    titleColW = Math.ceil(maxW) + 40;

    // In-row spacing s, plus s*GAP extra at each row boundary; the total fills
    // [top + lineH/2, bottom - lineH/2] exactly (never overflows).
    const s = N > 1 ? (H - lineH) / W : 0;
    const E = s * GAP;
    let y = N > 1 ? top + lineH / 2 : (top + bottom) / 2;
    for (let k = 0; k < N; k++) {
      if (k > 0) {
        y += s;
        if (rowKeys[k] !== rowKeys[k - 1]) y += E;
      }
      titleLayout.push({ text: nonEmptyTitles[k], y });
    }
  }

  // Clamp to sane, finite dimensions so malformed option values can't ask for a
  // gigantic (or NaN) canvas that would OOM/crash the function.
  const canvasW = Math.min(6000, Math.max(1, Math.round(CHART_W + (Number.isFinite(titleColW) ? titleColW : 0))));
  const canvasH = Math.min(20000, Math.max(1, Math.ceil(Number.isFinite(totalH) ? totalH : 1)));
  const canvas = createCanvas(canvasW, canvasH);
  const ctx = canvas.getContext('2d');

  // Background
  const bg = chart.options.background || '';
  if (bg.startsWith('url(')) {
    try {
      const urlMatch = bg.match(/url\(["']?([^"')]+)["']?\)/);
      if (urlMatch) {
        const resp = await fetch(urlMatch[1], { signal: AbortSignal.timeout(8000) });
        if (resp.ok) {
          const buf = Buffer.from(await resp.arrayBuffer());
          const bgImg = await loadImage(buf);
          ctx.drawImage(bgImg, 0, 0, canvasW, canvasH);
        }
      }
    } catch (_) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvasW, canvasH);
    }
  } else {
    ctx.fillStyle = bg || '#000000';
    ctx.fillRect(0, 0, canvasW, canvasH);
  }

  // Build list of tile sources (empty string = blank tile)
  const tileSrcs = Array.from({ length: tileCount }, (_, i) => {
    const src = (chart.sources && chart.sources[i]) || '';
    if (!src || src.includes('blank.png') || src.startsWith('assets/')) return '';
    return src;
  });

  // Fetch each unique URL once (with retry), then map tiles back to results.
  // Deduplication avoids hammering the same URL dozens of times.
  // Batching by CONCURRENCY prevents rate-limit failures on Cover Art Archive.
  //
  // Everything runs against an overall deadline: other users' charts often
  // contain a slow, dead, or hotlink-blocked image URL, and without a global
  // budget a single one could burn the whole 30s function limit (504). Once the
  // budget is spent, remaining covers are simply left blank instead of failing
  // the entire download.
  const FETCH_DEADLINE_MS = 25000; // headroom under vercel.json maxDuration (30s)
  const startedAt = Date.now();
  const timeLeft = () => FETCH_DEADLINE_MS - (Date.now() - startedAt);

  async function fetchWithRetry(src) {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (timeLeft() <= 0) return null;
      if (attempt > 0) {
        await new Promise(r => setTimeout(r, Math.min(500, Math.max(0, timeLeft()))));
      }
      const budget = Math.min(8000, timeLeft());
      if (budget <= 0) return null;
      try {
        const resp = await fetch(src, { signal: AbortSignal.timeout(budget) });
        if (!resp.ok) {
          if (resp.status === 429 || resp.status >= 500) continue;
          return null;
        }
        return await loadImage(Buffer.from(await resp.arrayBuffer()));
      } catch (_) { /* timed out or errored — retry if budget remains */ }
    }
    return null;
  }

  const uniqueUrls = [...new Set(tileSrcs.filter(Boolean))];
  const imageCache = new Map();
  const CONCURRENCY = 10;
  for (let i = 0; i < uniqueUrls.length; i += CONCURRENCY) {
    if (timeLeft() <= 200) break; // out of budget — the rest render blank
    const batch = uniqueUrls.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(fetchWithRetry));
    results.forEach((img, j) => { if (img) imageCache.set(batch[j], img); });
  }
  const images = tileSrcs.map(src => imageCache.get(src) || null);

  // Draw tiles
  for (let i = 0; i < tileCount; i++) {
    const img = images[i];
    if (!img) continue;
    const pos = positions[i];
    if (!pos) continue;
    const dx = pos.x + innerPad;
    const dy = pos.y + innerPad;
    const dw = pos.w - 2 * innerPad;
    const dh = pos.h - 2 * innerPad;
    if (dw <= 0 || dh <= 0) continue;
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  // Draw titles
  if (showTitles) {
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    for (const lab of titleLayout) {
      ctx.fillText(lab.text, CHART_W + 10, lab.y);
    }
  }

  const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
  const ext = format === 'jpg' ? 'jpg' : 'png';
  const buffer = format === 'jpg'
    ? await canvas.encode('jpeg', 95)
    : await canvas.encode('png');

  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${(chart.name || 'chart')}.${ext}"`);
  res.status(200).end(buffer);
  } catch (err) {
    // Turn any unexpected failure into a clear 500 (and log it for the Vercel
    // dashboard) instead of an opaque platform crash.
    console.error('generate-chart failed:', (err && err.stack) || err);
    if (!res.headersSent) res.status(500).end('Chart render failed');
  }
};
