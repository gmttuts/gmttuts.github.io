/* GMT Desktop - Klondike Solitaire (original implementation, original drawing).
 * API: window.GMTGames.solitaire(container, { sfx: fn(name), lang: 'vi'|'en' }) -> { destroy() }
 * No dependencies. Pointer Events (mouse + touch), keyboard, undo, score, timer, win cascade.
 */
(function () {
  'use strict';

  var SUITS = ['♠', '♥', '♦', '♣'];
  var VS = '︎'; // text presentation (avoid emoji glyphs on iOS)
  var SUIT_VI = ['bích', 'cơ', 'rô', 'chuồn'];
  var SUIT_EN = ['spades', 'hearts', 'diamonds', 'clubs'];
  var RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  var RANK_VI = ['Át', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  var RANK_EN = ['Ace', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Jack', 'Queen', 'King'];

  var TXT = {
    vi: {
      newGame: 'Ván mới', undo: 'Hoàn tác', score: 'Điểm', win: 'Bạn thắng!',
      draw3: 'Rút 3', time: 'Thời gian', down: 'Lá úp', stock: 'Chồng bài (rút)',
      recycle: 'Xếp lại chồng bài', board: 'Bàn Solitaire', found: 'Ô nền',
      empty: 'Cột trống', skip: 'Nhấp để bỏ qua'
    },
    en: {
      newGame: 'New game', undo: 'Undo', score: 'Score', win: 'You win!',
      draw3: 'Draw 3', time: 'Time', down: 'Face-down card', stock: 'Stock (draw)',
      recycle: 'Recycle waste', board: 'Solitaire table', found: 'Foundation',
      empty: 'Empty column', skip: 'Click to skip'
    }
  };

  var CSS = [
    '.sol-root{position:relative;display:flex;flex-direction:column;width:100%;min-height:100%;box-sizing:border-box;',
    'font-family:"Segoe UI",Tahoma,system-ui,-apple-system,sans-serif;color:#fff;',
    'background:radial-gradient(ellipse at 50% 25%,#14a052 0%,#0a7a3a 55%,#05592a 100%);overflow-x:auto;overflow-y:visible}',
    '.sol-root *{box-sizing:border-box}',
    '.sol-bar{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:5px 8px;background:#ece9d8;color:#000;',
    'border-bottom:1px solid #aca899;font-size:12px;line-height:1.2;position:sticky;left:0;top:0;z-index:4000}',
    '.sol-btn{font:inherit;font-size:12px;color:#000;padding:3px 10px;min-height:24px;border:1px solid #003c74;border-radius:3px;',
    'background:linear-gradient(#fff,#ece9d8 85%,#d8d2bd);cursor:pointer}',
    '.sol-btn:hover{box-shadow:inset 0 0 0 1px #f8b330}',
    '.sol-btn:active{background:linear-gradient(#e3e0d0,#f4f2e8)}',
    '.sol-btn:disabled{color:#9a9a9a;border-color:#b5b2a5;cursor:default;box-shadow:none}',
    '.sol-btn:focus-visible,.sol-chk input:focus-visible{outline:2px solid #2a62c9;outline-offset:1px}',
    '.sol-chk{display:inline-flex;align-items:center;gap:4px;cursor:pointer;user-select:none;-webkit-user-select:none}',
    '.sol-sp{flex:1 1 auto}',
    '.sol-stat{font-variant-numeric:tabular-nums;white-space:nowrap;padding:0 2px}',
    '.sol-board{position:relative;width:100%;flex:0 0 auto;-webkit-user-select:none;user-select:none;overflow:hidden}',
    '.sol-board.sol-noanim .sol-card{transition:none!important}',
    '.sol-slot{position:absolute;left:0;top:0;width:var(--sol-cw);height:var(--sol-ch);border:2px solid rgba(255,255,255,.28);',
    'border-radius:calc(var(--sol-cw)*.09);background:rgba(0,0,0,.12);display:flex;align-items:center;justify-content:center;',
    'color:rgba(255,255,255,.35);font-weight:700;font-size:calc(var(--sol-cw)*.4);padding:0;margin:0;z-index:1}',
    'button.sol-slot{cursor:pointer;font-family:inherit;touch-action:manipulation;-webkit-tap-highlight-color:transparent;appearance:none;-webkit-appearance:none}',
    '.sol-slot-stock span{display:none}',
    '.sol-slot-stock.sol-empty span{display:block}',
    '.sol-slot-stock.sol-dead{cursor:default;opacity:.5}',
    '.sol-slot:focus-visible{outline:2px solid #ffd54a;outline-offset:1px}',
    '.sol-card{position:absolute;left:0;top:0;width:var(--sol-cw);height:var(--sol-ch);padding:0;margin:0;',
    'border:1px solid #707070;border-radius:calc(var(--sol-cw)*.09);background:#fff;color:#111;font:inherit;',
    'box-shadow:0 1px 2px rgba(0,0,0,.35);cursor:pointer;overflow:hidden;touch-action:none;will-change:transform;',
    'transition:transform .18s ease-out;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;',
    '-webkit-tap-highlight-color:transparent;appearance:none;-webkit-appearance:none;text-align:left}',
    '.sol-card.sol-red{color:#c00}',
    '.sol-card:focus-visible{outline:2px solid #ffd54a;outline-offset:1px}',
    '.sol-c{position:absolute;font-weight:700;line-height:.95;font-size:calc(var(--sol-cw)*.24);text-align:center;',
    'letter-spacing:-.05em;font-family:Georgia,"Times New Roman",serif;pointer-events:none}',
    '.sol-tl{top:4%;left:6%}',
    '.sol-br{bottom:4%;right:6%;transform:rotate(180deg)}',
    '.sol-mid{position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);text-align:center;line-height:1;',
    'font-size:calc(var(--sol-cw)*.56);pointer-events:none}',
    '.sol-fc{top:23%;bottom:23%;left:24%;right:24%;transform:none;display:flex;flex-direction:column;align-items:center;',
    'justify-content:center;border:1px solid currentColor;border-radius:3px;font-size:calc(var(--sol-cw)*.26);',
    'background:repeating-linear-gradient(135deg,rgba(0,0,0,.04) 0 2px,transparent 2px 5px)}',
    '.sol-fc b{font-family:Georgia,"Times New Roman",serif;font-size:calc(var(--sol-cw)*.34);line-height:1}',
    '.sol-down{background-color:#1b2a5c;border-color:#0d1636;',
    'background-image:repeating-linear-gradient(45deg,rgba(255,138,31,.8) 0 1.5px,transparent 1.5px 7px),',
    'repeating-linear-gradient(-45deg,rgba(255,138,31,.8) 0 1.5px,transparent 1.5px 7px);',
    'box-shadow:inset 0 0 0 3px #fff,inset 0 0 0 4px #1b2a5c,0 1px 2px rgba(0,0,0,.35)}',
    '.sol-down>*{visibility:hidden}',
    '.sol-down::after{content:"GMT";position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);',
    'font:700 calc(var(--sol-cw)*.19)/1 "Segoe UI",Tahoma,sans-serif;letter-spacing:.06em;color:#ff8a1f;',
    'background:#14204a;padding:.25em .35em;border-radius:3px;border:1px solid #ff8a1f}',
    '.sol-lift{transition:none!important;box-shadow:0 8px 16px rgba(0,0,0,.45);cursor:grabbing}',
    '.sol-shake{animation:sol-shake .28s linear}',
    '@keyframes sol-shake{0%,100%{margin-left:0}25%{margin-left:-4px}75%{margin-left:4px}}',
    '.sol-fx{position:absolute;left:0;top:0;z-index:2500;cursor:pointer}',
    '.sol-fx.sol-done{opacity:.55;cursor:default}',
    '.sol-win{position:absolute;left:0;top:0;right:0;bottom:0;z-index:3000;display:flex;align-items:flex-start;',
    'justify-content:center;padding-top:12%;background:rgba(0,0,0,.18)}',
    '.sol-win-box{background:#ece9d8;color:#000;border:1px solid #0a246a;border-radius:6px 6px 3px 3px;',
    'box-shadow:0 8px 24px rgba(0,0,0,.45);min-width:200px;max-width:90%;text-align:center;overflow:hidden}',
    '.sol-win-h{background:linear-gradient(#0a5fd8,#0842a8);color:#fff;font-weight:700;padding:6px 10px;font-size:15px}',
    '.sol-win-p{padding:10px 12px 4px;font-size:12px}',
    '.sol-win-a{padding:8px 12px 12px}',
    '.sol-live{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}',
    '@media (prefers-reduced-motion:reduce){.sol-card{transition:none}.sol-shake{animation:none}}'
  ].join('');

  function injectStyle() {
    if (document.getElementById('gmt-sol-style')) return;
    var s = document.createElement('style');
    s.id = 'gmt-sol-style';
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function isRed(suit) { return suit === 1 || suit === 2; }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function fmtTime(s) { return pad2(Math.floor(s / 60)) + ':' + pad2(s % 60); }
  function reducedMotion() {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
    catch (e) { return false; }
  }

  function faceHTML(c) {
    var r = RANKS[c.rank - 1], s = SUITS[c.suit] + VS;
    var corner = r + '<br>' + s;
    var mid = c.rank > 10
      ? '<span class="sol-mid sol-fc" aria-hidden="true"><b>' + r + '</b>' + s + '</span>'
      : '<span class="sol-mid" aria-hidden="true">' + s + '</span>';
    return '<span class="sol-c sol-tl" aria-hidden="true">' + corner + '</span>' + mid +
      '<span class="sol-c sol-br" aria-hidden="true">' + corner + '</span>';
  }

  function mount(container, opts) {
    opts = opts || {};
    var sfxFn = typeof opts.sfx === 'function' ? opts.sfx : function () {};
    function play(n) { try { sfxFn(n); } catch (e) { /* ignore */ } }
    var lang = opts.lang === 'en' ? 'en' : 'vi';
    function t(k) { return (TXT[lang] || TXT.vi)[k]; }

    injectStyle();

    // ---------- model ----------
    var cards = [];
    for (var su = 0; su < 4; su++) {
      for (var rk = 1; rk <= 13; rk++) cards.push({ id: su * 13 + rk - 1, suit: su, rank: rk, up: false });
    }
    var st = { s: [], w: [], f: [[], [], [], []], t: [[], [], [], [], [], [], []] };
    var history = [];
    var score = 0, secs = 0, timerId = null, draw3 = false, won = false;
    var L = null, pos = {}, flyIds = null;
    var timeouts = [], raf = 0, fx = null, winEl = null;
    var press = null, drag = null, suppressUntil = 0, lastW = -1;
    var destroyed = false;

    function later(fn, ms) {
      var id = setTimeout(function () {
        var i = timeouts.indexOf(id); if (i >= 0) timeouts.splice(i, 1);
        if (!destroyed) fn();
      }, ms);
      timeouts.push(id);
      return id;
    }

    // ---------- DOM ----------
    container.innerHTML = '';
    var root = document.createElement('div');
    root.className = 'sol-root';

    var bar = document.createElement('div');
    bar.className = 'sol-bar';
    var btnNew = document.createElement('button');
    btnNew.type = 'button'; btnNew.className = 'sol-btn';
    var btnUndo = document.createElement('button');
    btnUndo.type = 'button'; btnUndo.className = 'sol-btn';
    var chkLab = document.createElement('label');
    chkLab.className = 'sol-chk';
    var chk = document.createElement('input');
    chk.type = 'checkbox';
    var chkTxt = document.createElement('span');
    chkLab.appendChild(chk); chkLab.appendChild(chkTxt);
    var spacer = document.createElement('span'); spacer.className = 'sol-sp';
    var scoreEl = document.createElement('span'); scoreEl.className = 'sol-stat';
    var timeEl = document.createElement('span'); timeEl.className = 'sol-stat';
    bar.appendChild(btnNew); bar.appendChild(btnUndo); bar.appendChild(chkLab);
    bar.appendChild(spacer); bar.appendChild(scoreEl); bar.appendChild(timeEl);

    var board = document.createElement('div');
    board.className = 'sol-board';
    board.setAttribute('role', 'group');

    var stockSlot = document.createElement('button');
    stockSlot.type = 'button';
    stockSlot.className = 'sol-slot sol-slot-stock';
    stockSlot.innerHTML = '<span aria-hidden="true">↻</span>';
    board.appendChild(stockSlot);
    var fSlots = [], tSlots = [], i;
    for (i = 0; i < 4; i++) {
      var fs = document.createElement('div');
      fs.className = 'sol-slot';
      fs.setAttribute('aria-hidden', 'true');
      fs.textContent = 'A';
      board.appendChild(fs); fSlots.push(fs);
    }
    for (i = 0; i < 7; i++) {
      var ts = document.createElement('div');
      ts.className = 'sol-slot';
      ts.setAttribute('aria-hidden', 'true');
      ts.textContent = 'K';
      board.appendChild(ts); tSlots.push(ts);
    }
    var els = [];
    cards.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'sol-card' + (isRed(c.suit) ? ' sol-red' : '');
      b.setAttribute('data-id', String(c.id));
      b.innerHTML = faceHTML(c);
      board.appendChild(b);
      els[c.id] = b;
    });

    var live = document.createElement('div');
    live.className = 'sol-live';
    live.setAttribute('aria-live', 'polite');
    live.setAttribute('role', 'status');

    root.appendChild(bar);
    root.appendChild(board);
    root.appendChild(live);
    container.appendChild(root);

    // ---------- labels ----------
    function relabel() {
      btnNew.textContent = t('newGame');
      btnUndo.textContent = t('undo');
      chkTxt.textContent = t('draw3');
      board.setAttribute('aria-label', t('board'));
      for (var k = 0; k < 4; k++) fSlots[k].title = t('found') + ' ' + (k + 1);
      for (k = 0; k < 7; k++) tSlots[k].title = t('empty');
      updScore(); updTime();
      if (winEl) {
        var h = winEl.querySelector('.sol-win-h'); if (h) h.textContent = t('win');
        var p = winEl.querySelector('.sol-win-p'); if (p) p.textContent = winDetail();
        var b = winEl.querySelector('.sol-btn'); if (b) b.textContent = t('newGame');
      }
      if (fx && !fx.done) fx.cv.title = t('skip');
    }
    function updScore() { scoreEl.textContent = t('score') + ': ' + score; }
    function updTime() { timeEl.textContent = '⏱' + VS + ' ' + fmtTime(secs); timeEl.title = t('time'); }
    function winDetail() { return t('score') + ': ' + score + ' · ' + t('time') + ': ' + fmtTime(secs); }
    function cardLabel(c) {
      if (!c.up) return t('down');
      if (lang === 'en') return RANK_EN[c.rank - 1] + ' of ' + SUIT_EN[c.suit];
      return RANK_VI[c.rank - 1] + ' ' + SUIT_VI[c.suit];
    }

    // ---------- timer ----------
    function startTimer() {
      if (timerId || won) return;
      timerId = setInterval(function () { secs++; updTime(); }, 1000);
    }
    function stopTimer() { if (timerId) { clearInterval(timerId); timerId = null; } }

    // ---------- layout ----------
    function layout() {
      var W = board.clientWidth || container.clientWidth || 600;
      var gap = clamp(Math.round(W * 0.014), 3, 12);
      var cw = clamp(Math.floor((W - 8 * gap) / 7), 38, 90);
      var ch = Math.round(cw * 10 / 7);
      var total = 7 * cw + 8 * gap;
      L = {
        W: Math.max(W, total), cw: cw, ch: ch, gap: gap,
        ox: Math.max(0, Math.floor((W - total) / 2)),
        topY: gap + 2, tabY: gap * 2 + ch + Math.round(ch * 0.08),
        fanDown: Math.max(4, Math.round(ch * 0.1)), fanUp: Math.max(11, Math.round(ch * 0.27)),
        wasteFan: Math.round(cw * 0.26)
      };
      board.style.setProperty('--sol-cw', cw + 'px');
      board.style.setProperty('--sol-ch', ch + 'px');
      board.style.minWidth = total > W ? total + 'px' : '';
    }
    function colX(c) { return L.ox + L.gap + c * (L.cw + L.gap); }

    function computePositions() {
      var j, n, bottom = L.tabY + L.ch;
      for (j = 0; j < st.s.length; j++) pos[st.s[j].id] = { x: colX(0), y: L.topY, z: 10 + j };
      n = st.w.length;
      var vis = draw3 ? 3 : 1;
      for (j = 0; j < n; j++) {
        var k = j - (n - Math.min(vis, n));
        pos[st.w[j].id] = { x: colX(1) + (draw3 && k > 0 ? k * L.wasteFan : 0), y: L.topY, z: 10 + j };
      }
      for (var f = 0; f < 4; f++) {
        for (j = 0; j < st.f[f].length; j++) pos[st.f[f][j].id] = { x: colX(3 + f), y: L.topY, z: 10 + j };
      }
      for (var c = 0; c < 7; c++) {
        var y = L.tabY, p = st.t[c];
        for (j = 0; j < p.length; j++) {
          pos[p[j].id] = { x: colX(c), y: y, z: 10 + j };
          if (j === p.length - 1) bottom = Math.max(bottom, y + L.ch);
          y += p[j].up ? L.fanUp : L.fanDown;
        }
      }
      return Math.max(bottom + L.gap * 2, L.tabY + Math.round(L.ch * 3.2));
    }

    function place(el, x, y) { el.style.transform = 'translate(' + x + 'px,' + y + 'px)'; }

    function locate(id) {
      var j = st.s.indexOf(cards[id]);
      if (j >= 0) return { k: 's', i: 0, j: j };
      j = st.w.indexOf(cards[id]);
      if (j >= 0) return { k: 'w', i: 0, j: j };
      for (var f = 0; f < 4; f++) { j = st.f[f].indexOf(cards[id]); if (j >= 0) return { k: 'f', i: f, j: j }; }
      for (var c = 0; c < 7; c++) { j = st.t[c].indexOf(cards[id]); if (j >= 0) return { k: 't', i: c, j: j }; }
      return null;
    }
    function pileOf(loc) {
      return loc.k === 's' ? st.s : loc.k === 'w' ? st.w : loc.k === 'f' ? st.f[loc.i] : st.t[loc.i];
    }

    function render() {
      if (!L) layout();
      var h = computePositions();
      board.style.height = h + 'px';
      var stockTop = st.s.length ? st.s[st.s.length - 1] : null;
      var wasteTop = st.w.length ? st.w[st.w.length - 1] : null;
      cards.forEach(function (c) {
        var el = els[c.id], p = pos[c.id];
        if (!p) return;
        place(el, p.x, p.y);
        el.style.zIndex = String(flyIds && flyIds[c.id] ? 900 + p.z : p.z);
        el.classList.toggle('sol-down', !c.up);
        var loc = null, focusable;
        if (c === stockTop) focusable = true;
        else if (!c.up) focusable = false;
        else if (c === wasteTop) focusable = true;
        else {
          loc = locate(c.id);
          focusable = loc.k === 't' || (loc.k === 'f' && loc.j === st.f[loc.i].length - 1);
        }
        el.tabIndex = focusable ? 0 : -1;
        el.setAttribute('aria-label', c === stockTop ? t('stock') : cardLabel(c));
        if (focusable) el.removeAttribute('aria-hidden'); else el.setAttribute('aria-hidden', 'true');
      });
      place(stockSlot, colX(0), L.topY);
      var stockEmpty = !st.s.length;
      stockSlot.classList.toggle('sol-empty', stockEmpty);
      stockSlot.classList.toggle('sol-dead', stockEmpty && !st.w.length);
      stockSlot.tabIndex = stockEmpty ? 0 : -1;
      stockSlot.setAttribute('aria-label', stockEmpty ? t('recycle') : t('stock'));
      for (var f = 0; f < 4; f++) place(fSlots[f], colX(3 + f), L.topY);
      for (var c = 0; c < 7; c++) place(tSlots[c], colX(c), L.tabY);
      updScore();
      btnUndo.disabled = !history.length || won;
      scheduleSnap();
    }

    /* Safety net: some embedded/background browsers barely tick CSS transitions.
       If cards have not reached their target shortly after a render, snap them there. */
    var snapTimer = 0;
    function scheduleSnap() {
      clearTimeout(snapTimer);
      snapTimer = setTimeout(function () {
        if (destroyed || drag) return;
        var stuck = false, brect = board.getBoundingClientRect();
        for (var i = 0; i < cards.length && !stuck; i++) {
          var p = pos[cards[i].id]; if (!p) continue;
          var r = els[cards[i].id].getBoundingClientRect();
          if (Math.abs(r.left - brect.left - p.x) > 3 || Math.abs(r.top - brect.top - p.y) > 3) stuck = true;
        }
        if (stuck) noAnim(function () { cards.forEach(function (c) { var p = pos[c.id]; if (p) place(els[c.id], p.x, p.y); els[c.id].style.transitionDelay = ''; }); });
      }, 900);
    }

    function fly(list) {
      flyIds = {};
      list.forEach(function (c) { flyIds[c.id] = true; });
      later(function () { flyIds = null; if (!drag) render(); }, 230);
    }

    function noAnim(fn) {
      board.classList.add('sol-noanim');
      fn();
      void board.offsetWidth;
      board.classList.remove('sol-noanim');
    }

    // ---------- history ----------
    function ser(a) { return a.map(function (c) { return c.id * 2 + (c.up ? 1 : 0); }); }
    function des(a) { return a.map(function (v) { var c = cards[v >> 1]; c.up = !!(v & 1); return c; }); }
    function pushHist() {
      history.push({ s: ser(st.s), w: ser(st.w), f: st.f.map(ser), t: st.t.map(ser), score: score });
      if (history.length > 500) history.shift();
    }
    function undo() {
      if (!history.length || won || drag) return;
      var h = history.pop();
      st.s = des(h.s); st.w = des(h.w); st.f = h.f.map(des); st.t = h.t.map(des);
      score = h.score;
      render();
      play('place');
    }

    // ---------- rules ----------
    function canFound(c, fi) {
      var p = st.f[fi];
      if (!p.length) return c.rank === 1;
      var top = p[p.length - 1];
      return top.suit === c.suit && top.rank + 1 === c.rank;
    }
    function canTab(c, ti) {
      var p = st.t[ti];
      if (!p.length) return c.rank === 13;
      var top = p[p.length - 1];
      return top.up && isRed(top.suit) !== isRed(c.suit) && top.rank === c.rank + 1;
    }
    function canDrop(list, to, from) {
      if (to.k === from.k && to.i === from.i) return false;
      if (to.k === 'f') return list.length === 1 && canFound(list[0], to.i);
      return canTab(list[0], to.i);
    }

    function doMove(from, j, to) {
      pushHist();
      startTimer();
      var src = pileOf(from), moving = src.splice(j), dst = pileOf(to);
      for (var m = 0; m < moving.length; m++) dst.push(moving[m]);
      if (to.k === 'f' && from.k !== 'f') score += 10;
      if (from.k === 'w' && to.k === 't') score += 5;
      if (from.k === 'f' && to.k === 't') score = Math.max(0, score - 15);
      var flipped = false;
      if (from.k === 't') {
        var p = st.t[from.i];
        if (p.length && !p[p.length - 1].up) { p[p.length - 1].up = true; score += 5; flipped = true; }
      }
      fly(moving);
      render();
      play('place');
      if (flipped) later(function () { play('flip'); }, 90);
      checkWin();
    }

    function drawStock() {
      if (won) return;
      if (st.s.length) {
        pushHist(); startTimer();
        var n = draw3 ? 3 : 1, moved = [];
        for (var k = 0; k < n && st.s.length; k++) {
          var c = st.s.pop(); c.up = true; st.w.push(c); moved.push(c);
        }
        fly(moved); render(); play('flip');
      } else if (st.w.length) {
        pushHist();
        while (st.w.length) { var d = st.w.pop(); d.up = false; st.s.push(d); }
        render(); play('flip');
      } else {
        play('invalid');
      }
    }

    function shake(list) {
      if (reducedMotion()) return;
      list.forEach(function (c) {
        var el = els[c.id];
        el.classList.remove('sol-shake'); void el.offsetWidth; el.classList.add('sol-shake');
      });
      later(function () { list.forEach(function (c) { els[c.id].classList.remove('sol-shake'); }); }, 320);
    }

    function autoMove(id) {
      if (won) return false;
      var c = cards[id], loc = locate(id);
      if (!loc) return false;
      var src = pileOf(loc), isTop = loc.j === src.length - 1;
      if (loc.k === 's') { drawStock(); return false; }
      if (!c.up) {
        if (loc.k === 't' && isTop) {
          pushHist(); c.up = true; score += 5; render(); play('flip'); return true;
        }
        return false;
      }
      var moving = src.slice(loc.j);
      if ((loc.k === 'w' || loc.k === 'f') && !isTop) { play('invalid'); shake(moving); return false; }
      if (isTop && loc.k !== 'f') {
        for (var fi = 0; fi < 4; fi++) {
          if (canFound(c, fi)) { doMove(loc, loc.j, { k: 'f', i: fi }); return true; }
        }
      }
      var best = -1, emptyCand = -1;
      for (var d = 0; d < 7; d++) {
        var ti = loc.k === 't' ? (loc.i + 1 + d) % 7 : d;
        if (loc.k === 't' && ti === loc.i) continue;
        if (!canTab(c, ti)) continue;
        if (!st.t[ti].length) {
          if (loc.k === 't' && loc.j === 0) continue; // king already at base: pointless
          if (emptyCand < 0) emptyCand = ti;
        } else { best = ti; break; }
      }
      if (best < 0) best = emptyCand;
      if (best >= 0) { doMove(loc, loc.j, { k: 't', i: best }); return true; }
      play('invalid'); shake(moving);
      return false;
    }

    // ---------- pointer input ----------
    function isStockEl(el) {
      if (el === stockSlot) return true;
      if (!el.classList.contains('sol-card')) return false;
      return st.s.length > 0 && st.s[st.s.length - 1] === cards[+el.getAttribute('data-id')];
    }

    function onDown(e) {
      if (won || press || destroyed) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      var el = e.target && e.target.closest ? e.target.closest('.sol-card,.sol-slot-stock') : null;
      if (!el || !board.contains(el)) return;
      var p = { pid: e.pointerId, x: e.clientX, y: e.clientY, el: el, id: -1, list: null, loc: null };
      if (el.classList.contains('sol-card')) {
        p.id = +el.getAttribute('data-id');
        var c = cards[p.id], loc = locate(p.id);
        if (c.up && loc && loc.k !== 's') {
          var src = pileOf(loc);
          if (loc.k === 't' || loc.j === src.length - 1) { p.loc = loc; p.list = src.slice(loc.j); }
        }
      }
      press = p;
      try { board.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    }

    function onMove(e) {
      if (!press || e.pointerId !== press.pid) return;
      var dx = e.clientX - press.x, dy = e.clientY - press.y;
      if (!drag) {
        if (!press.list || dx * dx + dy * dy < 36) return;
        drag = { list: press.list, loc: press.loc, dx: 0, dy: 0 };
        drag.list.forEach(function (c, k) {
          els[c.id].classList.add('sol-lift');
          els[c.id].style.zIndex = String(2000 + k);
        });
      }
      if (e.cancelable) e.preventDefault();
      drag.dx = dx; drag.dy = dy;
      drag.list.forEach(function (c) { var p0 = pos[c.id]; place(els[c.id], p0.x + dx, p0.y + dy); });
    }

    function endLift(list) {
      list.forEach(function (c) { els[c.id].classList.remove('sol-lift'); });
      void board.offsetWidth;
    }

    function overlap(a, b) {
      var w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      var h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      return w > 0 && h > 0 ? w * h : 0;
    }

    function finishDrag(d) {
      var lead = pos[d.list[0].id];
      var r = { x: lead.x + d.dx, y: lead.y + d.dy, w: L.cw, h: L.ch };
      var best = null, bestA = 0, k, area, tr;
      for (k = 0; k < 7; k++) {
        var p = st.t[k], to = { k: 't', i: k };
        if (!canDrop(d.list, to, d.loc)) continue;
        if (p.length) { var tp = pos[p[p.length - 1].id]; tr = { x: tp.x, y: tp.y, w: L.cw, h: L.ch + L.fanUp }; }
        else tr = { x: colX(k), y: L.tabY, w: L.cw, h: L.ch };
        area = overlap(r, tr);
        if (area > bestA) { bestA = area; best = to; }
      }
      if (d.list.length === 1) {
        for (k = 0; k < 4; k++) {
          var tf = { k: 'f', i: k };
          if (!canDrop(d.list, tf, d.loc)) continue;
          area = overlap(r, { x: colX(3 + k), y: L.topY, w: L.cw, h: L.ch });
          if (area > bestA) { bestA = area; best = tf; }
        }
      }
      endLift(d.list);
      if (best) doMove(d.loc, d.loc.j, best);
      else { render(); play('invalid'); }
    }

    function tap(p) {
      if (isStockEl(p.el)) { drawStock(); return; }
      if (p.id < 0) return;
      var now = Date.now();
      if (now < suppressUntil) return;
      if (autoMove(p.id)) suppressUntil = now + 320;
    }

    function onUp(e) {
      if (!press || e.pointerId !== press.pid) return;
      var p = press; press = null;
      if (drag) { var d = drag; drag = null; finishDrag(d); return; }
      tap(p);
    }

    function onCancel(e) {
      if (!press || e.pointerId !== press.pid) return;
      press = null;
      if (drag) { var d = drag; drag = null; endLift(d.list); render(); }
    }

    function onDbl(e) {
      var el = e.target && e.target.closest ? e.target.closest('.sol-card') : null;
      if (!el || won) return;
      var id = +el.getAttribute('data-id'), c = cards[id], loc = locate(id);
      if (!loc || !c.up || loc.k === 'f' || loc.k === 's' || Date.now() < suppressUntil) return;
      if (loc.j !== pileOf(loc).length - 1) return;
      for (var fi = 0; fi < 4; fi++) {
        if (canFound(c, fi)) { doMove(loc, loc.j, { k: 'f', i: fi }); return; }
      }
    }

    function onKey(e) {
      if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
      var el = e.target && e.target.closest ? e.target.closest('.sol-card,.sol-slot-stock') : null;
      if (!el || !board.contains(el)) return;
      e.preventDefault();
      if (won) return;
      if (isStockEl(el)) { drawStock(); return; }
      autoMove(+el.getAttribute('data-id'));
    }

    function onCtx(e) {
      if (e.target && e.target.closest && e.target.closest('.sol-card')) e.preventDefault();
    }

    // ---------- win ----------
    function checkWin() {
      var n = st.f[0].length + st.f[1].length + st.f[2].length + st.f[3].length;
      if (n !== 52 || won) return;
      won = true;
      stopTimer();
      btnUndo.disabled = true;
      live.textContent = t('win') + ' ' + winDetail();
      later(function () { play('win'); celebrate(); }, 250);
    }

    function cardBitmap(c, dpr) {
      var w = L.cw, h = L.ch, cv = document.createElement('canvas');
      cv.width = Math.ceil(w * dpr); cv.height = Math.ceil(h * dpr);
      var g = cv.getContext('2d');
      g.scale(dpr, dpr);
      var r = w * 0.09;
      g.beginPath();
      g.moveTo(r + 0.5, 0.5); g.lineTo(w - r - 0.5, 0.5); g.quadraticCurveTo(w - 0.5, 0.5, w - 0.5, r + 0.5);
      g.lineTo(w - 0.5, h - r - 0.5); g.quadraticCurveTo(w - 0.5, h - 0.5, w - r - 0.5, h - 0.5);
      g.lineTo(r + 0.5, h - 0.5); g.quadraticCurveTo(0.5, h - 0.5, 0.5, h - r - 0.5);
      g.lineTo(0.5, r + 0.5); g.quadraticCurveTo(0.5, 0.5, r + 0.5, 0.5);
      g.closePath();
      g.fillStyle = '#fff'; g.fill();
      g.strokeStyle = '#666'; g.lineWidth = 1; g.stroke();
      g.fillStyle = isRed(c.suit) ? '#c00' : '#111';
      var fs = Math.round(w * 0.24);
      g.font = 'bold ' + fs + 'px Georgia, "Times New Roman", serif';
      g.textAlign = 'center'; g.textBaseline = 'top';
      var cx = w * 0.06 + fs * 0.45;
      g.fillText(RANKS[c.rank - 1], cx, h * 0.04);
      g.fillText(SUITS[c.suit] + VS, cx, h * 0.04 + fs * 0.95);
      g.textBaseline = 'middle';
      g.font = Math.round(w * (c.rank > 10 ? 0.4 : 0.56)) + 'px Georgia, serif';
      g.fillText((c.rank > 10 ? RANKS[c.rank - 1] : '') + SUITS[c.suit] + VS, w / 2, h / 2);
      return cv;
    }

    function celebrate() {
      if (destroyed || !won) return;
      if (reducedMotion()) { showWin(); return; }
      var W = board.clientWidth, H = board.clientHeight;
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      var cv = document.createElement('canvas');
      cv.className = 'sol-fx';
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
      cv.title = t('skip');
      var ctx = cv.getContext('2d');
      if (!ctx) { showWin(); return; }
      ctx.scale(dpr, dpr);
      board.appendChild(cv);
      var queue = [];
      for (var r = 13; r >= 1; r--) for (var f = 0; f < 4; f++) { var c = st.f[f][r - 1]; if (c) queue.push(c); }
      var bmp = {}, active = [], t0 = 0, last = 0, nextSpawn = 0, k = L.cw / 70;
      fx = { cv: cv, done: false };
      function stop() {
        if (!fx || fx.done) return;
        fx.done = true;
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
        cv.classList.add('sol-done');
        cv.removeAttribute('title');
        showWin();
      }
      fx.stop = stop;
      cv.addEventListener('pointerdown', stop);
      function step(ts) {
        raf = 0;
        if (destroyed || !fx || fx.done) return;
        if (!t0) { t0 = last = ts; }
        var dt = Math.min(50, ts - last) / 16.667; last = ts;
        var el = ts - t0;
        while (queue.length && el >= nextSpawn) {
          var c = queue.shift(), p = pos[c.id];
          els[c.id].style.visibility = 'hidden';
          if (!bmp[c.id]) bmp[c.id] = cardBitmap(c, dpr);
          active.push({
            c: c, x: p.x, y: p.y,
            vx: (Math.random() < 0.5 ? -1 : 1) * (1.6 + Math.random() * 4.4) * k,
            vy: -(Math.random() * 7) * k
          });
          nextSpawn += 88;
        }
        for (var a = 0; a < active.length; a++) {
          var q = active[a];
          q.vy += 0.55 * k * dt; q.x += q.vx * dt; q.y += q.vy * dt;
          if (q.y + L.ch > H) { q.y = H - L.ch; q.vy = -Math.abs(q.vy) * 0.78; }
          ctx.drawImage(bmp[q.c.id], q.x, q.y, L.cw, L.ch);
        }
        active = active.filter(function (q) { return q.x > -L.cw && q.x < W; });
        if ((!queue.length && !active.length) || el > 6500) { stop(); return; }
        raf = requestAnimationFrame(step);
      }
      raf = requestAnimationFrame(step);
    }

    function showWin() {
      if (winEl || destroyed) return;
      winEl = document.createElement('div');
      winEl.className = 'sol-win';
      winEl.innerHTML = '<div class="sol-win-box" role="dialog" aria-modal="false">' +
        '<div class="sol-win-h"></div><div class="sol-win-p"></div>' +
        '<div class="sol-win-a"><button type="button" class="sol-btn"></button></div></div>';
      winEl.querySelector('.sol-win-h').textContent = t('win');
      winEl.querySelector('.sol-win-p').textContent = winDetail();
      var b = winEl.querySelector('.sol-btn');
      b.textContent = t('newGame');
      b.addEventListener('click', newGame);
      board.appendChild(winEl);
      try { b.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    }

    function clearWinFx() {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      if (fx) { if (fx.cv.parentNode) fx.cv.parentNode.removeChild(fx.cv); fx = null; }
      if (winEl) { if (winEl.parentNode) winEl.parentNode.removeChild(winEl); winEl = null; }
    }

    // ---------- new game ----------
    function newGame() {
      clearWinFx();
      timeouts.forEach(clearTimeout); timeouts = [];
      press = null; drag = null; flyIds = null;
      won = false; history = []; score = 0; secs = 0; suppressUntil = 0;
      stopTimer(); updTime();
      live.textContent = '';
      var deck = cards.slice();
      for (var a = deck.length - 1; a > 0; a--) {
        var b = Math.floor(Math.random() * (a + 1)), tmp = deck[a]; deck[a] = deck[b]; deck[b] = tmp;
      }
      deck.forEach(function (c) {
        c.up = false;
        var el = els[c.id];
        el.style.visibility = ''; el.style.transitionDelay = '';
        el.classList.remove('sol-lift', 'sol-shake');
      });
      st = { s: [], w: [], f: [[], [], [], []], t: [[], [], [], [], [], [], []] };
      var order = [];
      for (var row = 0; row < 7; row++) {
        for (var col = row; col < 7; col++) {
          var c = deck.pop();
          if (col === row) c.up = true;
          st.t[col].push(c); order.push(c);
        }
      }
      st.s = deck;
      layout();
      if (!reducedMotion()) {
        noAnim(function () {
          cards.forEach(function (c) { place(els[c.id], colX(0), L.topY); els[c.id].style.zIndex = '10'; });
        });
        order.forEach(function (c, n) { els[c.id].style.transitionDelay = (n * 18) + 'ms'; });
        later(function () { order.forEach(function (c) { els[c.id].style.transitionDelay = ''; }); }, 18 * order.length + 260);
      }
      render();
      play('deal');
    }

    // ---------- wiring ----------
    function onNew() { newGame(); }
    function onUndo() { undo(); }
    function onChk() { draw3 = !!chk.checked; newGame(); }
    function onLang(e) {
      var l = e && e.detail && e.detail.lang;
      if (l !== 'vi' && l !== 'en') return;
      lang = l; relabel(); if (!drag) render();
    }
    function onResize() {
      if (destroyed) return;
      var w = board.clientWidth;
      if (w === lastW) return;
      lastW = w;
      if (drag) { var d = drag; drag = null; press = null; endLift(d.list); }
      layout();
      noAnim(render);
      if (fx && fx.cv && !fx.done) fx.stop();
    }

    btnNew.addEventListener('click', onNew);
    btnUndo.addEventListener('click', onUndo);
    chk.addEventListener('change', onChk);
    board.addEventListener('pointerdown', onDown);
    board.addEventListener('pointermove', onMove);
    board.addEventListener('pointerup', onUp);
    board.addEventListener('pointercancel', onCancel);
    board.addEventListener('dblclick', onDbl);
    board.addEventListener('keydown', onKey);
    board.addEventListener('contextmenu', onCtx);
    document.addEventListener('gmt:lang', onLang);

    var ro = null;
    if (typeof ResizeObserver === 'function') {
      ro = new ResizeObserver(function () { onResize(); });
      ro.observe(container);
    } else {
      window.addEventListener('resize', onResize);
    }

    relabel();
    layout();
    lastW = board.clientWidth;
    newGame();

    return {
      destroy: function () {
        if (destroyed) return;
        destroyed = true;
        stopTimer();
        clearWinFx();
        timeouts.forEach(clearTimeout); timeouts = [];
        if (ro) ro.disconnect(); else window.removeEventListener('resize', onResize);
        document.removeEventListener('gmt:lang', onLang);
        btnNew.removeEventListener('click', onNew);
        btnUndo.removeEventListener('click', onUndo);
        chk.removeEventListener('change', onChk);
        board.removeEventListener('pointerdown', onDown);
        board.removeEventListener('pointermove', onMove);
        board.removeEventListener('pointerup', onUp);
        board.removeEventListener('pointercancel', onCancel);
        board.removeEventListener('dblclick', onDbl);
        board.removeEventListener('keydown', onKey);
        board.removeEventListener('contextmenu', onCtx);
        if (root.parentNode) root.parentNode.removeChild(root);
      }
    };
  }

  window.GMTGames = window.GMTGames || {};
  window.GMTGames.solitaire = mount;
})();
