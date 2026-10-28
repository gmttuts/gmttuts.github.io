/* GMT Desktop — Dò mìn (Minesweeper)
 * Original implementation, original CSS/inline-SVG drawings. No dependencies.
 * API: window.GMTGames.minesweeper(container, { sfx: fn(name), lang: 'vi'|'en' }) -> { destroy() }
 */
(function () {
  'use strict';

  var STYLE_ID = 'gmt-ms-style';

  var LEVELS = {
    easy: { cols: 9, rows: 9, mines: 10 },
    medium: { cols: 16, rows: 16, mines: 40 },
    hard: { cols: 30, rows: 16, mines: 99 }
  };

  var STR = {
    vi: {
      easy: 'Dễ', medium: 'Vừa', hard: 'Khó',
      flagMode: 'Cắm cờ', flagModeTitle: 'Chế độ cắm cờ: chạm để cắm/gỡ cờ',
      cell: 'Ô', hidden: 'chưa mở', flagged: 'đã cắm cờ', empty: 'trống',
      mine: 'mìn', hit: 'mìn đã nổ', wrongFlag: 'cờ sai',
      around: function (n) { return n + ' mìn xung quanh'; },
      face: 'Ván mới', minesLeft: 'Số mìn còn lại', time: 'Thời gian (giây)',
      board: 'Bãi mìn', levels: 'Độ khó',
      won: function (t) { return 'Bạn đã thắng! Thời gian: ' + t + ' giây.'; },
      lost: 'Trúng mìn! Bạn đã thua. Bấm mặt cười để chơi lại.',
      newGame: 'Ván mới bắt đầu.'
    },
    en: {
      easy: 'Easy', medium: 'Medium', hard: 'Hard',
      flagMode: 'Flag mode', flagModeTitle: 'Flag mode: tap to place/remove flags',
      cell: 'Cell', hidden: 'hidden', flagged: 'flagged', empty: 'empty',
      mine: 'mine', hit: 'exploded mine', wrongFlag: 'wrong flag',
      around: function (n) { return n + (n === 1 ? ' adjacent mine' : ' adjacent mines'); },
      face: 'New game', minesLeft: 'Mines left', time: 'Time (seconds)',
      board: 'Minefield', levels: 'Difficulty',
      won: function (t) { return 'You win! Time: ' + t + ' seconds.'; },
      lost: 'Boom! You hit a mine. Press the face to play again.',
      newGame: 'New game started.'
    }
  };

  var NUM_COLORS = ['', '#0000ff', '#008000', '#ff0000', '#000080', '#800000', '#008080', '#000000', '#808080'];

  var SVG_MINE =
    '<svg class="ms-ico" viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
    '<g stroke="#000" stroke-width="1.4" stroke-linecap="round">' +
    '<line x1="8" y1="1.5" x2="8" y2="14.5"/><line x1="1.5" y1="8" x2="14.5" y2="8"/>' +
    '<line x1="3.4" y1="3.4" x2="12.6" y2="12.6"/><line x1="12.6" y1="3.4" x2="3.4" y2="12.6"/></g>' +
    '<circle cx="8" cy="8" r="4.6" fill="#000"/>' +
    '<rect x="5.6" y="5.6" width="2" height="2" fill="#fff"/></svg>';

  var SVG_FLAG =
    '<svg class="ms-ico" viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
    '<polygon points="9,2 9,8.5 3.5,5.3" fill="#ff0000"/>' +
    '<rect x="8.3" y="2" width="1.4" height="9" fill="#000"/>' +
    '<rect x="5.5" y="10.5" width="7" height="1.6" fill="#000"/>' +
    '<rect x="3.5" y="12" width="11" height="2" fill="#000"/></svg>';

  var SVG_CROSS =
    '<svg class="ms-ico ms-cross" viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
    '<g stroke="#ff0000" stroke-width="1.8" stroke-linecap="round">' +
    '<line x1="2.5" y1="2.5" x2="13.5" y2="13.5"/><line x1="13.5" y1="2.5" x2="2.5" y2="13.5"/></g></svg>';

  var CSS = [
    '.ms-root{--ms-cell:24px;font-family:Tahoma,"Segoe UI",Verdana,sans-serif;font-size:12px;color:#000;display:block;max-width:100%;box-sizing:border-box;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;}',
    '.ms-root *,.ms-root *::before,.ms-root *::after{box-sizing:border-box;}',
    '.ms-menu{display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin:0 0 6px;}',
    '.ms-btn{font:inherit;font-size:12px;color:#000;background:#c0c0c0;border:2px solid;border-color:#fff #808080 #808080 #fff;padding:2px 8px;min-height:24px;cursor:pointer;border-radius:0;line-height:1.2;}',
    '.ms-btn:active,.ms-btn[aria-pressed="true"]{border-color:#808080 #fff #fff #808080;background:#b5b5b5;}',
    '.ms-btn:focus-visible{outline:1px dotted #000;outline-offset:-4px;}',
    '.ms-sep{flex:1 1 auto;}',
    '.ms-frame{display:inline-block;max-width:100%;background:#c0c0c0;border:3px solid;border-color:#fff #808080 #808080 #fff;padding:6px;}',
    '.ms-panel{display:flex;align-items:center;justify-content:space-between;gap:6px;border:2px solid;border-color:#808080 #fff #fff #808080;padding:4px 5px;margin-bottom:6px;}',
    '.ms-led{display:inline-block;background:#000;color:#ff1a1a;font-family:"VT323","Courier New",ui-monospace,monospace;font-size:26px;line-height:26px;height:30px;min-width:46px;padding:2px 3px 0;text-align:center;letter-spacing:1px;border:1px solid;border-color:#808080 #fff #fff #808080;text-shadow:0 0 4px rgba(255,0,0,.6);font-variant-numeric:tabular-nums;}',
    '.ms-face{width:32px;height:32px;padding:0;font-size:20px;line-height:1;background:#c0c0c0;border:2px solid;border-color:#fff #808080 #808080 #fff;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;font-family:"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif;}',
    '.ms-face:active{border-color:#808080 #fff #fff #808080;}',
    '.ms-face:focus-visible{outline:1px dotted #000;outline-offset:-5px;}',
    '.ms-wrap{max-width:100%;overflow:auto;-webkit-overflow-scrolling:touch;border:3px solid;border-color:#808080 #fff #fff #808080;}',
    '.ms-grid{display:grid;grid-auto-rows:var(--ms-cell);width:max-content;background:#c0c0c0;}',
    '.ms-cell{width:var(--ms-cell);height:var(--ms-cell);margin:0;padding:0;font:inherit;font-weight:700;font-size:calc(var(--ms-cell) * 0.64);line-height:1;color:#000;background:#c0c0c0;border-style:solid;border-width:calc(var(--ms-cell) / 8);border-color:#fff #808080 #808080 #fff;border-radius:0;display:flex;align-items:center;justify-content:center;cursor:default;touch-action:manipulation;position:relative;overflow:hidden;-webkit-appearance:none;appearance:none;}',
    '.ms-cell:focus{outline:none;}',
    '.ms-cell:focus-visible{outline:1px dotted #000;outline-offset:-3px;z-index:1;}',
    '.ms-cell.ms-down{border-width:1px 0 0 1px;border-color:#808080;}',
    '.ms-cell.ms-open{border-width:1px 0 0 1px;border-color:#808080;font-family:"Courier New",ui-monospace,monospace;font-weight:900;}',
    '.ms-cell.ms-hit{background:#ff0000;}',
    '.ms-ico{width:70%;height:70%;display:block;pointer-events:none;}',
    '.ms-cross{position:absolute;left:15%;top:15%;}',
    '.ms-n1{color:#0000ff}.ms-n2{color:#008000}.ms-n3{color:#ff0000}.ms-n4{color:#000080}.ms-n5{color:#800000}.ms-n6{color:#008080}.ms-n7{color:#000000}.ms-n8{color:#808080}',
    '.ms-sr{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;}'
  ].join('\n');

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  function el(tag, cls, attrs) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (attrs) for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) e.setAttribute(k, attrs[k]);
    return e;
  }

  function fmt3(n) {
    if (n > 999) n = 999;
    if (n < -99) n = -99;
    if (n < 0) {
      var a = String(-n);
      while (a.length < 2) a = '0' + a;
      return '-' + a;
    }
    var s = String(n);
    while (s.length < 3) s = '0' + s;
    return s;
  }

  function mount(container, opts) {
    opts = opts || {};
    injectStyle();

    var lang = opts.lang === 'en' ? 'en' : 'vi';
    var level = 'easy';
    var cfg, cols, rows, total;
    var mine, adj, st; // st: 0 hidden, 1 open, 2 flagged
    var status; // 'ready' | 'playing' | 'won' | 'lost'
    var flags, opened, seconds, timerId = null, hitIndex = -1;
    var cells = [];
    var focusIdx = 0;
    var flagMode = false;
    var destroyed = false;

    // input tracking
    var leftDown = false, rightDown = false, chordedByBoth = false;
    var skipClickUntil = 0;
    var lpTimer = null, lpStartX = 0, lpStartY = 0, lpFired = false, lastTouch = 0;

    function T() { return STR[lang]; }
    function sfx(name) {
      try { if (typeof opts.sfx === 'function') opts.sfx(name); } catch (e) { /* ignore */ }
    }

    // ---------- DOM ----------
    var root = el('div', 'ms-root');
    var menu = el('div', 'ms-menu', { role: 'toolbar' });
    var levelBtns = {};
    ['easy', 'medium', 'hard'].forEach(function (k) {
      var b = el('button', 'ms-btn', { type: 'button', 'data-level': k });
      levelBtns[k] = b;
      menu.appendChild(b);
    });
    menu.appendChild(el('span', 'ms-sep'));
    var flagBtn = el('button', 'ms-btn ms-flagmode', { type: 'button', 'aria-pressed': 'false' });
    menu.appendChild(flagBtn);

    var frame = el('div', 'ms-frame');
    var panel = el('div', 'ms-panel');
    var mineLed = el('span', 'ms-led', { role: 'status', 'aria-live': 'off' });
    var face = el('button', 'ms-face', { type: 'button' });
    var timeLed = el('span', 'ms-led', { role: 'timer', 'aria-live': 'off' });
    panel.appendChild(mineLed);
    panel.appendChild(face);
    panel.appendChild(timeLed);
    var wrap = el('div', 'ms-wrap');
    var grid = el('div', 'ms-grid', { role: 'group' });
    wrap.appendChild(grid);
    frame.appendChild(panel);
    frame.appendChild(wrap);
    var live = el('div', 'ms-sr', { 'aria-live': 'polite', 'aria-atomic': 'true' });

    root.appendChild(menu);
    root.appendChild(frame);
    root.appendChild(live);
    container.appendChild(root);

    // ---------- helpers ----------
    function neighbors(i) {
      var r = Math.floor(i / cols), c = i % cols, out = [];
      for (var dr = -1; dr <= 1; dr++) {
        for (var dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          var nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) out.push(nr * cols + nc);
        }
      }
      return out;
    }

    function setFace(ch) { face.textContent = ch; }
    function idleFace() {
      setFace(status === 'lost' ? '😵' : status === 'won' ? '😎' : '😊');
    }

    function updateMineLed() { mineLed.textContent = fmt3(cfg.mines - flags); }
    function updateTimeLed() { timeLed.textContent = fmt3(seconds); }

    function announce(msg) {
      live.textContent = '';
      setTimeout(function () { if (!destroyed) live.textContent = msg; }, 30);
    }

    function startTimer() {
      if (timerId) return;
      timerId = setInterval(function () {
        if (seconds < 999) { seconds++; updateTimeLed(); }
      }, 1000);
    }
    function stopTimer() {
      if (timerId) { clearInterval(timerId); timerId = null; }
    }

    function cellLabel(i) {
      var t = T(), r = Math.floor(i / cols) + 1, c = (i % cols) + 1;
      var base = t.cell + ' ' + r + ',' + c + ', ';
      var b = cells[i];
      if (b.classList.contains('ms-wrong')) return base + t.wrongFlag;
      if (st[i] === 2) return base + t.flagged;
      if (st[i] === 1) {
        if (mine[i]) return base + (i === hitIndex ? t.hit : t.mine);
        return base + (adj[i] ? t.around(adj[i]) : t.empty);
      }
      if (status === 'lost' && mine[i]) return base + t.mine;
      return base + t.hidden;
    }

    function renderCell(i) {
      var b = cells[i];
      var cls = 'ms-cell';
      var html = '';
      var wrong = false;
      if (st[i] === 1) {
        cls += ' ms-open';
        if (mine[i]) {
          html = SVG_MINE;
          if (i === hitIndex) cls += ' ms-hit';
        } else if (adj[i]) {
          html = String(adj[i]);
          cls += ' ms-n' + adj[i];
        }
      } else if (st[i] === 2) {
        if (status === 'lost' && !mine[i]) {
          cls += ' ms-open ms-wrong';
          html = SVG_MINE + SVG_CROSS;
          wrong = true;
        } else {
          html = SVG_FLAG;
        }
      } else if (status === 'lost' && mine[i]) {
        cls += ' ms-open';
        html = SVG_MINE;
      }
      b.className = cls;
      b.innerHTML = html;
      if (!wrong) b.classList.remove('ms-wrong');
      b.setAttribute('aria-label', cellLabel(i));
    }

    function renderAll() { for (var i = 0; i < total; i++) renderCell(i); }

    function applyLabels() {
      var t = T();
      ['easy', 'medium', 'hard'].forEach(function (k) {
        var L = LEVELS[k];
        levelBtns[k].textContent = t[k];
        levelBtns[k].title = t[k] + ' ' + L.cols + '×' + L.rows + ', ' + L.mines + ' ' + t.mine;
        levelBtns[k].setAttribute('aria-pressed', k === level ? 'true' : 'false');
      });
      menu.setAttribute('aria-label', t.levels);
      flagBtn.textContent = '🚩 ' + t.flagMode;
      flagBtn.title = t.flagModeTitle;
      face.setAttribute('aria-label', t.face);
      face.title = t.face;
      mineLed.setAttribute('aria-label', t.minesLeft);
      mineLed.title = t.minesLeft;
      timeLed.setAttribute('aria-label', t.time);
      timeLed.title = t.time;
      grid.setAttribute('aria-label', t.board + ' ' + cols + '×' + rows);
      if (cells.length) for (var i = 0; i < total; i++) cells[i].setAttribute('aria-label', cellLabel(i));
    }

    // ---------- sizing ----------
    function fitCells() {
      if (destroyed) return;
      var w = container.clientWidth || 0;
      var size = 24;
      if (w > 0 && w < 380) {
        // frame (3+6)*2 + wrap border 3*2 = 24px of chrome around the grid
        var avail = w - 26;
        size = Math.floor(avail / LEVELS.easy.cols);
        if (size > 24) size = 24;
        if (size < 14) size = 14;
      }
      root.style.setProperty('--ms-cell', size + 'px');
    }

    // ---------- game ----------
    function build() {
      cfg = LEVELS[level];
      cols = cfg.cols; rows = cfg.rows; total = cols * rows;
      grid.style.gridTemplateColumns = 'repeat(' + cols + ', var(--ms-cell))';
      grid.innerHTML = '';
      cells = [];
      var frag = document.createDocumentFragment();
      for (var i = 0; i < total; i++) {
        var b = el('button', 'ms-cell', { type: 'button', tabindex: '-1', 'data-i': String(i) });
        cells.push(b);
        frag.appendChild(b);
      }
      grid.appendChild(frag);
      focusIdx = 0;
      cells[0].setAttribute('tabindex', '0');
    }

    function reset(rebuild) {
      stopTimer();
      if (rebuild || !cells.length || cells.length !== LEVELS[level].cols * LEVELS[level].rows) build();
      mine = new Uint8Array(total);
      adj = new Uint8Array(total);
      st = new Uint8Array(total);
      status = 'ready';
      flags = 0; opened = 0; seconds = 0; hitIndex = -1;
      if (focusIdx >= total) focusIdx = 0;
      updateMineLed();
      updateTimeLed();
      idleFace();
      applyLabels();
      renderAll();
    }

    function placeMines(safe) {
      var excl = {};
      excl[safe] = true;
      var nb = neighbors(safe);
      if (total - nb.length - 1 >= cfg.mines) nb.forEach(function (n) { excl[n] = true; });
      var pool = [];
      for (var i = 0; i < total; i++) if (!excl[i]) pool.push(i);
      for (var k = 0; k < cfg.mines; k++) {
        var j = k + Math.floor(Math.random() * (pool.length - k));
        var tmp = pool[k]; pool[k] = pool[j]; pool[j] = tmp;
        mine[pool[k]] = 1;
      }
      for (var c = 0; c < total; c++) {
        if (mine[c]) continue;
        var n = 0, ns = neighbors(c);
        for (var q = 0; q < ns.length; q++) n += mine[ns[q]];
        adj[c] = n;
      }
    }

    // returns true if a mine was hit
    function openCell(i, changed) {
      if (st[i] !== 0) return false;
      if (mine[i]) {
        st[i] = 1;
        hitIndex = i;
        return true;
      }
      var stack = [i];
      while (stack.length) {
        var x = stack.pop();
        if (st[x] !== 0 || mine[x]) continue;
        st[x] = 1;
        opened++;
        changed.push(x);
        if (adj[x] === 0) {
          var ns = neighbors(x);
          for (var k = 0; k < ns.length; k++) if (st[ns[k]] === 0) stack.push(ns[k]);
        }
      }
      return false;
    }

    function finishCheck(changed, hit) {
      if (hit) { lose(); return; }
      for (var k = 0; k < changed.length; k++) renderCell(changed[k]);
      if (opened === total - cfg.mines) win();
    }

    function reveal(i) {
      if (status === 'won' || status === 'lost') return;
      if (st[i] !== 0) return;
      if (status === 'ready') {
        placeMines(i);
        status = 'playing';
        startTimer();
      }
      var changed = [];
      var hit = openCell(i, changed);
      if (!hit) sfx('click');
      finishCheck(changed, hit);
    }

    function chord(i) {
      if (status !== 'playing' || st[i] !== 1 || !adj[i]) return;
      var ns = neighbors(i), f = 0, k;
      for (k = 0; k < ns.length; k++) if (st[ns[k]] === 2) f++;
      if (f !== adj[i]) return;
      var changed = [], hit = false, any = false;
      for (k = 0; k < ns.length; k++) {
        if (st[ns[k]] === 0) {
          any = true;
          if (openCell(ns[k], changed)) hit = true;
        }
      }
      if (!any) return;
      if (!hit) sfx('click');
      finishCheck(changed, hit);
    }

    function toggleFlag(i) {
      if (status === 'won' || status === 'lost') return;
      if (st[i] === 1) return;
      if (st[i] === 2) { st[i] = 0; flags--; } else { st[i] = 2; flags++; }
      sfx('flag');
      updateMineLed();
      renderCell(i);
    }

    function lose() {
      status = 'lost';
      stopTimer();
      sfx('boom');
      idleFace();
      renderAll();
      announce(T().lost);
    }

    function win() {
      status = 'won';
      stopTimer();
      for (var i = 0; i < total; i++) {
        if (mine[i] && st[i] !== 2) { st[i] = 2; flags++; }
      }
      updateMineLed();
      sfx('win');
      idleFace();
      renderAll();
      announce(T().won(seconds));
    }

    function newGame() {
      reset(false);
      sfx('reset');
      announce(T().newGame);
    }

    // primary action on a cell (click / tap / Enter / Space)
    function primary(i) {
      if (status === 'won' || status === 'lost') return;
      if (st[i] === 1) { chord(i); return; }
      if (flagMode) { toggleFlag(i); return; }
      if (st[i] === 2) return;
      reveal(i);
    }

    // ---------- focus (roving tabindex) ----------
    function setFocus(i, doFocus) {
      if (i < 0 || i >= total) return;
      if (cells[focusIdx]) cells[focusIdx].setAttribute('tabindex', '-1');
      focusIdx = i;
      cells[i].setAttribute('tabindex', '0');
      if (doFocus) {
        try { cells[i].focus({ preventScroll: false }); } catch (e) { cells[i].focus(); }
      }
    }

    function idxFromEvent(e) {
      var t = e.target;
      while (t && t !== grid) {
        if (t.classList && t.classList.contains('ms-cell')) return parseInt(t.getAttribute('data-i'), 10);
        t = t.parentNode;
      }
      return -1;
    }

    // ---------- event handlers ----------
    function onGridClick(e) {
      var i = idxFromEvent(e);
      if (i < 0) return;
      setFocus(i, false);
      if (Date.now() < skipClickUntil || lpFired) { lpFired = false; return; }
      primary(i);
    }

    function onContextMenu(e) {
      e.preventDefault();
      var i = idxFromEvent(e);
      if (i < 0) return;
      if (Date.now() - lastTouch < 1000) return; // touch long-press handled by our timer
      if (chordedByBoth) return;
      setFocus(i, false);
      toggleFlag(i);
    }

    function onAuxClick(e) {
      if (e.button !== 1) return;
      var i = idxFromEvent(e);
      if (i < 0) return;
      e.preventDefault();
      chord(i);
    }

    function pressFaceFor(i) {
      if (status === 'won' || status === 'lost') return;
      if (i >= 0 && st[i] !== 2) setFace('😮');
    }

    function clearLongPress() {
      if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; }
    }

    function onPointerDown(e) {
      var i = idxFromEvent(e);
      if (i < 0) return;
      if (e.pointerType === 'touch' || e.pointerType === 'pen') {
        lastTouch = Date.now();
        lpFired = false;
        lpStartX = e.clientX; lpStartY = e.clientY;
        clearLongPress();
        pressFaceFor(i);
        lpTimer = setTimeout(function () {
          lpTimer = null;
          if (destroyed) return;
          lpFired = true;
          idleFace();
          if (st[i] === 1) chord(i); else toggleFlag(i);
          try { if (navigator.vibrate) navigator.vibrate(25); } catch (err) { /* ignore */ }
        }, 400);
        return;
      }
    }

    function onMouseDown(e) {
      if (Date.now() - lastTouch < 1000) return; // emulated mouse after touch
      var i = idxFromEvent(e);
      if (i < 0) return;
      if (e.button === 0) leftDown = true;
      if (e.button === 2) rightDown = true;
      if (e.button === 1) e.preventDefault();
      if (e.button === 0 || e.button === 1 || (leftDown && rightDown)) pressFaceFor(i);
    }

    function onPointerMove(e) {
      if (!lpTimer) return;
      var dx = e.clientX - lpStartX, dy = e.clientY - lpStartY;
      if (dx * dx + dy * dy > 100) { clearLongPress(); idleFace(); }
    }

    function onPointerCancel() {
      clearLongPress();
      idleFace();
    }

    function onDocPointerUp(e) {
      if (e.pointerType === 'touch' || e.pointerType === 'pen') {
        lastTouch = Date.now();
        clearLongPress();
        idleFace();
      }
    }

    function onDocMouseUp(e) {
      if (Date.now() - lastTouch < 1000) { leftDown = rightDown = false; return; }
      if (leftDown && rightDown) {
        var i = idxFromEvent(e);
        if (i >= 0 && grid.contains(e.target)) {
          chordedByBoth = true;
          chord(i);
          skipClickUntil = Date.now() + 250;
          setTimeout(function () { chordedByBoth = false; }, 250);
        }
      }
      if (e.button === 0) leftDown = false;
      if (e.button === 2) rightDown = false;
      if (e.buttons === 0) { leftDown = false; rightDown = false; }
      idleFace();
    }

    function onGridKey(e) {
      var i = idxFromEvent(e);
      if (i < 0) return;
      var r = Math.floor(i / cols), c = i % cols, n = -1;
      var key = e.key;
      if (key === 'ArrowUp') n = r > 0 ? i - cols : i;
      else if (key === 'ArrowDown') n = r < rows - 1 ? i + cols : i;
      else if (key === 'ArrowLeft') n = c > 0 ? i - 1 : i;
      else if (key === 'ArrowRight') n = c < cols - 1 ? i + 1 : i;
      else if (key === 'Home') n = r * cols;
      else if (key === 'End') n = r * cols + cols - 1;
      if (n >= 0) {
        e.preventDefault();
        setFocus(n, true);
        return;
      }
      if (key === 'f' || key === 'F') {
        e.preventDefault();
        if (st[i] === 1) chord(i); else toggleFlag(i);
        return;
      }
      // Enter / Space: native button activation fires 'click' -> primary()
    }

    function onGridFocusIn(e) {
      var i = idxFromEvent(e);
      if (i >= 0 && i !== focusIdx) setFocus(i, false);
    }

    function onFace() { newGame(); }

    function onMenuClick(e) {
      var t = e.target;
      var k = t && t.getAttribute && t.getAttribute('data-level');
      if (!k || !LEVELS[k]) return;
      level = k;
      reset(true);
      sfx('reset');
      announce(T()[k] + ' ' + LEVELS[k].cols + '×' + LEVELS[k].rows + ', ' + LEVELS[k].mines + ' ' + T().mine);
    }

    function onFlagMode() {
      flagMode = !flagMode;
      flagBtn.setAttribute('aria-pressed', flagMode ? 'true' : 'false');
    }

    function onLang(e) {
      var l = e && e.detail && e.detail.lang;
      if (l !== 'vi' && l !== 'en') return;
      lang = l;
      applyLabels();
    }

    function onFrameContext(e) { e.preventDefault(); }

    grid.addEventListener('click', onGridClick);
    grid.addEventListener('contextmenu', onContextMenu);
    grid.addEventListener('auxclick', onAuxClick);
    grid.addEventListener('pointerdown', onPointerDown);
    grid.addEventListener('mousedown', onMouseDown);
    grid.addEventListener('pointermove', onPointerMove);
    grid.addEventListener('pointercancel', onPointerCancel);
    grid.addEventListener('keydown', onGridKey);
    grid.addEventListener('focusin', onGridFocusIn);
    frame.addEventListener('contextmenu', onFrameContext);
    document.addEventListener('pointerup', onDocPointerUp);
    document.addEventListener('mouseup', onDocMouseUp);
    face.addEventListener('click', onFace);
    menu.addEventListener('click', onMenuClick);
    flagBtn.addEventListener('click', onFlagMode);
    document.addEventListener('gmt:lang', onLang);

    var ro = null;
    function onWinResize() { fitCells(); }
    if (typeof ResizeObserver === 'function') {
      ro = new ResizeObserver(function () { fitCells(); });
      ro.observe(container);
    } else {
      window.addEventListener('resize', onWinResize);
    }

    reset(true);
    fitCells();

    return {
      destroy: function () {
        if (destroyed) return;
        destroyed = true;
        stopTimer();
        clearLongPress();
        if (ro) { ro.disconnect(); ro = null; } else window.removeEventListener('resize', onWinResize);
        grid.removeEventListener('click', onGridClick);
        grid.removeEventListener('contextmenu', onContextMenu);
        grid.removeEventListener('auxclick', onAuxClick);
        grid.removeEventListener('pointerdown', onPointerDown);
        grid.removeEventListener('mousedown', onMouseDown);
        grid.removeEventListener('pointermove', onPointerMove);
        grid.removeEventListener('pointercancel', onPointerCancel);
        grid.removeEventListener('keydown', onGridKey);
        grid.removeEventListener('focusin', onGridFocusIn);
        frame.removeEventListener('contextmenu', onFrameContext);
        document.removeEventListener('pointerup', onDocPointerUp);
        document.removeEventListener('mouseup', onDocMouseUp);
        face.removeEventListener('click', onFace);
        menu.removeEventListener('click', onMenuClick);
        flagBtn.removeEventListener('click', onFlagMode);
        document.removeEventListener('gmt:lang', onLang);
        if (root.parentNode) root.parentNode.removeChild(root);
      }
    };
  }

  window.GMTGames = window.GMTGames || {};
  window.GMTGames.minesweeper = mount;
})();
