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
}

function updateTitlesHeight() {
  const $titles = $('#titles');
  const titlesEl = $titles[0];
  const chartH = document.getElementById('chart').offsetHeight;
  if (chartH <= 0) return;

  $titles.css('height', chartH + 'px');
  const $items = $titles.find('.title');
  const n = $items.length;
  if (n === 0) return;

  const style = getComputedStyle(titlesEl);
  const pt = parseFloat(style.paddingTop) || 0;
  const pb = parseFloat(style.paddingBottom) || 0;
  const fs = parseFloat(style.fontSize) || 12;
  const contentH = chartH - pt - pb;
  const slotH = contentH / n;

  $titles.css('justify-content', 'flex-start');
  if (slotH >= 8) {
    // Each title gets an equal slice — first aligns with first tile, last with last tile
    $items.css('height', slotH + 'px');
  } else {
    // Too many titles to fit: use natural height (some will be clipped)
    $items.css('height', '');
  }
}

/**
 * Ajax request
 * @param {String} url
 * @param {Function} success
 */
function fetch(url, success) {
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
function getAlbums() {
  let artist = $('#artist').val();
  let album = $('#album').val();
  $('#results').html('');
  // Avoids duplicate urls in results
  let sourceList = [];
  let query =
    (album ? 'release:' + album : '') +
    (album && artist ? ' AND ' : '') +
    (artist ? 'artist:' + artist : '');
  // Retrieve list of albums that match the search input
  fetch(
    `https://musicbrainz.org/ws/2/release?query=${query}&limit=40?inc=artist-credit&fmt=json`,
    (resp) => {
      let releases = JSON.parse(resp).releases;
      for (let i = 0; i < releases.length; i++) {
        let rel = releases[i];
        fetch('https://coverartarchive.org/release/' + rel['id'], (resp) => {
          JSON.parse(resp).images.forEach((image) => {
            let source = image['image'].replace('http:/', 'https:/');
            if (!sourceList.includes(source)) {
              let img = document.createElement('img');
              img.src = source;
              img.title =
                rel['artist-credit'][0]['name'] + ' - ' + rel['title'];
              img.className = 'result';
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
                  // Left bound: results left edge; right: unconstrained (matches results width)
                  if (ui.position.left < r.left) ui.position.left = r.left;
                  // Vertical: keep within window
                  if (ui.position.top < 0) ui.position.top = 0;
                  if (ui.position.top + hH > window.innerHeight)
                    ui.position.top = window.innerHeight - hH;
                }
              });
              $(img).css({ height: $('#results').width() / 2 });
              $('#results').append(img);
            }
          });
        });
      }
    }
  );
}

/**
 * Takes a screenshot of #chart and downloads it as an image
 * @param {String} ext - png or jpg
 */
function chartToImage(ext) {
  const container = document.getElementById('chartContainer');
  container.style.border = 'none';
  container.scrollTop = 0;

  // Set each tile's height = its own width (html2canvas 1.3.x ignores aspect-ratio)
  const tiles = $('#chart img.tile');
  tiles.each(function () {
    const w = this.offsetWidth;
    if (w > 0) $(this).css('height', w + 'px');
  });

  html2canvas(container, { useCORS: true, scale: window.devicePixelRatio || 1, backgroundColor: '#000000' }).then((canvas) => {
    container.style.border = '1px solid white';
    tiles.css('height', '');

    const mimeType = ext === 'jpg' ? 'image/jpeg' : 'image/png';
    const filename = (chart.name || 'chart') + '.' + ext;
    canvas.toBlob((blob) => {
      let url = URL.createObjectURL(blob);
      let a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, mimeType);
  });
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
      if (ui.position.left < r.left) ui.position.left = r.left;
      if (ui.position.top < 0) ui.position.top = 0;
      if (ui.position.top + hH > window.innerHeight)
        ui.position.top = window.innerHeight - hH;
    }
  });
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

  let height = $('#chartContainer').height();

  $('#titles').html('');
  for (let i = 0; i < images.length; i++) {
    if (chart.titles[i].length > 0) {
      let input = document.createElement('input');
      input.type = 'text';
      input.className = 'title';
      input.value = chart.titles[i];
      let w = getDisplayWidth(input.value);
      input.style.width = (w * 0.55 + 1) + 'em';
      $(input).change((e) => {
        chart.titles[$('.title').index(e.target)] = e.target.value;
        let dw = getDisplayWidth(e.target.value);
        e.target.style.width = (dw * 0.55 + 1) + 'em';
      });
      $('#titles').append(input);
    }
  }

  if ($('#chartContainer').height() > height && !maxHeight) {
    $('#chart').css({ maxHeight: height });
    maxHeight = true;
  }

  setTimeout(updateTitlesHeight, 0);
  storeToJSON();
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
      if (i >= 52) tile_n = 'tile-4';
      else if (i >= 22) tile_n = 'tile-3';
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
        dragIndex = -1;
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
    }
  });

  resize();
  outerPadding();
  innerPadding();
  setTimeout(updateTitlesHeight, 0);
  storeToJSON();
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
  fetch(URL.createObjectURL($('#jsonImport').get(0).files[0]), (resp) => {
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
  fetch(URL.createObjectURL($('#csvImport').get(0).files[0]), (resp) => {
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
        fetch,
        1000 * i,
        `https://musicbrainz.org/ws/2/release?query=${query}&limit=40?inc=artist-credit&fmt=json`,
        (resp) => {
          let release = JSON.parse(resp).releases.find(
            (release) => release.title == obj.Title
          );
          if (release) {
            fetch(
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
  chart.options.length = $('#tiles').val();
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
    $('#createChart').click();
  }

  $('#imgImportURLDiv').hide();
  $('#imgImportFileRadio').prop('checked', true);
  window.onresize = resize;
});
