const { createCanvas, loadImage } = require('@napi-rs/canvas');

const CHART_W = 1400;

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
  const { grid, rows, cols, length, outerPadding, innerPadding } = options;
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

  const layout = computeLayout(chart.options);
  const { positions, totalH, innerPad, tileCount, outerPad } = layout;

  // Title rendering setup
  const fontFamily = `"${chart.options.font || 'Arial'}", sans-serif`;
  const rawTitles = (chart.titles || []).slice(0, tileCount);
  const nonEmptyTitles = rawTitles.filter(t => t && t.length > 0);
  const showTitles = chart.options.titles && nonEmptyTitles.length > 0;

  let titleColW = 0;
  let fontSize = 14;
  let slotH = 0;

  if (showTitles) {
    const n = nonEmptyTitles.length;
    const contentH = totalH - 2 * outerPad;
    slotH = contentH / n;
    fontSize = Math.max(10, Math.min(Math.floor(slotH * 0.65), 28));

    const measureCtx = createCanvas(1, 1).getContext('2d');
    measureCtx.font = `${fontSize}px ${fontFamily}`;
    let maxW = 0;
    for (const t of nonEmptyTitles) {
      const w = measureCtx.measureText(t).width;
      if (w > maxW) maxW = w;
    }
    titleColW = Math.ceil(maxW) + 20;
  }

  const canvasW = CHART_W + titleColW;
  const canvas = createCanvas(canvasW, Math.ceil(totalH));
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
          ctx.drawImage(bgImg, 0, 0, canvasW, Math.ceil(totalH));
        }
      }
    } catch (_) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvasW, Math.ceil(totalH));
    }
  } else {
    ctx.fillStyle = bg || '#000000';
    ctx.fillRect(0, 0, canvasW, Math.ceil(totalH));
  }

  // Load tile images in parallel
  const images = await Promise.all(
    Array.from({ length: tileCount }, async (_, i) => {
      const src = (chart.sources && chart.sources[i]) || '';
      if (!src || src.includes('blank.png') || src.startsWith('assets/')) return null;
      try {
        const resp = await fetch(src, { signal: AbortSignal.timeout(8000) });
        if (!resp.ok) return null;
        const buf = Buffer.from(await resp.arrayBuffer());
        return await loadImage(buf);
      } catch (_) {
        return null;
      }
    })
  );

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
    let j = 0;
    for (let i = 0; i < tileCount; i++) {
      const t = rawTitles[i] || '';
      if (t.length === 0) continue;
      const ty = outerPad + slotH * j + slotH / 2;
      ctx.fillText(t, CHART_W + 10, ty);
      j++;
    }
  }

  const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
  const ext = format === 'jpg' ? 'jpg' : 'png';
  const buffer = format === 'jpg'
    ? await canvas.encode('jpeg', 90)
    : await canvas.encode('png');

  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${(chart.name || 'chart')}.${ext}"`);
  res.status(200).end(buffer);
};
