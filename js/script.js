/*****************

ChartYourMusic

@author GiraffeKey and sorwu

******************/

// Array for the chart list
let charts = [];

// Handle for the selected chart
let chart;

// Index of selected chart
let chartIndex;

// Helps with dynamic reordering during drag & drop
let dragIndex = -1;

// Helps with fix for when there's too many titles
let maxHeight = false;

/**
 * For options dropdown visuals
 */
function optionsArrow() {
  let arrow = $('#optionsArrow');
  if (arrow.html() === 'Options ▼') arrow.html('Options ▲');
  else arrow.html('Options ▼');
}

/**
 * Resize images in #results and #charts to keep them square
 */
function resize() {
  let w = $('#results').width() / 2;
  if (w > 0) $('.result').css({ height: w });
  updateTitlesHeight();
  refreshDeleteButtons();
}

function updateTitlesHeight() {
  const $titles = $('#titles');
  const titlesEl = $titles[0];
  const chartEl = document.getElementById('chart');
  const chartH = chartEl.offsetHeight;
  if (chartH <= 0) return;

  $titles.css({ height: chartH + 'px', position: 'relative' });

  const $items = $titles.find('.title');
  const n = $items.length;
  if (n === 0) return;

  const style = getComputedStyle(titlesEl);
  const pt = parseFloat(style.paddingTop) || 0;
  const fs = parseFloat(style.fontSize) || 12;

  $titles.css('justify-content', 'flex-start');

  // Lay out titles across the region from the TOP of the first titled tile to
  // the BOTTOM of the last titled tile (tile sizes differ a lot between tiers).
  // Titles fill that region, with EXTRA space at every row boundary so they
  // group by row. If those gaps would push the list past the bottom, the font
  // is shrunk so everything still fits. Matches the server (CHART_W / 64).
  const allTiles = document.querySelectorAll('#chart img.tile');
  const titlesTop = titlesEl.getBoundingClientRect().top;

  const items = $items.toArray();
  const rowKeys = [];
  let top = pt;
  let bottom = chartH;
  items.forEach((el, k) => {
    const tile = allTiles[parseInt(el.dataset.tileIndex)];
    if (!tile) { rowKeys[k] = -k - 1; return; }
    const r = tile.getBoundingClientRect();
    rowKeys[k] = Math.round(r.top - titlesTop);
    if (k === 0) top = r.top - titlesTop;
    if (k === items.length - 1) bottom = r.bottom - titlesTop;
  });
  const H = bottom - top;

  let transitions = 0;
  for (let k = 1; k < n; k++) if (rowKeys[k] !== rowKeys[k - 1]) transitions++;

  const GAP = 0.6;
  const W = (n - 1) + GAP * transitions;
  let titleFs = Math.max(6, chartEl.offsetWidth / 64);
  let lineH = Math.round(titleFs * 1.35);
  if (n > 1) {
    const maxLineH = H / (W + 1);
    if (lineH > maxLineH) {
      lineH = maxLineH;
      titleFs = lineH / 1.35;
    }
  }

  const s = n > 1 ? (H - lineH) / W : 0;
  const E = s * GAP;
  let y = n > 1 ? top + lineH / 2 : (top + bottom) / 2;
  items.forEach((el, k) => {
    if (k > 0) {
      y += s;
      if (rowKeys[k] !== rowKeys[k - 1]) y += E;
    }
    el.style.fontSize = titleFs + 'px';
    el.style.lineHeight = lineH + 'px';
    el.style.height = lineH + 'px';
    el.style.position = 'absolute';
    el.style.top = (y - lineH / 2) + 'px';
    el.style.left = '0';
  });

  if (chart && !chart.options.grid && chart.options.titles && n > 0) {
    if (dragIndex !== -1) return;

    const containerEl = document.getElementById('chartContainer');

    titlesEl.style.flex = '0 0 auto';
    titlesEl.style.maxWidth = 'none';

    const canvasCtx = document.createElement('canvas').getContext('2d');
    canvasCtx.font = `${titleFs}px ${style.fontFamily}`;
    const padRight = parseFloat(style.paddingRight) || 0;

    let maxTextW = 0;
    $items.each(function () {
      const tw = Math.ceil(canvasCtx.measureText(this.value).width) + 6;
      this.style.width = tw + 'px';
      if (tw > maxTextW) maxTextW = tw;
    });

    // Explicitly set #titles width since children are absolute-positioned
    titlesEl.style.width = (maxTextW + padRight) + 'px';

    const scrollWrapper = document.getElementById('chartScrollWrapper');
    const chartW = (scrollWrapper && window.innerWidth <= 767)
      ? scrollWrapper.offsetWidth
      : chartEl.offsetWidth;

    containerEl.style.width = (chartW + maxTextW + padRight) + 'px';
  } else if (chart) {
    titlesEl.style.flex = '';
    titlesEl.style.maxWidth = '';
    titlesEl.style.width = '';
  }
}

/**
 * Ajax request
 * @param {String} url
 * @param {Function} success
 */
function xhrGet(url, success) {
  let http = new XMLHttpRequest();
  http.onreadystatechange = function () {
    if (this.readyState == 4 && this.status == 200) {
      success(this.responseText);
    }
  };
  http.open('GET', url);
  http.send();
}

function checkEnter() {
  $('#album, #artist').on('keypress', function (e) {
    if (e.which === 13) {
      getAlbums();
    }
  });
  $('#chartName').on('keypress', function (e) {
    if (e.which === 13) {
      $('#btnCreate').click();
    }
  });
}

/**
 * Fill #results with album covers based on search terms
 */
/**
 * Makes a search-result <img> draggable onto the chart tiles.
 * Shared by the album search and the custom-URL result so the drag behaviour
 * (helper sizing + scroll-aware clamping) stays in one place.
 */
function makeResultDraggable(img) {
  $(img).draggable({
    appendTo: 'body',
    zIndex: 10,
    helper: 'clone',
    scroll: false,
    start: (e, ui) => {
      let ref = document.querySelector('.tile-3') || document.querySelector('.tile');
      let size = ref ? ref.offsetWidth : Math.round($('#chart').width() * 0.1);
      $(ui.helper).css({ width: size, height: size });
    },
    drag: (e, ui) => {
      const r = document.getElementById('results').getBoundingClientRect();
      const hH = ui.helper.height();
      // ui.position is in DOCUMENT coords (appendTo body), so the viewport
      // bounds must be shifted by the page scroll offset — otherwise, once the
      // page is scrolled (e.g. 100-tile charts), the helper gets clamped near
      // the top of the document and can't reach the lower tiles.
      const sx = window.scrollX, sy = window.scrollY;
      // Left bound: results left edge; right: unconstrained (matches results width)
      if (ui.position.left < r.left + sx) ui.position.left = r.left + sx;
      // Vertical: keep within the visible window
      if (ui.position.top < sy) ui.position.top = sy;
      if (ui.position.top + hH > sy + window.innerHeight)
        ui.position.top = sy + window.innerHeight - hH;
    }
  });
}

function getAlbums() {
  let artist = $('#artist').val();
  let album = $('#album').val();
  $('#results').html('');
  // Last.fm's album.search takes a single query string, so combine the two
  // fields (this matches how Topsters 3 searches — one Last.fm album query).
  let query = [album, artist].map(s => (s || '').trim()).filter(Boolean).join(' ');
  if (!query) return;
  // Avoids duplicate urls in results
  let sourceList = [];
  // Proxied Last.fm album.search (see api/lastfm-search.js)
  xhrGet(`/api/lastfm-search?q=${encodeURIComponent(query)}`, (resp) => {
    let albums;
    try {
      albums = JSON.parse(resp).results.albummatches.album || [];
    } catch (_) {
      albums = [];
    }
    albums.forEach((al) => {
      // Cover = last image entry (extralarge); skip results without a cover.
      const imgs = al.image || [];
      let source = imgs.length ? imgs[imgs.length - 1]['#text'] : '';
      if (!source || sourceList.includes(source)) return;
      sourceList.push(source);
      let img = document.createElement('img');
      img.src = source;
      img.title = [al.artist, al.name].filter(Boolean).join(' - ');
      img.className = 'result';
      makeResultDraggable(img);
      $(img).css({ height: $('#results').width() / 2 });
      $('#results').append(img);
    });
  });
}

/**
 * Sends chart data to the server and downloads the generated image
 * @param {String} ext - png or jpg
 */
async function chartToImage(ext) {
  const btn = document.getElementById('downloadBtn');
  const origHTML = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm mr-1" role="status" aria-hidden="true"></span>Generating...';
  }

  try {
    const tileCount = chart.options.grid
      ? chart.options.rows * chart.options.cols
      : chart.options.length;

    const sources = chart.sources.slice(0, tileCount).map(src => {
      if (!src || src.includes('blank.png') || src.startsWith('assets/')) return '';
      if (/^https?:\/\//.test(src)) return src;
      return new URL(src, window.location.href).href;
    });

    const payload = {
      chart: {
        name: chart.name,
        sources,
        titles: chart.titles.slice(0, tileCount),
        options: Object.assign({}, chart.options)
      },
      format: ext
    };

    const resp = await fetch('/api/generate-chart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) throw new Error('Server error ' + resp.status);
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (chart.name || 'chart') + '.' + ext;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    alert('画像の生成に失敗しました: ' + e.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origHTML;
    }
  }
}

/**
 * Switch mobile tab panels
 */
function mobileTab(panel) {
  $('.mobile-panel').removeClass('mobile-panel-active');
  $('#tab' + panel.charAt(0).toUpperCase() + panel.slice(1)).addClass('mobile-panel-active');
  $('.mobile-tab').removeClass('mobile-tab-active');
  event.currentTarget.classList.add('mobile-tab-active');
  if (panel === 'options') {
    $('#options').addClass('show');
  }
  if (panel === 'search') {
    // Recalculate result image sizes now that panel is visible
    setTimeout(resize, 0);
  }
}


/**
 * Add custom image URL to results as a draggable element
 */
function addCustomImage() {
  let url = $('#customImageURL').val().trim();
  if (!url) return;
  let artist = $('#customArtist').val().trim();
  let album = $('#customAlbum').val().trim();
  let title = [artist, album].filter(Boolean).join(' - ');

  $('#results').html('');

  let img = document.createElement('img');
  img.src = url;
  img.title = title;
  img.className = 'result';
  makeResultDraggable(img);
  $(img).css({ height: $('#results').width() / 2 });
  $('#results').append(img);
}

/**
 * Returns display width of a string, counting full-width CJK characters as 2
 */
function getDisplayWidth(str) {
  let width = 0;
  for (const char of str) {
    const code = char.codePointAt(0);
    if (
      (code >= 0x1100 && code <= 0x115F) ||
      (code >= 0x2E80 && code <= 0x303E) ||
      (code >= 0x3041 && code <= 0x33FF) ||
      (code >= 0x3400 && code <= 0x4DBF) ||
      (code >= 0x4E00 && code <= 0x9FFF) ||
      (code >= 0xA000 && code <= 0xA4CF) ||
      (code >= 0xAC00 && code <= 0xD7AF) ||
      (code >= 0xF900 && code <= 0xFAFF) ||
      (code >= 0xFE10 && code <= 0xFE19) ||
      (code >= 0xFE30 && code <= 0xFE6F) ||
      (code >= 0xFF01 && code <= 0xFF60) ||
      (code >= 0xFFE0 && code <= 0xFFE6)
    ) {
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
}

/**
 * Rearranges the artwork and titles for visible chart
 */
function repaintChart() {
  let images = $('#chart img');
  for (let i = 0; i < images.length; i++) {
    images.get(i).src = chart.sources[i];
  }

  // During tile drag: only update image sources (done above). Rebuilding #titles
  // here would reset input widths to overestimated em values, momentarily shrinking
  // #chart before updateTitlesHeight can correct it. Full rebuild happens in stop.
  if (dragIndex !== -1) return;

  let height = $('#chartContainer').height();

  $('#titles').html('');
  for (let i = 0; i < images.length; i++) {
    if (chart.titles[i] && chart.titles[i].length > 0) {
      let input = document.createElement('input');
      input.type = 'text';
      input.className = 'title';
      input.dataset.tileIndex = i;
      input.value = chart.titles[i];
      let w = getDisplayWidth(input.value);
      input.style.width = (w * 0.55 + 1) + 'em';
      $(input).change(((idx) => (e) => {
        chart.titles[idx] = e.target.value;
        setTimeout(updateTitlesHeight, 0);
      })(i));
      $('#titles').append(input);
    }
  }

  if ($('#chartContainer').height() > height && !maxHeight) {
    $('#chart').css({ maxHeight: height });
    maxHeight = true;
  }

  setTimeout(updateTitlesHeight, 0);
  // After the deferred title layout settles (it can change #chart's width and
  // thus tile positions), reposition the delete buttons.
  setTimeout(refreshDeleteButtons, 0);
  storeToJSON();
}

/**
 * Adds a delete button to the top-right of each filled tile (like Topsters 3).
 * Desktop: revealed on hover; touch screens: always shown — both handled in CSS.
 * Clicking clears that tile's album art AND its linked title.
 *
 * The buttons are absolutely-positioned siblings inserted right after each
 * filled tile inside #chart (which is position:relative). They're taken out of
 * flex flow, so tile wrapping is unaffected, and `#chart img` still selects
 * only the tiles, so index-based lookups elsewhere keep working.
 */
function refreshDeleteButtons() {
  const chartEl = document.getElementById('chart');
  if (!chartEl) return;
  chartEl.querySelectorAll('.tile-delete').forEach((b) => b.remove());
  // No buttons mid-drag — they'd steal elementFromPoint hits during touch drag.
  if (dragIndex !== -1) return;
  const tiles = chartEl.querySelectorAll('img.tile');
  tiles.forEach((tile, i) => {
    const src = chart.sources[i] || '';
    if (!src || src.includes('blank.png') || src.startsWith('assets/')) return;
    const w = tile.offsetWidth;
    if (w <= 0) return;
    // Inset by the tile's own (inner) padding so the button sits on the cover.
    const pad = parseFloat(getComputedStyle(tile).paddingLeft) || 0;
    const size = Math.max(13, Math.min(Math.round(w * 0.26), 30));
    const gap = Math.max(2, Math.round(size * 0.14));
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tile-delete';
    btn.title = 'Delete';
    btn.setAttribute('aria-label', 'Delete');
    btn.innerHTML = '&times;';
    btn.style.width = size + 'px';
    btn.style.height = size + 'px';
    btn.style.fontSize = Math.round(size * 0.8) + 'px';
    btn.style.left = (tile.offsetLeft + tile.offsetWidth - pad - size - gap) + 'px';
    btn.style.top = (tile.offsetTop + pad + gap) + 'px';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      chart.sources[i] = 'assets/images/blank.png';
      chart.titles[i] = '';
      repaintChart();
    });
    tile.insertAdjacentElement('afterend', btn);
  });
}

/**
 * Generates tiles in #chart when tile amount changes
 */
function generateChart() {
  let innerHTML = '';
  let length = chart.options.grid
    ? chart.options.rows * chart.options.cols
    : chart.options.length;
  for (let i = 0; i < length; i++) {
    // Makes tiles get smaller as they go down unless chart is in a grid
    let tile_n = 'tile-1';
    if (!chart.options.grid) {
      // For 100 tiles: each size tier spans exactly 3 rows
      const tile3Start = (length === 100) ? 28 : 22;
      const tile4Start = (length === 100) ? 58 : 52;
      if (i >= tile4Start) tile_n = 'tile-4';
      else if (i >= tile3Start) tile_n = 'tile-3';
      else if (i >= 10) tile_n = 'tile-2';
    }

    innerHTML += `<img class="tile ${tile_n}" src="${chart.sources[i]}"`;
    if (tile_n === 'tile-1')
      innerHTML += ` style="width: ${
        chart.options.grid ? 100 / chart.options.cols : 20
      }%"`;
    innerHTML += '>';
  }
  $('#chart').html(innerHTML);

  // Clear tile on double click
  $('.tile').dblclick(function (e) {
    let index = $('#chart img').index(e.target);
    chart.sources[index] = 'assets/images/blank.png';
    chart.titles[index] = '';
    repaintChart();
  });

  $('.tile').droppable({
    accept: '.ui-draggable',
    // Search result? set source and title of tile
    // Another tile? create visual drop effect
    drop: (e, ui) => {
      let images = $('#chart img');
      if ($(ui.draggable).hasClass('result')) {
        let index = images.index(e.target);
        chart.sources[index] = $(ui.draggable).attr('src');
        chart.titles[index] = $(ui.draggable).attr('title');
        repaintChart();
      } else if ($(ui.draggable).hasClass('tile')) {
        e.target.style.opacity = 1;
        // dragIndex reset + full layout cleanup happen in draggable stop callback
      }
    },
    // Dynamically rearranges chart during hover
    over: (e, ui) => {
      let images = $('#chart img');
      if ($(ui.draggable).hasClass('tile')) {
        // Moves source image into position mouse is hovering over
        // dragIndex is necessary because location of source image changes
        if (dragIndex === -1) dragIndex = images.index(ui.draggable);
        let moveto = images.index(e.target);
        let src = chart.sources.splice(dragIndex, 1)[0];
        chart.sources.splice(moveto, 0, src);
        let title = chart.titles.splice(dragIndex, 1)[0];
        chart.titles.splice(moveto, 0, title);
        dragIndex = moveto;
        repaintChart();
        // Makes sure dragged image doesn't change its source
        $(ui.helper).attr('src', src);
        // Create illusion of a blank drop space
        e.target.style.opacity = 0;
      }
    },
    // Removes blank space when not hovering over
    out: (e, ui) => {
      if ($(ui.draggable).hasClass('tile')) e.target.style.opacity = 1;
    }
  });

  // Touch devices: long-press drag is handled by setupTileLongPressDrag()
  // Desktop: use jQuery UI draggable with mouse
  if (!('ontouchstart' in window)) {
    $('.tile').draggable({
      // If not appended to body $('#chart img') will include dragged clone
      appendTo: 'body',
      zIndex: 10,
      helper: 'clone',
      start: (e, ui) => {
        $(ui.helper).css({
          width: e.target.offsetWidth,
          height: e.target.offsetHeight
        });
        // Hide delete buttons while dragging; rebuilt on drop via repaintChart.
        document.querySelectorAll('#chart .tile-delete').forEach((b) => b.remove());
      },
      stop: () => {
        // Always fires after drop (or when dropped on a non-droppable area).
        // Reset dragIndex and inline styles, then repaint so titles are rebuilt
        // with correct order and updateTitlesHeight can set the container width.
        dragIndex = -1;
        const titlesEl = document.getElementById('titles');
        const containerEl = document.getElementById('chartContainer');
        if (titlesEl) { titlesEl.style.flex = ''; titlesEl.style.maxWidth = ''; }
        if (containerEl) containerEl.style.width = '';
        repaintChart();
      }
    });
  }

  resize();
  outerPadding();
  innerPadding();
  // Rebuild the titles list for the new tile count: repaintChart() only creates
  // inputs for i < current tile count, so titles for tiles hidden by a smaller
  // count drop off, and they come back (from chart.titles) when the count grows
  // again — mirroring how the tiles themselves persist. It also handles the
  // deferred title layout, delete-button refresh, and storeToJSON.
  repaintChart();
}

/**
 * Create a new chart and add to list
 */
function newChart() {
  charts.push({
    name: $('#chartName').val(),
    sources: [],
    titles: [],
    options: {
      grid: false,
      rows: 3,
      cols: 3,
      length: 42,
      outerPadding: 10,
      innerPadding: 4,
      titles: false,
      font: 'Arial',
      background: ''
    }
  });

  for (let i = 0; i < 144; i++) {
    charts[charts.length - 1].sources.push('assets/images/blank.png');
    charts[charts.length - 1].titles.push('');
  }

  $(chartItemString(charts[charts.length - 1].name)).insertBefore(
    '#createChart'
  );
  loadChart(charts.length - 1);
}

/**
 * Change active chart data
 * @param {Number} index
 */
function loadChart(index) {
  if (chartIndex > -1) charts[chartIndex] = chart;
  chart = charts[index];
  chartIndex = index;

  storeToJSON();

  $('.chart-item.selected input[type=checkbox]').prop('checked', false);
  $('.chart-item.selected').removeClass('selected');
  $($('.chart-item').get(chartIndex)).addClass('selected');
  $('.chart-item.selected input[type=checkbox]').prop('checked', true);

  if (chart.options.grid) {
    $('#gridRadio').prop('checked', true);
  } else {
    $('#collageRadio').prop('checked', true);
  }

  $('#rows').val(chart.options.rows);
  $('#cols').val(chart.options.cols);
  $('#rowsNum').html(chart.options.rows);
  $('#colsNum').html(chart.options.cols);
  $('#tiles').val(chart.options.length);
  $('#outerPadding').val(chart.options.outerPadding);
  $('#innerPadding').val(chart.options.innerPadding);

  $('#titleToggle').prop('checked', chart.options.titles);
  if (!chart.options.titles) {
    $('#titles').hide();
  }

  $('#fonts').val(chart.options.font);
  $('#background').val(chart.options.background);

  chartType(chart.options.grid);
  changeFont();
  background();
  repaintChart();
}

/**
 * Save data to localStorage
 */
function storeToJSON() {
  charts[chartIndex] = chart;
  localStorage.setItem(
    'chartStorage',
    JSON.stringify({ charts, index: chartIndex })
  );
}

/**
 * Download chart data as json file
 */
function exportToJSON() {
  let file = new Blob([JSON.stringify(chart)], { type: 'json' });
  let filename = chart.name.toLowerCase().replace(/\s/g, '-') + '.json';
  if (window.navigator.msSaveOrOpenBlob) {
    // Internet Explorer
    window.navigator.msSaveOrOpenBlob(file, filename);
  } else {
    // Actual web browsers
    let a = document.createElement('a');
    let url = URL.createObjectURL(file);
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }
}

/**
 * Import chart data from file
 */
function importFromJSON() {
  xhrGet(URL.createObjectURL($('#jsonImport').get(0).files[0]), (resp) => {
    charts.push(JSON.parse(resp));
    $(chartItemString(charts[charts.length - 1].name)).insertBefore(
      '#createChart'
    );
    loadChart(charts.length - 1);
  });
}

/**
 * Generate chart images from RateYourMusic data
 */
function importFromRYM() {
  xhrGet(URL.createObjectURL($('#csvImport').get(0).files[0]), (resp) => {
    resp = resp.replace(/""/g, '0');
    resp = resp.replace(
      'RYM Album, First Name,Last Name,First Name localized, Last Name localized,Title,Release_Date,Rating,Ownership,Purchase Date,Media Type,Review',
      'RYM_Album,First_Name,Last_Name,First_Name_Localized,Last_Name_Localized,Title,Release_Date,Rating,Ownership,Purchase_Date,Media_Type,Review'
    );
    let userData = $.csv.toObjects(resp);
    userData = userData.sort((obj1, obj2) => obj2.Rating - obj1.Rating);
    let length =
      2 *
      (chart.options.grid
        ? chart.options.rows * chart.options.cols
        : chart.options.length);
    for (let i = 0; i < length; i++) {
      let obj = userData[i];
      let artist =
        (obj.First_Name == 0 ? '' : obj.First_Name + ' ') + obj.Last_Name;
      let query = 'release:' + obj.Title + ' AND artist:' + artist;
      window.setTimeout(
        xhrGet,
        1000 * i,
        `https://musicbrainz.org/ws/2/release?query=${query}&limit=40?inc=artist-credit&fmt=json`,
        (resp) => {
          let release = JSON.parse(resp).releases.find(
            (release) => release.title == obj.Title
          );
          if (release) {
            xhrGet(
              'https://coverartarchive.org/release/' + release['id'],
              (resp) => {
                let index = chart.sources.indexOf('assets/images/blank.png');
                if (index > -1 && index < 144) {
                  chart.sources[index] = JSON.parse(resp)
                    .images.find((img) => img.front)
                    ['image'].replace('http:/', 'https:/');
                  chart.titles[index] = artist + ' - ' + obj.Title;
                }
                repaintChart();
              }
            );
          }
        }
      );
    }
  });
}

/**
 * Upload image and title data to first blank space
 */
function importFromImage() {
  let index = chart.sources.indexOf('assets/images/blank.png');
  chart.sources[index] = $('#imgImportFileRadio').prop('checked')
    ? URL.createObjectURL($('#imgImportFile').get(0).files[0])
    : $('#imgImportURL').val();
  chart.titles[index] = $('#imgTitle').val();
  repaintChart();
}

/**
 * Switch between custom image import modes
 * @param {Boolean} file - File or URL?
 */
function imgImportMode(file) {
  if (file) {
    $('#imgImportFileDiv').show();
    $('#imgImportURLDiv').hide();
  } else {
    $('#imgImportURLDiv').show();
    $('#imgImportFileDiv').hide();
  }
}

/**
 * Changes between grid and collage display mode
 * @param {Boolean} grid
 */
function chartType(grid) {
  if (grid) {
    $('#chartContainer').css({
      width:
        (chart.options.titles
          ? 100
          : Math.min(100, 40 + 10 * chart.options.cols)) + '%'
    });
    $('#chartSize').show();
    $('#chartLength').hide();
  } else {
    $('#chartContainer').css({ width: '100%' });
    $('#chartSize').hide();
    $('#chartLength').show();
  }
  chart.options.grid = grid;
  generateChart();
}

/**
 * Change rows and cols amount when in grid mode
 */
function chartSize() {
  let rows = $('#rows').val();
  let cols = $('#cols').val();
  chart.options.rows = rows;
  $('#rowsNum').html(rows);
  chart.options.cols = cols;
  $('#colsNum').html(cols);
  chartType(true);
}

/**
 * Change amount of tiles when in collage mode
 */
function chartLength() {
  const val = Math.min(100, Math.max(1, parseInt($('#tiles').val()) || 1));
  $('#tiles').val(val);
  chart.options.length = val;
  generateChart();
}

/**
 * Padding for #chart and #titles
 */
function outerPadding() {
  let padding = $('#outerPadding').val();
  chart.options.outerPadding = padding;
  // Use % so padding scales proportionally on any screen size
  const pct = (padding * 0.2) + '%';
  $('#chart').css({ padding: pct });
  $('#titles').css({ paddingTop: pct, paddingBottom: pct, paddingRight: pct });
  $('#outerPaddingNum').html(padding);
  setTimeout(updateTitlesHeight, 0);
}

/**
 * Padding between tiles
 */
function innerPadding() {
  let padding = $('#innerPadding').val();
  chart.options.innerPadding = padding;
  // Use % so gap between tiles scales with chart size
  $('#chart img').css({ padding: (padding * 0.15) + '%' });
  $('#innerPaddingNum').html(padding);
}

/**
 * Show or hide titles list
 */
function titleToggle() {
  $('#titles').toggle();
  chart.options.titles = !chart.options.titles;
  if (chart.options.grid) {
    if (chart.options.titles) $('#chartContainer').css({ width: '100%' });
    else
      $('#chartContainer').css({
        width: Math.min(100, 40 + 10 * chart.options.cols) + '%'
      });
  } else {
    // Collage mode: when hiding titles, restore full-width so the chart expands
    if (!chart.options.titles) $('#chartContainer').css({ width: '100%' });
  }
  resize();
  storeToJSON();
}

/**
 * Change font of titles list
 */
function changeFont() {
  chart.options.font = $('#fonts').val();
  $('#titles').css('font-family', $('#fonts').val() + ', sans-serif');
  storeToJSON();
}

/**
 * Background color or image of chart
 */
function background() {
  let val = $('#background').val().toLowerCase();
  if (val.includes('http') || val.includes('www')) {
    val = 'url(' + val + ')';
  }
  chart.options.background = val;
  $('#chartContainer').css('background', val);
  storeToJSON();
}

/**
 * For the color picker
 */
function backgroundColor() {
  let val = $('#colorPicker').val();
  chart.options.background = val;
  $('#background').val(val);
  $('#chartContainer').css('background', val);
  storeToJSON();
}

/**
 * Return chart-item html string
 */
function chartItemString(name) {
  return `
    <div class="chart-item d-flex flex-row justify-content-between align-items-center">
      <input type="checkbox" onclick="selectChart(event)">
      <input type="text" class="flex-grow-1 mx-2" value="${name}" disabled>
      <input 
        type="image" 
        class="mr-1 ml-auto" 
        src="assets/images/rename.svg" 
        onclick="renameChart(event)"
      >
      <input
        type="image"
        src="assets/images/delete.svg"
        onclick="
          $('#deleteTitle').html(
            'Are you sure you want to delete ' +
            $(event.target).siblings('input[type=text]').val() + '?'
          )
          $('#btnDelete').click(() => deleteChart(event));
        "
        data-toggle="modal"
        data-target="#deleteChartModal"
      >
    </div>
  `;
}

/**
 * Change name of selected chart
 */
function renameChart(e) {
  $(e.target)
    .siblings('input[type=text]')
    .removeAttr('disabled')
    .focus()
    .on('focusout change', (e) => {
      let input = e.target;
      $(input).attr('disabled', true);
      charts[$('.chart-item').index($(input).parent())].name = $(input).val();
      storeToJSON();
    });
}

/**
 * Remove chart from list
 */
function deleteChart(e) {
  let div = $(e.target).parent();
  let index = $('.chart-item').index(div);
  charts.splice(index, 1);
  if (charts.length > 0) {
    loadChart(Math.min(chartIndex, charts.length - 1));
  } else {
    chartIndex = -1;
    $('#createChart').click();
  }
  div.remove();
}

/**
 * Select and load a chart from the list
 */
function selectChart(e) {
  loadChart($('.chart-item').index($(e.target).parent()));
}

/**
 * Long-press-to-drag for tiles on touch screens.
 * Called once at document ready. Uses passive event listeners on #chart so
 * normal swipe-to-scroll is never blocked during the detection phase.
 * overflow:hidden on the scroll wrapper suppresses scroll once drag is active.
 */
function setupTileLongPressDrag() {
  var LONG_PRESS_MS = 400;
  var CANCEL_PX = 10;

  var timer = null;
  var activeTouchId = null;
  var startX = 0, startY = 0;
  var prevX = 0, prevY = 0;
  var helper = null;
  var draggingTile = null;

  function resetState() {
    clearTimeout(timer);
    timer = null;
    activeTouchId = null;
    draggingTile = null;
  }

  function endDrag() {
    if (helper) { document.body.removeChild(helper); helper = null; }
    document.querySelectorAll('#chart img.tile').forEach(function(img) {
      img.style.opacity = '';
    });
    var sw = document.getElementById('chartScrollWrapper');
    if (sw) sw.style.overflow = '';
    if (dragIndex !== -1) {
      dragIndex = -1;
      var titlesEl = document.getElementById('titles');
      var containerEl = document.getElementById('chartContainer');
      if (titlesEl) { titlesEl.style.flex = ''; titlesEl.style.maxWidth = ''; }
      if (containerEl) containerEl.style.width = '';
      repaintChart();
    }
    resetState();
  }

  var chartEl = document.getElementById('chart');
  if (!chartEl) return;

  chartEl.addEventListener('touchstart', function(e) {
    if (e.touches.length !== 1) { resetState(); return; }
    var t = e.touches[0];
    var tile = e.target.closest ? e.target.closest('img.tile') : null;
    if (!tile) return;

    activeTouchId = t.identifier;
    startX = prevX = t.clientX;
    startY = prevY = t.clientY;
    draggingTile = tile;

    timer = setTimeout(function() {
      timer = null;
      if (!draggingTile) return;
      var tiles = document.querySelectorAll('#chart img.tile');
      dragIndex = Array.prototype.indexOf.call(tiles, draggingTile);
      if (dragIndex < 0) { dragIndex = -1; return; }

      var rect = draggingTile.getBoundingClientRect();
      helper = document.createElement('img');
      helper.src = draggingTile.src;
      helper.style.cssText =
        'position:fixed;z-index:9999;pointer-events:none;object-fit:cover;' +
        'opacity:0.85;left:' + rect.left + 'px;top:' + rect.top + 'px;' +
        'width:' + rect.width + 'px;height:' + rect.height + 'px;' +
        'transform:scale(1.08);transition:transform 0.12s;';
      document.body.appendChild(helper);
      setTimeout(function() { if (helper) helper.style.transform = ''; }, 140);

      draggingTile.style.opacity = '0.2';
      // Clear delete buttons so they don't intercept elementFromPoint drops.
      refreshDeleteButtons();
      var sw = document.getElementById('chartScrollWrapper');
      if (sw) sw.style.overflow = 'hidden';
      if (window.navigator.vibrate) window.navigator.vibrate(30);
    }, LONG_PRESS_MS);
  }, { passive: true });

  chartEl.addEventListener('touchmove', function(e) {
    var t = null;
    for (var i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === activeTouchId) { t = e.changedTouches[i]; break; }
    }
    if (!t) return;

    if (!helper) {
      if (Math.hypot(t.clientX - startX, t.clientY - startY) > CANCEL_PX) resetState();
      return;
    }

    var dx = t.clientX - prevX;
    var dy = t.clientY - prevY;
    helper.style.left = (parseFloat(helper.style.left) + dx) + 'px';
    helper.style.top  = (parseFloat(helper.style.top)  + dy) + 'px';
    prevX = t.clientX;
    prevY = t.clientY;

    helper.style.visibility = 'hidden';
    var el = document.elementFromPoint(t.clientX, t.clientY);
    helper.style.visibility = '';
    var hovered = (el && el.matches && el.matches('img.tile')) ? el
                : (el && el.closest ? el.closest('img.tile') : null);

    if (hovered && hovered !== draggingTile) {
      var allTiles = document.querySelectorAll('#chart img.tile');
      var newIdx = Array.prototype.indexOf.call(allTiles, hovered);
      if (newIdx !== -1 && newIdx !== dragIndex) {
        var srcMoved   = chart.sources.splice(dragIndex, 1)[0];
        chart.sources.splice(newIdx, 0, srcMoved);
        var titleMoved = chart.titles.splice(dragIndex, 1)[0];
        chart.titles.splice(newIdx, 0, titleMoved);
        dragIndex = newIdx;
        repaintChart();
        if (helper) helper.src = chart.sources[dragIndex];
        draggingTile = document.querySelectorAll('#chart img.tile')[dragIndex];
        document.querySelectorAll('#chart img.tile').forEach(function(img, i) {
          img.style.opacity = i === dragIndex ? '0.2' : '';
        });
      }
    }
  }, { passive: true });

  function onTouchEnd(e) {
    var found = false;
    for (var i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === activeTouchId) { found = true; break; }
    }
    if (!found && !helper) { clearTimeout(timer); timer = null; return; }
    endDrag();
  }
  chartEl.addEventListener('touchend',   onTouchEnd, { passive: true });
  chartEl.addEventListener('touchcancel', onTouchEnd, { passive: true });
}

/**
 * Runs when window is ready
 */
$(() => {
  let data = JSON.parse(localStorage.getItem('chartStorage'));

  if (data) {
    charts = data.charts;
    let innerHTML = '';
    charts.forEach((item) => {
      innerHTML += chartItemString(item.name);
    });
    $('#chartList').prepend(innerHTML);
    loadChart(data.index);
  } else {
    $('#createChartModal').modal('show');
  }

  $('#imgImportURLDiv').hide();
  $('#imgImportFileRadio').prop('checked', true);
  window.onresize = resize;

  if ('ontouchstart' in window) setupTileLongPressDrag();
});
