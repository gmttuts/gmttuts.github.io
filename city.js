/* GMT City — isometric portfolio map.
   World units: x, y = ground tiles, z = height (1 z = one cube tall). */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var TW = 64, TH = 32, ZH = 32;
  var RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var C = {
    ink: '#16161d', top: '#fbf8f0', grid: '#e4dfd1', paper: '#f4f1e8',
    orange: '#ff6b2c', green: '#3fcf8e', purple: '#6d5cf0', blue: '#3d8bff',
    yellow: '#ffc933', pink: '#ff7eb9', lilac: '#c9b6ff', sky: '#3db8ff', mint: '#9ee8d0',
    skin: '#f8c0a2', navy: '#262d4a', cuff: '#4a5a95', brown: '#a3563b', sleeve: '#cfe0ff', red: '#d63b48'
  };

  function P(x, y, z) { return [(x - y) * TW / 2, (x + y) * TH / 2 - (z || 0) * ZH]; }
  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function pts(a) { return a.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' '); }
  var ST = { stroke: C.ink, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' };
  function poly(g, a, fill, extra) {
    var o = { points: pts(a), fill: fill };
    for (var k in ST) o[k] = ST[k];
    if (extra) for (k in extra) o[k] = extra[k];
    return el('polygon', o, g);
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* ---------- colour helpers ---------- */
  function h2r(h) { h = h.replace('#', ''); return [0, 2, 4].map(function (i) { return parseInt(h.slice(i, i + 2), 16); }); }
  function r2h(r) { return '#' + r.map(function (v) { v = Math.round(clamp(v, 0, 255)); return (v < 16 ? '0' : '') + v.toString(16); }).join(''); }
  function mix(a, b, t) { var A = h2r(a), B = h2r(b); return r2h(A.map(function (v, i) { return v + (B[i] - v) * t; })); }
  function shade(a, t) { return t < 0 ? mix(a, '#000000', -t) : mix(a, '#ffffff', t); }
  // A flat sprite that flips around its vertical axis gets a solid edge, like a coin.
  // The edge is one vector shape: the outline swept sideways by the thickness
  // (both copies of the outline plus a quad per side), drawn once stroked and once filled
  // so only the outer silhouette keeps its ink line.
  function coinEdge(parent, before, d, col) {
    var g = el('g', { 'pointer-events': 'none' }, parent);
    parent.insertBefore(g, before);
    var tmp = el('path', { d: d }, document.getElementById('city'));
    var len = tmp.getTotalLength(), pts = [], N = 48;
    for (var i = 0; i < N; i++) { var q = tmp.getPointAtLength(len * i / N); pts.push([q.x, q.y]); }
    tmp.remove();
    var outl = el('path', { fill: col, stroke: C.ink, 'stroke-width': 2.4, 'stroke-linejoin': 'round' }, g);
    var fill = el('path', { fill: col }, g);
    function ring(a) {
      // every sub-shape wound the same way, so the nonzero fill is their union
      var ar = 0;
      for (var i = 0; i < a.length; i++) { var p = a[i], n = a[(i + 1) % a.length]; ar += p[0] * n[1] - n[0] * p[1]; }
      if (ar < 0) a = a.slice().reverse();
      return 'M' + a.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join('L') + 'Z';
    }
    return {
      set: function (tf, dx) {
        var moved = pts.map(function (p) { return [p[0] + dx, p[1]]; });
        var out = ring(pts) + ring(moved);
        for (var i = 0; i < N; i++) {
          var j = (i + 1) % N;
          if (Math.abs(pts[i][1] - pts[j][1]) < 0.01) continue;
          out += ring([pts[i], pts[j], moved[j], moved[i]]);
        }
        outl.setAttribute('d', out); fill.setAttribute('d', out);
        outl.setAttribute('transform', tf); fill.setAttribute('transform', tf);
      },
      show: function (on) { g.style.display = on ? '' : 'none'; }
    };
  }

  /* ---------- svg scaffolding ---------- */
  var svg = document.getElementById('city');
  var defs = el('defs', null, svg);
  var cam = el('g', { id: 'cam' }, svg);
  var L = {
    world: el('g', null, cam),
    route: el('g', { 'pointer-events': 'none' }, cam),
    hits: el('g', null, cam),
    actors: el('g', null, cam),
    tags: el('g', null, cam),
    sky: el('g', { 'pointer-events': 'none' }, cam),
    over: el('g', { 'pointer-events': 'none' }, cam),   // front copies of thin props, shown when an actor walks behind them
    fx: el('g', { 'pointer-events': 'none' }, cam)
  };
  var gcache = {};
  function grad(col, kind) {
    var id = 'g' + kind + col.slice(1);
    if (!gcache[id]) {
      var lg = el('linearGradient', { id: id, x1: 0, y1: 0, x2: kind === 'r' ? 1 : 0, y2: 1 }, defs);
      var s0 = kind === 'r' ? shade(col, -0.14) : col;
      var s1 = kind === 'r' ? mix(shade(col, -0.2), C.purple, 0.38) : mix(col, C.pink, 0.28);
      el('stop', { offset: 0, 'stop-color': s0 }, lg);
      el('stop', { offset: 1, 'stop-color': s1 }, lg);
      gcache[id] = 1;
    }
    return 'url(#' + id + ')';
  }

  /* ---------- iso primitives ---------- */
  var BOXES = [];   // footprints of everything solid, used by the occlusion audit
  var TOPS = [], WINS = [], TREES = [];   // box tops (snow), arched windows (lit at night), trees (seasonal crowns)
  function box(g, x, y, z, w, d, h, col, o) {
    o = o || {};
    BOXES.push({ x: x, y: y, z: z, w: w, d: d, h: h, g: g });
    var t = z + h;
    var T = [P(x, y, t), P(x + w, y, t), P(x + w, y + d, t), P(x, y + d, t)];
    var Lf = [P(x, y + d, t), P(x + w, y + d, t), P(x + w, y + d, z), P(x, y + d, z)];
    var R = [P(x + w, y, t), P(x + w, y + d, t), P(x + w, y + d, z), P(x + w, y, z)];
    var sw = o.sw == null ? 2 : o.sw;
    if (h > 0) {
      poly(g, Lf, o.left || grad(col, 'l'), { 'stroke-width': sw });
      poly(g, R, o.right || grad(col, 'r'), { 'stroke-width': sw });
    }
    var top = poly(g, T, o.top || C.top, { 'stroke-width': sw });
    if (o.grid) {
      var gg = el('g', { stroke: C.grid, 'stroke-width': 1.2 }, g);
      for (var i = 1; i < w; i++) line(gg, P(x + i, y, t), P(x + i, y + d, t));
      for (var j = 1; j < d; j++) line(gg, P(x, y + j, t), P(x + w, y + j, t));
      poly(g, T, 'none', { 'stroke-width': sw });
    }
    if (!o.nosnow) TOPS.push({ g: g, after: g.lastChild, T: T, w: w, d: d });
    return { top: top, T: T };
  }
  function line(g, a, b, extra) {
    var o = { x1: a[0], y1: a[1], x2: b[0], y2: b[1] };
    if (extra) for (var k in extra) o[k] = extra[k];
    return el('line', o, g);
  }
  // Affine frames for drawing flat art onto box faces (units: tiles across, z down).
  function faceL(x, y, z, w, d, h) { var o = P(x, y + d, z + h); return 'matrix(' + TW / 2 + ',' + TH / 2 + ',0,' + ZH + ',' + o[0] + ',' + o[1] + ')'; }
  function faceR(x, y, z, w, d, h) { var o = P(x + w, y + d, z + h); return 'matrix(' + TW / 2 + ',' + (-TH / 2) + ',0,' + ZH + ',' + o[0] + ',' + o[1] + ')'; }
  function faceT(x, y, z) { var o = P(x, y, z); return 'matrix(' + TW / 2 + ',' + TH / 2 + ',' + (-TW / 2) + ',' + TH / 2 + ',' + o[0] + ',' + o[1] + ')'; }
  var NSS = { 'vector-effect': 'non-scaling-stroke' };
  function arch(g, s, t, w, h, fill) {
    var r = w / 2;
    var d = 'M' + s + ',' + (t + h) + ' V' + (t + r) + ' A' + r + ',' + r + ' 0 0 1 ' + (s + w) + ',' + (t + r) + ' V' + (t + h) + ' Z';
    var e = el('path', { d: d, fill: fill || C.ink, stroke: C.ink, 'stroke-width': 1.5, 'vector-effect': 'non-scaling-stroke' }, g);
    WINS.push({ n: e, g: g, cx: s + w / 2, cy: t + h / 2, w: w, h: h, d: d });
    return e;
  }
  function stairs(g, axis, from, to, other, z0, z1, col) {
    // axis 'y' or 'x'; steps go from `from` (at z0) to `to` (at z1)
    var n = 4, dir = to > from ? 1 : -1, len = Math.abs(to - from) / n;
    var steps = [];
    for (var i = 0; i < n; i++) {
      var a = from + dir * i * len, b = a + dir * len;
      var lo = Math.min(a, b);
      var top = z0 + (z1 - z0) * (i + 1) / n;
      steps.push({ lo: lo, top: top });
    }
    steps.sort(function (p, q) { return p.lo - q.lo; });
    steps.forEach(function (s) {
      if (axis === 'y') box(g, other, s.lo, 0, 1, len, s.top, col);
      else box(g, s.lo, other, 0, len, 1, s.top, col);
    });
  }
  // a thin bridge deck; no stub legs (they read as glitches, not supports)
  var SLABS = [];
  function slab(g, x, y, w, d, z, col) {
    box(g, x, y, z - 0.25, w, d, 0.25, col);
    SLABS.push([x, y, w, d]);
  }
  function onBridge(x, y) { return SLABS.some(function (b) { return x >= b[0] - 0.05 && x <= b[0] + b[2] + 0.05 && y >= b[1] - 0.05 && y <= b[1] + b[3] + 0.05; }); }

  /* ---------- impacts: shake, dust, shockwave, nearby things react ---------- */
  var QUAKE = { t0: -99, x: 0, y: 0, f: 0 }, shake = 0, PARTS = [], PADS = [];
  function quake(x, y) {
    var dt = simT - QUAKE.t0;
    if (dt > 1.6 || !QUAKE.f) return 0;
    var fall = Math.max(0, 1 - Math.hypot(x - QUAKE.x, y - QUAKE.y) / 6.5);
    return -QUAKE.f * fall * Math.exp(-dt * 4.5) * Math.sin(dt * 26) * 5;
  }
  function pad(g, x, y, z) {
    var w = 0.5, d = 0.4, pg = el('g', null, g);
    box(pg, x, y, z, w, d, 0.06, C.navy, { top: shade(C.navy, 0.35) });
    var coil = el('path', { fill: 'none', stroke: C.ink, 'stroke-width': 1.8, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, pg);
    var plate = el('g', null, pg);
    box(plate, x, y, z + 0.06, w, d, 0.1, C.pink, { top: shade(C.pink, 0.4) });
    PADS.push({ g: pg, plate: plate, coil: coil, feet: [P(x + 0.07, y + d - 0.07, z + 0.06), P(x + w - 0.07, y + d - 0.07, z + 0.06), P(x + w - 0.07, y + 0.07, z + 0.06)], rest: 9, x: x + w / 2, y: y + d / 2, hold: 0, A: 0, t: 9 });
  }
  function padAt(p) {
    var best = null, bd = 0.8;
    PADS.forEach(function (q) { var d = Math.hypot(q.x - p[0], q.y - p[1]); if (d < bd) { bd = d; best = q; } });
    return best;
  }
  function padHold(p, q) { var pd = padAt(p); if (pd) pd.hold = q * 4; }
  function padKick(p, a) { var pd = padAt(p); if (pd) { pd.hold = 0; pd.A = a; pd.t = 0; } }
  function updatePads(dt) {
    PADS.forEach(function (q) {
      q.t += dt;
      var off = q.hold > 0 ? q.hold : q.A * Math.exp(-q.t * 5) * Math.cos(q.t * 24);
      var hgt = clamp(q.rest - off, 2.5, 20), d = '';
      q.feet.forEach(function (f) {
        d += 'M' + f[0] + ',' + f[1];
        for (var k = 1; k <= 4; k++) d += ' L' + (f[0] + (k % 2 ? 2.6 : -2.6)) + ',' + (f[1] - hgt * (k - 0.5) / 4).toFixed(1);
        d += ' L' + f[0] + ',' + (f[1] - hgt).toFixed(1) + ' ';
      });
      q.coil.setAttribute('d', d);
      q.plate.setAttribute('transform', 'translate(0,' + (-hgt).toFixed(2) + ')');
    });
  }
  function impact(x, y, z, f) {
    QUAKE = { t0: simT, x: x, y: y, f: f };
    shake = Math.max(shake, 9 * f);
    var p = P(x, y, z);
    // shockwave ring on the ground
    var ring = el('ellipse', { cx: p[0], cy: p[1], rx: 6, ry: 3, fill: 'none', stroke: C.ink, 'stroke-width': 2.5 }, L.fx);
    PARTS.push({ n: ring, ring: 1, life: 0.55, max: 0.55, r: 6, vr: 150 * (0.4 + f) });
    // dust puffs fanning out
    var n = Math.round(5 + 9 * f);
    for (var i = 0; i < n; i++) {
      var side = i % 2 ? 1 : -1, sp = (30 + Math.random() * 70) * (0.4 + f);
      var c = el('circle', { cx: p[0], cy: p[1], r: 3, fill: '#fff', stroke: C.ink, 'stroke-width': 1.6 }, L.fx);
      PARTS.push({ n: c, x: p[0] + side * 4, y: p[1], vx: side * sp, vy: -(10 + Math.random() * 40) * (0.3 + f), r: 2 + Math.random() * 3 * (0.5 + f), life: 0.5 + Math.random() * 0.4, max: 0.9 });
    }
    // creatures nearby get bumped away
    CRE.forEach(function (c) {
      var d = Math.hypot(c.x - x, c.y - y), R = 1.2 + 3 * f;
      if (d > R) return;
      var k = (1 - d / R) * f;
      c.jump = 0.6; c.jh = 0.35 + k * 1.3;
      c.kx += (c.x - x) / (d || 1) * k * 0.45; c.ky += (c.y - y) / (d || 1) * k * 0.45;
      c.scare = 0.4 + k * 1.2;
      if (c.st === 'sleep') { c.st = 'idle'; c.timer = 0; c.dur = 0.6; }
    });
    if (f > 0.5) SFX.thud();
  }
  function updateParts(dt) {
    for (var i = PARTS.length - 1; i >= 0; i--) {
      var q = PARTS[i];
      q.life -= dt;
      if (q.life <= 0) { q.n.remove(); PARTS.splice(i, 1); continue; }
      var a = q.life / q.max;
      if (q.ring) {
        q.r += q.vr * dt;
        q.n.setAttribute('rx', q.r.toFixed(1)); q.n.setAttribute('ry', (q.r / 2).toFixed(1));
      } else {
        q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 70 * dt; q.vx *= Math.pow(0.12, dt); q.r += 9 * dt;
        q.n.setAttribute('cx', q.x.toFixed(1)); q.n.setAttribute('cy', q.y.toFixed(1)); q.n.setAttribute('r', q.r.toFixed(1));
      }
      q.n.setAttribute('opacity', Math.min(1, a * 1.6).toFixed(2));
    }
  }

  /* ---------- animation registry ---------- */
  var anims = [];
  function anim(fn) { anims.push(fn); }

  /* ---------- small decor ---------- */
  function tree(g, x, y, z, col) {
    BOXES.push({ x: x - 0.2, y: y - 0.2, z: z, w: 0.4, d: 0.4, h: 1.4, tree: 1 });
    var b = P(x, y, z);
    var tg = el('g', { transform: 'translate(' + b[0] + ',' + b[1] + ')' }, g);
    var sway = el('g', null, tg);
    el('ellipse', { cx: 0, cy: 0, rx: 9, ry: 4.5, fill: 'rgba(22,22,29,.15)' }, tg);
    el('path', { d: 'M0,0 V-22', stroke: C.ink, 'stroke-width': 3.5, 'stroke-linecap': 'round' }, sway);
    var crown = el('circle', { cx: 0, cy: -30, r: 11, fill: col, stroke: C.ink, 'stroke-width': 2 }, sway);
    el('path', { d: 'M-5,-35 q3,-4 7,-3', stroke: '#fff', 'stroke-width': 2.2, fill: 'none', 'stroke-linecap': 'round', opacity: 0.8 }, sway);
    TREES.push({ crown: crown, col: col, sway: sway });
    var ph = Math.random() * 6;
    anim(function (t) { sway.setAttribute('transform', 'rotate(' + (Math.sin(t * 1.6 + ph) * 4 + quake(x, y) * 3).toFixed(2) + ')'); });
  }
  function bulb(g, x, y, z, col) {
    var p = P(x, y, z);
    var c = el('circle', { cx: p[0], cy: p[1], r: 3.5, fill: col, stroke: C.ink, 'stroke-width': 1.5 }, g);
    var ph = Math.random() * 6;
    anim(function (t) { c.setAttribute('fill', Math.sin(t * 3 + ph) > 0 ? col : '#fff'); });
  }

  /* ================= ZONES ================= */
  var ZONES = [
    { n: '01', en: 'Home', vi: 'Nhà', file: 'ABOUT.TXT', col: C.orange, b: [6, 15, 4, 3, 1], hb: 2.2 },
    { n: '02', en: 'Stats Tower', vi: 'Tháp số liệu', file: 'STATS.EXE', col: C.green, b: [1, 9, 3, 3, 2], hb: 3.4 },
    { n: '03', en: 'Cinema', vi: 'Rạp phim', file: 'PROJECTS.MP4', col: C.purple, b: [1, 2, 3, 3, 3], hb: 2.2 },
    { n: '04', en: 'Dezi Gallery', vi: 'Dezi Gallery', file: 'DEZI.URL', col: C.blue, b: [7, 2, 3, 3, 3], hb: 2.2 },
    { n: '05', en: 'Workshop', vi: 'Xưởng kỹ năng', file: 'SKILLS.KEY', col: C.yellow, b: [12, 2, 3, 3, 2], hb: 1.6 },
    { n: '06', en: 'Motion Studio', vi: 'Xưởng motion', file: 'SERVICES.AE', col: C.pink, b: [12, 9, 3, 3, 1], hb: 1.8 },
    { n: '07', en: 'Post Office', vi: 'Bưu điện', file: 'CONTACT.MAIL', col: C.lilac, b: [12, 15, 3, 3, 1], hb: 3 }
  ];

  /* Route: closed loop. `s` marks the stop index of a zone. */
  var NODES = [
    { p: [8, 16.7, 1], s: 0 },
    { p: [2.5, 16.7, 1] },
    { p: [2.5, 14, 1] },
    { p: [2.5, 12, 2], t: 'stairs' },
    { p: [2.5, 11.2, 2], s: 1 },
    { p: [2.5, 7, 2] },
    { p: [2.5, 5, 3], t: 'stairs' },
    { p: [2.5, 4.1, 3], s: 2 },
    { p: [3.9, 4.1, 3] },
    { p: [7.1, 4.1, 3], t: 'rope' },
    { p: [8.5, 4.1, 3], s: 3 },
    { p: [10, 4.1, 3] },
    { p: [12, 4.1, 2], t: 'stairs' },
    { p: [13.5, 4.1, 2], s: 4 },
    { p: [14.68, 4.22, 2] },
    { p: [13.95, 10.95, 1], t: 'slide' },
    { p: [13.5, 10.5, 1], s: 5 },
    { p: [13.5, 16.7, 1], s: 6 }
    // closes back to node 0 with a walk
  ];
  var SEGS = NODES.map(function (n, i) {
    var nx = NODES[(i + 1) % NODES.length];
    return { a: n.p, b: nx.p, t: nx.t || 'walk' };
  });
  var STOP_NODE = [];
  NODES.forEach(function (n, i) { if (n.s != null) STOP_NODE[n.s] = i; });

  /* Route graph: the loop plus a shortcut hopping across the tops of G, M, T. */
  var GN = NODES.map(function (n) { return n.p; });
  var ADJ = GN.map(function () { return []; });
  function edge(u, v, t) {
    var a = GN[u], b = GN[v], len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    var c = t === 'rope' ? len * 1.6 : t === 'jump' || t === 'slide' ? 4 : t === 'hop' ? 0.9 : t === 'stairs' ? len * 1.3 : len;
    ADJ[u].push({ to: v, t: t, c: c }); ADJ[v].push({ to: u, t: t, c: c });
  }
  function addNode(p) { GN.push(p); ADJ.push([]); return GN.length - 1; }
  SEGS.forEach(function (sg, i) { edge(i, (i + 1) % NODES.length, sg.t); });
  (function () {
    var LZ = 3.2, LY = 10.35;
    var chain = [STOP_NODE[1], addNode([3.7, LY, 2]), addNode([5.85, LY, LZ]), addNode([7.35, LY, LZ]), addNode([9.35, LY, LZ]), addNode([10.85, LY, LZ]), addNode([12.35, LY, 1]), STOP_NODE[5]];
    for (var i = 0; i < chain.length - 1; i++) edge(chain[i], chain[i + 1], i === 0 || i === chain.length - 2 ? 'walk' : 'hop');
  })();
  function plan(from, to) {
    var dist = GN.map(function () { return Infinity; }), prev = [], done = [];
    dist[from] = 0;
    for (;;) {
      var u = -1;
      for (var i = 0; i < GN.length; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
      if (u < 0 || u === to) break;
      done[u] = 1;
      ADJ[u].forEach(function (e) { if (dist[u] + e.c < dist[e.to]) { dist[e.to] = dist[u] + e.c; prev[e.to] = { u: u, t: e.t }; } });
    }
    var list = [], n = to;
    while (n !== from && prev[n]) {
      var pr = prev[n], a = GN[pr.u], b = GN[n];
      list.unshift({ a: a, b: b, t: pr.t, len: Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), endNode: n });
      n = pr.u;
    }
    return list;
  }

  var ROPE = { a: P(3.9, 3.8, 4.55), b: P(7.1, 3.8, 4.55), sag: 15, wob: 0, wv: 0, hold: null, load: 0 };

  /* Water slide 05 → 06: a drop off the tower, a vertical loop, a U-turn into the studio.
     The centreline is sampled once; `t` is the ride time at each sample (energy minus friction). */
  var SLIDE = (function () {
    function cat(p0, p1, p2, p3, u) {
      return [0, 1, 2].map(function (i) {
        var a = p0[i], b = p1[i], c = p2[i], d = p3[i];
        return 0.5 * (2 * b + (c - a) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (3 * b - a - 3 * c + d) * u * u * u);
      });
    }
    // only spans cp[from]..cp[to]; the outer points just steer the end tangents
    function spline(cp, n, out, from, to) {
      for (var i = from; i < to; i++) {
        var p0 = cp[Math.max(0, i - 1)], p3 = cp[Math.min(cp.length - 1, i + 2)];
        for (var k = 0; k < n; k++) out.push(cat(p0, cp[i], cp[i + 1], p3, k / n));
      }
    }
    // off the tower heading right, a wide sweep down and round toward the viewer, a loop that
    // faces the camera (it drifts toward the viewer so the way out passes in front of the way in),
    // then a long banked climb that throws the rider off high above the studio roof
    var pts = [], R = 1.15, RZ = 1.45, ex = 18.35, ey = 7.3, ez = 0.65, lw = 1.15, s2 = Math.SQRT1_2;
    // the loop's own direction where it starts and ends; the splines either side are steered
    // along it so there's no kink at the joins
    var lt = [-R * s2 + lw * s2 / (Math.PI * 2), R * s2 + lw * s2 / (Math.PI * 2), 0], ll = Math.hypot(lt[0], lt[1]);
    lt = [lt[0] / ll, lt[1] / ll, 0];
    function along(p, q, sign) { var L = Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) * 2 * sign; return [p[0] + lt[0] * L, p[1] + lt[1] * L, p[2]]; }
    // The track is built raw (spline in, loop, spline out), then respaced evenly and relaxed
    // as ONE line, joins included, so the bend changes gradually everywhere: no corners.
    function even(a, step) {
      var out = [a[0]], acc = 0;
      for (var i = 1; i < a.length; i++) {
        var p = a[i - 1], q = a[i], d = Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]), u = step - acc;
        while (u <= d) { var w = u / d; out.push([lerp(p[0], q[0], w), lerp(p[1], q[1], w), lerp(p[2], q[2], w)]); u += step; }
        acc = d - (u - step);
      }
      out.push(a[a.length - 1]);
      return out;
    }
    function relax(a, fixA, fixB, n) {
      for (var r = 0; r < n; r++) {
        var b = a.map(function (p) { return p.slice(); });
        for (var i = fixA; i < a.length - fixB; i++) for (var j = 0; j < 3; j++) b[i][j] = (a[i - 1][j] + 2 * a[i][j] + a[i + 1][j]) / 4;
        a = b;
      }
      return a;
    }
    function arc(a) { var L = [0]; for (var i = 1; i < a.length; i++) L.push(L[i - 1] + Math.hypot(a[i][0] - a[i - 1][0], a[i][1] - a[i - 1][1], a[i][2] - a[i - 1][2])); return L; }
    var inA = [19.4, 6.7, 0.75], raw = [];
    spline([[14.96, 3.78, 3.4], [16.0, 3.9, 3.15], [17.3, 4.2, 2.6], [18.8, 4.9, 1.8], [19.6, 6.0, 1.1], inA, [ex, ey, ez], along(inA, [ex, ey, ez], 1)], 12, raw, 0, 6);
    // the loop peels off at its right-hand side, where it points straight down, so the track
    // drops vertically and then bends one way only into the U (no S)
    function loopAt(th) { var f = R * Math.sin(th), dr = lw * th / (Math.PI * 2); return [ex - f * s2 + dr * s2, ey + f * s2 + dr * s2, ez + RZ * (1 - Math.cos(th))]; }
    var rFrom = raw.length, TH = Math.PI * 1.5;
    for (var k = 0; k < 72; k++) raw.push(loopAt(k / 96 * Math.PI * 2));
    var rTo = raw.length, lo = loopAt(TH);
    var ld = [-s2 * R * Math.cos(TH) + s2 * lw / (Math.PI * 2), s2 * R * Math.cos(TH) + s2 * lw / (Math.PI * 2), RZ * Math.sin(TH)];
    // out of the loop: a deep round U, a climb in front of the studio's yellow block, a crest,
    // and a lip that curls down toward the 06 mat (the user's sketch)
    var o1 = [19.73, 7.24, 1.3], lL = Math.hypot(o1[0] - lo[0], o1[1] - lo[1], o1[2] - lo[2]) * 2 / Math.hypot(ld[0], ld[1], ld[2]);
    spline([[o1[0] - ld[0] * lL, o1[1] - ld[1] * lL, o1[2] - ld[2] * lL], lo, o1, [19.99, 7.7, 1.0], [20.12, 8.05, 0.85], [20.38, 8.85, 0.72], [20.43, 9.57, 0.66], [20.6, 10.6, 0.7], [19.95, 11.6, 0.62], [18.95, 12.2, 0.82], [17.82, 12.2, 1.01], [16.68, 11.5, 1.75], [16.47, 11.4, 3.28], [16.14, 11.3, 3.96], [15.7, 11.2, 4.03], [15.27, 11.1, 3.43], [14.84, 11.0, 2.83]], 12, raw, 1, 15);
    raw.push([15.27, 11.1, 3.43]);
    var rs = arc(raw), sFrom = rs[rFrom], sTo = rs[rTo];
    pts = relax(even(raw, 0.1), 2, 1, 60);
    // where the loop now starts and ends along the smoothed line
    var ps = arc(pts), tot = ps[ps.length - 1], rTot = rs[rs.length - 1], loopFrom = 0, loopTo = 0;
    while (ps[loopFrom] < sFrom / rTot * tot) loopFrom++;
    loopTo = loopFrom;
    while (ps[loopTo] < sTo / rTot * tot) loopTo++;
    // ride time: speed from the drop height, a little friction so the run-out slows down
    var E = pts[0][2] + 0.32, s = 0, t = 0, out = [];
    pts.forEach(function (p, i) {
      if (i) {
        var q = pts[i - 1], ds = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
        s += ds;
        // falls fast off the tower, crawls over the loop, then a water jet in the run-out
        // floors it all the way up the last climb so the rider gets flung off the lip
        var jet = i > loopTo ? clamp((i - loopTo) / (pts.length - loopTo), 0, 1) : 0;
        jet = jet * jet * (3 - 2 * jet);
        var h = Math.max(0.3 + jet * 0.5, E - p[2] - s * 0.03);
        t += ds / (Math.sqrt(2 * 9.8 * h) * (1 + 2.2 * jet));
      }
      out.push({ p: p, s: s, t: t, loop: i >= loopFrom && i < loopTo });
    });
    var T = RM ? 0.3 : 3.6, k0 = T / t;
    out.forEach(function (o) { o.t *= k0; o.sp = P(o.p[0], o.p[1], o.p[2]); });
    return { pts: out, T: T, loopFrom: loopFrom, loopTo: loopTo, top: [14.88, 3.78, 3.4], foot: [14.68, 4.22, 2], land: [13.95, 10.95, 1] };
  })();
  // position + screen tangent on the slide at ride time t
  function slideAt(t) {
    var a = SLIDE.pts, i = 1;
    t = clamp(t, 0, SLIDE.T);
    while (i < a.length - 1 && a[i].t < t) i++;
    var p = a[i - 1], q = a[i], u = (t - p.t) / ((q.t - p.t) || 1);
    return { p: [lerp(p.p[0], q.p[0], u), lerp(p.p[1], q.p[1], u), lerp(p.p[2], q.p[2], u)], d: [q.sp[0] - p.sp[0], q.sp[1] - p.sp[1]], loop: p.loop, i: i };
  }

  /* draw list sorted by depth */
  var items = [];
  function item(key, fn) { items.push({ k: key, f: fn }); }

  // the loop's bridges + stairs
  // Home → Stats walkway: one L-shaped deck. Back arm first, then the front one, then a single
  // top over both so it reads as one level with no seam at the corner.
  item(2 + 16.5 + 0.1, function (g) {
    slab(g, 2, 14, 1, 2.2, 1, C.orange); slab(g, 2, 16.2, 4, 1, 1, C.orange);
    poly(g, [P(2, 14, 1), P(3, 14, 1), P(3, 16.2, 1), P(6, 16.2, 1), P(6, 17.2, 1), P(2, 17.2, 1)], C.top);
  });
  item(2.5 + 13, function (g) { stairs(g, 'y', 14, 12, 2, 1, 2, C.green); });
  item(2.5 + 8, function (g) { slab(g, 2, 7, 1, 2, 2, C.green); });
  item(2.5 + 6, function (g) { stairs(g, 'y', 7, 5, 2, 2, 3, C.purple); });
  item(11 + 3.5, function (g) { stairs(g, 'x', 10, 12, 3.6, 3, 2, C.yellow); });
  item(13.5 + 13.5, function (g) { slab(g, 13, 12, 1, 3, 1, C.pink); });
  item(11 + 16.5, function (g) { slab(g, 10, 16.2, 2, 1, 1, C.lilac); });

  // the water slide stands right of both blocks, so it draws after them in one go: supports
  // first, then the track in two runs split at the top of the loop, so the loop's way out
  // (nearer the viewer) crosses over its way in with a proper outline
  var SLIDE_WATER = [], SLIDE_OVER = null, SLIDE_RUN = 0, SLIDE_IN = RM ? 0.05 : 1.3, SLIDE_OUT = RM ? 0.05 : 1.25;
  item(25.5, function (g) {
    var a = SLIDE.pts, sg = el('g', null, g), half = SLIDE.loopFrom + Math.round((SLIDE.loopTo - SLIDE.loopFrom) / 1.5);
    var feet = [];
    function post(p) {
      // only on open ground, and not crowding another post
      if (p[0] > 11.9 && p[0] < 15.1 && (p[1] > 8.9 && p[1] < 12.1 || p[1] < 5.1)) return;
      if (p[2] < 0.35 || feet.some(function (q) { return Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.75; })) return;
      feet.push(p);
      var t0 = P(p[0], p[1], p[2] - 0.12), b0 = P(p[0], p[1], 0);
      el('ellipse', { cx: b0[0], cy: b0[1], rx: 6, ry: 3, fill: C.navy, stroke: C.ink, 'stroke-width': 1.5 }, sg);
      line(sg, t0, b0, { stroke: C.ink, 'stroke-width': 5.5, 'stroke-linecap': 'round' });
      line(sg, t0, b0, { stroke: C.yellow, 'stroke-width': 2.4, 'stroke-linecap': 'round' });
    }
    // the loop first (its foot and both sides), then one every ~1.1 tiles of ground covered
    [0, 0.333].forEach(function (u) { post(a[SLIDE.loopFrom + Math.round((SLIDE.loopTo - SLIDE.loopFrom) * u)].p); });
    var gone = 0.6;
    a.forEach(function (o, i) {
      if (!i || o.loop) return;
      var q = a[i - 1].p;
      gone += Math.hypot(o.p[0] - q[0], o.p[1] - q[1]);
      if (gone >= 1.1) { var n = feet.length; post(o.p); if (feet.length > n) gone = 0; }
    });
    var run = 0;
    // the loop's way out also gets a copy above the hero, shown while the hero is still on the
    // way in, so the near side of the loop passes in front of the rider instead of under them
    SLIDE_OVER = el('g', { display: 'none' }, L.sky);
    [[0, half, sg], [half, a.length - 1, sg], [SLIDE.loopTo - 15, SLIDE.loopTo + 12, SLIDE_OVER]].forEach(function (r, ri) {
      var d = '', sg = r[2];
      for (var i = r[0]; i <= r[1]; i++) d += (i > r[0] ? ' L' : 'M') + a[i].sp[0].toFixed(1) + ',' + a[i].sp[1].toFixed(1);
      el('path', { d: d, fill: 'none', stroke: C.ink, 'stroke-width': 17, 'stroke-linejoin': 'round', 'stroke-linecap': 'butt' }, sg);
      el('path', { d: d, fill: 'none', stroke: C.sky, 'stroke-width': 11.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'butt', 'data-slide': 'body' }, sg);
      el('path', { d: d, fill: 'none', stroke: shade(C.sky, 0.45), 'stroke-width': 4, 'stroke-linejoin': 'round', 'stroke-linecap': 'butt', transform: 'translate(0,-2.2)', 'data-slide': 'hi' }, sg);
      var w = el('path', { d: d, class: 'slide-water', fill: 'none', stroke: '#fff', 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-dasharray': '6 14', transform: 'translate(0,-2.2)' }, sg);
      SLIDE_WATER.push({ n: w, o: run });
      if (ri === 2) SLIDE_WATER[SLIDE_WATER.length - 1].o = SLIDE_RUN;
      if (ri === 1) for (i = half, SLIDE_RUN = run; i < SLIDE.loopTo - 15; i++) SLIDE_RUN += Math.hypot(a[i + 1].sp[0] - a[i].sp[0], a[i + 1].sp[1] - a[i].sp[1]);
      for (i = r[0]; i < r[1]; i++) run += Math.hypot(a[i + 1].sp[0] - a[i].sp[0], a[i + 1].sp[1] - a[i].sp[1]);
    });
    // lip at the end of the kicker
    var e = a[a.length - 1].sp;
    el('ellipse', { cx: e[0], cy: e[1], rx: 5.5, ry: 8, fill: shade(C.sky, 0.3), stroke: C.ink, 'stroke-width': 2.5, 'data-slide': 'lip' }, sg);
  });
  anim(function (t) { SLIDE_WATER.forEach(function (w) { w.n.setAttribute('stroke-dashoffset', (w.o - t * 90).toFixed(1)); }); });
  // launch tower on the Workshop roof, right of the stop mat (so it never hides the hero
  // standing there): a short open truss with a deck and a hand ladder on its front face.
  // The hero climbs in front of the ladder, so nothing of the tower ever sits in front of it.
  var TOWER = { x0: 14.4, x1: 14.95, y0: 3.5, y1: 4.05, z0: 2, z1: 3.3 };
  item(14.68 + 3.78, function (g) {
    var T0 = TOWER, x0 = T0.x0, x1 = T0.x1, y0 = T0.y0, y1 = T0.y1, z0 = T0.z0, z1 = T0.z1;
    // legs and cross braces share one outline pass and one colour pass, so they join cleanly
    var legs = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].map(function (c) { return [P(c[0], c[1], z0), P(c[0], c[1], z1), 5.5, 2.4]; });
    var braces = [[[x1, y0, z0], [x1, y1, z1]], [[x1, y1, z0], [x1, y0, z1]]].map(function (b) { return [P(b[0][0], b[0][1], b[0][2]), P(b[1][0], b[1][1], b[1][2]), 3.8, 1.5]; });
    var bars = braces.concat(legs);
    bars.forEach(function (b) { line(g, b[0], b[1], { stroke: C.ink, 'stroke-width': b[2], 'stroke-linecap': 'round' }); });
    bars.forEach(function (b) { line(g, b[0], b[1], { stroke: C.yellow, 'stroke-width': b[3], 'stroke-linecap': 'round' }); });
    box(g, x0 - 0.05, y0 - 0.05, z1, x1 - x0 + 0.1, y1 - y0 + 0.1, 0.1, C.yellow, { top: shade(C.yellow, 0.55) });
    // hand ladder on the front (+y) face, rails poking above the deck as grab handles
    // all the outline first, then all the colour, so rungs and rails merge instead of cutting into each other
    var lx0 = 14.55, lx1 = 14.8, ly = y1 + 0.06, top = z1 + 0.22, bars = [];
    [lx0, lx1].forEach(function (x) { bars.push([P(x, ly, z0), P(x, ly, top)]); });
    for (var r = z0 + 0.2; r < z1 + 0.05; r += 0.24) bars.push([P(lx0, ly, r), P(lx1, ly, r)]);
    bars.forEach(function (b) { line(g, b[0], b[1], { stroke: C.ink, 'stroke-width': 4.6, 'stroke-linecap': 'round' }); });
    bars.forEach(function (b) { line(g, b[0], b[1], { stroke: C.orange, 'stroke-width': 1.9, 'stroke-linecap': 'round' }); });
  });

  /* ---------- light seasonal touches around some zone windows (European street style) ---------- */
  // spring flower boxes, summer striped awnings, autumn ivy, winter pine swags; drawn in px around the arch
  // two quiet strips that belong to the same family as the cinema's feature wall each season,
  // but each with its own motif: v 0 on the Stats Tower, v 1 on the Motion Studio
  var BANDS = { 1: ['r', 0.12, 1.25, 0], 5: ['r', 0.1, 0.2, 1] };   // zone -> face, u, v of an 86x22px strip, variant
  function band(i, fl, fr) {
    var p = BANDS[i];
    if (!p) return;
    var g = el('g', { transform: 'translate(' + p[1] + ',' + p[2] + ') scale(0.03125)' }, p[0] === 'l' ? fl : fr);
    var W = 86, H = 22, v = p[3], k, d;
    var ink = function (o) { return Object.assign({ stroke: C.ink, 'stroke-width': 1.2, 'stroke-linejoin': 'round' }, o); };
    function rose(sg, x, y) {
      el('circle', ink({ cx: x, cy: y, r: 2.8, fill: '#ff7eb9', 'stroke-width': 0.8 }), sg);
      el('path', { d: 'M' + (x - 1) + ',' + y + ' a1,1 0 1 1 1,1', fill: 'none', stroke: 'rgba(22,22,29,.55)', 'stroke-width': 0.6 }, sg);
    }
    function lf(sg, x, y, r) { el('ellipse', ink({ cx: x, cy: y, rx: 2.3, ry: 1.3, fill: '#3aa36c', 'stroke-width': 0.6, transform: 'rotate(' + r + ',' + x + ',' + y + ')' }), sg); }

    // SPRING — garden: a picket fence with roses / a draped leafy vine
    var sp = sgroup(g, 'spring');
    if (v === 0) {
      el('path', { d: 'M0,14 H86 M0,19 H86', stroke: C.ink, 'stroke-width': 3.2 }, sp);
      el('path', { d: 'M0,14 H86 M0,19 H86', stroke: '#d9a873', 'stroke-width': 1.6 }, sp);
      for (k = 0; k < 9; k++) { var px = 4 + k * 9.8; el('path', ink({ d: 'M' + (px - 2) + ',22 V7 l2,-3 l2,3 V22 Z', fill: '#e8c08f' }), sp); }
      [[12, 9], [36, 8], [61, 9], [79, 8]].forEach(function (r) { lf(sp, r[0] + 3, r[1] + 3, 30); rose(sp, r[0], r[1]); });
    } else {
      d = 'M0,4 Q21.5,16 43,4 Q64.5,16 86,4';
      el('path', { d: d, fill: 'none', stroke: '#2f7d55', 'stroke-width': 1.6 }, sp);
      for (k = 1; k < 12; k++) { if (k === 6) continue; var t = (k % 6) / 6; lf(sp, k * 86 / 12, 4 + 24 * t * (1 - t) + (k % 2 ? -1.6 : 1.6), k % 2 ? 35 : -35); }
      rose(sp, 21.5, 10); rose(sp, 64.5, 10);
    }

    // SUMMER — azulejo: a wave frieze / three loose tiles
    var su = sgroup(g, 'summer'), T = 14;
    if (v === 0) {
      for (k = 0; k < 6; k++) {
        var x = 1 + k * T, tg = el('g', null, su);
        el('rect', { x: x, y: 4, width: T, height: T, fill: '#f7fbff', stroke: '#9ec3e6', 'stroke-width': 0.7 }, tg);
        el('path', { d: 'M' + x + ',14 q3.5,-6 7,0 t7,0 M' + x + ',9 q3.5,-4 7,0 t7,0', fill: 'none', stroke: '#2d6fc1', 'stroke-width': 1.4 }, tg);
      }
      el('rect', { x: 1, y: 4, width: T * 6, height: T, fill: 'none', stroke: C.ink, 'stroke-width': 1.2 }, su);
    } else {
      [14, 43, 72].forEach(function (cx, n) {
        var tg = el('g', { transform: 'rotate(' + [-4, 3, -2][n] + ',' + cx + ',11)' }, su);
        el('rect', ink({ x: cx - 8, y: 3, width: 16, height: 16, fill: '#f7fbff' }), tg);
        el('rect', { x: cx - 6, y: 5, width: 12, height: 12, fill: 'none', stroke: '#2d6fc1', 'stroke-width': 0.9 }, tg);
        var d2 = '';
        for (var q = 0; q < 8; q++) { var a = q * Math.PI / 4 - Math.PI / 2, r = q % 2 ? 2 : 5; d2 += (q ? 'L' : 'M') + (cx + Math.cos(a) * r).toFixed(1) + ',' + (11 + Math.sin(a) * r).toFixed(1); }
        el('path', { d: d2 + 'Z', fill: '#2d6fc1' }, tg);
        el('circle', { cx: cx, cy: 11, r: 1.2, fill: '#f2b33d' }, tg);
      });
    }

    // AUTUMN — folk art on cream: a tulip-and-dot border / two birds and a heart
    var au = sgroup(g, 'autumn');
    if (v === 0) {
      el('rect', ink({ x: 0, y: 2, width: W, height: 18, rx: 2, fill: '#f6e2c2' }), au);
      el('rect', { x: 2.5, y: 4.5, width: W - 5, height: 13, rx: 1.5, fill: 'none', stroke: '#c9682a', 'stroke-width': 1, 'stroke-dasharray': '1.2 2.2', 'stroke-linecap': 'round' }, au);
      for (k = 0; k < 5; k++) {
        var tx2 = 10 + k * 16.5, col = ['#e5532f', '#ff8a2c', '#ffc233'][k % 3];
        el('path', ink({ d: 'M' + (tx2 - 3.5) + ',9 q0,5 3.5,5 q3.5,0 3.5,-5 l-1.75,1.6 l-1.75,-2.4 l-1.75,2.4 Z', fill: col, 'stroke-width': 0.8 }), au);
        if (k < 4) el('circle', { cx: tx2 + 8.25, cy: 11, r: 1.1, fill: '#7a4630' }, au);
      }
    } else {
      el('rect', ink({ x: 22, y: 1, width: 42, height: 20, rx: 10, fill: '#f6e2c2' }), au);
      [[34, 1], [52, -1]].forEach(function (b) {
        var x = b[0], m = b[1];
        el('path', ink({ d: 'M' + (x - 5 * m) + ',14 q' + (2 * m) + ',-8 ' + (7 * m) + ',-6 q' + (3 * m) + ',1 ' + (2 * m) + ',4 l' + (2.5 * m) + ',1 l' + (-2.5 * m) + ',1 q' + (-2 * m) + ',4 ' + (-9 * m) + ',1 Z', fill: m > 0 ? '#e5532f' : '#ff8a2c', 'stroke-width': 0.9 }), au);
        el('circle', { cx: x + 2.2 * m, cy: 9.5, r: 0.8, fill: C.ink }, au);
      });
      el('path', ink({ d: 'M43,15 l-3.2,-3.4 a1.9,1.9 0 0 1 3.2,-2.4 a1.9,1.9 0 0 1 3.2,2.4 Z', fill: '#ffc233', 'stroke-width': 0.8 }), au);
    }

    // WINTER — Nordic on navy: a row of little pines / a Fair Isle diamond chain
    var wi = sgroup(g, 'winter');
    el('rect', ink({ x: 0, y: 2, width: W, height: 18, rx: 2, fill: '#27325e' }), wi);
    if (v === 0) {
      for (k = 0; k < 8; k++) {
        var cx = 6 + k * 10.6;
        el('path', { d: 'M' + cx + ',5 l3.6,5 h-2 l3,4.5 h-3 v2.5 h-3.2 v-2.5 h-3 l3,-4.5 h-2 Z', fill: '#fff' }, wi);
      }
    } else {
      for (k = 0; k < 9; k++) {
        var cx2 = 5 + k * 9.5;
        el('path', { d: 'M' + cx2 + ',5 l4,6 l-4,6 l-4,-6 Z', fill: 'none', stroke: '#fff', 'stroke-width': 1.3 }, wi);
        el('path', { d: 'M' + cx2 + ',9 v4 M' + (cx2 - 2) + ',11 h4', stroke: k % 2 ? '#ff6b6b' : '#fff', 'stroke-width': 1 }, wi);
      }
    }
  }

  // one bigger feature wall (the cinema's side): a different European craft each season
  // FW_BANDS: the cinema's side gets two matching strips (top and bottom edge) instead of one centred panel
  var FW_BANDS = false;
  function featureStrip(g, n) {
    var W = 86, H = 20, k;
    var ink = function (o) { return Object.assign({ stroke: C.ink, 'stroke-width': 1.2, 'stroke-linejoin': 'round' }, o); };
    // spring: a strip of wooden lattice with roses
    var sp = sgroup(g, 'spring'), cp = el('clipPath', { id: 'fwS' + n }, defs), d = '';
    el('rect', { x: 0, y: 0, width: W, height: H }, cp);
    for (k = -H; k < W + H; k += 9) d += 'M' + k + ',' + H + 'L' + (k + H) + ',0M' + k + ',0L' + (k + H) + ',' + H;
    var lat = el('g', { 'clip-path': 'url(#fwS' + n + ')' }, sp);
    el('path', { d: d, stroke: C.ink, 'stroke-width': 3 }, lat);
    el('path', { d: d, stroke: '#d9a873', 'stroke-width': 1.5 }, lat);
    el('rect', ink({ x: 0, y: 0, width: W, height: H, fill: 'none', stroke: '#8a5a3b', 'stroke-width': 2 }), sp);
    for (k = 0; k < 5; k++) {
      var rx = 9 + k * 17, ry = k % 2 ? 13 : 7;
      el('ellipse', ink({ cx: rx + 3, cy: ry + 2, rx: 2.2, ry: 1.3, fill: '#3aa36c', 'stroke-width': 0.6, transform: 'rotate(30,' + (rx + 3) + ',' + (ry + 2) + ')' }), sp);
      el('circle', ink({ cx: rx, cy: ry, r: 2.8, fill: k % 2 ? '#ff7eb9' : '#e5435a', 'stroke-width': 0.8 }), sp);
    }
    // summer: one row of azulejo tiles
    var su = sgroup(g, 'summer'), T = W / 6;
    for (k = 0; k < 6; k++) {
      var x = k * T, cx = x + T / 2, cy = H / 2;
      el('rect', { x: x, y: 0, width: T, height: H, fill: '#f7fbff', stroke: '#9ec3e6', 'stroke-width': 0.7 }, su);
      for (var m = 0; m < 4; m++) el('ellipse', { cx: cx, cy: cy - 3.2, rx: 1.6, ry: 3, fill: '#2d6fc1', transform: 'rotate(' + (m * 90) + ',' + cx + ',' + cy + ')' }, su);
      el('circle', { cx: cx, cy: cy, r: 1.3, fill: '#f2b33d' }, su);
      el('path', { d: 'M' + x + ',0 m3.5,0 a3.5,3.5 0 0 1 -3.5,3.5 Z M' + (x + T) + ',' + H + ' m-3.5,0 a3.5,3.5 0 0 1 3.5,-3.5 Z', fill: '#2d6fc1' }, su);
    }
    el('rect', { x: 0, y: 0, width: W, height: H, fill: 'none', stroke: C.ink, 'stroke-width': 1.2 }, su);
    // autumn: a folk-art row of little round trees
    var au = sgroup(g, 'autumn');
    el('rect', ink({ x: 0, y: 0, width: W, height: H, rx: 2, fill: '#f6e2c2' }), au);
    el('rect', { x: 2.5, y: 2.5, width: W - 5, height: H - 5, rx: 1.5, fill: 'none', stroke: '#c9682a', 'stroke-width': 0.9, 'stroke-dasharray': '1.2 2.2', 'stroke-linecap': 'round' }, au);
    for (k = 0; k < 6; k++) {
      var tx = 8 + k * 14;
      el('path', { d: 'M' + tx + ',16 V11', stroke: '#7a4630', 'stroke-width': 1.4 }, au);
      el('circle', ink({ cx: tx, cy: 8.5, r: 4, fill: ['#e5532f', '#ff8a2c', '#ffc233'][k % 3], 'stroke-width': 0.9 }), au);
      el('circle', { cx: tx, cy: 8.5, r: 1, fill: '#fff6e0' }, au);
    }
    // winter: Nordic stars on navy
    var wi = sgroup(g, 'winter');
    el('rect', ink({ x: 0, y: 0, width: W, height: H, rx: 2, fill: '#27325e' }), wi);
    for (k = 0; k < 6; k++) {
      var sx = 8 + k * 14, d3 = '';
      for (var q = 0; q < 16; q++) { var a = -Math.PI / 2 + q * Math.PI / 8, rr2 = q % 2 ? 2.2 : 5.4; d3 += (q ? 'L' : 'M') + (sx + Math.cos(a) * rr2).toFixed(1) + ',' + (10 + Math.sin(a) * rr2).toFixed(1); }
      el('path', { d: d3 + 'Z', fill: '#fff' }, wi);
      if (k < 5) el('circle', { cx: sx + 7, cy: 10, r: 1, fill: '#ff6b6b' }, wi);
    }
  }
  function featureWall(i, fr) {
    if (i !== 2) return;
    if (FW_BANDS) {
      [0.3, 2.3].forEach(function (v, n) { featureStrip(el('g', { transform: 'translate(0.15,' + v + ') scale(0.03125)' }, fr), n); });
      return;
    }
    var g = el('g', { transform: 'translate(0.5,0.7) scale(0.0234375)' }, fr);   // 3/4 size, upper middle of the bare wall
    var W = 86, H = 54, k, j;
    var ink = function (o) { return Object.assign({ stroke: C.ink, 'stroke-width': 1.3, 'stroke-linejoin': 'round' }, o); };
    var cp = el('clipPath', { id: 'fwClip' }, defs);
    el('rect', { x: 0, y: 0, width: W, height: H }, cp);
    // spring: a wooden lattice with climbing roses
    var sp = sgroup(g, 'spring'), lat = el('g', { 'clip-path': 'url(#fwClip)' }, sp), d = '';
    for (k = -H; k < W + H; k += 13) d += 'M' + k + ',' + H + 'L' + (k + H) + ',0M' + k + ',0L' + (k + H) + ',' + H;
    el('path', { d: d, stroke: C.ink, 'stroke-width': 3.6 }, lat);
    el('path', { d: d, stroke: '#d9a873', 'stroke-width': 1.8 }, lat);
    el('rect', ink({ x: 0, y: 0, width: W, height: H, fill: 'none', stroke: '#8a5a3b', 'stroke-width': 2.4 }), sp);
    el('rect', { x: 0, y: 0, width: W, height: H, fill: 'none', stroke: C.ink, 'stroke-width': 1 }, sp);
    el('path', { d: 'M4,54 C10,40 6,30 16,22 S30,8 44,10 M16,22 C26,26 32,36 30,48 M44,10 C56,12 62,6 70,4', fill: 'none', stroke: '#2f7d55', 'stroke-width': 1.6 }, sp);
    [[6, 44], [12, 30], [18, 20], [28, 13], [40, 10], [52, 10], [64, 6], [27, 30], [31, 42]].forEach(function (r, n) {
      el('ellipse', ink({ cx: r[0] + 3, cy: r[1] + 2, rx: 2.4, ry: 1.4, fill: '#3aa36c', 'stroke-width': 0.7, transform: 'rotate(30,' + (r[0] + 3) + ',' + (r[1] + 2) + ')' }), sp);
      el('circle', ink({ cx: r[0], cy: r[1], r: 3.2, fill: n % 3 ? '#ff7eb9' : '#e5435a', 'stroke-width': 0.9 }), sp);
      el('path', { d: 'M' + (r[0] - 1.2) + ',' + r[1] + ' a1.2,1.2 0 1 1 1.2,1.2', fill: 'none', stroke: 'rgba(22,22,29,.55)', 'stroke-width': 0.7 }, sp);
    });
    // summer: Portuguese azulejo tiles, the corner arcs join into circles across tiles
    var su = sgroup(g, 'summer'), T = 18, ox = (W - T * 4) / 2;
    for (j = 0; j < 3; j++) for (k = 0; k < 4; k++) {
      var x = ox + k * T, y = j * T, cx = x + T / 2, cy = y + T / 2, tg = el('g', null, su);
      el('rect', { x: x, y: y, width: T, height: T, fill: '#f7fbff', stroke: '#9ec3e6', 'stroke-width': 0.8 }, tg);
      [[x, y, 0], [x + T, y, 90], [x + T, y + T, 180], [x, y + T, 270]].forEach(function (c) {
        el('path', { d: 'M' + c[0] + ',' + c[1] + ' m5,0 a5,5 0 0 1 -5,5 Z', fill: '#2d6fc1', transform: 'rotate(' + c[2] + ',' + c[0] + ',' + c[1] + ')' }, tg);
      });
      for (var m = 0; m < 4; m++) el('ellipse', { cx: cx, cy: cy - 3.4, rx: 1.7, ry: 3.2, fill: '#2d6fc1', transform: 'rotate(' + (m * 90) + ',' + cx + ',' + cy + ')' }, tg);
      el('circle', { cx: cx, cy: cy, r: 1.5, fill: '#f2b33d' }, tg);
    }
    el('rect', { x: ox, y: 0, width: T * 4, height: T * 3, fill: 'none', stroke: C.ink, 'stroke-width': 1.4 }, su);
    // autumn: Scandinavian folk-art trees in warm tones
    var au = sgroup(g, 'autumn');
    el('rect', ink({ x: 0, y: 0, width: W, height: H, rx: 3, fill: '#f6e2c2' }), au);
    el('rect', { x: 3, y: 3, width: W - 6, height: H - 6, rx: 2, fill: 'none', stroke: '#c9682a', 'stroke-width': 1.2, 'stroke-dasharray': '1.5 2.5', 'stroke-linecap': 'round' }, au);
    el('path', { d: 'M8,46 H78', stroke: '#7a4630', 'stroke-width': 1.4 }, au);
    [[20, '#e5532f', 13], [43, '#ff8a2c', 16], [66, '#ffc233', 12]].forEach(function (t) {
      el('path', { d: 'M' + t[0] + ',46 V' + (32 - t[2] * 0.3), stroke: '#7a4630', 'stroke-width': 2 }, au);
      var cy = 24 - t[2] * 0.25;
      el('circle', ink({ cx: t[0], cy: cy, r: t[2] * 0.75, fill: t[1] }), au);
      for (var m = 0; m < 6; m++) { var a = m * 1.047; el('circle', { cx: t[0] + Math.cos(a) * t[2] * 0.42, cy: cy + Math.sin(a) * t[2] * 0.42, r: 1.1, fill: '#fff6e0' }, au); }
      el('circle', { cx: t[0], cy: cy, r: 1.4, fill: '#fff6e0' }, au);
    });
    el('path', { d: 'M28,10 l2.5,2 l2.5,-2 M36,7 l2,1.6 l2,-1.6', fill: 'none', stroke: C.ink, 'stroke-width': 1, 'stroke-linecap': 'round' }, au);
    // winter: Nordic eight-point stars on navy
    var wi = sgroup(g, 'winter');
    el('rect', ink({ x: 0, y: 0, width: W, height: H, rx: 3, fill: '#27325e' }), wi);
    function tri(y, up) { var d2 = ''; for (var q = 0; q < 14; q++) { var x0 = 3 + q * 5.75; d2 += 'M' + x0 + ',' + y + 'l2.9,' + (up ? -3.5 : 3.5) + 'l2.9,' + (up ? 3.5 : -3.5) + 'Z'; } el('path', { d: d2, fill: '#fff' }, wi); }
    tri(7, true); tri(47, false);
    [[18, 27, 9], [43, 27, 11], [68, 27, 9]].forEach(function (st) {
      var d3 = '';
      for (var q = 0; q < 16; q++) { var a = -Math.PI / 2 + q * Math.PI / 8, rr2 = q % 2 ? st[2] * 0.42 : st[2]; d3 += (q ? 'L' : 'M') + (st[0] + Math.cos(a) * rr2).toFixed(1) + ',' + (st[1] + Math.sin(a) * rr2).toFixed(1); }
      el('path', { d: d3 + 'Z', fill: '#fff', stroke: '#9fb6e6', 'stroke-width': 0.8 }, wi);
      el('rect', { x: st[0] - 1.6, y: st[1] - 1.6, width: 3.2, height: 3.2, fill: '#d8322b', transform: 'rotate(45,' + st[0] + ',' + st[1] + ')' }, wi);
    });
    [[30, 18], [30, 36], [56, 18], [56, 36], [6, 27], [80, 27]].forEach(function (p) { el('circle', { cx: p[0], cy: p[1], r: 1.2, fill: '#fff' }, wi); });
  }

  function winDecor(i, from) {
    for (var k = from; k < WINS.length; k++) {
      if (srand(i * 31 + k * 7)() > 0.42) continue;
      var w = WINS[k], top = w.cy - w.h / 2, R = srand(k + 90);
      var g = el('g', { transform: 'translate(' + w.cx + ',' + top + ') scale(0.03125)' }, w.g);
      var bot = w.h * 32, hw = w.w * 16, ink = { stroke: C.ink, 'stroke-width': 1.3, 'stroke-linejoin': 'round' };
      // spring: a planter under the sill
      var sp = sgroup(g, 'spring');
      [[-hw + 1, '#ff8fb8'], [-hw / 3, '#fff'], [hw / 3, '#ffd23f'], [hw - 1, '#ff8fb8']].forEach(function (f, n) {
        el('circle', { cx: f[0], cy: bot - 1 - (n % 2) * 1.5, r: 2.2, fill: n % 2 ? '#2f9e6a' : f[1], stroke: C.ink, 'stroke-width': 0.9 }, sp);
      });
      el('rect', Object.assign({ x: -hw - 3, y: bot, width: hw * 2 + 6, height: 4.5, rx: 1, fill: '#a8613f' }, ink), sp);
      // summer: a scalloped striped awning over the top
      var su = sgroup(g, 'summer'), ac = R() < 0.5 ? C.red : '#2aa6a0', aw = hw + 4, n = 4;
      for (var q = 0; q < n; q++) {
        var x0 = -aw + q * aw * 2 / n, x1 = x0 + aw * 2 / n;
        el('path', { d: 'M' + (x0 + 1.5 * (q - n / 2) / n) + ',-4 L' + (x1 + 1.5 * (q + 1 - n / 2) / n) + ',-4 L' + x1 + ',2 Q' + ((x0 + x1) / 2) + ',5 ' + x0 + ',2 Z', fill: q % 2 ? '#fff' : ac }, su);
      }
      el('path', Object.assign({ d: 'M' + (-aw - 0.7) + ',-4 H' + (aw + 0.7) + ' L' + aw + ',2' + (function () { var d = ''; for (var q = n - 1; q >= 0; q--) { var x0 = -aw + q * aw * 2 / n, x1 = x0 + aw * 2 / n; d += ' Q' + ((x0 + x1) / 2) + ',5 ' + x0 + ',2'; } return d; })() + ' Z', fill: 'none' }, ink), su);
      // autumn: ivy climbing beside the window
      var au = sgroup(g, 'autumn'), side = R() < 0.5 ? -1 : 1, vx = side * (hw + 3);
      el('path', { d: 'M' + vx + ',' + (bot + 6) + ' C' + (vx + side * 3) + ',' + (bot * 0.6) + ' ' + (vx - side * 3) + ',' + (bot * 0.3) + ' ' + (vx + side * 1) + ',-3', fill: 'none', stroke: '#6b4a2e', 'stroke-width': 1.2 }, au);
      [[bot + 2, 1], [bot * 0.72, -1], [bot * 0.45, 1], [bot * 0.18, -1], [-2, 1]].forEach(function (l, m) {
        el('ellipse', { cx: vx + l[1] * 2.2, cy: l[0], rx: 2.3, ry: 1.6, fill: ['#e5532f', '#ff8a2c', '#c9682a', '#ffc233', '#e5532f'][m], stroke: C.ink, 'stroke-width': 0.8, transform: 'rotate(' + (l[1] * 30) + ',' + (vx + l[1] * 2.2) + ',' + l[0] + ')' }, au);
      });
      // winter: a pine swag with a red bow
      var wi = sgroup(g, 'winter'), sw = 'M' + (-hw - 3) + ',-3 Q0,4 ' + (hw + 3) + ',-3';
      el('path', { d: sw, fill: 'none', stroke: C.ink, 'stroke-width': 4.4, 'stroke-linecap': 'round' }, wi);
      el('path', { d: sw, fill: 'none', stroke: '#2f7d55', 'stroke-width': 2.6, 'stroke-linecap': 'round' }, wi);
      el('path', Object.assign({ d: 'M0,0.5 l-3.5,-2.2 v4.4 Z M0,0.5 l3.5,-2.2 v4.4 Z', fill: C.red }, ink, { 'stroke-width': 0.8 }), wi);
    }
  }

  ZONES.forEach(function (z, i) {
    var b = z.b;
    item(b[0] + b[2] / 2 + b[1] + b[3] / 2, function (g) {
      var zg = el('g', { 'data-zone': i }, g);
      box(zg, b[0], b[1], 0, b[2], b[3], b[4], z.col, { grid: true });
      // arches on the tall faces
      var fl = el('g', { transform: faceL(b[0], b[1], 0, b[2], b[3], b[4]) }, zg);
      var fr = el('g', { transform: faceR(b[0], b[1], 0, b[2], b[3], b[4]) }, zg);
      var w0 = WINS.length;
      // long walls keep just the two end windows, high up on tall walls; every building has its windows on this face
      var lv = b[4] >= 2 ? 0.35 : b[4] - 0.85;
      var lp = b[2] < 3 ? [0.32, 1.32].slice(0, b[2]) : [0.32, b[2] - 0.68];
      lp.forEach(function (u) { arch(fl, u, lv, 0.36, 0.6, shade(z.col, -0.55)); });
      winDecor(i, w0); band(i, fl, fr); featureWall(i, fr);
      var sn = NODES[STOP_NODE[i]].p, m = 0.42;
      poly(zg, [P(sn[0] - m, sn[1] - m, b[4]), P(sn[0] + m, sn[1] - m, b[4]), P(sn[0] + m, sn[1] + m, b[4]), P(sn[0] - m, sn[1] + m, b[4])], shade(z.col, 0.55), { 'stroke-width': 1.6 });
      poly(zg, [P(sn[0] - m * 0.55, sn[1] - m * 0.55, b[4]), P(sn[0] + m * 0.55, sn[1] - m * 0.55, b[4]), P(sn[0] + m * 0.55, sn[1] + m * 0.55, b[4]), P(sn[0] - m * 0.55, sn[1] + m * 0.55, b[4])], 'none', { stroke: z.col, 'stroke-width': 2, 'stroke-dasharray': '3 3' });
      DECOR[i](zg, b);
    });
  });

  /* ---------- zone decor ---------- */
  var DECOR = [
    function home(g, b) {
      var x = 6.25, y = 15.1, z = 1, w = 1.6, d = 1.0, h = 1;
      box(g, x, y, z, w, d, h, C.yellow);
      var fl = el('g', { transform: faceL(x, y, z, w, d, h) }, g);
      arch(fl, 0.55, 0.3, 0.45, 0.7, C.ink);
      el('rect', { x: 0.15, y: 0.25, width: 0.3, height: 0.3, fill: C.sky, stroke: C.ink, 'stroke-width': 1.5, 'vector-effect': 'non-scaling-stroke' }, fl);
      var fr = el('g', { transform: faceR(x, y, z, w, d, h) }, g);
      var win = el('rect', { x: 0.4, y: 0.25, width: 0.5, height: 0.4, fill: '#fff', stroke: C.ink, 'stroke-width': 1.5, 'vector-effect': 'non-scaling-stroke' }, fr);
      anim(function (t) { win.setAttribute('fill', (t % 6) < 3 ? '#fff6c8' : C.yellow); });
      // roof
      var E = z + h, R = z + h + 0.75, yc = y + d / 2;
      poly(g, [P(x - 0.1, y - 0.1, E), P(x + w + 0.1, y - 0.1, E), P(x + w + 0.1, yc, R), P(x - 0.1, yc, R)], shade(C.orange, -0.1));
      poly(g, [P(x - 0.1, yc, R), P(x + w + 0.1, yc, R), P(x + w + 0.1, y + d + 0.1, E), P(x - 0.1, y + d + 0.1, E)], grad(C.orange, 'l'));
      poly(g, [P(x + w + 0.1, y - 0.1, E), P(x + w + 0.1, yc, R), P(x + w + 0.1, y + d + 0.1, E)], grad(C.pink, 'r'));
      var rsn = sgroup(g, 'winter');
      poly(rsn, [P(x - 0.1, y - 0.1, E + 0.04), P(x + w + 0.1, y - 0.1, E + 0.04), P(x + w + 0.1, yc, R + 0.04), P(x - 0.1, yc, R + 0.04)], '#fbfdff', { 'stroke-width': 1.8 });
      var rf = [P(x - 0.1, yc, R + 0.04), P(x + w + 0.1, yc, R + 0.04), P(x + w + 0.1, y + d * 0.72, E + 0.3)], rd = srand(9);
      for (var q = 1; q <= 9; q++) { var qq = P(x + w + 0.1 - (w + 0.2) * q / 9, y + d * 0.72, E + 0.3); rf.push([qq[0], qq[1] + (q < 9 ? 2 + rd() * 5 : 0)]); }
      poly(rsn, rf, '#fbfdff', { 'stroke-width': 1.8 });
      // chimney + smoke
      box(g, x + 0.3, y + 0.15, E + 0.2, 0.3, 0.3, 0.6, C.red);
      var sp = P(x + 0.45, y + 0.3, E + 0.85);
      var puffs = [0, 1, 2].map(function () { return el('circle', { r: 4, fill: '#fff', stroke: C.ink, 'stroke-width': 1.5 }, g); });
      anim(function (t) {
        puffs.forEach(function (c, i) {
          var u = ((t * 0.45 + i / 3) % 1);
          c.setAttribute('cx', (sp[0] + Math.sin(u * 6 + i) * 5 + u * 10).toFixed(1));
          c.setAttribute('cy', (sp[1] - u * 46).toFixed(1));
          c.setAttribute('r', (3 + u * 6).toFixed(1));
          c.setAttribute('opacity', (1 - u).toFixed(2));
        });
      });
      arcadeCabinet(g, 9.0, 15.1, 1);
    },
    function stats(g, b) {
      var parts = [[1.05, 9.2, 2, 1.0, 1.1, 1.3], [1.15, 9.3, 3.3, 0.8, 0.9, 1], [1.25, 9.4, 4.3, 0.6, 0.7, 0.8]];
      var labels = ['100+', '10Y', '62M'];
      parts.forEach(function (p, i) {
        box(g, p[0], p[1], p[2], p[3], p[4], p[5], i === 1 ? C.mint : C.green);
        var fr = el('g', { transform: faceR(p[0], p[1], p[2], p[3], p[4], p[5]) }, g);
        el('text', { x: p[4] / 2, y: p[5] * 0.66, 'font-size': i === 0 ? 0.56 : 0.46, 'text-anchor': 'middle', fill: '#fff', stroke: C.ink, 'stroke-width': 3, 'paint-order': 'stroke', 'vector-effect': 'non-scaling-stroke' }, fr).textContent = labels[i];
      });
      // bar chart on the left face of the base
      var p0 = parts[0];
      var fl = el('g', { transform: faceL(p0[0], p0[1], p0[2], p0[3], p0[4], p0[5]) }, g);
      var bars = [0, 1, 2, 3].map(function (k) {
        return el('rect', { x: 0.12 + k * 0.21, width: 0.15, fill: [C.yellow, C.pink, C.sky, C.orange][k], stroke: C.ink, 'stroke-width': 1.5, 'vector-effect': 'non-scaling-stroke' }, fl);
      });
      anim(function (t) {
        bars.forEach(function (r, k) {
          var hh = 0.3 + 0.55 * (0.5 + 0.5 * Math.sin(t * 2 + k * 0.9));
          r.setAttribute('y', (1.15 - hh).toFixed(3)); r.setAttribute('height', hh.toFixed(3));
        });
      });
      // antenna
      var a0 = P(1.55, 9.75, 5.1), a1 = P(1.55, 9.75, 6);
      line(g, a0, a1, { stroke: C.ink, 'stroke-width': 3 });
      bulb(g, 1.55, 9.75, 6.05, C.red);
      tree(g, 1.4, 11.6, 2, C.yellow);
    },
    function cinema(g, b) {
      var x = 1.2, y = 2.15, z = 3, w = 2.1, d = 1.0, h = 1.3;
      box(g, x, y, z, w, d, h, C.purple);
      var fl = el('g', { transform: faceL(x, y, z, w, d, h) }, g);
      el('rect', { x: 0.15, y: 0.15, width: 1.8, height: 0.85, fill: C.ink, stroke: C.ink, 'stroke-width': 1.5, 'vector-effect': 'non-scaling-stroke' }, fl);
      var play = el('path', { d: 'M0.92,0.36 L1.22,0.57 L0.92,0.78 Z', fill: C.yellow }, fl);
      var prog = el('rect', { x: 0.25, y: 0.9, height: 0.05, fill: C.pink }, fl);
      anim(function (t) {
        var u = (t * 0.18) % 1;
        prog.setAttribute('width', (1.6 * u).toFixed(3));
        play.setAttribute('fill', Math.sin(t * 4) > 0 ? C.yellow : C.orange);
      });
      // marquee bulbs on top edge
      for (var k = 0; k <= 6; k++) bulb(g, x + k * w / 6, y + d, z + h, k % 2 ? C.yellow : C.pink);
      // film reel on the roof (spins)
      var rc = P(x + 0.9, y + 0.5, z + h + 0.7);
      var reelG = el('g', { transform: 'translate(' + rc[0] + ',' + rc[1] + ')' }, g);
      line(g, P(x + 0.9, y + 0.5, z + h), [rc[0], rc[1]], { stroke: C.ink, 'stroke-width': 3 });
      var reel = el('g', null, reelG);
      el('circle', { r: 17, fill: C.lilac, stroke: C.ink, 'stroke-width': 2 }, reel);
      for (k = 0; k < 5; k++) {
        var an = k * Math.PI * 2 / 5;
        el('circle', { cx: Math.cos(an) * 9, cy: Math.sin(an) * 9, r: 4, fill: C.ink }, reel);
      }
      el('circle', { r: 3, fill: '#fff', stroke: C.ink, 'stroke-width': 1.5 }, reel);
      anim(function (t) { reel.setAttribute('transform', 'rotate(' + (t * 90 % 360).toFixed(1) + ')'); });
      // rope post
      box(g, 3.75, 3.6, 3, 0.3, 0.3, 1.6, C.ink, { top: C.yellow, left: C.navy, right: C.ink });
    },
    function dezi(g, b) {
      box(g, 6.95, 3.6, 3, 0.3, 0.3, 1.6, C.ink, { top: C.yellow, left: C.navy, right: C.ink });
      var x = 8.1, y = 2.15, z = 3, w = 1.7, d = 1.0, h = 1.4;
      box(g, x, y, z, w, d, h, C.blue);
      var fl = el('g', { transform: faceL(x, y, z, w, d, h) }, g);
      var cols = [C.pink, C.yellow, C.green, C.orange, C.lilac, C.sky];
      var frames = [0, 1, 2].map(function (k) {
        return el('rect', { x: 0.14 + k * 0.52, y: 0.22, width: 0.42, height: 0.55, fill: cols[k], stroke: C.ink, 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke' }, fl);
      });
      anim(function (t) { var s = Math.floor(t / 1.1); frames.forEach(function (f, k) { f.setAttribute('fill', cols[(s + k * 2) % cols.length]); }); });
      var fr = el('g', { transform: faceR(x, y, z, w, d, h) }, g);
      el('text', { x: d / 2, y: 0.64, 'font-size': 0.5, 'text-anchor': 'middle', fill: '#fff', stroke: C.ink, 'stroke-width': 3, 'paint-order': 'stroke', 'vector-effect': 'non-scaling-stroke', 'font-weight': 700 }, fr).textContent = 'DEZI';
      // waving flag
      var fp = P(x + 1.4, y + 0.3, z + h), ft = P(x + 1.4, y + 0.3, z + h + 1.3);
      line(g, fp, ft, { stroke: C.ink, 'stroke-width': 3 });
      var flag = el('path', { fill: C.yellow, stroke: C.ink, 'stroke-width': 2, 'stroke-linejoin': 'round' }, g);
      anim(function (t) {
        var d0 = 'M' + ft[0] + ',' + ft[1];
        var w1 = Math.sin(t * 5) * 4, w2 = Math.sin(t * 5 + 1.6) * 4;
        flag.setAttribute('d', d0 + ' q12,' + (w1 - 4) + ' 26,' + (w2) + ' l0,16 q-14,' + (w1 - 3) + ' -26,' + (-w2 + 2) + ' Z');
      });
      tree(g, 9.7, 3.6, 3, C.green);
    },
    function skills(g, b) {
      var caps = [['Ae', C.purple], ['Ri', C.pink], ['Fi', C.orange], ['Cc', C.green], ['Ai', C.yellow], ['Lt', C.sky]];
      caps.forEach(function (c, i) {
        var cx = 12.2 + (i % 3) * 0.85, cy = 2.05 + Math.floor(i / 3) * 0.68;
        var cg = el('g', null, g);
        box(cg, cx, cy, 2, 0.7, 0.6, 0.34, c[1], { top: shade(c[1], 0.45) });
        var tt = el('g', { transform: faceT(cx, cy, 2.34) }, cg);
        el('text', { x: 0.35, y: 0.43, 'font-size': 0.4, 'text-anchor': 'middle', fill: C.ink, 'font-weight': 700 }, tt).textContent = c[0];
        anim(function (t) {
          var u = (t * 0.9 - i * 0.22) % 3;
          var p = u > 0 && u < 0.3 ? Math.sin(u / 0.3 * Math.PI) : 0;
          cg.setAttribute('transform', 'translate(0,' + (p * 6 + quake(cx, cy) * 1.6).toFixed(1) + ')');
        });
      });
      // gear on a post
      var gp = P(14.7, 2.35, 2), gt = P(14.7, 2.35, 3.4);
      line(g, gp, gt, { stroke: C.ink, 'stroke-width': 3 });
      var gearG = el('g', { transform: 'translate(' + gt[0] + ',' + gt[1] + ')' }, g);
      var gear = el('path', { fill: C.orange, stroke: C.ink, 'stroke-width': 2, 'stroke-linejoin': 'round' }, gearG);
      var gd = '';
      for (var k = 0; k < 16; k++) {
        var a = k * Math.PI / 8, r = k % 2 ? 11 : 15;
        gd += (k ? 'L' : 'M') + (Math.cos(a - 0.18) * r).toFixed(1) + ',' + (Math.sin(a - 0.18) * r).toFixed(1) + 'L' + (Math.cos(a + 0.18) * r).toFixed(1) + ',' + (Math.sin(a + 0.18) * r).toFixed(1);
      }
      gear.setAttribute('d', gd + 'Z');
      el('circle', { r: 4.5, fill: '#fff', stroke: C.ink, 'stroke-width': 2 }, gearG);
      anim(function (t) { gear.setAttribute('transform', 'rotate(' + (t * 60 % 360).toFixed(1) + ')'); });
    },
    function studio(g, b) {
      var cols = [C.orange, C.green, C.yellow];
      cols.forEach(function (c, i) {
        var px = [12.1, 12.75, 14.05][i], py = 9.12;
        box(g, px, py, 1, 0.5, 0.5, 0.55, c);
        var ic = P(px + 0.25, py + 0.25, 2.3);
        var icg = el('g', { transform: 'translate(' + ic[0] + ',' + ic[1] + ')' }, g);
        var inner = el('g', null, icg), edge = null, starF;
        if (i === 0) {
          el('rect', { x: -13, y: -10, width: 26, height: 20, rx: 3, fill: '#fff', stroke: C.ink, 'stroke-width': 2 }, inner);
          el('path', { d: 'M-4,-6 L7,0 L-4,6 Z', fill: C.orange, stroke: C.ink, 'stroke-width': 1.5, 'stroke-linejoin': 'round' }, inner);
        } else if (i === 1) {
          el('rect', { x: -9, y: -15, width: 18, height: 30, rx: 4, fill: '#fff', stroke: C.ink, 'stroke-width': 2 }, inner);
          var bars = [0, 1, 2].map(function (k) { return el('rect', { x: -5, y: -9 + k * 7, height: 4, fill: [C.green, C.pink, C.sky][k] }, inner); });
          anim(function (t) { bars.forEach(function (r, k) { r.setAttribute('width', (4 + 6 * (0.5 + 0.5 * Math.sin(t * 3 + k))).toFixed(1)); }); });
        } else {
          var STAR = 'M0,-14 L4,-4 L14,-4 L6,3 L9,13 L0,7 L-9,13 L-6,3 L-14,-4 L-4,-4 Z';
          var edge = coinEdge(icg, inner, STAR, shade(C.yellow, -0.32));
          var starF = el('path', { d: STAR, fill: C.yellow, stroke: C.ink, 'stroke-width': 2, 'stroke-linejoin': 'round' }, inner);
        }
        anim(function (t) {
          var by = Math.sin(t * 2.2 + i * 1.3) * 4 + quake(px, py) * 2.2;
          var sx = i === 2 ? Math.cos(t * 4.2) : 1;
          if (i === 2 && Math.abs(sx) < 0.14) sx = sx < 0 ? -0.14 : 0.14; // never paper-thin: the edge needs a face to stack
          inner.setAttribute('transform', 'translate(0,' + by.toFixed(1) + ') scale(' + sx.toFixed(3) + ',1)' + (i === 0 ? ' rotate(' + (Math.sin(t * 1.7) * 8).toFixed(1) + ')' : ''));
          if (edge) {
            var sn = Math.sin(t * 4.2);
            edge.set('translate(0,' + by.toFixed(1) + ') scale(' + sx.toFixed(3) + ',1)', sn * 3.2 / sx);
            starF.setAttribute('fill', sx < 0 ? shade(C.yellow, -0.1) : C.yellow);
          }
        });
      });
    },
    function post(g, b) {
      var x = 12.15, y = 15.1, z = 1, w = 0.85, d = 0.85, h = 2;
      box(g, x, y, z, w, d, h, C.lilac);
      var fl = el('g', { transform: faceL(x, y, z, w, d, h) }, g);
      el('rect', { x: 0.2, y: 0.3, width: 0.55, height: 0.38, fill: '#fff', stroke: C.ink, 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke' }, fl);
      el('path', { d: 'M0.2,0.3 L0.475,0.52 L0.75,0.3', fill: 'none', stroke: C.ink, 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke' }, fl);
      arch(fl, 0.3, 1.1, 0.36, 0.9, C.ink);
      // antenna + signal waves
      var at = P(x + 0.47, y + 0.47, z + h + 0.9);
      line(g, P(x + 0.47, y + 0.47, z + h), at, { stroke: C.ink, 'stroke-width': 3 });
      bulb(g, x + 0.47, y + 0.47, z + h + 0.95, C.pink);
      var waves = [0, 1, 2].map(function () { return el('path', { fill: 'none', stroke: C.ink, 'stroke-width': 2.5, 'stroke-linecap': 'round' }, g); });
      anim(function (t) {
        waves.forEach(function (wv, i) {
          var u = (t * 0.6 + i / 3) % 1, r = 8 + u * 26;
          wv.setAttribute('d', 'M' + (at[0] - r) + ',' + (at[1] - r * 0.25) + ' A' + r + ',' + r + ' 0 0 1 ' + (at[0] + r) + ',' + (at[1] - r * 0.25));
          wv.setAttribute('opacity', (1 - u).toFixed(2));
        });
      });
      // mailbox
      var mx = 12.9, my = 15.15;
      box(g, mx + 0.12, my + 0.12, 1, 0.16, 0.16, 0.5, C.ink, { left: C.navy, right: C.ink });
      box(g, mx, my, 1.5, 0.45, 0.4, 0.32, C.red, { top: C.pink });
      var flag = el('path', { fill: C.yellow, stroke: C.ink, 'stroke-width': 1.5 }, g);
      var fb = P(mx + 0.45, my + 0.15, 1.7);
      anim(function (t) {
        var up = Math.sin(t * 1.3) > 0;
        flag.setAttribute('d', up ? 'M' + fb[0] + ',' + fb[1] + ' v-14 h8 v6 h-6 v8 Z' : 'M' + fb[0] + ',' + fb[1] + ' h12 v4 h-12 Z');
      });
      // paper plane orbit
      var oc = P(x + 0.47, y + 0.47, z + h + 0.3);
      var plane = el('path', { d: 'M-10,-6 L12,0 L-10,6 L-5,0 Z', fill: '#fff', stroke: C.ink, 'stroke-width': 2, 'stroke-linejoin': 'round' }, L.fx);
      anim(function (t) {
        var a = t * 1.4, px = oc[0] + Math.cos(a) * 70, py = oc[1] + Math.sin(a) * 26 - 20;
        var ang = Math.atan2(Math.cos(a) * 26, -Math.sin(a) * 70) * 180 / Math.PI;
        plane.setAttribute('transform', 'translate(' + px.toFixed(1) + ',' + py.toFixed(1) + ') rotate(' + ang.toFixed(1) + ')');
      });
    }
  ];

  /* ---------- mini arcade cabinet next to the house ---------- */
  var ARCADE_HIT = null;
  var ARCADE_TAG = null;
  function arcadeCabinet(g, x, y, z) {
    var w = 0.62, d = 0.5, h = 1.3, cab = el('g', { 'data-arcade': 1 }, g);
    box(cab, x, y, z, w, d, h, '#3b3360', { top: '#5a5190', left: grad('#4a4178', 'l'), right: grad('#2e2850', 'r') });
    var fl = el('g', { transform: faceL(x, y, z, w, d, h) }, cab);
    var NS2 = { 'vector-effect': 'non-scaling-stroke', stroke: C.ink, 'stroke-width': 1.6 };
    var marquee = el('rect', Object.assign({ x: 0.05, y: 0.04, width: w - 0.1, height: 0.13, fill: C.yellow }, NS2), fl);
    el('rect', Object.assign({ x: 0.07, y: 0.22, width: w - 0.14, height: 0.42, fill: '#100e1c' }, NS2), fl);
    var px = [0, 1, 2, 3, 4].map(function (k) { return el('rect', { x: 0.12 + k * 0.085, y: 0.5, width: 0.06, height: 0.06, fill: [C.pink, C.sky, C.green, C.yellow, C.orange][k] }, fl); });
    var hero = el('rect', { x: 0.14, y: 0.3, width: 0.07, height: 0.07, fill: C.yellow }, fl);
    el('rect', Object.assign({ x: 0.12, y: 0.86, width: w - 0.24, height: 0.22, fill: '#2a2447' }, NS2), fl);
    el('rect', { x: 0.24, y: 0.92, width: 0.14, height: 0.04, fill: C.ink }, fl);
    var fr = el('g', { transform: faceR(x, y, z, w, d, h) }, cab);
    el('path', { d: 'M0,0.9 L' + d + ',0.45 L' + d + ',0.62 L0,1.07 Z', fill: C.pink, opacity: 0.85 }, fr);
    el('path', { d: 'M0,1.1 L' + d + ',0.65 L' + d + ',0.74 L0,1.19 Z', fill: C.sky, opacity: 0.85 }, fr);
    // control deck sticking out of the front
    box(cab, x, y + d, z + 0.62, w, 0.24, 0.1, C.red, { top: '#ff7b88' });
    var dk = P(x + 0.18, y + d + 0.12, z + 0.72);
    el('line', { x1: dk[0], y1: dk[1], x2: dk[0], y2: dk[1] - 10, stroke: C.ink, 'stroke-width': 2.4 }, cab);
    el('circle', { cx: dk[0], cy: dk[1] - 11, r: 3.6, fill: C.red, stroke: C.ink, 'stroke-width': 1.5 }, cab);
    [[0.38, 0.08], [0.5, 0.15]].forEach(function (b) { var bp = P(x + b[0], y + d + b[1], z + 0.72); el('ellipse', { cx: bp[0], cy: bp[1], rx: 2.6, ry: 1.5, fill: C.yellow, stroke: C.ink, 'stroke-width': 1.2 }, cab); });
    anim(function (t) {
      marquee.setAttribute('fill', Math.floor(t * 3) % 2 ? C.yellow : '#fff3b0');
      var k = (t * 0.6) % 1;
      hero.setAttribute('x', (0.12 + k * 0.34).toFixed(3));
      hero.setAttribute('y', (0.28 + Math.abs(Math.sin(t * 6)) * -0.04 + 0.04).toFixed(3));
      px.forEach(function (r, i) { r.setAttribute('opacity', (Math.floor(t * 4) + i) % 3 ? 1 : 0.25); });
    });
    // hit area + floating label
    var m = 0.2;
    ARCADE_HIT = poly(L.hits, [P(x - m, y - m, z + h + 1.1), P(x + w + m, y - m, z + h + 1.1), P(x + w + m, y - m, z), P(x + w + m, y + d + 0.24 + m, z - 0.1), P(x - m, y + d + 0.24 + m, z - 0.1), P(x - m, y + d + 0.24 + m, z + h + 1.1)], 'transparent', { stroke: 'none', 'data-arcade': 1 });
    var tp = P(x + w / 2, y + d / 2, z + h + 0.55);
    var tg = el('g', { class: 'tag', 'data-arcade': 1, transform: 'translate(' + tp[0] + ',' + tp[1] + ')' }, L.tags);
    var inner = el('g', null, tg);
    var ash = el('rect', { y: -11, height: 26, fill: C.ink }, inner);
    var arc = el('rect', { y: -15, height: 26, fill: C.yellow, stroke: C.ink, 'stroke-width': 2.5 }, inner);
    var atx = el('text', { y: 5, 'font-size': 22, 'text-anchor': 'middle', fill: C.ink }, inner);
    atx.textContent = '▶ ARCADE';
    ARCADE_TAG = function () {
      var tw = 75;
      try { tw = atx.getBBox().width || tw; } catch (e) {}
      var Wd = Math.ceil(tw + 22), x0 = -Wd / 2;
      arc.setAttribute('x', x0); arc.setAttribute('width', Wd);
      ash.setAttribute('x', x0 + 4); ash.setAttribute('width', Wd);
      atx.setAttribute('x', 0);
    };
    anim(function (t) { inner.setAttribute('transform', 'translate(0,' + (Math.sin(t * 2.6) * 2.5).toFixed(1) + ') scale(' + clamp(0.8 / (view.s || 1), 0.8, 2.1).toFixed(3) + ')'); });
  }

  /* ---------- GMT voxel letters in the middle ---------- */
  var GLYPHS = {
    G: ['.###', '#...', '#.##', '#..#', '.###'],
    M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
    T: ['###', '.#.', '.#.', '.#.', '.#.']
  };
  var LET = [{ c: 'G', col: C.orange }, { c: 'M', col: C.purple }, { c: 'T', col: C.green }];
  var vx = 0.5, lx = 4.6, ly = 10.1, lz = 0.7;
  LET.forEach(function (L0, li) {
    var rows = GLYPHS[L0.c], wcols = rows[0].length;
    var x0 = lx;
    lx += (wcols + 1) * vx;
    item(x0 + ly + 1, function (g) {
      var lg = el('g', null, g);
      var cells = [];
      rows.forEach(function (r, ri) {
        for (var ci = 0; ci < r.length; ci++) if (r[ci] === '#') cells.push({ x: x0 + ci * vx, z: lz + (4 - ri) * vx });
      });
      cells.sort(function (a, b) { return (a.x + a.z) - (b.x + b.z); });
      cells.forEach(function (c) { box(lg, c.x, ly, c.z, vx, vx, vx, L0.col, { sw: 1.6, top: shade(L0.col, 0.55) }); });
      var sh = P(x0 + wcols * vx / 2, ly + vx / 2, 0);
      var shadow = el('ellipse', { cx: sh[0], cy: sh[1], rx: 34, ry: 9, fill: 'rgba(22,22,29,.12)' }, g);
      g.insertBefore(shadow, lg);
      anim(function (t) {
        var o = Math.sin(t * 1.5 - li * 0.8) * 0.5;
        var on = hero.z > 3 && Math.abs(hero.y - 10.35) < 0.5 && hero.x > x0 - 0.1 && hero.x < x0 + wcols * vx + 0.1;
        L0.dip = lerp(L0.dip || 0, on ? 5 : 0, 0.25);
        L0.oy = o * 6 + L0.dip + quake(x0 + wcols * vx / 2, ly) * 1.5;
        lg.setAttribute('transform', 'translate(0,' + L0.oy.toFixed(1) + ')');
        shadow.setAttribute('rx', (30 + o * 4).toFixed(1));
      });
    });
  });

  /* ---------- floating shapes ---------- */
  function floater(key, fn) { item(key, fn); }
  [[9.6, 6.2, 1.0, C.pink], [21.4, 6.2, 1.6, C.yellow], [16.2, 13.5, 2.2, C.sky], [4.2, 19.2, 1.8, C.green], [5.6, 0.6, 4.6, C.orange]].forEach(function (f, i) {
    floater(f[0] + f[1], function (g) {
      var fg = el('g', null, g);
      box(fg, f[0], f[1], f[2], 0.6, 0.6, 0.6, f[3], { top: shade(f[3], 0.5) });
      anim(function (t) { fg.setAttribute('transform', 'translate(0,' + (Math.sin(t * 1.2 + i * 1.7) * 9 + quake(f[0], f[1]) * 2).toFixed(1) + ')'); });
    });
  });
  // spheres + pyramid
  function sphere(g, x, y, z, r, col, ph) {
    var p = P(x, y, z);
    var id = 'sp' + col.slice(1);
    if (!gcache[id]) {
      var rg = el('radialGradient', { id: id, cx: 0.35, cy: 0.3, r: 0.75 }, defs);
      el('stop', { offset: 0, 'stop-color': shade(col, 0.6) }, rg);
      el('stop', { offset: 0.6, 'stop-color': col }, rg);
      el('stop', { offset: 1, 'stop-color': mix(col, C.purple, 0.45) }, rg);
      gcache[id] = 1;
    }
    var sg = el('g', null, g);
    el('circle', { cx: p[0], cy: p[1], r: r, fill: 'url(#' + id + ')', stroke: C.ink, 'stroke-width': 2 }, sg);
    anim(function (t) { sg.setAttribute('transform', 'translate(0,' + (Math.sin(t * 0.9 + ph) * 7 + quake(x, y) * 2).toFixed(1) + ')'); });
  }
  floater(17, function (g) { sphere(g, 7.2, 5.2, 1.2, 15, C.mint, 0); });
  floater(20, function (g) { sphere(g, 19.6, 2.2, 2.6, 11, C.lilac, 2); });
  floater(1, function (g) { sphere(g, 0.2, 6.8, 3.6, 9, C.sky, 4); });
  floater(4, function (g) {
    var p = P(9.8, 0.6, 4.4), pg = el('g', null, g);
    poly(pg, [[p[0], p[1] - 34], [p[0] - 18, p[1]], [p[0], p[1] + 9]], grad(C.yellow, 'l'));
    poly(pg, [[p[0], p[1] - 34], [p[0], p[1] + 9], [p[0] + 18, p[1]]], grad(C.green, 'r'));
    anim(function (t) { pg.setAttribute('transform', 'translate(0,' + (Math.sin(t * 1.1 + 1) * 8).toFixed(1) + ')'); });
  });
  // wiggly worm ribbon (like an animation curve)
  floater(0, function (g) {
    var o = P(11.8, -1.2, 3.6);
    var w1 = el('path', { fill: 'none', stroke: C.ink, 'stroke-width': 13, 'stroke-linecap': 'round' }, g);
    var w2 = el('path', { fill: 'none', stroke: C.blue, 'stroke-width': 8, 'stroke-linecap': 'round' }, g);
    var w3 = el('path', { fill: 'none', stroke: C.green, 'stroke-width': 3, 'stroke-linecap': 'round', transform: 'translate(-1,-2)' }, g);
    anim(function (t) {
      var d = 'M' + o[0] + ',' + o[1];
      for (var k = 1; k <= 24; k++) {
        var xx = o[0] + k * 6, yy = o[1] - k * 1.6 + Math.sin(k * 0.55 - t * 3) * 9;
        d += ' L' + xx.toFixed(1) + ',' + yy.toFixed(1);
      }
      w1.setAttribute('d', d); w2.setAttribute('d', d); w3.setAttribute('d', d);
    });
  });

  /* ---------- seasons + night: props ----------
     Every prop is drawn once and shown by class: .ss-<season> only in that season,
     .on-night / .on-day only at that time. #city carries .s-<season> and .night. */
  function srand(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
  function sgroup(g, season, when) { return el('g', { class: (season ? 'ss ss-' + season : '') + (when ? ' on-' + when : '') }, g); }
  // a rounded rectangle on the ground (world units) as screen points
  function rrect(x0, y0, x1, y1, r, z) {
    var out = [], c = [[x1 - r, y0 + r, -0.5], [x1 - r, y1 - r, 0], [x0 + r, y1 - r, 0.5], [x0 + r, y0 + r, 1]];
    c.forEach(function (q) { for (var k = 0; k <= 4; k++) { var a = (q[2] + k / 8) * Math.PI; out.push(P(q[0] + Math.cos(a) * r, q[1] + Math.sin(a) * r, z)); } });
    return out;
  }
  // a flat shape with a little thickness: the bottom copy shows as the side band
  function puck(g, shape, z0, z1, side, top) {
    poly(g, shape(z0), side);
    return poly(g, shape(z1), top);
  }
  // a soft heap (snow, leaves) standing on the ground
  function mound(g, x, y, z, r, col, rim) {
    var p = P(x, y, z), rx = r * 34, h = r * 22;
    el('ellipse', { cx: p[0], cy: p[1] + 2, rx: rx + 3, ry: rx * 0.42, fill: 'rgba(22,22,29,.12)' }, g);
    return el('path', { d: 'M' + (p[0] - rx) + ',' + p[1] + ' C' + (p[0] - rx * 0.8) + ',' + (p[1] - h * 1.3) + ' ' + (p[0] + rx * 0.8) + ',' + (p[1] - h * 1.3) + ' ' + (p[0] + rx) + ',' + p[1] + ' A' + rx + ',' + (rx * 0.42) + ' 0 0 1 ' + (p[0] - rx) + ',' + p[1] + ' Z', fill: col, stroke: rim || C.ink, 'stroke-width': 2, 'stroke-linejoin': 'round' }, g);
  }
  // a string of bulbs hanging between two points; bulbs are lit (never dimmed) and twinkle at night
  var BULBS = [];
  function bulbString(g, a, b, n, cols, kind) {
    var pa = P(a[0], a[1], a[2]), pb = P(b[0], b[1], b[2]), sag = 18;
    [a, b].forEach(function (q) {
      var top = P(q[0], q[1], q[2]), bot = P(q[0], q[1], 0);
      line(g, bot, [top[0], top[1] - 3], { stroke: C.ink, 'stroke-width': 4.4, 'stroke-linecap': 'round' });
      line(g, bot, [top[0], top[1] - 3], { stroke: C.brown, 'stroke-width': 1.8, 'stroke-linecap': 'round' });
    });
    var d = 'M' + pa[0] + ',' + pa[1] + ' Q' + ((pa[0] + pb[0]) / 2) + ',' + ((pa[1] + pb[1]) / 2 + sag * 2) + ' ' + pb[0] + ',' + pb[1];
    el('path', { d: d, fill: 'none', stroke: C.ink, 'stroke-width': 1.8 }, g);
    for (var i = 1; i < n; i++) {
      var u = i / n, x = (1 - u) * (1 - u) * pa[0] + 2 * u * (1 - u) * (pa[0] + pb[0]) / 2 + u * u * pb[0];
      var y = (1 - u) * (1 - u) * pa[1] + 2 * u * (1 - u) * ((pa[1] + pb[1]) / 2 + sag * 2) + u * u * pb[1];
      var col = cols[i % cols.length];
      if (kind === 'lantern') {
        line(g, [x, y], [x, y + 5], { stroke: C.ink, 'stroke-width': 1.5 });
        el('ellipse', { class: 'on-night glow', cx: x, cy: y + 12, rx: 13, ry: 13, fill: 'url(#glowW)' }, g);
        var lb = el('ellipse', { cx: x, cy: y + 12, rx: 6, ry: 7.5, fill: col, stroke: C.ink, 'stroke-width': 1.6, 'data-lit': 1 }, g);
        el('path', { d: 'M' + (x - 3) + ',' + (y + 5) + ' h6 M' + (x - 3) + ',' + (y + 19.5) + ' h6', stroke: C.ink, 'stroke-width': 2 }, g);
        BULBS.push({ n: lb, on: col, off: col, ph: i, lantern: 1 });
      } else {
        el('circle', { class: 'on-night glow', cx: x, cy: y + 4, r: 9, fill: 'url(#glowW)' }, g);
        var bb = el('circle', { cx: x, cy: y + 4, r: 3, fill: '#d8d6e4', stroke: C.ink, 'stroke-width': 1.3, 'data-lit': 1 }, g);
        BULBS.push({ n: bb, on: col, off: '#d8d6e4', ph: i * 1.7 });
      }
    }
  }
  // street lamps: posts along the decks, a warm head and a pool of light on the ground at night
  var LAMPS = [[2.2, 15.0, 1, 18.7], [7.95, 15.12, 1, 24.6], [12.2, 17.8, 1], [12.25, 11.75, 1],
    [2.2, 8.0, 2, 10.6], [3.7, 2.3, 3], [7.25, 2.7, 3, 12.05], [20.5, 17.9, 0]];
  var LAMPF = [];
  function lampArt(lg, b, hgt, glow) {
    if (glow) el('ellipse', { class: 'on-night glow', cx: b[0], cy: b[1], rx: 42, ry: 21, fill: 'url(#glowPool)' }, lg);
    el('ellipse', { cx: b[0], cy: b[1], rx: 5, ry: 2.5, fill: C.navy, stroke: C.ink, 'stroke-width': 1.5 }, lg);
    line(lg, b, [b[0], b[1] - hgt], { stroke: C.ink, 'stroke-width': 4.6, 'stroke-linecap': 'round' });
    line(lg, b, [b[0], b[1] - hgt], { stroke: C.navy, 'stroke-width': 1.8, 'stroke-linecap': 'round' });
    el('circle', { class: 'on-night glow', cx: b[0], cy: b[1] - hgt - 5, r: 22, fill: 'url(#glowW)' }, lg);
    el('path', { d: 'M' + (b[0] - 6) + ',' + (b[1] - hgt) + ' h12 l-2,-10 h-8 Z', class: 'lamp-glass', fill: '#e6e3f2', stroke: C.ink, 'stroke-width': 1.8, 'stroke-linejoin': 'round', 'data-lit': 1 }, lg);
    el('path', { d: 'M' + (b[0] - 7.5) + ',' + (b[1] - hgt - 10) + ' h15 l-7.5,-6 Z', fill: C.ink, stroke: C.ink, 'stroke-width': 1.5, 'stroke-linejoin': 'round' }, lg);
  }
  LAMPS.forEach(function (l) {
    var b = P(l[0], l[1], l[2]), hgt = 40;
    // an optional 4th value overrides the depth key, for a lamp standing on a deck that is drawn as one piece
    item(l[3] || l[0] + l[1] + 0.05, function (g) { lampArt(el('g', { class: 'lamp' }, g), b, hgt, true); });
    // actors are drawn above the world, so a copy of the post goes on top while someone is behind it
    var fg = el('g', { class: 'lamp', display: 'none' }, L.over);
    lampArt(fg, b, hgt, false);
    LAMPF.push({ n: fg, k: l[0] + l[1], x: b[0], base: b[1] + 3, top: b[1] - hgt - 17, on: false });
  });
  function lampsFront() {
    var who = [];
    var hp = hero.sp || P(hero.x, hero.y, hero.z);
    who.push([hero.x + hero.y, hp[0], hp[1], 13, 74]);
    CRE.forEach(function (c) { if (c.sy) who.push([c.cx + c.cy, c.sx, c.sy, 15, 40]); });
    LAMPF.forEach(function (f) {
      var on = false;
      for (var i = 0; i < who.length && !on; i++) {
        var a = who[i];
        on = a[0] < f.k - 0.05 && Math.abs(a[1] - f.x) < a[3] + 8 && a[2] < f.base && a[2] - a[4] < f.base;
      }
      if (on !== f.on) { f.on = on; f.n.setAttribute('display', on ? '' : 'none'); }
    });
  }

  // the open lot right of the Post Office (in front of the slide) changes with the season
  var GX0 = 16.2, GY0 = 14.2, GX1 = 19.6, GY1 = 16.8;
  // WINTER: an ice rink, a snowman, a Christmas tree, snow heaps; string lights at night
  item(GX0 + GY0 + 0.2, function (g) {
    var sg = sgroup(g, 'winter');
    puck(sg, function (z) { return rrect(GX0, GY0, GX1, GY1, 0.6, z); }, 0, 0.08, '#8fbfe3', '#d9f1ff');
    var sc = el('g', { fill: 'none', stroke: '#fff', 'stroke-width': 2, 'stroke-linecap': 'round', opacity: 0.9 }, sg);
    [[17.1, 15.0, 0.7], [18.5, 15.8, 0.9], [19.0, 14.9, 0.5]].forEach(function (s) {
      var a = P(s[0] - s[2], s[1], 0.08), b = P(s[0] + s[2], s[1] + 0.2, 0.08);
      el('path', { d: 'M' + a[0] + ',' + a[1] + ' Q' + ((a[0] + b[0]) / 2) + ',' + (Math.min(a[1], b[1]) - 9) + ' ' + b[0] + ',' + b[1] }, sc);
    });
    var gl = P(16.9, 16.0, 0.08);
    el('path', { d: 'M' + (gl[0] - 14) + ',' + (gl[1] + 4) + ' l22,-11 M' + (gl[0] - 4) + ',' + (gl[1] + 6) + ' l14,-7', stroke: '#fff', 'stroke-width': 2.5, 'stroke-linecap': 'round', opacity: 0.8 }, sg);
    [[19.9, 13.4, 0.42], [20.7, 17.4, 0.38], [16.1, 17.6, 0.3], [21.0, 15.9, 0.3]].forEach(function (m) { mound(sg, m[0], m[1], 0, m[2], '#f7fbff'); });
    var ng = sgroup(sg, null, 'night');
    bulbString(ng, [GX0 + 0.2, GY0 + 0.2, 1.6], [GX1 - 0.2, GY0 + 0.2, 1.6], 9, [C.red, C.yellow, C.green, C.sky, C.pink]);
  });
  item(20.3 + 14.7, function (g) {
    var sg = sgroup(g, 'winter'), p = P(20.3, 14.7, 0);
    el('ellipse', { cx: p[0], cy: p[1], rx: 17, ry: 6, fill: 'rgba(22,22,29,.15)' }, sg);
    var fx = sg; sg = el('g', {}, fx);
    var bodyS = { fill: '#fbfdff', stroke: C.ink, 'stroke-width': 2.2 };
    el('circle', Object.assign({ cx: p[0], cy: p[1] - 13, r: 14 }, bodyS), sg);
    el('circle', Object.assign({ cx: p[0], cy: p[1] - 33, r: 10.5 }, bodyS), sg);
    el('circle', Object.assign({ cx: p[0], cy: p[1] - 50, r: 8.5 }, bodyS), sg);
    [-38, -31, -13, -6].forEach(function (y, i) { el('circle', { cx: p[0] + (i < 2 ? 0 : 1), cy: p[1] + y, r: 1.8, fill: C.ink }, sg); });
    el('circle', { cx: p[0] - 3, cy: p[1] - 52, r: 1.5, fill: C.ink }, sg); el('circle', { cx: p[0] + 3, cy: p[1] - 52, r: 1.5, fill: C.ink }, sg);
    el('path', { d: 'M' + p[0] + ',' + (p[1] - 49) + ' l10,2 l-10,2 Z', fill: C.orange, stroke: C.ink, 'stroke-width': 1.2, 'stroke-linejoin': 'round' }, sg);
    el('path', { d: 'M' + (p[0] - 9) + ',' + (p[1] - 42) + ' q9,4 18,0 l1,4 q-10,4 -20,0 Z M' + (p[0] + 4) + ',' + (p[1] - 40) + ' l4,10 l4,-1 l-3,-10', fill: C.red, stroke: C.ink, 'stroke-width': 1.6, 'stroke-linejoin': 'round' }, sg);
    el('path', { d: 'M' + (p[0] - 10) + ',' + (p[1] - 34) + ' l-12,-9 l-3,-5 M' + (p[0] - 20) + ',' + (p[1] - 41) + ' l-5,1 M' + (p[0] + 10) + ',' + (p[1] - 34) + ' l12,-8 l4,-6', fill: 'none', stroke: C.brown, 'stroke-width': 2.4, 'stroke-linecap': 'round' }, sg);
    el('path', { d: 'M' + (p[0] - 10) + ',' + (p[1] - 56) + ' h20 v2.5 h-20 Z M' + (p[0] - 6.5) + ',' + (p[1] - 56) + ' v-10 h13 v10 Z', fill: C.ink, stroke: C.ink, 'stroke-width': 1.5, 'stroke-linejoin': 'round' }, sg);
    // every so often it wriggles and shakes the snow off, then stands still again
    var body = sg, cityEl = document.getElementById('city'), wait = 3 + Math.random() * 5, shake = -1, flakes = [];
    function puff() {
      for (var i = 0; i < 12; i++) {
        var a = -Math.PI * (0.1 + Math.random() * 0.8), sp = 30 + Math.random() * 45, y0 = p[1] - 10 - Math.random() * 48;
        flakes.push({ n: el('circle', { r: 1.4 + Math.random() * 1.8, fill: '#fff', stroke: 'rgba(22,22,29,.25)', 'stroke-width': 0.6, 'data-nograde': 1 }, fx),
          x: p[0] + (Math.random() < 0.5 ? -1 : 1) * (6 + Math.random() * 8), y: y0, vx: Math.cos(a) * sp * (Math.random() < 0.5 ? -1 : 1), vy: Math.sin(a) * sp, life: 0, max: 0.7 + Math.random() * 0.5, gy: p[1] + 2 - Math.random() * 6 });
      }
    }
    anim(function (t, dt) {
      if (RM || !cityEl.classList.contains('s-winter')) return;
      if (shake < 0) {
        wait -= dt;
        if (wait <= 0) { shake = 0; puff(); }
      } else {
        shake += dt;
        var k = Math.min(1, shake / 1.1), amp = 1 - k;
        body.setAttribute('transform', 'translate(' + p[0] + ',' + p[1] + ') rotate(' + (Math.sin(shake * 30) * 6 * amp).toFixed(2) + ') scale(' + (1 + Math.sin(shake * 30 + 1) * 0.04 * amp).toFixed(3) + ',' + (1 - Math.abs(Math.sin(shake * 30)) * 0.05 * amp).toFixed(3) + ') translate(' + -p[0] + ',' + -p[1] + ')');
        if (shake > 0.45 && shake - dt <= 0.45) puff();
        if (k >= 1) { shake = -1; wait = 6 + Math.random() * 8; body.removeAttribute('transform'); }
      }
      for (var i = flakes.length - 1; i >= 0; i--) {
        var f = flakes[i];
        f.life += dt; f.vy += 160 * dt; f.x += f.vx * dt; f.y = Math.min(f.gy, f.y + f.vy * dt);
        if (f.y >= f.gy) f.vx *= 0.8;
        var o = 1 - f.life / f.max;
        if (o <= 0) { f.n.remove(); flakes.splice(i, 1); continue; }
        f.n.setAttribute('cx', f.x.toFixed(1)); f.n.setAttribute('cy', f.y.toFixed(1)); f.n.setAttribute('opacity', o.toFixed(2));
      }
    });
  });
  item(17.0 + 17.7, function (g) {
    var sg = sgroup(g, 'winter'), p = P(17.0, 17.7, 0);
    el('ellipse', { cx: p[0], cy: p[1], rx: 20, ry: 7, fill: 'rgba(22,22,29,.15)' }, sg);
    el('rect', { x: p[0] - 4, y: p[1] - 12, width: 8, height: 12, fill: C.brown, stroke: C.ink, 'stroke-width': 1.8 }, sg);
    [[0, 24, 22], [-16, 19, 17], [-30, 14, 13]].forEach(function (t) {
      var y = p[1] - 10 + t[0];
      el('path', { d: 'M' + (p[0] - t[1]) + ',' + y + ' L' + p[0] + ',' + (y - t[2] - 10) + ' L' + (p[0] + t[1]) + ',' + y + ' Q' + p[0] + ',' + (y + 5) + ' ' + (p[0] - t[1]) + ',' + y + ' Z', fill: '#2f9e6a', stroke: C.ink, 'stroke-width': 2, 'stroke-linejoin': 'round' }, sg);
      el('path', { d: 'M' + (p[0] - t[1] * 0.45) + ',' + (y - t[2] * 0.55) + ' L' + p[0] + ',' + (y - t[2] - 10) + ' L' + (p[0] + t[1] * 0.45) + ',' + (y - t[2] * 0.55) + ' q-4,3 -7,0 q-4,3 -8,0 Z', fill: '#fbfdff', stroke: C.ink, 'stroke-width': 1.4, 'stroke-linejoin': 'round' }, sg);
    });
    var top = p[1] - 64;
    el('circle', { class: 'on-night glow', cx: p[0], cy: top, r: 18, fill: 'url(#glowW)' }, sg);
    el('path', { d: 'M' + p[0] + ',' + (top - 8) + ' l2.4,5.5 6,0.4 -4.6,3.8 1.5,5.8 -5.3,-3.2 -5.3,3.2 1.5,-5.8 -4.6,-3.8 6,-0.4 Z', fill: C.yellow, stroke: C.ink, 'stroke-width': 1.5, 'stroke-linejoin': 'round', 'data-lit': 1 }, sg);
    [[-12, -8], [9, -12], [-4, -22], [8, -30], [-9, -36], [3, -44]].forEach(function (o, i) {
      var bb = el('circle', { cx: p[0] + o[0], cy: p[1] + o[1], r: 2.6, fill: '#d8d6e4', stroke: C.ink, 'stroke-width': 1.2, 'data-lit': 1 }, sg);
      BULBS.push({ n: bb, on: [C.red, C.yellow, C.sky, C.pink][i % 4], off: [C.red, C.yellow, C.sky, C.pink][i % 4], ph: i * 2.1, tw: 1 });
    });
  });

  // SPRING: a flower bed with tulips, a cherry tree; paper lanterns at night
  item(GX0 + GY0 + 0.2, function (g) {
    var sg = sgroup(g, 'spring'), R = srand(7);
    puck(sg, function (z) { return rrect(GX0, GY0, GX1, GY1, 0.6, z); }, 0, 0.12, '#a0673f', '#8fdc7e');
    var fl = [];
    for (var i = 0; i < 38; i++) fl.push([lerp(GX0 + 0.35, GX1 - 0.35, R()), lerp(GY0 + 0.3, GY1 - 0.3, R()), [C.pink, C.yellow, '#fff', C.red, C.lilac][Math.floor(R() * 5)], R() * 6]);
    fl.sort(function (a, b) { return a[0] + a[1] - b[0] - b[1]; });
    var heads = fl.map(function (f) {
      var p = P(f[0], f[1], 0.12), fg = el('g', { transform: 'translate(' + p[0].toFixed(1) + ',' + p[1].toFixed(1) + ')' }, sg);
      el('path', { d: 'M0,0 q-1,-6 0,-11 M0,-4 q4,-2 6,-6', fill: 'none', stroke: '#2f8f4e', 'stroke-width': 1.8, 'stroke-linecap': 'round' }, fg);
      var hg = el('g', null, fg);
      el('path', { d: 'M-3.5,-11 q0,-6 3.5,-6 q3.5,0 3.5,6 l-1.7,-2 -1.8,2 -1.8,-2 Z', fill: f[2], stroke: C.ink, 'stroke-width': 1.3, 'stroke-linejoin': 'round' }, hg);
      return { g: hg, ph: f[3] };
    });
    anim(function (t) { heads.forEach(function (h) { h.g.setAttribute('transform', 'rotate(' + (Math.sin(t * 1.8 + h.ph) * 7).toFixed(1) + ',0,-11)'); }); });
    [[19.9, 13.4, 0.3], [20.7, 17.4, 0.28], [16.1, 17.6, 0.25]].forEach(function (m) { mound(sg, m[0], m[1], 0, m[2], '#8fdc7e'); });
    var ng = sgroup(sg, null, 'night');
    bulbString(ng, [GX0 + 0.2, GY0 + 0.2, 1.7], [GX1 - 0.2, GY0 + 0.2, 1.7], 6, [C.red, C.orange, C.pink], 'lantern');
  });
  item(20.4 + 14.8, function (g) {
    var sg = sgroup(g, 'spring'), p = P(20.4, 14.8, 0);
    el('ellipse', { cx: p[0], cy: p[1], rx: 26, ry: 9, fill: 'rgba(22,22,29,.15)' }, sg);
    el('path', { d: 'M' + (p[0] - 4) + ',' + p[1] + ' q2,-20 -6,-34 M' + (p[0] + 3) + ',' + p[1] + ' q0,-22 8,-36', fill: 'none', stroke: C.ink, 'stroke-width': 7, 'stroke-linecap': 'round' }, sg);
    el('path', { d: 'M' + (p[0] - 4) + ',' + p[1] + ' q2,-20 -6,-34 M' + (p[0] + 3) + ',' + p[1] + ' q0,-22 8,-36', fill: 'none', stroke: C.brown, 'stroke-width': 3.6, 'stroke-linecap': 'round' }, sg);
    var crown = el('g', null, sg);
    [[-14, -44, 15], [13, -46, 16], [0, -58, 17], [-4, -38, 12]].forEach(function (c) { el('circle', { cx: p[0] + c[0], cy: p[1] + c[1], r: c[2], fill: '#ffb6d3', stroke: C.ink, 'stroke-width': 2 }, crown); });
    var R = srand(3);
    for (var i = 0; i < 14; i++) el('circle', { cx: p[0] + (R() - 0.5) * 44, cy: p[1] - 40 - R() * 28, r: 2.2, fill: '#fff', stroke: C.pink, 'stroke-width': 1 }, crown);
    anim(function (t) { crown.setAttribute('transform', 'rotate(' + (Math.sin(t * 1.2) * 2).toFixed(2) + ',' + p[0] + ',' + p[1] + ')'); });
  });

  // SUMMER: a pool with a float ring and a beach ball, a parasol and lounger, a palm
  item(GX0 + GY0 + 0.2, function (g) {
    var sg = sgroup(g, 'summer');
    puck(sg, function (z) { return rrect(GX0, GY0, GX1, GY1, 0.55, z); }, 0, 0.16, '#d8cdb3', '#fffaf0');
    var water = poly(sg, rrect(GX0 + 0.22, GY0 + 0.22, GX1 - 0.22, GY1 - 0.22, 0.4, 0.1), '#55c8ff', { class: 'pool' });
    var rip = el('g', { fill: 'none', stroke: '#fff', 'stroke-width': 2, 'stroke-linecap': 'round', opacity: 0.85 }, sg);
    var rips = [[17.2, 15.1], [18.8, 15.6], [17.9, 16.1], [19.0, 14.8]].map(function (r) { return { n: el('path', null, rip), p: P(r[0], r[1], 0.1), ph: r[0] }; });
    anim(function (t) { rips.forEach(function (r) { var k = Math.sin(t * 2 + r.ph) * 3; r.n.setAttribute('d', 'M' + (r.p[0] - 10) + ',' + r.p[1] + ' q5,' + (-3 + k * 0.4) + ' 10,0 t10,0'); }); });
    // float ring + beach ball bob on the water
    var ring = el('g', null, sg), rp = P(17.4, 15.4, 0.1);
    el('ellipse', { cx: rp[0], cy: rp[1], rx: 15, ry: 7.5, fill: C.pink, stroke: C.ink, 'stroke-width': 2 }, ring);
    el('ellipse', { cx: rp[0], cy: rp[1] - 1, rx: 6, ry: 3, fill: '#55c8ff', stroke: C.ink, 'stroke-width': 1.8 }, ring);
    el('path', { d: 'M' + (rp[0] - 13) + ',' + (rp[1] - 3) + ' l5,3 M' + (rp[0] + 9) + ',' + (rp[1] + 5) + ' l5,-3 M' + (rp[0] + 2) + ',' + (rp[1] - 7) + ' l2,3', stroke: '#fff', 'stroke-width': 3.2, 'stroke-linecap': 'round' }, ring);
    var ball = el('g', null, sg), bp = P(18.9, 15.9, 0.1);
    el('circle', { cx: bp[0], cy: bp[1] - 8, r: 9, fill: '#fff', stroke: C.ink, 'stroke-width': 2 }, ball);
    el('path', { d: 'M' + (bp[0] - 9) + ',' + (bp[1] - 8) + ' q9,-5 18,0 M' + bp[0] + ',' + (bp[1] - 17) + ' q-5,9 0,18', fill: 'none', stroke: C.red, 'stroke-width': 3.2 }, ball);
    anim(function (t) {
      ring.setAttribute('transform', 'translate(' + (Math.sin(t * 0.5) * 6).toFixed(1) + ',' + (Math.sin(t * 2.1) * 1.6).toFixed(1) + ') rotate(' + (Math.sin(t * 0.7) * 4).toFixed(1) + ',' + rp[0] + ',' + rp[1] + ')');
      ball.setAttribute('transform', 'translate(0,' + (Math.sin(t * 2.4 + 1) * 2).toFixed(1) + ') rotate(' + (t * 20 % 360).toFixed(1) + ',' + bp[0] + ',' + (bp[1] - 8) + ')');
    });
    // a ladder on the near rim
    var lp = P(19.2, 16.45, 0.16);
    el('path', { d: 'M' + (lp[0] - 4) + ',' + (lp[1] + 4) + ' v-14 q0,-5 4,-5 M' + (lp[0] + 4) + ',' + (lp[1]) + ' v-14 q0,-5 4,-5', fill: 'none', stroke: C.ink, 'stroke-width': 4.2, 'stroke-linecap': 'round' }, sg);
    el('path', { d: 'M' + (lp[0] - 4) + ',' + (lp[1] + 4) + ' v-14 q0,-5 4,-5 M' + (lp[0] + 4) + ',' + (lp[1]) + ' v-14 q0,-5 4,-5', fill: 'none', stroke: '#e6e6ef', 'stroke-width': 1.8, 'stroke-linecap': 'round' }, sg);
    var ng = sgroup(sg, null, 'night');
    bulbString(ng, [GX0 + 0.2, GY0 + 0.2, 1.6], [GX1 - 0.2, GY0 + 0.2, 1.6], 9, [C.pink, C.sky, C.yellow, C.green, C.lilac]);
  });
  item(20.3 + 14.6, function (g) {
    var sg = sgroup(g, 'summer'), p = P(20.3, 14.6, 0);
    // lounger
    var c = P(20.0, 15.4, 0);
    var lg = el('g', { transform: 'translate(' + c[0] + ',' + c[1] + ') scale(1.45) translate(' + -c[0] + ',' + -c[1] + ')' }, sg);
    el('path', { d: 'M' + (c[0] - 16) + ',' + (c[1] - 4) + ' l22,-11 l10,5 l-22,11 Z', fill: C.sky, stroke: C.ink, 'stroke-width': 2, 'stroke-linejoin': 'round' }, lg);
    el('path', { d: 'M' + (c[0] - 16) + ',' + (c[1] - 4) + ' l-6,-14 l10,-5 l6,14', fill: shade(C.sky, -0.15), stroke: C.ink, 'stroke-width': 2, 'stroke-linejoin': 'round' }, lg);
    el('path', { d: 'M' + (c[0] - 14) + ',' + (c[1] - 3) + ' v6 M' + (c[0] + 14) + ',' + (c[1] + 2) + ' v-6', stroke: C.ink, 'stroke-width': 2 }, lg);
    // parasol
    el('ellipse', { cx: p[0] + 6, cy: p[1] + 2, rx: 26, ry: 10, fill: 'rgba(22,22,29,.13)' }, sg);
    line(sg, p, [p[0], p[1] - 52], { stroke: C.ink, 'stroke-width': 3.2 });
    var top = p[1] - 52;
    el('path', { d: 'M' + (p[0] - 30) + ',' + (top + 10) + ' Q' + p[0] + ',' + (top - 22) + ' ' + (p[0] + 30) + ',' + (top + 10) + ' Q' + p[0] + ',' + (top + 2) + ' ' + (p[0] - 30) + ',' + (top + 10) + ' Z', fill: C.red, stroke: C.ink, 'stroke-width': 2, 'stroke-linejoin': 'round' }, sg);
    el('path', { d: 'M' + (p[0] - 12) + ',' + (top + 6) + ' Q' + (p[0] - 4) + ',' + (top - 10) + ' ' + p[0] + ',' + (top - 7) + ' Q' + (p[0] + 4) + ',' + (top - 10) + ' ' + (p[0] + 12) + ',' + (top + 6) + ' Q' + p[0] + ',' + (top + 3) + ' ' + (p[0] - 12) + ',' + (top + 6) + ' Z', fill: '#fff', stroke: C.ink, 'stroke-width': 1.5, 'stroke-linejoin': 'round' }, sg);
  });
  item(17.0 + 17.7, function (g) {
    var sg = sgroup(g, 'summer'), p = P(17.0, 17.7, 0);
    el('ellipse', { cx: p[0], cy: p[1], rx: 22, ry: 8, fill: 'rgba(22,22,29,.13)' }, sg);
    var tr = 'M' + p[0] + ',' + p[1] + ' q-2,-30 10,-58';
    el('path', { d: tr, fill: 'none', stroke: C.ink, 'stroke-width': 9, 'stroke-linecap': 'round' }, sg);
    el('path', { d: tr, fill: 'none', stroke: '#c98b52', 'stroke-width': 5.4, 'stroke-linecap': 'round', 'stroke-dasharray': '5 3' }, sg);
    var fr = el('g', null, sg), tp = [p[0] + 10, p[1] - 58];
    [[-34, 6], [-22, -16], [6, -24], [30, -8], [26, 14], [-12, 16]].forEach(function (f) {
      el('path', { d: 'M' + tp[0] + ',' + tp[1] + ' q' + (f[0] * 0.5) + ',' + (f[1] * 0.6 - 10) + ' ' + f[0] + ',' + f[1] + ' q' + (-f[0] * 0.4) + ',' + (-f[1] * 0.2 + 4) + ' ' + (-f[0]) + ',' + (-f[1]) + ' Z', fill: '#38c47b', stroke: C.ink, 'stroke-width': 1.8, 'stroke-linejoin': 'round' }, fr);
    });
    el('circle', { cx: tp[0] - 3, cy: tp[1] + 4, r: 4, fill: C.brown, stroke: C.ink, 'stroke-width': 1.5 }, fr);
    el('circle', { cx: tp[0] + 4, cy: tp[1] + 5, r: 4, fill: C.brown, stroke: C.ink, 'stroke-width': 1.5 }, fr);
    anim(function (t) { fr.setAttribute('transform', 'rotate(' + (Math.sin(t * 1.4) * 3).toFixed(2) + ',' + tp[0] + ',' + tp[1] + ')'); });
  });

  // the gap between the Workshop and the Studio gets a small seasonal touch too
  item(13.9 + 7.0, function (g) {
    var p = P(13.9, 7.0, 0);
    // winter: a red sled by a snow heap
    var w = sgroup(g, 'winter');
    mound(w, 13.4, 6.6, 0, 0.4, '#f7fbff');
    el('path', { d: 'M' + (p[0] - 18) + ',' + (p[1] - 2) + ' l26,-13 l12,6 l-26,13 Z', fill: C.red, stroke: C.ink, 'stroke-width': 2, 'stroke-linejoin': 'round' }, w);
    el('path', { d: 'M' + (p[0] - 22) + ',' + (p[1] + 2) + ' q-4,-3 0,-6 M' + (p[0] - 20) + ',' + (p[1] + 3) + ' l28,-14 M' + (p[0] - 8) + ',' + (p[1] + 9) + ' l28,-14 q5,-1 4,-6', fill: 'none', stroke: C.ink, 'stroke-width': 2.2, 'stroke-linecap': 'round' }, w);
    // spring: a flowering bush and a bench
    var sp = sgroup(g, 'spring');
    mound(sp, 13.3, 6.5, 0, 0.5, '#7fd27a');
    var R = srand(21);
    for (var i = 0; i < 9; i++) { var bp = P(13.3, 6.5, 0); el('circle', { cx: bp[0] + (R() - 0.5) * 30, cy: bp[1] - 4 - R() * 10, r: 2.4, fill: [C.pink, C.yellow, '#fff'][i % 3], stroke: C.ink, 'stroke-width': 1 }, sp); }
    el('path', { d: 'M' + (p[0] - 16) + ',' + (p[1] - 10) + ' l24,-12 l6,3 l-24,12 Z', fill: C.brown, stroke: C.ink, 'stroke-width': 2, 'stroke-linejoin': 'round' }, sp);
    el('path', { d: 'M' + (p[0] - 16) + ',' + (p[1] - 10) + ' v-10 l24,-12 v10', fill: shade(C.brown, 0.15), stroke: C.ink, 'stroke-width': 2, 'stroke-linejoin': 'round' }, sp);
    el('path', { d: 'M' + (p[0] - 14) + ',' + (p[1] - 9) + ' v9 M' + (p[0] + 12) + ',' + (p[1] - 19) + ' v9 M' + (p[0] - 8) + ',' + (p[1] - 6) + ' v8', stroke: C.ink, 'stroke-width': 2.2, 'stroke-linecap': 'round' }, sp);
    // summer: an ice-cream cart
    var su = sgroup(g, 'summer'), c = P(13.9, 7.0, 0);
    el('ellipse', { cx: c[0], cy: c[1] + 2, rx: 24, ry: 8, fill: 'rgba(22,22,29,.13)' }, su);
    el('path', { d: 'M' + (c[0] - 20) + ',' + (c[1] - 10) + ' l22,-11 l18,9 v18 l-22,11 l-18,-9 Z', fill: '#fff', stroke: C.ink, 'stroke-width': 2, 'stroke-linejoin': 'round' }, su);
    el('path', { d: 'M' + (c[0] - 20) + ',' + (c[1] - 10) + ' l18,9 l22,-11 M' + (c[0] - 2) + ',' + (c[1] - 1) + ' v18', fill: 'none', stroke: C.ink, 'stroke-width': 2 }, su);
    el('path', { d: 'M' + (c[0] - 18) + ',' + (c[1] - 4) + ' l14,7 v5 l-14,-7 Z', fill: C.pink, stroke: C.ink, 'stroke-width': 1.5 }, su);
    el('circle', { cx: c[0] - 14, cy: c[1] + 9, r: 4.5, fill: C.ink }, su); el('circle', { cx: c[0] + 10, cy: c[1] + 13, r: 4.5, fill: C.ink }, su);
    line(su, [c[0] - 2, c[1] - 12], [c[0] - 2, c[1] - 46], { stroke: C.ink, 'stroke-width': 2.6 });
    el('path', { d: 'M' + (c[0] - 26) + ',' + (c[1] - 40) + ' Q' + (c[0] - 2) + ',' + (c[1] - 64) + ' ' + (c[0] + 22) + ',' + (c[1] - 40) + ' Z', fill: C.yellow, stroke: C.ink, 'stroke-width': 2, 'stroke-linejoin': 'round' }, su);
    el('path', { d: 'M' + (c[0] - 10) + ',' + (c[1] - 41) + ' Q' + (c[0] - 4) + ',' + (c[1] - 58) + ' ' + (c[0] - 2) + ',' + (c[1] - 52) + ' Q' + c[0] + ',' + (c[1] - 58) + ' ' + (c[0] + 6) + ',' + (c[1] - 41) + ' Z', fill: '#fff', stroke: C.ink, 'stroke-width': 1.4, 'stroke-linejoin': 'round' }, su);
    el('path', { d: 'M' + (c[0] + 8) + ',' + (c[1] - 18) + ' l4,10 l4,-10 Z', fill: '#e8b06a', stroke: C.ink, 'stroke-width': 1.3, 'stroke-linejoin': 'round' }, su);
    el('circle', { cx: c[0] + 12, cy: c[1] - 21, r: 4.4, fill: C.mint, stroke: C.ink, 'stroke-width': 1.3 }, su);
    // autumn: a leaf heap with a rake stuck in it
    var au = sgroup(g, 'autumn');
    mound(au, 13.6, 6.8, 0, 0.55, '#ff8a2c');
    var hp = P(13.6, 6.8, 0);
    line(au, [hp[0] + 4, hp[1] - 8], [hp[0] + 22, hp[1] - 52], { stroke: C.ink, 'stroke-width': 4.4, 'stroke-linecap': 'round' });
    line(au, [hp[0] + 4, hp[1] - 8], [hp[0] + 22, hp[1] - 52], { stroke: C.brown, 'stroke-width': 2, 'stroke-linecap': 'round' });
    el('path', { d: 'M' + (hp[0] - 4) + ',' + (hp[1] - 4) + ' l16,-6 M' + (hp[0] - 3) + ',' + (hp[1] - 4) + ' v5 M' + (hp[0] + 2) + ',' + (hp[1] - 6) + ' v5 M' + (hp[0] + 7) + ',' + (hp[1] - 8) + ' v5 M' + (hp[0] + 12) + ',' + (hp[1] - 10) + ' v5', fill: 'none', stroke: C.ink, 'stroke-width': 2, 'stroke-linecap': 'round' }, au);
    var R2 = srand(33);
    for (i = 0; i < 8; i++) el('path', { d: 'M' + (hp[0] + (R2() - 0.5) * 40) + ',' + (hp[1] - R2() * 12) + ' q4,-4 8,0 q-4,4 -8,0 Z', fill: ['#e5532f', '#ffc233', '#c9682a'][i % 3], stroke: C.ink, 'stroke-width': 1 }, au);
  });
  // AUTUMN: leaf heaps and loose leaves, a pumpkin patch that turns into jack-o'-lanterns at night, a scarecrow
  item(GX0 + GY0 + 0.2, function (g) {
    var sg = sgroup(g, 'autumn'), R = srand(11);
    var cols = ['#ff8a2c', '#e5532f', '#ffc233', '#c9682a'];
    for (var i = 0; i < 46; i++) {
      var x = lerp(15.6, 20.9, R()), y = lerp(13.6, 18.2, R());
      var p = P(x, y, 0);
      el('path', { d: 'M' + p[0] + ',' + p[1] + ' q4,-4 8,0 q-4,4 -8,0 Z', fill: cols[i % 4], stroke: C.ink, 'stroke-width': 1.1, transform: 'rotate(' + Math.round(R() * 360) + ',' + (p[0] + 4) + ',' + p[1] + ')' }, sg);
    }
    [[17.0, 14.9, 0.55, cols[0]], [18.6, 16.0, 0.62, cols[1]], [19.1, 14.7, 0.45, cols[2]], [16.6, 16.4, 0.38, cols[3]]].forEach(function (m) {
      mound(sg, m[0], m[1], 0, m[2], m[3]);
      var p = P(m[0], m[1], 0), RR = srand(Math.round(m[0] * 100));
      for (var k = 0; k < 7; k++) {
        var lx = p[0] + (RR() - 0.5) * m[2] * 52, ly = p[1] - RR() * m[2] * 22 - 2;
        el('path', { d: 'M' + lx + ',' + ly + ' q4,-4 8,0 q-4,4 -8,0 Z', fill: cols[(k + 1) % 4], stroke: C.ink, 'stroke-width': 1 }, sg);
      }
    });
  });
  [[20.15, 14.45, 1], [20.65, 14.85, 0.8], [20.1, 15.2, 0.7]].forEach(function (q, i) {
    item(q[0] + q[1], function (g) {
      var sg = sgroup(g, 'autumn'), p = P(q[0], q[1], 0), s = q[2], rx = 14 * s, ry = 11 * s;
      el('ellipse', { cx: p[0], cy: p[1], rx: rx + 3, ry: 5 * s, fill: 'rgba(22,22,29,.15)' }, sg);
      el('ellipse', { cx: p[0], cy: p[1] - ry, rx: rx, ry: ry, fill: C.orange, stroke: C.ink, 'stroke-width': 2 }, sg);
      el('path', { d: 'M' + (p[0] - rx * 0.4) + ',' + (p[1] - ry * 1.9) + ' q-4,' + ry + ' 0,' + (ry * 1.8) + ' M' + (p[0] + rx * 0.4) + ',' + (p[1] - ry * 1.9) + ' q4,' + ry + ' 0,' + (ry * 1.8), fill: 'none', stroke: shade(C.orange, -0.35), 'stroke-width': 1.6 }, sg);
      el('path', { d: 'M' + p[0] + ',' + (p[1] - ry * 2) + ' q1,-5 5,-7', fill: 'none', stroke: '#3d7a3a', 'stroke-width': 3, 'stroke-linecap': 'round' }, sg);
      // carved face, glowing at night
      var fg = sgroup(sg, null, 'night'), fy = p[1] - ry;
      el('circle', { class: 'glow', cx: p[0], cy: fy, r: rx * 1.8, fill: 'url(#glowW)' }, fg);
      el('path', { d: 'M' + (p[0] - 6 * s) + ',' + (fy - 3 * s) + ' l3,-4 l3,4 Z M' + (p[0] + 1 * s) + ',' + (fy - 3 * s) + ' l3,-4 l3,4 Z M' + (p[0] - 7 * s) + ',' + (fy + 2 * s) + ' q7,6 14,0 l-3,1 -2,-2 -2,2 -2,-2 -2,2 Z', fill: '#ffd34d', stroke: C.ink, 'stroke-width': 1.2, 'stroke-linejoin': 'round', 'data-lit': 1 }, fg);
    });
  });
  item(17.0 + 17.7, function (g) {
    var sg = sgroup(g, 'autumn'), p = P(17.0, 17.7, 0);
    el('ellipse', { cx: p[0], cy: p[1], rx: 14, ry: 5, fill: 'rgba(22,22,29,.15)' }, sg);
    line(sg, p, [p[0], p[1] - 62], { stroke: C.ink, 'stroke-width': 5 }); line(sg, p, [p[0], p[1] - 62], { stroke: C.brown, 'stroke-width': 2.2 });
    var sw = el('g', null, sg);
    el('path', { d: 'M' + (p[0] - 22) + ',' + (p[1] - 44) + ' h44', stroke: C.ink, 'stroke-width': 5, 'stroke-linecap': 'round' }, sw);
    el('path', { d: 'M' + (p[0] - 22) + ',' + (p[1] - 44) + ' h44', stroke: C.brown, 'stroke-width': 2.2, 'stroke-linecap': 'round' }, sw);
    el('path', { d: 'M' + (p[0] - 13) + ',' + (p[1] - 48) + ' h26 l-3,24 h-20 Z', fill: '#4f7bd9', stroke: C.ink, 'stroke-width': 2, 'stroke-linejoin': 'round' }, sw);
    el('path', { d: 'M' + (p[0] - 6) + ',' + (p[1] - 48) + ' v24 M' + (p[0] + 6) + ',' + (p[1] - 48) + ' v24', stroke: '#e5532f', 'stroke-width': 1.6 }, sw);
    el('path', { d: 'M' + (p[0] - 24) + ',' + (p[1] - 44) + ' l-4,5 M' + (p[0] - 24) + ',' + (p[1] - 44) + ' l-5,1 M' + (p[0] + 24) + ',' + (p[1] - 44) + ' l4,5 M' + (p[0] + 24) + ',' + (p[1] - 44) + ' l5,1', stroke: C.yellow, 'stroke-width': 2, 'stroke-linecap': 'round' }, sw);
    el('circle', { cx: p[0], cy: p[1] - 56, r: 8, fill: '#f3d9a4', stroke: C.ink, 'stroke-width': 2 }, sw);
    el('path', { d: 'M' + (p[0] - 3) + ',' + (p[1] - 58) + ' l1.5,1.5 M' + (p[0] + 3) + ',' + (p[1] - 58) + ' l-1.5,1.5 M' + (p[0] - 3) + ',' + (p[1] - 53) + ' q3,2 6,0', fill: 'none', stroke: C.ink, 'stroke-width': 1.4, 'stroke-linecap': 'round' }, sw);
    el('path', { d: 'M' + (p[0] - 16) + ',' + (p[1] - 61) + ' h32 l-2,-2 h-6 l-3,-9 h-10 l-3,9 h-6 Z', fill: C.yellow, stroke: C.ink, 'stroke-width': 1.8, 'stroke-linejoin': 'round' }, sw);
    anim(function (t) { sw.setAttribute('transform', 'rotate(' + (Math.sin(t * 1.1) * 2.5).toFixed(2) + ',' + p[0] + ',' + p[1] + ')'); });
  });

  // draw everything
  items.sort(function (a, b) { return a.k - b.k; });
  items.forEach(function (it) { it.f(L.world); });

  /* ---------- rope ---------- */
  var ropeO = el('path', { fill: 'none', stroke: C.ink, 'stroke-width': 5, 'stroke-linecap': 'round' }, L.fx);
  var ropeI = el('path', { fill: 'none', stroke: C.yellow, 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-dasharray': '4 4' }, L.fx);
  L.fx.insertBefore(ropeI, L.fx.firstChild);
  L.fx.insertBefore(ropeO, ropeI);
  // keep the rope beneath actors: move to the route layer
  L.route.appendChild(ropeO); L.route.appendChild(ropeI);
  // Rope with natural slack; a hanging load pulls it into a V at the hands.
  function ropeY(u, dyn) {
    var a = ROPE.a, b = ROPE.b;
    return [lerp(a[0], b[0], u), lerp(a[1], b[1], u) + 4 * ROPE.sag * u * (1 - u) + (dyn || 0)];
  }
  function ropeDip(u) { return 18 * Math.pow(Math.sin(Math.PI * clamp(u, 0, 1)), 0.8); }
  function ropeHand(u) { return ropeY(u, ropeDip(u)); }
  function drawRope(dt) {
    var pts = [], n = 24, k, v, y;
    if (ROPE.hold != null) {
      var u = clamp(ROPE.hold, 0.001, 0.999), e = ropeDip(u);
      ROPE.load = e; ROPE.wob = e; ROPE.wv = 0;
      for (k = 0; k <= n; k++) {
        v = k / n;
        var tent = v < u ? v / u : (1 - v) / (1 - u);
        pts.push(ropeY(v, e * tent));
      }
      pts.splice(Math.round(u * n), 0, ropeHand(u));
      pts.sort(function (p1, p2) { return p1[0] - p2[0]; });
    } else {
      // after release the extra dip rings out as a damped wave
      ROPE.wv += (-ROPE.wob * 90 - ROPE.wv * 6) * dt;
      ROPE.wob += ROPE.wv * dt;
      for (k = 0; k <= n; k++) { v = k / n; pts.push(ropeY(v, ROPE.wob * Math.sin(Math.PI * v))); }
    }
    var d = 'M' + pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' L');
    ropeO.setAttribute('d', d); ropeI.setAttribute('d', d);
  }

  /* ---------- hit areas + tags ---------- */
  var TAGS = [];
  ZONES.forEach(function (z, i) {
    var b = z.b, x = b[0], y = b[1], w = b[2], d = b[3], T = b[4] + z.hb;
    poly(L.hits, [P(x, y, T), P(x + w, y, T), P(x + w, y, 0), P(x + w, y + d, 0), P(x, y + d, 0), P(x, y + d, T)], 'transparent', { stroke: 'none', 'data-zone': i });
    var tp = P(x + w / 2, y + d / 2, T + 0.35);
    var tg = el('g', { class: 'tag', 'data-zone': i, transform: 'translate(' + tp[0] + ',' + tp[1] + ')' }, L.tags);
    var inner = el('g', null, tg);
    var rect = el('rect', { y: -15, height: 28, fill: '#fff', stroke: C.ink, 'stroke-width': 2.5 }, inner);
    var sh = el('rect', { y: -11, height: 28, fill: C.ink }, inner);
    inner.insertBefore(sh, rect);
    var num = el('rect', { y: -15, width: 26, height: 28, fill: z.col, stroke: C.ink, 'stroke-width': 2.5 }, inner);
    var nt = el('text', { class: 'n', y: 6, 'font-size': 24, 'text-anchor': 'middle', fill: C.ink }, inner);
    nt.textContent = z.n;
    var ten = el('text', { y: 6, 'font-size': 24, fill: C.ink, lang: 'en' }, inner); ten.textContent = z.en;
    var tvi = el('text', { y: 6, 'font-size': 24, fill: C.ink, lang: 'vi' }, inner); tvi.textContent = z.vi;
    TAGS.push({ g: tg, inner: inner, rect: rect, sh: sh, num: num, nt: nt, ten: ten, tvi: tvi, base: tp, ph: i * 0.9 });
  });
  function layoutTags() {
    var vi = document.documentElement.getAttribute('data-lang') === 'vi';
    TAGS.forEach(function (t) {
      var txt = vi ? t.tvi : t.ten;
      var tw = 0;
      try { tw = txt.getBBox().width; } catch (e) {}
      if (!tw) tw = txt.textContent.length * 10.5;
      var W = Math.ceil(26 + 10 + tw + 14), x0 = -W / 2;
      t.rect.setAttribute('x', x0); t.rect.setAttribute('width', W);
      t.sh.setAttribute('x', x0 + 4); t.sh.setAttribute('width', W);
      t.num.setAttribute('x', x0);
      t.nt.setAttribute('x', x0 + 13);
      t.ten.setAttribute('x', x0 + 36); t.tvi.setAttribute('x', x0 + 36);
    });
    if (ARCADE_TAG) ARCADE_TAG();
  }
  // the cabinet's hit area must sit above the Home zone's, or clicks fall through to Home
  if (ARCADE_HIT) L.hits.appendChild(ARCADE_HIT);
  var nextArrow = el('path', { d: 'M-10,-14 h20 l-10,12 Z', fill: C.yellow, stroke: C.ink, 'stroke-width': 2.5, 'stroke-linejoin': 'round', 'pointer-events': 'none' }, L.tags);
  anim(function (t) {
    var ts = clamp(0.7 / (view.s || 1), 0.55, 1.9);
    TAGS.forEach(function (tg) { tg.inner.setAttribute('transform', 'translate(0,' + (Math.sin(t * 2 + tg.ph) * 2.5).toFixed(1) + ') scale(' + ts.toFixed(3) + ')'); });
    var nt = TAGS[state.next];
    if (nt && hero.mode !== 'travel') {
      nextArrow.style.display = '';
      var by = Math.abs(Math.sin(t * 4)) * -8;
      nextArrow.setAttribute('transform', 'translate(' + nt.base[0] + ',' + (nt.base[1] - 22 * ts + by).toFixed(1) + ') scale(' + ts.toFixed(3) + ')');
    } else nextArrow.style.display = 'none';
  });

  /* ---------- suggested route (marching ants) ---------- */
  var antsBg = el('path', { fill: 'none', stroke: '#fff', 'stroke-width': 7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.9 }, L.route);
  var ants = el('path', { fill: 'none', stroke: C.ink, 'stroke-width': 3, 'stroke-dasharray': '2 9', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, L.route);
  L.route.insertBefore(antsBg, L.route.firstChild);
  L.route.insertBefore(ants, antsBg.nextSibling);
  function segPoints(s, rev) {
    var a = rev ? s.b : s.a, b = rev ? s.a : s.b, out = [];
    if (s.t === 'jump' || s.t === 'hop') {
      var hh = s.t === 'hop' ? 0.9 : 2.4;
      for (var k = 1; k <= 10; k++) {
        var u = k / 10, p = P(lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u) + hh * 4 * u * (1 - u));
        out.push(p);
      }
    } else if (s.t === 'slide') {
      var sl = SLIDE.pts.map(function (o) { return o.sp; });
      if (a[1] > b[1]) sl.reverse();
      out.push(P(a[0], a[1], a[2]));
      out = out.concat(sl);
      out.push(P(b[0], b[1], b[2] + 0.02));
    } else if (s.t === 'rope') {
      for (k = 1; k <= 8; k++) { u = k / 8; out.push(P(lerp(a[0], b[0], u), a[1], a[2] + 0.02)); }
    } else out.push(P(b[0], b[1], b[2] + 0.02));
    return out;
  }
  function drawAnts(from, to) {
    if (from == null || to == null || from === to) { ants.setAttribute('d', ''); antsBg.setAttribute('d', ''); return; }
    var p0 = GN[STOP_NODE[from]];
    var d = 'M' + P(p0[0], p0[1], p0[2] + 0.02).join(',');
    plan(STOP_NODE[from], STOP_NODE[to]).forEach(function (sg) {
      segPoints(sg).forEach(function (p) { d += ' L' + p[0].toFixed(1) + ',' + p[1].toFixed(1); });
    });
    ants.setAttribute('d', d); antsBg.setAttribute('d', d);
  }
  anim(function (t) { ants.setAttribute('stroke-dashoffset', (-t * 22 % 110).toFixed(1)); });

  /* ================= SOUND ================= */
  var SFX = (function () {
    var ctx = null, on = true;
    try { on = localStorage.getItem('city-sound') !== '0'; } catch (e) {}
    function ac() {
      if (!ctx) { var A = window.AudioContext || window.webkitAudioContext; if (!A) return null; ctx = new A(); }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    function tone(f, d, type, v, slide, delay) {
      if (!on) return;
      var a = ac(); if (!a) return;
      var t = a.currentTime + (delay || 0), o = a.createOscillator(), g = a.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(f, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t + d);
      g.gain.setValueAtTime(v || 0.04, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(a.destination);
      o.start(t); o.stop(t + d + 0.03);
    }
    function noise(d, v, f) {
      if (!on) return;
      var a = ac(); if (!a) return;
      var n = Math.floor(a.sampleRate * d), buf = a.createBuffer(1, n, a.sampleRate), ch = buf.getChannelData(0);
      for (var i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / n);
      var s = a.createBufferSource(), bp = a.createBiquadFilter(), g = a.createGain();
      s.buffer = buf; bp.type = 'bandpass'; bp.frequency.value = f || 1200; g.gain.value = v || 0.08;
      s.connect(bp); bp.connect(g); g.connect(a.destination); s.start();
    }
    // a looping rush of water for the slide; it keeps running silently once started
    var wSrc = null, wFil = null, wGain = null;
    function water(lv) {
      if (!wGain && (!on || lv <= 0)) return;
      var a = ac(); if (!a) return;
      if (!wSrc) {
        var n = a.sampleRate * 2, buf = a.createBuffer(1, n, a.sampleRate), ch = buf.getChannelData(0), last = 0;
        for (var i = 0; i < n; i++) { last = last * 0.6 + (Math.random() * 2 - 1) * 0.4; ch[i] = last; }
        wSrc = a.createBufferSource(); wSrc.buffer = buf; wSrc.loop = true;
        wFil = a.createBiquadFilter(); wFil.type = 'bandpass'; wFil.Q.value = 0.9;
        wGain = a.createGain(); wGain.gain.value = 0;
        wSrc.connect(wFil); wFil.connect(wGain); wGain.connect(a.destination); wSrc.start();
      }
      var t = a.currentTime, v = on && lv > 0 ? 0.03 + lv * 0.07 : 0, icy = ENV && ENV.season === 'winter';
      if (icy) v *= 0.6;
      wFil.frequency.setTargetAtTime((icy ? 2600 + lv * 1800 : 600 + lv * 1300) + Math.random() * 250, t, 0.04);
      wGain.gain.setTargetAtTime(v, t, v ? 0.05 : 0.12);
    }
    return {
      // footsteps sound like what's underfoot: soft roof tap, sharper stair tick, hollow wooden bridge knock
      step: function (kind) {
        if (kind === 'stairs') { tone(250 + Math.random() * 60, 0.04, 'triangle', 0.04); noise(0.03, 0.025, 2600); }
        else if (kind === 'bridge') { tone(105 + Math.random() * 25, 0.09, 'sine', 0.06, 0.8); noise(0.05, 0.03, 650); }
        else if (kind === 'snow') { noise(0.07, 0.045, 1700 + Math.random() * 500); tone(90, 0.05, 'triangle', 0.02); }
        else if (kind === 'leaf') { noise(0.09, 0.03, 3200 + Math.random() * 800); tone(150 + Math.random() * 50, 0.045, 'triangle', 0.03); }
        else tone(150 + Math.random() * 50, 0.045, 'triangle', 0.035);
      },
      water: water,
      // flung off the lip: a watery plop and a spray
      splash: function () { if (ENV && ENV.season === 'winter') { noise(0.3, 0.08, 1900); tone(120, 0.12, 'triangle', 0.05, 0.6); return; } tone(240, 0.14, 'sine', 0.08, 3); noise(0.45, 0.08, 1100); },
      open: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.08, 'square', 0.03, 0, i * 0.055); }); },
      close: function () { tone(520, 0.1, 'square', 0.03, 0.5); },
      click: function () { tone(700, 0.035, 'square', 0.025); },
      boing: function () { tone(180, 0.38, 'sine', 0.09, 3.2); },
      land: function () { tone(110, 0.12, 'triangle', 0.08, 0.5); noise(0.08, 0.05, 500); },
      zip: function () { noise(0.5, 0.05, 2400); },
      rewind: function () { for (var i = 0; i < 6; i++) tone(1400 - i * 120, 0.07, 'square', 0.02, 0.5, i * 0.06); noise(0.9, 0.03, 3200); },
      grab: function () { tone(330, 0.07, 'square', 0.03, 1.5); },
      thud: function () { tone(70, 0.3, 'sine', 0.14, 0.5); noise(0.2, 0.09, 300); },
      squeak: function () { tone(880 + Math.random() * 300, 0.12, 'sine', 0.06, 1.7); },
      pop: function () { tone(260, 0.06, 'square', 0.04, 2.5); },
      tone: tone,
      get on() { return on; },
      set: function (v) { on = v; if (!v) water(0); try { localStorage.setItem('city-sound', v ? '1' : '0'); } catch (e) {} if (v) ac(); }
    };
  })();

  /* ================= HERO ================= */
  var hero = (function () {
    var root = el('g', { class: 'hero', 'pointer-events': 'none' }, L.actors);
    var shadow = el('ellipse', { rx: 12, ry: 4.5, fill: 'rgba(22,22,29,.2)' }, L.actors);
    L.actors.insertBefore(shadow, root);
    var body = el('g', null, root);
    // data-c names a recolourable part: lookify() turns it into var(--h-<part>) so the closet can repaint it
    function hose(col, w, k) {
      return { o: el('path', { fill: 'none', stroke: C.ink, 'stroke-width': w + 2.6, 'stroke-linecap': 'round' }, body), f: el('path', { fill: 'none', stroke: col, 'stroke-width': w, 'stroke-linecap': 'round', 'data-c': k }, body) };
    }
    var legL = hose(C.navy, 5.5, 'pants'), legR = hose(C.navy, 5.5, 'pants');
    var cuffL = el('path', { stroke: C.cuff, 'stroke-width': 5.5, fill: 'none', 'data-c': 'cuff' }, body), cuffR = el('path', { stroke: C.cuff, 'stroke-width': 5.5, fill: 'none', 'data-c': 'cuff' }, body);
    function shoe() {
      var g = el('g', null, body);
      el('path', { d: 'M-4,0 Q-4,-5 1,-5 Q6,-5 7,-1 L7,0 Z', fill: C.navy, 'data-c': 'shoe', stroke: C.ink, 'stroke-width': 1.4, 'stroke-linejoin': 'round' }, g);
      el('path', { d: 'M-4,0.2 H7', stroke: '#fff', 'stroke-width': 1.6 }, g);
      return g;
    }
    var shoeL = shoe(), shoeR = shoe();
    var armBack = hose(C.skin, 3.4, 'skin');
    armBack.o.setAttribute('data-part', 'armb'); armBack.f.setAttribute('data-part', 'armb');
    var torso = el('g', { 'data-part': 'torso' }, body);
    el('path', { d: 'M-7.5,-29 Q-7.5,-30.5 -5.5,-30.5 H5.5 Q7.5,-30.5 7.5,-29 V-15 H-7.5 Z', fill: '#fff', 'data-c': 'shirt', stroke: C.ink, 'stroke-width': 1.4, 'stroke-linejoin': 'round' }, torso);
    el('rect', { x: -7.5, y: -17, width: 15, height: 4, fill: C.navy, 'data-c': 'pants', stroke: C.ink, 'stroke-width': 1.4 }, torso);
    el('circle', { cx: -7.5, cy: -27.5, r: 3.3, fill: C.sleeve, 'data-c': 'sleeve', stroke: C.ink, 'stroke-width': 1.3 }, torso);
    el('circle', { cx: 7.5, cy: -27.5, r: 3.3, fill: C.sleeve, 'data-c': 'sleeve', stroke: C.ink, 'stroke-width': 1.3 }, torso);
    var armFront = hose(C.skin, 3.4, 'skin');
    var handB = el('circle', { r: 2.7, 'data-part': 'armb', fill: C.skin, 'data-c': 'skin', stroke: C.ink, 'stroke-width': 1.3 }, body);
    var handF = el('circle', { r: 2.7, fill: C.skin, 'data-c': 'skin', stroke: C.ink, 'stroke-width': 1.3 }, body);
    body.insertBefore(handB, torso);
    // pals: the pillow animal and the rocket animal. data-pt / data-mt pick the species (CSS), data-c paints it
    function palTag(pre) { return pre === 'pet' ? 'data-pt' : 'data-mt'; }
    function palEars(g, x, y, r, side, pre) {
      var tg = palTag(pre), sw = r > 7 ? 1.4 : 1.1;
      function E(tag, a, t) { a[tg] = t; return el(tag, a, g); }
      function pts(l) { return 'M' + l.map(function (p) { return p[0].toFixed(2) + ',' + p[1].toFixed(2); }).join(' L') + ' Z'; }
      (side ? [[-0.42, -1.02], [0.37, -0.95]] : [[-0.72, -0.72], [0.72, -0.72]]).forEach(function (p) {
        var ex = x + p[0] * r, ey = y + p[1] * r, k = p[0] < 0 ? -1 : 1;
        E('circle', { cx: ex, cy: ey, r: 0.36 * r, fill: C.brown, 'data-c': pre + 'ear', stroke: C.ink, 'stroke-width': sw }, 'bear panda');
        E('circle', { cx: ex, cy: ey, r: 0.16 * r, fill: '#5e2f1f', 'data-c': pre + 'in' }, 'bear panda');
        var tri = [[ex - 0.36 * r, ey + 0.3 * r], [ex + 0.36 * r, ey + 0.3 * r], [ex + k * 0.14 * r, ey - 0.62 * r]];
        var cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3, cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
        E('path', { d: pts(tri), fill: C.brown, 'data-c': pre, stroke: C.ink, 'stroke-width': sw, 'stroke-linejoin': 'round' }, 'cat');
        E('path', { d: pts(tri.map(function (q) { return [cx + (q[0] - cx) * 0.48, cy + (q[1] - cy) * 0.48 + 0.06 * r]; })), fill: '#ff9fb0', 'data-c': pre + 'in' }, 'cat');
        var bx = x + p[0] * 0.62 * r, by = y + p[1] * r - 0.5 * r, rot = 'rotate(' + (k * 12) + ',' + bx.toFixed(2) + ',' + by.toFixed(2) + ')';
        E('ellipse', { cx: bx, cy: by, rx: 0.25 * r, ry: 0.64 * r, transform: rot, fill: C.brown, 'data-c': pre, stroke: C.ink, 'stroke-width': sw }, 'bunny');
        E('ellipse', { cx: bx, cy: by + 0.08 * r, rx: 0.11 * r, ry: 0.42 * r, transform: rot, fill: '#ff9fb0', 'data-c': pre + 'in' }, 'bunny');
      });
    }
    function palFace(g, x, y, r, side, pre, head) {
      var tg = palTag(pre), sw = r > 7 ? 1.4 : 1.1;
      function E(tag, a, t, p) { if (t) a[tg] = t; return el(tag, a, p || g); }
      function R(v) { return (v * r).toFixed(2); }
      if (head) el('circle', { cx: x, cy: y, r: r, fill: C.brown, 'data-c': pre, stroke: C.ink, 'stroke-width': sw * 1.2 }, g);
      // a frog's eyes sit on top of its head
      (side ? [[-0.08, -0.86], [0.42, -0.78]] : [[-0.45, -0.72], [0.45, -0.72]]).forEach(function (p) {
        var fx = x + p[0] * r, fy = y + p[1] * r;
        E('circle', { cx: fx, cy: fy, r: R(0.34), fill: C.brown, 'data-c': pre, stroke: C.ink, 'stroke-width': sw }, 'frog');
        E('circle', { cx: fx, cy: fy, r: R(0.22), fill: '#fff' }, 'frog');
        E('circle', { cx: fx + (side ? 0.07 * r : 0), cy: fy + 0.02 * r, r: R(0.11), fill: C.ink }, 'frog');
      });
      var eg = el('g', null, g), mz = { fill: '#fff7ee', 'data-c': pre + 'mz', stroke: C.ink, 'stroke-width': sw * 0.6 };
      var ln = { fill: 'none', stroke: C.ink, 'stroke-width': sw * 0.6, 'stroke-linecap': 'round' };
      function o(a, b) { var k, c = {}; for (k in b) c[k] = b[k]; for (k in a) c[k] = a[k]; return c; }
      if (!side) {
        [-1, 1].forEach(function (k) {
          var ex = x + k * 0.35 * r, ey = y - 0.08 * r;
          E('ellipse', { cx: ex, cy: ey, rx: R(0.2), ry: R(0.27), fill: C.ink, transform: 'rotate(' + (k * 25) + ',' + ex.toFixed(2) + ',' + ey.toFixed(2) + ')' }, 'panda');
          E('circle', { cx: ex, cy: ey - 0.02 * r, r: R(0.1), fill: C.ink }, 'bear cat bunny', eg);
          E('circle', { cx: ex, cy: ey - 0.03 * r, r: R(0.075), fill: '#fff' }, 'panda', eg);
          el('circle', { cx: x + k * 0.6 * r, cy: y + 0.3 * r, r: R(0.14), fill: '#ff8f8f', opacity: 0.6 }, g);
          E('path', o({ d: 'M' + (x + k * 0.45 * r).toFixed(2) + ',' + (y + 0.3 * r).toFixed(2) + ' L' + (x + k * 0.9 * r).toFixed(2) + ',' + (y + 0.2 * r).toFixed(2) + ' M' + (x + k * 0.45 * r).toFixed(2) + ',' + (y + 0.4 * r).toFixed(2) + ' L' + (x + k * 0.88 * r).toFixed(2) + ',' + (y + 0.48 * r).toFixed(2) }, ln), 'cat');
        });
        E('ellipse', o({ cx: x, cy: y + 0.33 * r, rx: R(0.36), ry: R(0.27) }, mz), 'bear cat bunny panda');
        E('ellipse', { cx: x, cy: y + 0.24 * r, rx: R(0.13), ry: R(0.09), fill: C.ink }, 'bear panda');
        E('path', { d: 'M' + (x - 0.12 * r).toFixed(2) + ',' + (y + 0.2 * r).toFixed(2) + ' H' + (x + 0.12 * r).toFixed(2) + ' L' + x + ',' + (y + 0.31 * r).toFixed(2) + ' Z', fill: '#ff7e9e', stroke: C.ink, 'stroke-width': sw * 0.4, 'stroke-linejoin': 'round' }, 'cat bunny');
        E('path', o({ d: 'M' + (x - 0.13 * r).toFixed(2) + ',' + (y + 0.43 * r).toFixed(2) + ' Q' + x + ',' + (y + 0.52 * r).toFixed(2) + ' ' + (x + 0.13 * r).toFixed(2) + ',' + (y + 0.43 * r).toFixed(2) }, ln), 'bear cat bunny panda');
        E('path', o({ d: 'M' + (x - 0.5 * r).toFixed(2) + ',' + (y + 0.12 * r).toFixed(2) + ' Q' + x + ',' + (y + 0.62 * r).toFixed(2) + ' ' + (x + 0.5 * r).toFixed(2) + ',' + (y + 0.12 * r).toFixed(2), 'stroke-width': sw * 0.8 }, ln), 'frog');
      } else {
        var ex = x + 0.18 * r, ey = y - 0.2 * r;
        E('ellipse', { cx: ex, cy: ey, rx: R(0.18), ry: R(0.26), fill: C.ink, transform: 'rotate(-20,' + ex.toFixed(2) + ',' + ey.toFixed(2) + ')' }, 'panda');
        E('ellipse', { cx: ex, cy: ey, rx: R(0.1), ry: R(0.13), fill: C.ink }, 'bear cat bunny', eg);
        E('circle', { cx: ex, cy: ey - 0.02 * r, r: R(0.07), fill: '#fff' }, 'panda', eg);
        el('circle', { cx: x - 0.35 * r, cy: y + 0.32 * r, r: R(0.16), fill: '#ff8f8f', opacity: 0.6 }, g);
        E('ellipse', o({ cx: x + 0.62 * r, cy: y + 0.3 * r, rx: R(0.42), ry: R(0.33) }, mz), 'bear cat bunny panda');
        E('ellipse', { cx: x + 0.9 * r, cy: y + 0.16 * r, rx: R(0.15), ry: R(0.1), fill: C.ink }, 'bear panda');
        E('ellipse', { cx: x + 0.92 * r, cy: y + 0.16 * r, rx: R(0.11), ry: R(0.09), fill: '#ff7e9e', stroke: C.ink, 'stroke-width': sw * 0.4 }, 'cat bunny');
        E('path', o({ d: 'M' + (x + 0.56 * r).toFixed(2) + ',' + (y + 0.47 * r).toFixed(2) + ' q' + R(0.15) + ',' + R(0.12) + ' ' + R(0.3) + ',0' }, ln), 'bear cat bunny panda');
        E('path', o({ d: 'M' + (x + 0.8 * r).toFixed(2) + ',' + (y + 0.34 * r).toFixed(2) + ' l' + R(0.45) + ',' + R(-0.08) + ' M' + (x + 0.8 * r).toFixed(2) + ',' + (y + 0.42 * r).toFixed(2) + ' l' + R(0.42) + ',' + R(0.1) }, ln), 'cat');
        E('path', o({ d: 'M' + (x + 0.05 * r).toFixed(2) + ',' + (y + 0.28 * r).toFixed(2) + ' Q' + (x + 0.6 * r).toFixed(2) + ',' + (y + 0.62 * r).toFixed(2) + ' ' + (x + 0.98 * r).toFixed(2) + ',' + (y + 0.1 * r).toFixed(2), 'stroke-width': sw * 0.8 }, ln), 'frog');
      }
      return eg;
    }
    // neck pillow: a chunky U with the pal's face on the left lobe (like the original)
    var pillow = el('g', { 'data-part': 'pillow' }, body);
    var PU = 'M-5,-24.5 C-14,-25 -14.5,-35 0,-35 C14.5,-35 14,-25 5,-24.5';
    var pFront = el('g', { 'data-v': 'front' }, pillow);
    el('path', { d: PU, fill: 'none', stroke: C.ink, 'stroke-width': 10.6, 'stroke-linecap': 'round' }, pFront);
    el('path', { d: PU, fill: 'none', stroke: C.brown, 'data-c': 'pet', 'stroke-width': 8, 'stroke-linecap': 'round' }, pFront);
    var bear = el('g', null, pFront);
    palEars(el('g', { transform: 'rotate(-28,-11.6,-30)' }, bear), -11.6, -30, 4.4, false, 'pet');
    el('path', { d: 'M-5,-24.5 C-14,-25 -14.5,-35 0,-35', fill: 'none', stroke: C.brown, 'data-c': 'pet', 'stroke-width': 8, 'stroke-linecap': 'round' }, bear);
    palFace(el('g', { transform: 'rotate(-18,-11,-29.4)' }, bear), -11, -29.4, 4.4, false, 'pet', false);
    var pBack = el('g', { display: 'none', 'data-v': 'back' }, pillow);
    var PB = 'M-12.5,-23 C-12.5,-33.5 12.5,-33.5 12.5,-23';
    el('path', { d: PB, fill: 'none', stroke: C.ink, 'stroke-width': 10.6, 'stroke-linecap': 'round' }, pBack);
    el('path', { d: PB, fill: 'none', stroke: C.brown, 'data-c': 'pet', 'stroke-width': 8, 'stroke-linecap': 'round' }, pBack);
    el('circle', { cx: 14.6, cy: -26, r: 2.6, 'data-part': 'knob', fill: C.brown, 'data-c': 'pet', stroke: C.ink, 'stroke-width': 1.2 }, pBack);
    // side view (closet turntable only): the ring seen edge-on, the pal riding on the front shoulder
    var pSide = el('g', { display: 'none', 'data-v': 'side' }, pillow);
    el('path', { d: 'M-7.5,-29.5 Q0,-23.5 6,-26.5', fill: 'none', stroke: C.ink, 'stroke-width': 10.6, 'stroke-linecap': 'round' }, pSide);
    el('path', { d: 'M-7.5,-29.5 Q0,-23.5 6,-26.5', fill: 'none', stroke: C.brown, 'data-c': 'pet', 'stroke-width': 8, 'stroke-linecap': 'round' }, pSide);
    palEars(pSide, 6.5, -28, 4.6, true, 'pet');
    palFace(pSide, 6.5, -28, 4.6, true, 'pet', true);
    // curly hair as one tidy scalloped cap, so every angle reads cleanly
    function curls(cx, cy, rx, ry, a0, a1, n) {
      var d = '', r;
      for (var i = 0; i <= n; i++) {
        var a = a0 + (a1 - a0) * i / n, x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
        if (!i) { d = 'M' + x.toFixed(2) + ',' + y.toFixed(2); continue; }
        var pa = a0 + (a1 - a0) * (i - 1) / n;
        r = Math.hypot(x - (cx + Math.cos(pa) * rx), y - (cy + Math.sin(pa) * ry)) * 0.56;
        d += ' A' + r.toFixed(2) + ',' + r.toFixed(2) + ' 0 0 1 ' + x.toFixed(2) + ',' + y.toFixed(2);
      }
      return d;
    }
    // head (front). data-hs / data-ey / data-ac pick hair style, eyes and accessory (see the CSS in index.html);
    // data-az + data-r place a feature on the round head so the closet preview can turn it
    var head = el('g', null, body);
    var face = el('g', { 'data-v': 'front' }, head);
    var HAIR_TOP = 'M-12.6,4 C-14.6,-8 -9,-14.8 0,-14.8 C9,-14.8 14.6,-8 12.6,4 Z';
    el('path', { d: 'M-13.4,-2 C-14.6,-16 14.6,-16 13.4,-2 L14,14 Q8,16.4 6.4,11.6 L-6.4,11.6 Q-8,16.4 -14,14 Z', fill: C.navy, 'data-c': 'hair', 'data-hs': 'long', 'data-sh': -2.4, stroke: C.ink, 'stroke-width': 1.4, 'stroke-linejoin': 'round' }, face);
    el('circle', { cx: 0, cy: -15.4, r: 4.8, fill: C.navy, 'data-c': 'hair', 'data-hs': 'bun', 'data-sh': -3, stroke: C.ink, 'stroke-width': 1.4 }, face);
    el('path', { d: curls(0, -1.8, 13.2, 13, Math.PI * 0.86, Math.PI * 2.14, 10) + ' Z', fill: C.navy, 'data-c': 'hair', 'data-hs': 'curly', 'data-sh': -2.4, stroke: C.ink, 'stroke-width': 1.4, 'stroke-linejoin': 'round' }, face);
    el('path', { d: HAIR_TOP, fill: C.navy, 'data-c': 'hair', 'data-hs': 'straight long bun', 'data-sh': -2.4, stroke: C.ink, 'stroke-width': 1.4, 'stroke-linejoin': 'round' }, face);
    el('circle', { cx: -10, cy: 2, r: 2.6, fill: C.skin, 'data-c': 'skin', 'data-az': -90, 'data-r': 10, stroke: C.ink, 'stroke-width': 1.2 }, face);
    el('circle', { cx: 10, cy: 2, r: 2.6, fill: C.skin, 'data-c': 'skin', 'data-az': 90, 'data-r': 10, stroke: C.ink, 'stroke-width': 1.2 }, face);
    el('ellipse', { cx: 0, cy: 1.5, rx: 9.6, ry: 9.8, fill: C.skin, 'data-c': 'skin', 'data-sh': 2.4, stroke: C.ink, 'stroke-width': 1.4 }, face);
    el('path', { d: 'M-9.8,0 Q-9,-6.5 -3.5,-7.2 Q-1,-4.5 2.5,-6.8 Q5,-4 7.5,-6.2 Q10.2,-4 9.8,0 Q10.5,-9.5 0,-10.6 Q-10.5,-9.5 -9.8,0 Z', fill: C.navy, 'data-c': 'hair', 'data-hs': 'curly', 'data-az': 0, 'data-r': 4 }, face);
    el('path', { d: 'M-9.9,1 Q-10.6,-9.8 0,-10.6 Q10.4,-10.2 9.9,-0.5 Q7.5,-6.4 0.5,-6.6 Q-6,-6.4 -9.9,1 Z', fill: C.navy, 'data-c': 'hair', 'data-hs': 'straight long bun', 'data-az': 0, 'data-r': 4 }, face);
    el('path', { d: 'M-6,-11.6 Q-2,-13.4 3,-12.6', fill: 'none', stroke: 'rgba(255,255,255,.35)', 'stroke-width': 1.4, 'stroke-linecap': 'round', 'data-hs': 'straight long bun' }, face);
    el('path', { d: 'M-3,-15.6 q1.6,-2.6 3.4,-0.6', fill: 'none', stroke: C.ink, 'stroke-width': 1.4, 'stroke-linecap': 'round', 'data-hs': 'curly' }, face);
    var eyes = el('g', null, face);
    el('ellipse', { cx: -3.8, cy: 1, rx: 1.3, ry: 1.9, fill: C.ink, 'data-ey': 'dot freckle', 'data-az': -22, 'data-r': 10 }, eyes);
    el('ellipse', { cx: 3.8, cy: 1, rx: 1.3, ry: 1.9, fill: C.ink, 'data-ey': 'dot freckle', 'data-az': 22, 'data-r': 10 }, eyes);
    [-1, 1].forEach(function (k) {
      var se = el('g', { 'data-ey': 'sparkle', 'data-az': 22 * k, 'data-r': 10 }, eyes);
      el('ellipse', { cx: 3.9 * k, cy: 1, rx: 1.9, ry: 2.5, fill: C.ink }, se);
      el('circle', { cx: 3.9 * k + 0.6, cy: 0, r: 0.8, fill: '#fff' }, se);
      el('circle', { cx: 3.9 * k - 0.6, cy: 2.1, r: 0.4, fill: '#fff' }, se);
      el('path', { d: 'M' + (5.6 * k) + ',2 Q' + (3.8 * k) + ',-1.6 ' + (2 * k) + ',2', fill: 'none', stroke: C.ink, 'stroke-width': 1.5, 'stroke-linecap': 'round', 'data-ey': 'happy', 'data-az': 22 * k, 'data-r': 10 }, eyes);
    });
    el('path', { d: 'M-6,-2.4 L-2,-3.1 M2,-3.1 L6,-2.4', stroke: C.ink, 'stroke-width': 1.4, 'stroke-linecap': 'round', 'data-az': 0, 'data-r': 9 }, face);
    el('circle', { cx: -6.6, cy: 5, r: 1.9, fill: '#ff8f8f', opacity: 0.75, 'data-az': -42, 'data-r': 10 }, face);
    el('circle', { cx: 6.6, cy: 5, r: 1.9, fill: '#ff8f8f', opacity: 0.75, 'data-az': 42, 'data-r': 10 }, face);
    [-1, 1].forEach(function (k) {
      var fr = el('g', { 'data-ey': 'freckle', fill: '#b5654a', 'data-az': 40 * k, 'data-r': 10 }, face);
      el('circle', { cx: 5.6 * k, cy: 3.6, r: 0.5 }, fr); el('circle', { cx: 7.2 * k, cy: 3.3, r: 0.5 }, fr); el('circle', { cx: 6.4 * k, cy: 4.6, r: 0.5 }, fr);
    });
    el('circle', { cx: 0, cy: 3.4, r: 1.1, fill: '#e98a7a', 'data-az': 0, 'data-r': 10 }, face);
    var mouth = el('path', { d: 'M-3,5.6 Q0,10.5 3,5.6 Z', fill: C.red, stroke: C.ink, 'stroke-width': 1.1, 'stroke-linejoin': 'round', 'data-az': 0, 'data-r': 9 }, face);
    // accessories, front
    var acc = el('g', { 'data-ac': 'glasses', 'data-az': 0, 'data-r': 10 }, face);
    [-1, 1].forEach(function (k) { el('circle', { cx: 3.9 * k, cy: 1, r: 3.3, fill: 'rgba(255,255,255,.3)', stroke: C.ink, 'stroke-width': 1.3 }, acc); });
    el('path', { d: 'M-0.6,0.6 Q0,-0.2 0.6,0.6 M-7.2,0.4 L-9.5,-0.4 M7.2,0.4 L9.5,-0.4', fill: 'none', stroke: C.ink, 'stroke-width': 1.2, 'stroke-linecap': 'round' }, acc);
    acc = el('g', { 'data-ac': 'shades', 'data-az': 0, 'data-r': 10 }, face);
    el('path', { d: 'M-7.6,-1.4 H-0.8 V1.6 Q-0.8,4 -3.6,4 H-4.8 Q-7.6,4 -7.6,1.6 Z M7.6,-1.4 H0.8 V1.6 Q0.8,4 3.6,4 H4.8 Q7.6,4 7.6,1.6 Z', fill: C.ink, stroke: C.ink, 'stroke-width': 1, 'stroke-linejoin': 'round' }, acc);
    el('path', { d: 'M-0.8,-0.8 H0.8 M-7.6,-0.8 L-9.6,-1.4 M7.6,-0.8 L9.6,-1.4', fill: 'none', stroke: C.ink, 'stroke-width': 1.3 }, acc);
    el('path', { d: 'M-6.4,-0.2 L-4.6,-0.2 M2,-0.2 L3.8,-0.2', stroke: '#8fd3ff', 'stroke-width': 1.1, 'stroke-linecap': 'round' }, acc);
    acc = el('g', { 'data-ac': 'cap' }, face);
    el('path', { d: 'M-13.3,-3.6 C-13.8,-20 13.8,-20 13.3,-3.6 Z', fill: C.orange, stroke: C.ink, 'stroke-width': 1.4, 'stroke-linejoin': 'round' }, acc);
    el('path', { d: 'M-4.5,-14.6 Q-6,-9 -6.6,-3.8 M4.5,-14.6 Q6,-9 6.6,-3.8', fill: 'none', stroke: shade(C.orange, -0.3), 'stroke-width': 1 }, acc);
    el('circle', { cx: 0, cy: -15.6, r: 1.4, fill: C.yellow, stroke: C.ink, 'stroke-width': 1 }, acc);
    el('path', { d: 'M-12,-3.2 Q0,0.6 12,-3.2 Q13,-5.6 11.4,-6 Q0,-2.8 -11.4,-6 Q-13,-5.6 -12,-3.2 Z', fill: shade(C.orange, -0.18), stroke: C.ink, 'stroke-width': 1.3, 'stroke-linejoin': 'round', 'data-az': 0, 'data-r': 3 }, acc);
    function phones(g, back) {
      var a = el('g', { 'data-ac': 'phones' }, g);
      el('path', { d: 'M-12.6,1 C-14.4,-19.4 14.4,-19.4 12.6,1', fill: 'none', stroke: C.ink, 'stroke-width': 4.8 }, a);
      el('path', { d: 'M-12.6,1 C-14.4,-19.4 14.4,-19.4 12.6,1', fill: 'none', stroke: C.pink, 'stroke-width': 2.4 }, a);
      [-1, 1].forEach(function (k) { el('rect', { x: k < 0 ? -16.4 : 10.6, y: -3, width: 5.8, height: 10, rx: 2.6, fill: C.pink, stroke: C.ink, 'stroke-width': 1.4, 'data-az': 90 * k, 'data-r': 13.5 }, a); });
    }
    phones(face);
    function flower(g, x) {
      var a = el('g', { 'data-ac': 'flower', transform: 'translate(' + x + ',-9.6)', 'data-az': x > 0 ? 52 : -52, 'data-r': 11 }, g);
      for (var i = 0; i < 5; i++) el('circle', { cx: (Math.cos(i * 1.2566) * 2.3).toFixed(2), cy: (Math.sin(i * 1.2566) * 2.3).toFixed(2), r: 1.9, fill: '#fff', stroke: C.ink, 'stroke-width': 1 }, a);
      el('circle', { r: 1.5, fill: C.yellow, stroke: C.ink, 'stroke-width': 0.9 }, a);
    }
    flower(face, 8.8);
    // head (back)
    var back = el('g', { display: 'none', 'data-v': 'back' }, head);
    el('path', { d: 'M-13.4,-2 C-14.6,-16 14.6,-16 13.4,-2 L14,14 Q0,17.4 -14,14 Z', fill: C.navy, 'data-c': 'hair', 'data-hs': 'long', stroke: C.ink, 'stroke-width': 1.4, 'stroke-linejoin': 'round' }, back);
    el('circle', { cx: -10.3, cy: 2.5, r: 2.6, fill: C.skin, 'data-c': 'skin', 'data-az': -90, 'data-r': 10.3, stroke: C.ink, 'stroke-width': 1.2 }, back);
    el('circle', { cx: 10.3, cy: 2.5, r: 2.6, fill: C.skin, 'data-c': 'skin', 'data-az': 90, 'data-r': 10.3, stroke: C.ink, 'stroke-width': 1.2 }, back);
    el('path', { d: curls(0, -0.6, 12.8, 13, 0, Math.PI * 2, 13) + ' Z', fill: C.navy, 'data-c': 'hair', 'data-hs': 'curly', stroke: C.ink, 'stroke-width': 1.4, 'stroke-linejoin': 'round' }, back);
    el('path', { d: 'M-5,-3 q2,-2.5 4,0 M1.5,-5 q2,-2.5 4,0 M-3,4 q2,-2.5 4,0 M3.5,3 q1.6,-2 3.2,0', stroke: '#45507a', 'data-c': 'hairhi', 'data-hs': 'curly', 'data-az': 0, 'data-r': 6, 'stroke-width': 1.3, fill: 'none', 'stroke-linecap': 'round' }, back);
    el('path', { d: 'M-12.8,5 C-14.6,-9 -9,-14.8 0,-14.8 C9,-14.8 14.6,-9 12.8,5 Q0,9.6 -12.8,5 Z', fill: C.navy, 'data-c': 'hair', 'data-hs': 'straight long bun', stroke: C.ink, 'stroke-width': 1.4, 'stroke-linejoin': 'round' }, back);
    el('path', { d: 'M-6,-9 Q-4,-1 -5,6 M0,-12 V7 M6,-9 Q4,-1 5,6', stroke: '#45507a', 'data-c': 'hairhi', 'data-hs': 'straight long bun', 'data-az': 0, 'data-r': 6, 'stroke-width': 1.2, fill: 'none', 'stroke-linecap': 'round' }, back);
    el('circle', { cx: 0, cy: -15.4, r: 4.8, fill: C.navy, 'data-c': 'hair', 'data-hs': 'bun', stroke: C.ink, 'stroke-width': 1.4 }, back);
    acc = el('g', { 'data-ac': 'cap' }, back);
    el('path', { d: 'M-13.3,0 C-13.8,-20 13.8,-20 13.3,0 Z', fill: C.orange, stroke: C.ink, 'stroke-width': 1.4, 'stroke-linejoin': 'round' }, acc);
    el('path', { d: 'M-3.4,0.2 Q0,-3.4 3.4,0.2', fill: C.skin, 'data-c': 'skin', stroke: C.ink, 'stroke-width': 1.1, 'data-az': 0, 'data-r': 8 }, acc);
    el('circle', { cx: 0, cy: -15.6, r: 1.4, fill: C.yellow, stroke: C.ink, 'stroke-width': 1 }, acc);
    phones(back);
    flower(back, -8.8);
    // three-quarter back (closet only): the near ear peeks past the hair
    el('circle', { cx: 11.8, cy: 3, r: 2.6, fill: C.skin, 'data-c': 'skin', stroke: C.ink, 'stroke-width': 1.2, 'data-q3': 1, display: 'none' }, back);

    // head (side, facing right): closet turntable only. Full hair dome, the face on its front half, one ear mid-head
    var sideH = el('g', { display: 'none', 'data-v': 'side' }, head);
    el('path', { d: 'M-13.4,0 C-14.6,-16 13,-16.5 12.6,-4 L-1,6 L0,14 Q-8,16.4 -14,14 Z', fill: C.navy, 'data-c': 'hair', transform: 'translate(-2.4,0)', 'data-hs': 'long', stroke: C.ink, 'stroke-width': 1.4, 'stroke-linejoin': 'round' }, sideH);
    el('circle', { cx: -4, cy: -15, r: 4.8, fill: C.navy, 'data-c': 'hair', transform: 'translate(-2.4,0)', 'data-hs': 'bun', stroke: C.ink, 'stroke-width': 1.4 }, sideH);
    el('path', { d: curls(0, -0.6, 12.8, 13, 0, Math.PI * 2, 13) + ' Z', fill: C.navy, 'data-c': 'hair', transform: 'translate(-2.4,0)', 'data-hs': 'curly', stroke: C.ink, 'stroke-width': 1.4, 'stroke-linejoin': 'round' }, sideH);
    el('path', { d: 'M-12.8,5 C-14.6,-9 -9,-14.8 0,-14.8 C9,-14.8 14.6,-9 12.8,5 Q0,9.6 -12.8,5 Z', fill: C.navy, 'data-c': 'hair', transform: 'translate(-2.4,0)', 'data-hs': 'straight long bun', stroke: C.ink, 'stroke-width': 1.4, 'stroke-linejoin': 'round' }, sideH);
    el('path', { d: 'M12.2,0.6 Q14.8,2.8 12.2,4.8', fill: C.skin, 'data-c': 'skin', stroke: C.ink, 'stroke-width': 1.3 }, sideH);
    el('ellipse', { cx: 4, cy: 1.8, rx: 8.6, ry: 9.6, fill: C.skin, 'data-c': 'skin', stroke: C.ink, 'stroke-width': 1.4 }, sideH);
    el('path', { d: 'M11.8,1 Q13.4,2.8 11.8,4.4', fill: C.skin, 'data-c': 'skin' }, sideH);
    // hairline: high at the front, sweeping down behind the ear
    el('path', { d: 'M-5.4,5.5 Q-6.4,-9.6 3.6,-10.6 Q12.2,-10.4 12.6,-3 Q11,-5.8 9,-4.6 Q8,-7 5.4,-5.6 Q3.4,-7.6 1,-5.2 Q-1.6,-4 -1.6,-1 Q-2.6,1 -2.2,5.5 Z', fill: C.navy, 'data-c': 'hair', 'data-hs': 'curly', stroke: C.ink, 'stroke-width': 1.2, 'stroke-linejoin': 'round' }, sideH);
    el('path', { d: 'M-5.4,5.5 Q-6.4,-9.6 3.6,-10.6 Q12.2,-10.4 12.6,-3 Q9.6,-6 5,-6.2 Q0.6,-6 -1.2,-2.6 Q-2.4,1 -2.2,5.5 Z', fill: C.navy, 'data-c': 'hair', 'data-hs': 'straight long bun', stroke: C.ink, 'stroke-width': 1.2, 'stroke-linejoin': 'round' }, sideH);
    el('path', { d: 'M1,-9.4 Q5,-10.4 8.4,-9', fill: 'none', stroke: 'rgba(255,255,255,.35)', 'stroke-width': 1.3, 'stroke-linecap': 'round', 'data-hs': 'straight long bun' }, sideH);
    el('circle', { cx: -0.8, cy: 2.8, r: 2.6, fill: C.skin, 'data-c': 'skin', stroke: C.ink, 'stroke-width': 1.2 }, sideH);
    el('path', { d: 'M-1.4,1.6 q1.3,1.2 0,2.5', fill: 'none', stroke: '#c9876a', 'stroke-width': 0.9, 'stroke-linecap': 'round' }, sideH);
    el('ellipse', { cx: 7.6, cy: 1.2, rx: 1.1, ry: 1.8, fill: C.ink, 'data-ey': 'dot freckle' }, sideH);
    var sse = el('g', { 'data-ey': 'sparkle' }, sideH);
    el('ellipse', { cx: 7.6, cy: 1.2, rx: 1.5, ry: 2.3, fill: C.ink }, sse);
    el('circle', { cx: 8.1, cy: 0.3, r: 0.65, fill: '#fff' }, sse);
    el('path', { d: 'M6.2,2.1 Q7.6,-1.2 9,2.1', fill: 'none', stroke: C.ink, 'stroke-width': 1.5, 'stroke-linecap': 'round', 'data-ey': 'happy' }, sideH);
    el('path', { d: 'M6,-2.2 L9.4,-1.9', stroke: C.ink, 'stroke-width': 1.4, 'stroke-linecap': 'round' }, sideH);
    el('circle', { cx: 6.2, cy: 5.4, r: 1.8, fill: '#ff8f8f', opacity: 0.75 }, sideH);
    var sfr = el('g', { 'data-ey': 'freckle', fill: '#b5654a' }, sideH);
    el('circle', { cx: 5.4, cy: 3.8, r: 0.5 }, sfr); el('circle', { cx: 7, cy: 3.6, r: 0.5 }, sfr); el('circle', { cx: 6.2, cy: 4.6, r: 0.5 }, sfr);
    el('path', { d: 'M9.2,6 Q10.8,8.8 12.2,6.2 Z', fill: C.red, stroke: C.ink, 'stroke-width': 1.1, 'stroke-linejoin': 'round' }, sideH);
    el('path', { d: 'M5.2,1.2 a2.8,2.8 0 1 0 5.6,0 a2.8,2.8 0 1 0 -5.6,0 M5.2,0.6 L1.2,0', fill: 'rgba(255,255,255,.3)', stroke: C.ink, 'stroke-width': 1.2, 'data-ac': 'glasses' }, sideH);
    el('path', { d: 'M5.4,-0.8 H10.6 V1.4 Q10.6,3.4 8.4,3.4 H7.6 Q5.4,3.4 5.4,1.4 Z M5.4,-0.4 L1.2,-0.6', fill: C.ink, stroke: C.ink, 'stroke-width': 1.1, 'stroke-linejoin': 'round', 'data-ac': 'shades' }, sideH);
    el('path', { d: 'M6.6,0 L8,0', stroke: '#8fd3ff', 'stroke-width': 1, 'stroke-linecap': 'round', 'data-ac': 'shades' }, sideH);
    acc = el('g', { 'data-ac': 'cap' }, sideH);
    el('path', { d: 'M-13.3,-2.6 C-13.8,-20 13.8,-20 13.3,-3.6 Z', fill: C.orange, stroke: C.ink, 'stroke-width': 1.4, 'stroke-linejoin': 'round' }, acc);
    el('path', { d: 'M9,-4.6 Q15,-6.4 20,-3.6 Q15,-1.8 9,-2.4 Z', fill: shade(C.orange, -0.18), stroke: C.ink, 'stroke-width': 1.3, 'stroke-linejoin': 'round' }, acc);
    el('circle', { cx: 0, cy: -15.6, r: 1.4, fill: C.yellow, stroke: C.ink, 'stroke-width': 1 }, acc);
    acc = el('g', { 'data-ac': 'phones' }, sideH);
    el('path', { d: 'M-2,-1 C-3,-19 4,-19 3,-1', fill: 'none', stroke: C.ink, 'stroke-width': 4.8 }, acc);
    el('path', { d: 'M-2,-1 C-3,-19 4,-19 3,-1', fill: 'none', stroke: C.pink, 'stroke-width': 2.4 }, acc);
    el('rect', { x: -4.6, y: -2.6, width: 7.6, height: 10.6, rx: 3.4, fill: C.pink, stroke: C.ink, 'stroke-width': 1.4 }, acc);
    flower(sideH, -7);

    // ---- character 2: astronaut riding the bear rocket (side view, faces right) ----
    var ship = el('g', { display: 'none' }, root);
    var flame = el('path', { d: 'M-27,-21 Q-42,-15.5 -27,-10 Z', fill: C.orange, stroke: C.ink, 'stroke-width': 1.4, 'stroke-linejoin': 'round' }, ship);
    var flameIn = el('path', { d: 'M-27,-18.5 Q-35,-15.5 -27,-12.5 Z', fill: C.yellow }, ship);
    el('rect', { x: -28, y: -22, width: 10, height: 13, rx: 2.5, fill: '#d9dde8', stroke: C.ink, 'stroke-width': 1.6 }, ship);
    el('rect', { x: -24.5, y: -21.2, width: 2.4, height: 11.4, fill: C.red }, ship);
    el('path', { d: 'M-11,-9 L-17,-1.5 L-4,-5 Z', fill: C.red, stroke: C.ink, 'stroke-width': 1.5, 'stroke-linejoin': 'round' }, ship);
    el('rect', { x: -21, y: -25, width: 36, height: 17, rx: 8.5, fill: C.brown, 'data-c': 'mnt', stroke: C.ink, 'stroke-width': 1.7 }, ship);
    el('path', { d: 'M-15,-21.5 H7', stroke: '#c0714f', 'data-c': 'mnthi', 'stroke-width': 2.6, 'stroke-linecap': 'round' }, ship);
    // astronaut: backpack, leg astride, suit, helmet with the curly hair inside the visor
    el('rect', { x: -16, y: -37, width: 6, height: 12, rx: 2, fill: '#d9dde8', stroke: C.ink, 'stroke-width': 1.4 }, ship);
    el('path', { d: 'M-6,-24 Q2,-24 3,-18 L3,-12', fill: 'none', stroke: C.ink, 'stroke-width': 8, 'stroke-linecap': 'round' }, ship);
    el('path', { d: 'M-6,-24 Q2,-24 3,-18 L3,-12', fill: 'none', stroke: '#fff', 'data-c': 'shirt', 'stroke-width': 5.2, 'stroke-linecap': 'round' }, ship);
    el('rect', { x: 0, y: -12.5, width: 8, height: 5, rx: 2, fill: C.cuff, 'data-c': 'cuff', stroke: C.ink, 'stroke-width': 1.3 }, ship);
    el('rect', { x: -11.5, y: -37, width: 12, height: 15, rx: 4, fill: '#fff', 'data-c': 'shirt', stroke: C.ink, 'stroke-width': 1.5 }, ship);
    el('rect', { x: -8, y: -32.5, width: 5, height: 4, rx: 1, fill: C.sky, stroke: C.ink, 'stroke-width': 1 }, ship);
    el('path', { d: 'M-11.5,-26 H0.5', stroke: C.orange, 'stroke-width': 2 }, ship);
    var helm = el('g', null, ship);
    el('path', { d: 'M-9,-52 L-11,-57', stroke: C.ink, 'stroke-width': 1.6, 'stroke-linecap': 'round', 'data-hm': 'classic star' }, helm);
    el('circle', { cx: -11, cy: -57.5, r: 2, fill: C.yellow, stroke: C.ink, 'stroke-width': 1.2, 'data-hm': 'classic' }, helm);
    helmStar(helm, -11.2, -58.4);
    helmEars(helm, [[-11.6, -51.2, -30], [-2.2, -53, 12]]);
    helmShell(helm, -5, -43);
    el('ellipse', { cx: -0.5, cy: -42.5, rx: 6.8, ry: 6, fill: C.skin, 'data-c': 'skin', stroke: C.ink, 'stroke-width': 1.4 }, helm);
    el('path', { d: 'M-7,-44 Q-6.5,-49 -1,-48.6 Q4,-48.6 6,-45 Q3,-46.4 1,-44.6 Q-1.5,-46.6 -4,-44.4 Q-5.4,-45.8 -7,-44 Z', fill: C.navy, 'data-c': 'hair' }, helm);
    var shipEyes = el('g', null, helm);
    var shipEye = el('ellipse', { cx: 2.4, cy: -42, rx: 1.1, ry: 1.6, fill: C.ink, 'data-ey': 'dot freckle' }, shipEyes);
    el('ellipse', { cx: 2.5, cy: -42, rx: 1.5, ry: 2.1, fill: C.ink, 'data-ey': 'sparkle' }, shipEyes);
    el('circle', { cx: 2.9, cy: -42.8, r: 0.6, fill: '#fff', 'data-ey': 'sparkle' }, shipEyes);
    el('path', { d: 'M1,-41.4 Q2.4,-44 3.8,-41.4', fill: 'none', stroke: C.ink, 'stroke-width': 1.2, 'stroke-linecap': 'round', 'data-ey': 'happy' }, shipEyes);
    var frk = el('g', { 'data-ey': 'freckle', fill: '#b5654a' }, helm);
    el('circle', { cx: 5, cy: -40.2, r: 0.45 }, frk); el('circle', { cx: 3.9, cy: -40.6, r: 0.45 }, frk);
    el('path', { d: 'M-0.4,-42.4 a3,3 0 1 0 6,0 a3,3 0 1 0 -6,0 M-0.4,-42.6 L-4,-43.6', fill: 'rgba(255,255,255,.3)', stroke: C.ink, 'stroke-width': 1.1, 'data-ac': 'glasses' }, helm);
    el('path', { d: 'M0,-44 H5.6 V-41.6 Q5.6,-39.6 3.4,-39.6 H2.2 Q0,-39.6 0,-41.6 Z M0,-43 L-4,-43.8', fill: C.ink, stroke: C.ink, 'stroke-width': 1, 'stroke-linejoin': 'round', 'data-ac': 'shades' }, helm);
    el('circle', { cx: 3.6, cy: -39, r: 1.4, fill: '#ff8f8f', opacity: 0.8 }, helm);
    el('path', { d: 'M-1.5,-38.6 Q0.5,-37 2,-38.4', fill: 'none', stroke: C.ink, 'stroke-width': 1, 'stroke-linecap': 'round' }, helm);
    el('ellipse', { cx: -0.5, cy: -42.5, rx: 6.8, ry: 6, fill: 'rgba(61,184,255,.22)', 'data-hm': 'classic star ears' }, helm);
    el('ellipse', { cx: -0.5, cy: -42.5, rx: 6.8, ry: 6, fill: 'rgba(255,184,40,.5)', stroke: '#c98a12', 'stroke-width': 1.2, 'data-hm': 'gold' }, helm);
    el('path', { d: 'M-5,-46 Q-3.5,-48 -1,-48.2', fill: 'none', stroke: '#fff', 'stroke-width': 1.5, 'stroke-linecap': 'round' }, helm);
    // the pal's head is the nose of the rocket
    palEars(ship, 18.5, -21, 9.5, true, 'mnt');
    var bearEye = palFace(ship, 18.5, -21, 9.5, true, 'mnt', true);
    // arm reaching for the bear's ears
    el('path', { d: 'M-4,-33 Q4,-35 10,-30', fill: 'none', stroke: C.ink, 'stroke-width': 6.4, 'stroke-linecap': 'round' }, ship);
    el('path', { d: 'M-4,-33 Q4,-35 10,-30', fill: 'none', stroke: '#fff', 'data-c': 'shirt', 'stroke-width': 3.8, 'stroke-linecap': 'round' }, ship);
    el('circle', { cx: 11, cy: -29.5, r: 2.8, fill: C.cuff, 'data-c': 'cuff', stroke: C.ink, 'stroke-width': 1.3 }, ship);

    // helmet styles (data-hm): antenna ball, star antenna, cat ears, gold visor
    function helmStar(g, x, y) {
      var d = '';
      for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 2.1 : 4.8; d += (i ? 'L' : 'M') + (x + Math.cos(a) * r).toFixed(2) + ',' + (y + Math.sin(a) * r).toFixed(2); }
      el('path', { d: d + 'Z', fill: C.yellow, stroke: C.ink, 'stroke-width': 1.1, 'stroke-linejoin': 'round', 'data-hm': 'star' }, g);
    }
    // each helmet style has its own shell colour; the gold one also wears a crest
    function helmShell(g, cx, cy) {
      var HM = { classic: '#ffffff', star: '#7fd0ff', ears: '#ff9fc6', gold: '#ffc933' };
      for (var k in HM) el('circle', { cx: cx, cy: cy, r: 10.5, fill: HM[k], stroke: C.ink, 'stroke-width': 1.7, 'data-hm': k }, g);
      var d = 'M' + (cx - 6.4) + ',' + (cy - 8) + ' Q' + cx + ',' + (cy - 17.5) + ' ' + (cx + 6.4) + ',' + (cy - 8);
      el('path', { d: d, fill: 'none', stroke: C.ink, 'stroke-width': 5.6, 'stroke-linecap': 'round', 'data-hm': 'gold' }, g);
      el('path', { d: d, fill: 'none', stroke: C.red, 'stroke-width': 3, 'stroke-linecap': 'round', 'data-hm': 'gold' }, g);
    }
    function helmEars(g, pts) {
      pts.forEach(function (p) {
        var x = p[0], y = p[1], t = 'rotate(' + p[2] + ',' + x + ',' + y + ')';
        el('path', { d: 'M' + (x - 3.4) + ',' + (y + 2.6) + ' L' + x + ',' + (y - 4) + ' L' + (x + 3.4) + ',' + (y + 2.6) + ' Z', transform: t, fill: '#ff9fc6', stroke: C.ink, 'stroke-width': 1.4, 'stroke-linejoin': 'round', 'data-hm': 'ears' }, g);
        el('path', { d: 'M' + (x - 1.6) + ',' + (y + 1.8) + ' L' + x + ',' + (y - 1.6) + ' L' + (x + 1.6) + ',' + (y + 1.8) + ' Z', transform: t, fill: '#fff', 'data-hm': 'ears' }, g);
      });
    }
    // front and back of the rocket: closet turntable only
    function suitLegs(g) {
      [-1, 1].forEach(function (k) {
        var d = 'M' + (k * 4.5) + ',-25 Q' + (k * 12.5) + ',-23 ' + (k * 12.5) + ',-13';
        el('path', { d: d, fill: 'none', stroke: C.ink, 'stroke-width': 8, 'stroke-linecap': 'round' }, g);
        el('path', { d: d, fill: 'none', stroke: '#fff', 'data-c': 'shirt', 'stroke-width': 5.2, 'stroke-linecap': 'round' }, g);
        el('rect', { x: k * 12.5 - 4, y: -13.5, width: 8, height: 5, rx: 2, fill: C.cuff, 'data-c': 'cuff', stroke: C.ink, 'stroke-width': 1.3 }, g);
      });
    }
    function rocketTail(g) {
      el('path', { d: 'M-8,-12 L-17.5,-3 L-5,-7.5 Z M8,-12 L17.5,-3 L5,-7.5 Z', fill: C.red, stroke: C.ink, 'stroke-width': 1.5, 'stroke-linejoin': 'round' }, g);
      el('ellipse', { cx: 0, cy: -17, rx: 12.5, ry: 8.8, fill: C.brown, 'data-c': 'mnt', stroke: C.ink, 'stroke-width': 1.7 }, g);
    }
    var shipF = el('g', { display: 'none' }, root);
    rocketTail(shipF);
    suitLegs(shipF);
    el('rect', { x: -6.5, y: -37, width: 13, height: 14, rx: 4, fill: '#fff', 'data-c': 'shirt', stroke: C.ink, 'stroke-width': 1.5 }, shipF);
    el('rect', { x: -2.5, y: -33.5, width: 5, height: 4, rx: 1, fill: C.sky, stroke: C.ink, 'stroke-width': 1 }, shipF);
    var hf = el('g', null, shipF);
    el('path', { d: 'M4,-52.5 L6.5,-57', stroke: C.ink, 'stroke-width': 1.6, 'stroke-linecap': 'round', 'data-hm': 'classic star' }, hf);
    el('circle', { cx: 6.8, cy: -57.5, r: 2, fill: C.yellow, stroke: C.ink, 'stroke-width': 1.2, 'data-hm': 'classic' }, hf);
    helmStar(hf, 6.8, -58.4);
    helmEars(hf, [[-6.6, -52.4, -24], [6.6, -52.4, 24]]);
    helmShell(hf, 0, -44);
    el('ellipse', { cx: 0, cy: -43.4, rx: 7.6, ry: 6.4, fill: C.skin, 'data-c': 'skin', stroke: C.ink, 'stroke-width': 1.4 }, hf);
    el('path', { d: 'M-7.4,-44.6 Q-6.8,-50.2 0,-50 Q6.8,-50.2 7.4,-44.6 Q4.6,-47.2 2.2,-45.4 Q0,-47.4 -2.2,-45.4 Q-4.6,-47.2 -7.4,-44.6 Z', fill: C.navy, 'data-c': 'hair' }, hf);
    [-1, 1].forEach(function (k) {
      el('ellipse', { cx: k * 2.7, cy: -42.8, rx: 1, ry: 1.5, fill: C.ink, 'data-ey': 'dot freckle' }, hf);
      var se = el('g', { 'data-ey': 'sparkle' }, hf);
      el('ellipse', { cx: k * 2.7, cy: -42.8, rx: 1.4, ry: 1.9, fill: C.ink }, se);
      el('circle', { cx: k * 2.7 + 0.5, cy: -43.6, r: 0.55, fill: '#fff' }, se);
      el('path', { d: 'M' + (k * 2.7 - 1.3) + ',-42 Q' + (k * 2.7) + ',-44.6 ' + (k * 2.7 + 1.3) + ',-42', fill: 'none', stroke: C.ink, 'stroke-width': 1.2, 'stroke-linecap': 'round', 'data-ey': 'happy' }, hf);
      el('circle', { cx: k * 4.8, cy: -40.4, r: 1.3, fill: '#ff8f8f', opacity: 0.8 }, hf);
      var fr = el('g', { 'data-ey': 'freckle', fill: '#b5654a' }, hf);
      el('circle', { cx: k * 4.2, cy: -41.4, r: 0.45 }, fr); el('circle', { cx: k * 5.2, cy: -41, r: 0.45 }, fr);
      el('circle', { cx: k * 2.8, cy: -42.8, r: 2.5, fill: 'rgba(255,255,255,.3)', stroke: C.ink, 'stroke-width': 1, 'data-ac': 'glasses' }, hf);
      el('path', { d: 'M' + (k * 0.6) + ',-44.4 H' + (k * 5.2) + ' V-42.4 Q' + (k * 5.2) + ',-40.6 ' + (k * 3.4) + ',-40.6 H' + (k * 2.4) + ' Q' + (k * 0.6) + ',-40.6 ' + (k * 0.6) + ',-42.4 Z', fill: C.ink, stroke: C.ink, 'stroke-width': 0.8, 'stroke-linejoin': 'round', 'data-ac': 'shades' }, hf);
    });
    el('path', { d: 'M-1.6,-39.6 Q0,-38 1.6,-39.6', fill: 'none', stroke: C.ink, 'stroke-width': 1, 'stroke-linecap': 'round' }, hf);
    el('ellipse', { cx: 0, cy: -43.4, rx: 7.6, ry: 6.4, fill: 'rgba(61,184,255,.22)', 'data-hm': 'classic star ears' }, hf);
    el('ellipse', { cx: 0, cy: -43.4, rx: 7.6, ry: 6.4, fill: 'rgba(255,184,40,.5)', stroke: '#c98a12', 'stroke-width': 1.2, 'data-hm': 'gold' }, hf);
    el('path', { d: 'M-5,-47 Q-3.5,-49 -1,-49.2', fill: 'none', stroke: '#fff', 'stroke-width': 1.5, 'stroke-linecap': 'round' }, hf);
    palEars(shipF, 0, -18.5, 9.5, false, 'mnt');
    palFace(shipF, 0, -18.5, 9.5, false, 'mnt', true);
    [-1, 1].forEach(function (k) {
      var d = 'M' + (k * 6) + ',-34 Q' + (k * 12.5) + ',-31 ' + (k * 10.6) + ',-22.6';
      el('path', { d: d, fill: 'none', stroke: C.ink, 'stroke-width': 6.4, 'stroke-linecap': 'round' }, shipF);
      el('path', { d: d, fill: 'none', stroke: '#fff', 'data-c': 'shirt', 'stroke-width': 3.8, 'stroke-linecap': 'round' }, shipF);
      el('circle', { cx: k * 10.4, cy: -22, r: 2.6, fill: C.cuff, 'data-c': 'cuff', stroke: C.ink, 'stroke-width': 1.3 }, shipF);
    });
    var shipB = el('g', { display: 'none' }, root);
    rocketTail(shipB);
    palEars(shipB, 0, -19.5, 10.5, false, 'mnt');
    el('circle', { cx: 0, cy: -16.5, r: 6.4, fill: '#d9dde8', stroke: C.ink, 'stroke-width': 1.6 }, shipB);
    el('circle', { cx: 0, cy: -16.5, r: 3.8, fill: C.orange, stroke: C.ink, 'stroke-width': 1.2 }, shipB);
    el('circle', { cx: 0, cy: -16.5, r: 1.8, fill: C.yellow }, shipB);
    suitLegs(shipB);
    el('rect', { x: -6.5, y: -37, width: 13, height: 13, rx: 4, fill: '#fff', 'data-c': 'shirt', stroke: C.ink, 'stroke-width': 1.5 }, shipB);
    [-1, 1].forEach(function (k) {
      var d = 'M' + (k * 6) + ',-34 Q' + (k * 9.6) + ',-31.5 ' + (k * 8.4) + ',-28.4';
      el('path', { d: d, fill: 'none', stroke: C.ink, 'stroke-width': 6.4, 'stroke-linecap': 'round' }, shipB);
      el('path', { d: d, fill: 'none', stroke: '#fff', 'data-c': 'shirt', 'stroke-width': 3.8, 'stroke-linecap': 'round' }, shipB);
    });
    el('rect', { x: -5, y: -38.5, width: 10, height: 12, rx: 2, fill: '#d9dde8', stroke: C.ink, 'stroke-width': 1.4 }, shipB);
    el('rect', { x: -3, y: -35, width: 6, height: 2.4, fill: C.red }, shipB);
    el('path', { d: 'M-4,-52.5 L-6.5,-57', stroke: C.ink, 'stroke-width': 1.6, 'stroke-linecap': 'round', 'data-hm': 'classic star' }, shipB);
    el('circle', { cx: -6.8, cy: -57.5, r: 2, fill: C.yellow, stroke: C.ink, 'stroke-width': 1.2, 'data-hm': 'classic' }, shipB);
    helmStar(shipB, -6.8, -58.4);
    helmEars(shipB, [[-6.6, -52.4, -24], [6.6, -52.4, 24]]);
    helmShell(shipB, 0, -44);
    el('path', { d: 'M-6,-38 Q0,-35.6 6,-38', fill: 'none', stroke: '#c9cfdc', 'stroke-width': 1.6, 'stroke-linecap': 'round' }, shipB);

    function limb(h, x1, y1, x2, y2, bend) {
      var mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1, Ln = Math.hypot(dx, dy) || 1;
      var cx = mx + (-dy / Ln) * bend, cy = my + (dx / Ln) * bend;
      var d = 'M' + x1.toFixed(1) + ',' + y1.toFixed(1) + ' Q' + cx.toFixed(1) + ',' + cy.toFixed(1) + ' ' + x2.toFixed(1) + ',' + y2.toFixed(1);
      h.o.setAttribute('d', d); h.f.setAttribute('d', d);
      return [cx, cy];
    }
    function cuff(pth, hx, hy, fx, fy, c) {
      var vx = c[0] - fx, vy = c[1] - fy, Ln = Math.hypot(vx, vy) || 1;
      vx /= Ln; vy /= Ln;
      pth.setAttribute('d', 'M' + (fx + vx * 3.2).toFixed(1) + ',' + (fy + vy * 3.2).toFixed(1) + ' L' + (fx + vx * 6.4).toFixed(1) + ',' + (fy + vy * 6.4).toFixed(1));
    }

    var H = {
      x: NODES[0].p[0], y: NODES[0].p[1], z: NODES[0].p[2],
      mode: 'idle', queue: [], seg: null, segT: 0, phase: 0,
      face: 1, isBack: false, stop: 0, target: null,
      sq: 0, sqT: 9, blinkT: 2, act: null, actT: 0, idleT: 0,
      scale: 0.82, hang: false, arriveCb: null, rot: 0,
      char: 'walk', hz: null
    };
    function squash(a) { H.sq = a; H.sqT = 0; }

    function pose(o) {
      var bob = o.bob || 0;
      var hipY = -15 + bob;
      // legs
      var hx = o.hx || 3.6, sx = o.sx || 7;   // hip and shoulder half-widths (narrower when turned)
      // legs stop a little above the foot so the round cap of the outline stays hidden inside the shoe
      var cL = limb(legL, -hx, hipY, o.fL[0], o.fL[1] - 2.6, o.kL || 0);
      var cR = limb(legR, hx, hipY, o.fR[0], o.fR[1] - 2.6, o.kR || 0);
      cuff(cuffL, -hx, hipY, o.fL[0], o.fL[1], cL);
      cuff(cuffR, hx, hipY, o.fR[0], o.fR[1], cR);
      shoeL.setAttribute('transform', 'translate(' + (o.fL[0] - 1).toFixed(1) + ',' + (o.fL[1] + 1.5).toFixed(1) + ') rotate(' + (o.sL || 0) + ')');
      shoeR.setAttribute('transform', 'translate(' + (o.fR[0] - 1).toFixed(1) + ',' + (o.fR[1] + 1.5).toFixed(1) + ') rotate(' + (o.sR || 0) + ')');
      torso.setAttribute('transform', 'translate(0,' + bob.toFixed(1) + ')');
      // the whole sprite mirrors when walking left; un-mirror the pillow so the bear stays on the same shoulder
      pillow.setAttribute('transform', 'translate(0,' + bob.toFixed(1) + ')' + (H.face < 0 ? ' scale(-1,1)' : ''));
      var shY = -26.5 + bob;
      limb(armBack, -sx, shY, o.hB[0], o.hB[1], o.eB || 3);
      limb(armFront, sx, shY, o.hF[0], o.hF[1], o.eF || -3);
      handB.setAttribute('cx', o.hB[0].toFixed(1)); handB.setAttribute('cy', o.hB[1].toFixed(1));
      handF.setAttribute('cx', o.hF[0].toFixed(1)); handF.setAttribute('cy', o.hF[1].toFixed(1));
      head.setAttribute('transform', 'translate(0,' + (-41 + bob + (o.hd || 0)).toFixed(1) + ') rotate(' + (o.tilt || 0).toFixed(1) + ',0,8)');
      eyes.setAttribute('transform', 'translate(0,1) scale(1,' + (o.blink ? 0.12 : 1) + ') translate(0,-1)');
      mouth.setAttribute('d', o.mouth === 'o' ? 'M-2,5.4 Q0,9.5 2,5.4 Q0,3.8 -2,5.4 Z' : o.mouth === 'flat' ? 'M-2.6,6.2 Q0,7.6 2.6,6.2 Q0,6.8 -2.6,6.2 Z' : 'M-3,5.6 Q0,10.5 3,5.6 Z');
      face.setAttribute('display', H.isBack ? 'none' : '');
      back.setAttribute('display', H.isBack ? '' : 'none');
      pFront.setAttribute('display', H.isBack ? 'none' : '');
      pBack.setAttribute('display', H.isBack ? '' : 'none');
      // arms behind torso in back view
      if (H.isBack) { body.insertBefore(armFront.o, torso); body.insertBefore(armFront.f, torso); body.insertBefore(handF, torso); }
      else { body.insertBefore(armFront.o, pillow); body.insertBefore(armFront.f, pillow); body.insertBefore(handF, pillow); }
    }

    function place(sp, extraRot, pivotY) {
      var s = H.scale;
      var sqv = H.sq * Math.exp(-H.sqT * 7) * Math.cos(H.sqT * 22);
      var sy = 1 - sqv, sx = 1 + sqv * 0.7;
      var tr = 'translate(' + sp[0].toFixed(1) + ',' + sp[1].toFixed(1) + ')';
      if (pivotY) tr += ' scale(' + (H.face * s) + ',' + s + ') rotate(' + (extraRot || 0).toFixed(2) + ') translate(0,' + pivotY + ')';
      else tr += ' scale(' + (H.face * s * sx).toFixed(3) + ',' + (s * sy).toFixed(3) + ')';
      root.setAttribute('transform', tr);
    }

    function smooth(k) { return k * k * (3 - 2 * k); }
    // character 2 flies straight to a stop: lift off, cruise high, settle into a hover
    function flyUpdate(dt, t, blink) {
      var hov = 0.38 + Math.sin(t * 2.6) * 0.07, tilt = Math.sin(t * 1.3) * 3, thrust = 0.3;
      if (H.mode === 'travel' && H.seg) {
        var s = H.seg;
        H.segT += dt;
        var u = clamp(H.segT / s.dur, 0, 1);
        var e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
        H.x = lerp(s.a[0], s.b[0], e); H.y = lerp(s.a[1], s.b[1], e); H.z = lerp(s.a[2], s.b[2], e);
        var land = smooth(clamp((u - 0.82) / 0.18, 0, 1));
        H.hz = lerp(s.a[2] + s.h0, s.b[2] + lerp(s.h0, hov, land), e) + Math.pow(Math.sin(Math.PI * u), 0.7) * s.cz;
        var sa = P(s.a[0], s.a[1], 0), sb = P(s.b[0], s.b[1], 0);
        if (Math.abs(sb[0] - sa[0]) > 0.5) H.face = sb[0] < sa[0] ? -1 : 1;
        tilt = 13 * Math.sin(Math.PI * u) * (u < 0.5 ? 1 : 0.6);
        thrust = 1;
        if (u >= 1) { SFX.land(); impact(s.b[0], s.b[1], s.b[2], 0.25); nextSeg(); H.hz = H.z + hov; }
      } else H.hz = H.z + hov;
      var sp = P(H.x, H.y, H.hz);
      root.setAttribute('transform', 'translate(' + sp[0].toFixed(1) + ',' + sp[1].toFixed(1) + ') scale(' + (H.face * H.scale) + ',' + H.scale + ') rotate(' + tilt.toFixed(2) + ',0,-22)');
      var fl = (thrust > 0.5 ? 13 : 6) + Math.random() * (thrust > 0.5 ? 7 : 3);
      flame.setAttribute('d', 'M-27,-21 Q' + (-27 - fl).toFixed(1) + ',-15.5 -27,-10 Z');
      flameIn.setAttribute('d', 'M-27,-18.5 Q' + (-27 - fl * 0.55).toFixed(1) + ',-15.5 -27,-12.5 Z');
      var bs = blink ? 0.15 : 1;
      shipEye.setAttribute('ry', (1.6 * bs).toFixed(2)); bearEye.setAttribute('transform', blink ? 'translate(0,-22.9) scale(1,0.15) translate(0,22.9)' : '');
      var gs = P(H.x, H.y, H.z), hgt = H.hz - H.z;
      shadow.setAttribute('cx', gs[0].toFixed(1)); shadow.setAttribute('cy', gs[1].toFixed(1));
      shadow.setAttribute('rx', Math.max(5, 15 - hgt * 2.2).toFixed(1));
      shadow.setAttribute('opacity', Math.max(0.25, 1 - hgt * 0.22).toFixed(2));
      shadow.style.display = '';
      H.sp = sp;
    }

    /* water slide: climb the tower, ride the track, pop out onto the studio mat.
       Going 06 → 05 plays the very same ride backwards, like scrubbing a timeline. */
    var RW = null;
    function rewind(on, sec) {
      if (!RW) {
        RW = document.createElement('div');
        RW.className = 'rw';
        RW.setAttribute('aria-hidden', 'true');
        RW.innerHTML = '<div class="rw-tag"><svg viewBox="0 0 44 28"><path d="M22,2 L2,14 L22,26 Z M42,2 L22,14 L42,26 Z" fill="#fff" stroke="#16161d" stroke-width="2.5" stroke-linejoin="round"/></svg><span>REWIND</span></div><div class="rw-tc"></div><div class="rw-band"></div>';
        document.body.appendChild(RW);
      }
      RW.classList.toggle('on', on);
      if (sec != null) {
        var f = Math.max(0, Math.round(sec * 25));
        RW.lastChild.previousSibling.textContent = '00:00:' + ('0' + Math.floor(f / 25)).slice(-2) + ':' + ('0' + f % 25).slice(-2);
      }
    }
    function slideUpdate(s, blink, dt) {
      var rev = s.a[1] > s.b[1], dur = s.dur;
      var tau = rev ? dur - H.segT : H.segT, o, sp, ft = SLIDE.foot, tp = SLIDE.top;
      H.isBack = false;
      s.gz = null;
      SLIDE_OVER.setAttribute('display', 'none');
      // the deck sits just under the Workshop tag, and the lip and the somersault pass right
      // under the studio's: let each step back while the hero is there
      if (TAGS[4]) TAGS[4].g.style.opacity = tau > SLIDE_IN * 0.5 && tau < SLIDE_IN + 0.5 ? 0.2 : '';
      if (TAGS[5]) TAGS[5].g.style.opacity = tau > SLIDE_IN + SLIDE.T - 0.7 && tau < SLIDE_IN + SLIDE.T + 0.9 ? 0.2 : '';
      if (rev) {
        if (!s.rw) { s.rw = 1; SFX.rewind(); }
        rewind(H.segT < dur - 0.02, tau);
      }
      if (tau < SLIDE_IN) {
        SFX.water(0);
        // hand over hand up the ladder (back to the camera), then step onto the deck
        var c = tau / SLIDE_IN, lc = clamp(c / 0.78, 0, 1), cl = Math.sin(lc * Math.PI * 7);
        if (c < 0.78) {
          H.isBack = true;
          H.x = ft[0]; H.y = ft[1]; H.z = lerp(ft[2], tp[2], lc);
          o = { bob: 0, fL: [-3, -Math.max(0, cl) * 6], fR: [3, -Math.max(0, -cl) * 6], kL: -Math.max(0, cl) * 4, kR: -Math.max(0, -cl) * 4, hB: [-6, -52 - cl * 5], hF: [6, -52 + cl * 5], eB: 3, eF: -3, blink: blink };
        } else {
          var st2 = (c - 0.78) / 0.22;
          H.face = 1;
          H.x = lerp(ft[0], tp[0], st2); H.y = lerp(ft[1], tp[1], st2); H.z = tp[2] + Math.sin(st2 * Math.PI) * 0.12;
          o = { bob: 1, fL: [-4, -3 * Math.sin(st2 * Math.PI)], fR: [4, 0], kL: 3, kR: -3, hB: [-11, -16], hF: [11, -16], blink: blink };
        }
        pose(o);
        sp = P(H.x, H.y, H.z);
        place(sp);
        s.gz = H.z;
        s.st = 0;
      } else if (tau < SLIDE_IN + SLIDE.T) {
        if (!rev && !s.st) { s.st = 1; SFX.zip(); }
        var at = slideAt(tau - SLIDE_IN);
        // water rushes louder and brighter the faster the rider goes
        if (s.wp) { var spd = Math.hypot(at.p[0] - s.wp[0], at.p[1] - s.wp[1], at.p[2] - s.wp[2]) / Math.max(dt, 1e-3); SFX.water(rev ? 0 : clamp(spd / 9, 0.25, 1)); }
        s.wp = at.p;
        var over = at.i < SLIDE.loopFrom + 18 && at.i > SLIDE.loopFrom - 18;
        SLIDE_OVER.setAttribute('display', over ? '' : 'none');
        if (over && L.sky.lastChild !== SLIDE_OVER) L.sky.appendChild(SLIDE_OVER);
        H.x = at.p[0]; H.y = at.p[1]; H.z = at.p[2];
        var ang = Math.atan2(at.d[1], at.d[0]) * 180 / Math.PI, vis;
        // which way the rider faces: in the loop the way it entered (so it turns all the way
        // round); elsewhere the way it's heading, switching only once the track clearly turns
        var lf = SLIDE.pts[SLIDE.loopFrom], lp = SLIDE.pts[SLIDE.loopFrom - 1];
        var tf = at.loop ? (lf.sp[0] >= lp.sp[0] ? 1 : -1)
          : Math.abs(at.d[0]) > 0.35 * Math.hypot(at.d[0], at.d[1]) ? (at.d[0] >= 0 ? 1 : -1) : (s.tf || 1);
        s.tf = tf;
        vis = tf > 0 ? ang : ang - 180;
        vis = ((vis + 540) % 360) - 180;
        if (!at.loop) vis = 70 * Math.tanh(vis / 70);
        // tilt and facing ease toward their targets instead of snapping, so nothing jerks
        if (!s.ri) { s.ri = 1; s.rv = 0; s.fv = tf; }
        s.rv += (((vis - s.rv + 540) % 360) - 180) * Math.min(1, dt * 14);
        s.fv += (tf - s.fv) * Math.min(1, dt * 12);
        H.face = Math.abs(s.fv) < 0.1 ? (s.fv < 0 ? -0.1 : 0.1) : s.fv;
        var wob = Math.sin(H.segT * 30) * 1.5;
        o = { bob: 0, fL: [10, -14 + wob], fR: [12.5, -12 - wob], kL: -2, kR: -2, sL: -10, sR: -10, hB: [-7, -50], hF: [9, -52], eB: 3, eF: -4, mouth: 'o', tilt: -4, blink: false };
        pose(o);
        sp = P(H.x, H.y, H.z);
        place(sp, s.rv * (H.face < 0 ? -1 : 1), 21);
        s.lv = s.rv;
        sp = [sp[0], sp[1] - 6];
        // spray off the track now and then
        if (!rev && Math.random() < 0.2) splash(sp, at.d);
      } else {
        // thrown off the lip: a tucked somersault on the way down, then a heavy landing
        SFX.water(0);
        if (!rev && !s.fl) { s.fl = 1; SFX.splash(); for (var sk = 0; sk < 7; sk++) splash(P(SLIDE.pts[SLIDE.pts.length - 1].p[0], SLIDE.pts[SLIDE.pts.length - 1].p[1], SLIDE.pts[SLIDE.pts.length - 1].p[2]), [-30, 10]); }
        var e = SLIDE.pts[SLIDE.pts.length - 1].p, mat = rev ? s.a : s.b, AIR = RM ? 0.03 : 0.95;
        var w = clamp((tau - SLIDE_IN - SLIDE.T) / AIR, 0, 1);
        H.face = -1;
        var wh = 1 - (1 - w) * (1 - w);
        H.x = lerp(e[0], mat[0], wh); H.y = lerp(e[1], mat[1], wh);
        H.z = lerp(e[2], mat[2], w * w) + 0.55 * 4 * w * (1 - w);
        if (w < 1) {
          // tuck while spinning, open up just before touching down
          var tk = Math.sin(Math.PI * clamp(w / 0.85, 0, 1));
          o = { bob: 4 * tk, fL: [lerp(-5, 6, tk), lerp(-4, -16, tk)], fR: [lerp(5, 8, tk), lerp(-2, -14, tk)], kL: -5 - 4 * tk, kR: 5 - 8 * tk, hB: [lerp(-9, 4, tk), lerp(-46, -20, tk)], hF: [lerp(9, 10, tk), lerp(-48, -22, tk)], eB: -4, eF: 4, mouth: 'o', blink: tk > 0.6 };
          pose(o);
          // the spin carries on from the tilt it left the lip with and ends upright; same pivot
          // as on the track, sliding down to the feet by touchdown, so nothing jumps
          var lv = s.lv == null ? 0 : s.lv, va = lerp(lv, -360, 1 - Math.pow(1 - clamp(w / 0.85, 0, 1), 2));
          sp = P(H.x, H.y, H.z);
          place([sp[0], sp[1] - 21 * H.scale * w], -va, 21);
          s.gz = H.z;
          s.ld = 0;
          H.sp = sp;
          return;
        }
        if (!rev && !s.ld) { s.ld = 1; squash(0.55); SFX.land(); impact(H.x, H.y, H.z, 0.85); }
        var lk = Math.max(0, 1 - (tau - SLIDE_IN - SLIDE.T - AIR) / (SLIDE_OUT - AIR));
        o = { bob: 2 + 5 * lk, fL: [-6 - 2 * lk, 0], fR: [6 + 2 * lk, 0], kL: 3 + 4 * lk, kR: -3 - 4 * lk, hB: [-13 - 5 * lk, -18 + 3 * lk], hF: [13 + 5 * lk, -18 + 3 * lk], mouth: lk > 0.5 ? 'flat' : null, blink: blink };
        pose(o);
        sp = P(H.x, H.y, H.z);
        place(sp);
        s.gz = H.z;
      }
      H.sp = sp;
    }
    function splash(sp, d) {
      var l = Math.hypot(d[0], d[1]) || 1, side = Math.random() < 0.5 ? 1 : -1;
      var c = el('circle', { cx: sp[0], cy: sp[1] + 8, r: 2.2, fill: '#fff', stroke: C.sky, 'stroke-width': 1.4 }, L.fx);
      PARTS.push({ n: c, x: sp[0], y: sp[1] + 8, vx: -d[0] / l * 40 + side * -d[1] / l * 50, vy: -30 - Math.random() * 40, r: 0.8 + Math.random(), life: 0.22 + Math.random() * 0.12, max: 0.34 });
    }

    H.update = function (dt, t) {
      H.sqT += dt;
      H.blinkT -= dt;
      var blink = false;
      if (H.blinkT < 0) { blink = true; if (H.blinkT < -0.12) H.blinkT = 1.5 + Math.random() * 3; }
      var gz = H.z, sp, o;
      if (H.char === 'astro') { flyUpdate(dt, t, blink); return; }

      if (H.mode === 'travel' && H.seg) {
        var s = H.seg;
        H.segT += dt;
        var u = clamp(H.segT / s.dur, 0, 1);
        var a = s.a, b = s.b;
        var sa = P(a[0], a[1], a[2]), sb = P(b[0], b[1], b[2]);
        var dx = sb[0] - sa[0], dy = sb[1] - sa[1];
        if (Math.abs(dx) > 0.5) H.face = dx < 0 ? -1 : 1;
        H.isBack = s.t !== 'rope' && dy < -0.5;

        if (s.t === 'walk' || s.t === 'stairs') {
          var spd = s.len / s.dur;
          var prev = Math.sin(H.phase);
          H.phase += dt * spd * (s.t === 'stairs' ? 6.5 : 5.4);
          if ((prev < 0) !== (Math.sin(H.phase) < 0)) SFX.step(s.t === 'stairs' ? 'stairs' : onBridge(H.x, H.y) ? 'bridge' : ENV && ENV.season === 'winter' ? 'snow' : ENV && ENV.season === 'autumn' ? 'leaf' : null);
          H.x = lerp(a[0], b[0], u); H.y = lerp(a[1], b[1], u); H.z = lerp(a[2], b[2], u);
          var sn = Math.sin(H.phase), cs = Math.cos(H.phase);
          var stride = s.t === 'stairs' ? 5 : 6.5, lift = s.t === 'stairs' ? 6.5 : 4.5;
          o = {
            bob: -Math.abs(cs) * 3.2,
            fL: [sn * stride - 1.5, -Math.max(0, cs) * lift], fR: [-sn * stride + 1.5, -Math.max(0, -cs) * lift],
            kL: -Math.max(0, cs) * 4, kR: -Math.max(0, -cs) * 4,
            hB: [-10 - sn * 4.5, -13 - Math.abs(sn) * 2], hF: [10 + sn * 4.5, -13 - Math.abs(sn) * 2],
            tilt: sn * 3, hd: -Math.abs(Math.cos(H.phase - 0.6)) * 1.2, blink: blink
          };
          pose(o);
          sp = P(H.x, H.y, H.z);
          place(sp);
          gz = H.z;
        } else if (s.t === 'rope') {
          // grab → hand-over-hand → drop
          var grab = 0.22, rel = 0.2, mid = s.dur - grab - rel;
          var k = H.segT < grab ? 0 : H.segT > s.dur - rel ? 1 : (H.segT - grab) / mid;
          var ue = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          var ru0 = (a[0] - 3.9) / 3.2, ru1 = (b[0] - 3.9) / 3.2;
          var ru = lerp(ru0, ru1, ue);
          ROPE.hold = clamp(ru, 0, 1);
          var rp = ropeHand(ROPE.hold);
          H.x = lerp(a[0], b[0], ue); H.y = a[1]; H.z = a[2];
          var sw = Math.sin(H.segT * 7) * 9 * (1 - Math.abs(2 * k - 1) * 0.3);
          var hh = Math.sin(H.segT * 12);
          o = {
            bob: 0,
            fL: [-3 + Math.sin(H.segT * 9) * 3, -1], fR: [3 + Math.sin(H.segT * 9 + 1.5) * 3, -2],
            kL: 3, kR: -3,
            hB: [-3 - hh * 4, -64], hF: [3 + hh * 4, -64], eB: 2, eF: -2,
            tilt: -sw * 0.4, mouth: 'o', blink: blink
          };
          pose(o);
          if (H.segT < grab) {
            // reach up: blend from stand to hang
            var g0 = H.segT / grab;
            var st = P(a[0], a[1], a[2]);
            var hp = [rp[0], rp[1] + 64 * H.scale];
            sp = [lerp(st[0], hp[0], g0), lerp(st[1], hp[1], g0) - Math.sin(g0 * Math.PI) * 8];
            place(sp);
          } else if (H.segT > s.dur - rel) {
            var g1 = (H.segT - (s.dur - rel)) / rel;
            var en = P(b[0], b[1], b[2]);
            var hp2 = [rp[0], rp[1] + 64 * H.scale];
            sp = [lerp(hp2[0], en[0], g1), lerp(hp2[1], en[1], g1)];
            ROPE.hold = null;
            place(sp);
          } else {
            place(rp, sw, 64);
            sp = [rp[0], rp[1] + 64 * H.scale];
          }
          gz = null;
          if (!s.zipped) { s.zipped = 1; SFX.grab(); setTimeout(SFX.zip, 120); }
        } else if (s.t === 'slide') {
          slideUpdate(s, blink, dt);
          sp = H.sp;
          gz = s.gz;
        } else if (s.t === 'jump' || s.t === 'hop') {
          var isHop = s.t === 'hop';
          var ant = isHop ? 0.07 : 0.26, landT = isHop ? 0.06 : 0.34, air = s.dur - ant - landT, arcH = isHop ? 0.9 : 2.4;
          var jt = H.segT;
          if (jt < ant) {
            H.x = a[0]; H.y = a[1]; H.z = a[2];
            var q = jt / ant;
            o = { bob: 3 * q, fL: [-4, 0], fR: [4, 0], kL: 4 * q, kR: -4 * q, hB: [-11, -10 + q * 3], hF: [11, -10 + q * 3], mouth: 'flat', blink: blink };
            pose(o);
            sp = P(H.x, H.y, H.z);
            place([sp[0], sp[1]]);
            root.setAttribute('transform', root.getAttribute('transform') + ' scale(' + (1 + q * 0.18).toFixed(3) + ',' + (1 - q * 0.22).toFixed(3) + ')');
            if (!isHop) padHold(a, q);
            if (!s.boing) { s.boing = 1; }
          } else if (jt < ant + air) {
            if (s.boing === 1) { s.boing = 2; if (isHop) SFX.pop(); else { SFX.boing(); padKick(a, -9); impact(a[0], a[1], a[2], 0.3); } }
            var w = (jt - ant) / air;
            H.x = lerp(a[0], b[0], w); H.y = lerp(a[1], b[1], w);
            H.z = lerp(a[2], b[2], w) + arcH * 4 * w * (1 - w);
            var str = 1 + 0.2 * (1 - Math.min(1, w * 3));
            o = { bob: -2, fL: [-5, -6], fR: [5, -3], kL: -5, kR: 5, hB: [-9, -44], hF: [9, -44], eB: -4, eF: 4, mouth: 'o', blink: false };
            pose(o);
            sp = P(H.x, H.y, H.z);
            place(sp);
            root.setAttribute('transform', root.getAttribute('transform') + ' scale(' + (1 / str).toFixed(3) + ',' + str.toFixed(3) + ')');
          } else {
            if (s.boing === 2) { s.boing = 3; squash(isHop ? 0.18 : 0.42); if (isHop) SFX.step(); else { SFX.land(); padKick(b, 6); } impact(b[0], b[1], b[2], isHop ? 0.22 : 1); }
            H.x = b[0]; H.y = b[1]; H.z = b[2];
            var lk = isHop ? 0.3 : Math.max(0, 1 - (jt - ant - air) / landT);
            o = { bob: 2 + 4 * lk, fL: [-5 - 2 * lk, 0], fR: [5 + 2 * lk, 0], kL: 3 + 3 * lk, kR: -3 - 3 * lk, hB: [-12 - 4 * lk, -18 + 2 * lk], hF: [12 + 4 * lk, -18 + 2 * lk], mouth: lk > 0.5 ? 'flat' : null, blink: blink };
            pose(o); sp = P(H.x, H.y, H.z); place(sp);
          }
          gz = H.z;
        }
        if (u >= 1) nextSeg();
      } else {
        // idle
        H.idleT += dt;
        H.actT -= dt;
        var br = Math.sin(t * 2.4) * 0.8;
        o = { bob: br * 0.6, fL: [-4, 0], fR: [4, 0], hB: [-10.5, -13 + br * 0.5], hF: [10.5, -13 + br * 0.5], blink: blink, tilt: Math.sin(t * 0.8) * 2 };
        if (H.act === 'wave' && H.actT > 0) {
          o.hF = [13 + Math.sin(t * 14) * 3, -46]; o.eF = 6; o.tilt = 5;
        } else if (H.act === 'scratch' && H.actT > 0) {
          o.hF = [8 + Math.sin(t * 20) * 1.2, -50]; o.eF = 8; o.tilt = -6; o.mouth = 'flat';
        } else if (H.act === 'hop' && H.actT > 0) {
          var hp3 = 1 - H.actT / 0.4;
          o.bob = -Math.sin(hp3 * Math.PI) * 10; o.fL = [-4, o.bob * 0.6]; o.fR = [4, o.bob * 0.6]; o.hB = [-10, -36]; o.hF = [10, -36]; o.mouth = 'o';
          if (H.actT - dt <= 0) squash(0.22);
        } else if (H.actT <= 0) {
          H.act = null;
          if (H.idleT > 6 && Math.random() < 0.006) { H.act = Math.random() < 0.5 ? 'scratch' : 'wave'; H.actT = 1.6; H.idleT = 0; }
        }
        H.isBack = false;
        pose(o);
        sp = P(H.x, H.y, H.z);
        place(sp);
      }
      // ground shadow
      if (gz != null) {
        var gs = P(H.x, H.y, H.mode === 'travel' && H.seg && (H.seg.t === 'jump' || H.seg.t === 'hop') ? lerp(H.seg.a[2], H.seg.b[2], clamp((H.x - H.seg.a[0] + H.y - H.seg.a[1]) / ((H.seg.b[0] - H.seg.a[0] + H.seg.b[1] - H.seg.a[1]) || 1), 0, 1)) : H.z);
        shadow.setAttribute('cx', gs[0].toFixed(1)); shadow.setAttribute('cy', gs[1].toFixed(1));
        var hgt = Math.max(0, (sp[1] - gs[1]) / -60);
        shadow.setAttribute('rx', (12 - hgt * 4).toFixed(1));
        shadow.setAttribute('opacity', (1 - Math.min(0.7, hgt * 0.5)).toFixed(2));
        shadow.style.display = '';
      } else shadow.style.display = 'none';
      H.sp = sp || P(H.x, H.y, H.z);
    };

    function nextSeg() {
      if (RW) rewind(false);
      if (SLIDE_OVER) SLIDE_OVER.setAttribute('display', 'none');
      SFX.water(0);
      if (TAGS[4]) TAGS[4].g.style.opacity = '';
      if (TAGS[5]) TAGS[5].g.style.opacity = '';
      H.seg = H.queue.shift() || null;
      H.segT = 0;
      if (!H.seg) {
        H.mode = 'idle';
        H.x = NODES[STOP_NODE[H.target]].p[0]; H.y = NODES[STOP_NODE[H.target]].p[1]; H.z = NODES[STOP_NODE[H.target]].p[2];
        H.stop = H.target;
        H.act = 'hop'; H.actT = 0.4; H.idleT = 0;
        ROPE.hold = null;
        var cb = H.arriveCb; H.arriveCb = null;
        setTimeout(function () { if (H.mode === 'idle') { H.act = 'wave'; H.actT = 1.4; } }, 420);
        if (cb) cb();
      }
    }

    H.travel = function (to, cb) {
      if (to === H.stop && H.mode === 'idle') { H.target = to; H.act = 'hop'; H.actT = 0.4; if (cb) setTimeout(cb, 250); return; }
      if (H.char === 'astro') {
        var nd = NODES[STOP_NODE[to]].p, dist = Math.hypot(nd[0] - H.x, nd[1] - H.y);
        H.seg = { t: 'fly', a: [H.x, H.y, H.z], b: [nd[0], nd[1], nd[2]], h0: (H.hz == null ? H.z : H.hz) - H.z, cz: 1.4 + dist * 0.12, dur: RM ? 0.3 : 0.8 + dist * 0.12 };
        H.queue = []; H.segT = 0; H.target = to; H.arriveCb = cb; H.mode = 'travel'; H.act = null;
        SFX.zip();
        return;
      }
      // from the node we're standing on (or the end of our current segment)
      var startNode;
      if (H.mode === 'travel' && H.seg) {
        // finish the current segment, then reroute from its end
        startNode = H.seg.endNode;
        H.queue = [];
      } else startNode = STOP_NODE[H.stop];
      var path = { list: plan(startNode, STOP_NODE[to]) };
      var walkLen = path.list.reduce(function (acc, s) { return acc + (s.t === 'walk' || s.t === 'stairs' ? s.len : 0); }, 0);
      var speed = RM ? 40 : Math.max(3.1, walkLen / 6);
      path.list.forEach(function (s) {
        if (s.t === 'walk') s.dur = s.len / speed;
        else if (s.t === 'stairs') s.dur = s.len / (speed * 0.75);
        else if (s.t === 'rope') s.dur = RM ? 0.3 : 0.42 + s.len / 1.9;
        else if (s.t === 'jump') s.dur = RM ? 0.3 : 1.45;
        else if (s.t === 'slide') s.dur = SLIDE_IN + SLIDE.T + SLIDE_OUT;
        else if (s.t === 'hop') s.dur = RM ? 0.2 : 0.52;
        s.dur = Math.max(s.dur, 0.05);
      });
      H.target = to;
      H.arriveCb = cb;
      if (H.mode === 'travel' && H.seg) { H.queue = path.list; }
      else { H.queue = path.list; H.mode = 'travel'; H.act = null; nextSeg(); }
    };
    H.setChar = function (c) {
      if (c === H.char) return;
      // finish any trip on the spot so the swap starts from a stop
      if (H.mode === 'travel') { H.queue = []; H.seg = null; ROPE.hold = null; nextSeg(); }
      H.char = c;
      body.setAttribute('display', c === 'astro' ? 'none' : '');
      ship.setAttribute('display', c === 'astro' ? '' : 'none');
      H.hz = c === 'astro' ? H.z : null;
      H.sq = 0;
    };
    H.root = root;
    H.ship = ship; H.walker = body;
    // the closet repaints parts through CSS variables, so live copies of the sprite follow along
    (function lookify(n) {
      n.querySelectorAll('[data-c]').forEach(function (e) {
        var k = e.getAttribute('data-c'), f = e.getAttribute('fill');
        if (f && f !== 'none') e.style.fill = 'var(--h-' + k + ',' + f + ')';
        else e.style.stroke = 'var(--h-' + k + ',' + e.getAttribute('stroke') + ')';
      });
    })(root);
    // posed copies for the closet turntable, at 0 / 45 / 90 / 135 / 180 degrees (the rest are mirrors)
    H.snapWalker = function (v) {
      v = v || 0;
      var b = H.isBack, f = H.face;
      H.isBack = v > 90; H.face = 1;
      if (v === 90) pose({ bob: 0, hx: 1.2, sx: 3.2, fL: [-1.4, 0], fR: [1.6, 0], hB: [-1, -13.5], hF: [3.4, -13.5], eF: -1.5 });
      else if (v === 45 || v === 135) pose({ bob: 0, hx: 3, sx: 6, fL: [-3.4, 0], fR: [3.2, 0], hB: [-9, -13], hF: [9, -13] });
      else pose({ bob: 0, fL: [-4, 0], fR: [4, 0], hB: [-10.5, -13], hF: [10.5, -13] });
      var c = body.cloneNode(true);
      c.removeAttribute('display');   // the walker is hidden in the city while the astronaut plays
      H.isBack = b; H.face = f;
      if (v === 90) {
        c.querySelectorAll('[data-v]').forEach(function (n) { n.setAttribute('display', n.getAttribute('data-v') === 'side' ? '' : 'none'); });
        var tq = c.querySelector('[data-part=torso]');
        tq.setAttribute('transform', (tq.getAttribute('transform') || '') + ' scale(0.62,1)');
        c.querySelectorAll('[data-part=armb]').forEach(function (n) { n.setAttribute('display', 'none'); });
      } else if (v === 45 || v === 135) {
        // three-quarter: the torso narrows, the pillow and features slide round, the far ear hides
        var th = (v === 45 ? 34 : -40) * Math.PI / 180;
        var t3 = c.querySelector('[data-part=torso]');
        t3.setAttribute('transform', (t3.getAttribute('transform') || '') + ' scale(0.86,1)');
        if (v === 135) {
          var bk = c.querySelector('[data-v=back] [data-q3]').parentNode;
          bk.setAttribute('transform', 'translate(-2.6,0)');
          c.querySelectorAll('[data-q3]').forEach(function (n) { n.removeAttribute('display'); });
          c.querySelector('[data-part=knob]').setAttribute('display', 'none');
        }
        var pl = c.querySelector('[data-part=pillow]');
        pl.setAttribute('transform', 'translate(' + (v === 45 ? 1.6 : -1.6) + ',0) ' + (pl.getAttribute('transform') || ''));
        c.querySelectorAll('[data-az]').forEach(function (n) {
          var az = +n.getAttribute('data-az') * Math.PI / 180, r = +n.getAttribute('data-r'), a = az + th;
          n.setAttribute('transform', 'translate(' + (r * (Math.sin(a) - Math.sin(az))).toFixed(2) + ',0)' + (n.getAttribute('transform') ? ' ' + n.getAttribute('transform') : ''));
          if (Math.cos(a) < -0.05) n.setAttribute('display', 'none');
        });
        c.querySelectorAll('[data-sh]').forEach(function (n) {
          n.setAttribute('transform', 'translate(' + (+n.getAttribute('data-sh') * Math.sin(th)).toFixed(2) + ',0)');
        });
      }
      return c;
    };
    H.snapShip = function (v) {
      var c = (v === 0 ? shipF : v === 180 ? shipB : ship).cloneNode(true);
      c.removeAttribute('display');
      return c;
    };
    return H;
  })();

  /* ================= KEYFRAME CREATURES ================= */
  var SHAPES = {
    linear: 'M0,-27 L13,-13.5 L0,0 L-13,-13.5 Z',
    ease: 'M-11,-26 H11 Q12.5,-26 11.5,-24 L4,-13.5 L11.5,-3 Q12.5,0 11,0 H-11 Q-12.5,0 -11.5,-3 L-4,-13.5 L-11.5,-24 Q-12.5,-26 -11,-26 Z',
    hold: 'M-11,-23 Q-11,-26 -8,-26 H8 Q11,-26 11,-23 V-3 Q11,0 8,0 H-8 Q-11,0 -11,-3 Z',
    bezier: 'M-13,-13 A13,13 0 1,0 13,-13 A13,13 0 1,0 -13,-13 Z',
    easeIn: 'M-11,-26 H1 L13,-13 L1,0 H-11 L-1,-13 Z',
    easeOut: 'M11,-26 H-1 L-13,-13 L-1,0 H11 L1,-13 Z'
  };
  var NAMES = { linear: 'LINEAR', ease: 'EASY EASE', hold: 'HOLD', bezier: 'AUTO BEZIER', easeIn: 'EASE IN', easeOut: 'EASE OUT' };
  var CRE = [
    { type: 'linear', col: C.sky, a: [6.6, 17.5], b: [9.6, 17.5], z: 1 },
    { type: 'ease', col: C.green, a: [3.6, 9.25], b: [3.6, 9.75], z: 2 },
    { type: 'hold', col: C.yellow, a: [1.45, 3.6], b: [1.45, 4.75], z: 3 },
    { type: 'bezier', col: C.pink, a: [7.5, 4.75], b: [9.6, 4.75], z: 3 },
    { type: 'easeIn', col: C.purple, a: [12.3, 3.62], b: [12.95, 3.62], z: 2 },
    { type: 'easeOut', col: C.orange, a: [12.5, 9.95], b: [12.65, 10.55], z: 1 },
    { type: 'bezier', col: C.lilac, a: [14.4, 17.3], b: [14.4, 17.75], z: 1 },
    { type: 'hold', col: C.mint, a: [8.45, 2.55], b: [9.45, 2.75], z: 4.4, small: 1 }
  ];
  function easeFn(type, u) {
    switch (type) {
      case 'linear': return u;
      case 'ease': return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      case 'hold': return u < 1 ? 0 : 1;
      case 'bezier': var c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2);
      case 'easeIn': return u * u * u;
      case 'easeOut': return 1 - Math.pow(1 - u, 3);
    }
    return u;
  }
  CRE.forEach(function (c, i) {
    var g = el('g', { 'data-cre': i }, L.actors);
    var sh = el('ellipse', { rx: 11, ry: 4, fill: 'rgba(22,22,29,.18)' }, g);
    var body = el('g', null, g);
    c.edge = coinEdge(g, body, SHAPES[c.type], shade(c.col, -0.3));
    var clipId = 'clip' + i;
    var cp = el('clipPath', { id: clipId }, defs);
    el('path', { d: SHAPES[c.type] }, cp);
    el('path', { d: SHAPES[c.type], fill: c.col }, body);
    el('rect', { x: 1, y: -30, width: 16, height: 32, fill: shade(c.col, -0.18), 'clip-path': 'url(#' + clipId + ')' }, body);
    el('path', { d: SHAPES[c.type], fill: 'none', stroke: C.ink, 'stroke-width': 2.6, 'stroke-linejoin': 'round' }, body);
    // face + highlight sit where each silhouette is widest, clear of the outline
    var FO = { ease: [0, -5, -9, -23], easeIn: [4.5, 0, -1.5, -21], easeOut: [-4.5, 0, -3, -21] }[c.type] || [0, 0, -6, -21];
    el('path', { d: 'M' + FO[2] + ',' + FO[3] + ' l2.5,-2.5', stroke: '#fff', 'stroke-width': 2.4, 'stroke-linecap': 'round', opacity: 0.9 }, body);
    var faceG = el('g', { transform: 'translate(' + FO[0] + ',' + FO[1] + ')' }, body);
    var eyes = el('g', null, faceG);
    el('ellipse', { cx: -3.8, cy: -15, rx: 1.7, ry: 2.1, fill: C.ink }, eyes);
    el('ellipse', { cx: 3.8, cy: -15, rx: 1.7, ry: 2.1, fill: C.ink }, eyes);
    var mouth = el('path', { d: 'M-2.6,-10.5 Q0,-7.8 2.6,-10.5', fill: 'none', stroke: C.ink, 'stroke-width': 1.6, 'stroke-linecap': 'round' }, faceG);
    var zz = el('text', { x: 10, y: -30, 'font-size': 10, 'font-weight': 700, fill: C.ink, display: 'none' }, body);
    zz.textContent = 'z';
    c.g = g; c.sh = sh; c.body = body; c.eyes = eyes; c.mouth = mouth; c.zz = zz;
    c.blink = 1 + Math.random() * 3; c.jump = 0; c.jh = 0.6; c.bub = null; c.near = false;
    c.sc = c.small ? 0.7 : 0.95;
    var x0 = Math.min(c.a[0], c.b[0]), x1 = Math.max(c.a[0], c.b[0]), y0 = Math.min(c.a[1], c.b[1]), y1 = Math.max(c.a[1], c.b[1]);
    if (x1 - x0 < 0.4) { x0 -= 0.12; x1 += 0.12; }
    if (y1 - y0 < 0.4) { y0 -= 0.12; y1 += 0.12; }
    c.R = [x0, x1, y0, y1];
    c.x = lerp(x0, x1, Math.random()); c.y = lerp(y0, y1, Math.random());
    c.kx = 0; c.ky = 0; c.scare = 0; c.face = Math.random() < 0.5 ? -1 : 1;
    c.st = 'idle'; c.timer = 0; c.dur = Math.random() * 2;
  });
  function rnd(a, b) { return a + Math.random() * (b - a); }
  // Each creature picks its next little action at random, with random timing.
  function pickAction(c) {
    c.timer = 0;
    if (c.st !== 'idle') { c.st = 'idle'; c.dur = rnd(0.25, 1.8); return; }
    var r = Math.random();
    // nights get rowdy: tipsy wandering and dancing to one shared beat
    if (ENV && ENV.night && r < 0.6) {
      if (r < 0.28) {
        var dx, dy, n = 0;
        do { dx = rnd(c.R[0], c.R[1]); dy = rnd(c.R[2], c.R[3]); } while (Math.hypot(dx - c.x, dy - c.y) < 0.3 && ++n < 8);
        c.st = 'drunk'; c.from = [c.x, c.y]; c.to = [dx, dy]; c.dur = rnd(1.6, 3); c.hicAt = rnd(0.3, 0.8);
      } else { c.st = 'party'; c.dur = rnd(2, 4.5); }
      return;
    }
    if (r < 0.46) {
      var tx, ty, tries = 0;
      do { tx = rnd(c.R[0], c.R[1]); ty = rnd(c.R[2], c.R[3]); } while (Math.hypot(tx - c.x, ty - c.y) < 0.35 && ++tries < 8);
      c.st = 'move'; c.from = [c.x, c.y]; c.to = [tx, ty];
      c.dur = clamp(Math.hypot(tx - c.x, ty - c.y) / rnd(0.6, 2.2), 0.35, 2.4);
    } else if (r < 0.6) { c.st = 'bounce'; c.nb = 1 + Math.floor(Math.random() * 4); c.dur = 0.28 * c.nb + rnd(0, 0.2); }
    else if (r < 0.69) { c.st = 'spin'; c.dur = rnd(0.45, 0.8); }
    else if (r < 0.78) { c.st = 'stretch'; c.dur = rnd(0.5, 0.9); }
    else if (r < 0.9) { c.st = 'look'; c.dur = rnd(0.9, 2); }
    else if (r < 0.95) { c.st = 'wiggle'; c.dur = rnd(0.5, 1); }
    else { c.st = 'sleep'; c.dur = rnd(3, 6.5); }
  }
  function updateCre(dt, t) {
    CRE.forEach(function (c) {
      c.timer += dt;
      if (c.timer >= c.dur) {
        if (c.st === 'move' || c.st === 'drunk') { c.x = c.to[0]; c.y = c.to[1]; if (c.type === 'hold' || c.type === 'easeIn') c.land = 0.25; }
        pickAction(c);
      }
      var u = clamp(c.timer / (c.dur || 1), 0, 1);
      var x = c.x, y = c.y, hop = 0, sx = 1, sy = 1 + Math.sin(t * 3 + c.R[0]) * 0.03, tilt = 0, eyesShut = false;
      if (c.st === 'move') {
        var e = easeFn(c.type, u);
        x = lerp(c.from[0], c.to[0], e); y = lerp(c.from[1], c.to[1], e);
        var sdx = P(c.to[0], c.to[1], 0)[0] - P(c.from[0], c.from[1], 0)[0];
        if (Math.abs(sdx) > 2) c.face = sdx < 0 ? -1 : 1;
        if (c.type === 'ease') hop = Math.sin(Math.PI * u) * 0.5;
        else if (c.type === 'bezier') { hop = Math.abs(Math.sin(u * Math.PI * 3)) * 0.32 * (1 - u * 0.5); tilt = 40 * e; }
        else if (c.type === 'easeIn') tilt = 12 * e;
        else if (c.type === 'easeOut') tilt = -12 * (1 - e);
        else if (c.type === 'hold') { sy += Math.sin(u * 50) * 0.03; }
        else if (c.type === 'linear') { sy += 0; }
      } else if (c.st === 'bounce') {
        var bp = u * c.nb;
        hop = Math.abs(Math.sin(bp * Math.PI)) * 0.3;
        var g0 = 1 - Math.abs(Math.sin(bp * Math.PI));
        if (g0 > 0.85) { sy *= 0.85; sx *= 1.12; }
      } else if (c.st === 'spin') {
        sx = Math.cos(u * Math.PI * 2); hop = Math.sin(u * Math.PI) * 0.22;
        if (Math.abs(sx) < 0.14) sx = sx < 0 ? -0.14 : 0.14;
      } else if (c.st === 'stretch') {
        var sp = Math.sin(u * Math.PI * 2);
        sy *= 1 + sp * 0.22; sx *= 1 - sp * 0.14;
      } else if (c.st === 'look') {
        tilt = Math.sin(u * Math.PI * 2) * 10;
        if (Math.abs(u - 0.5) < 0.01) c.face = -c.face;
      } else if (c.st === 'wiggle') {
        tilt = Math.sin(u * Math.PI * 10) * 9 * (1 - u);
      } else if (c.st === 'sleep') {
        eyesShut = true; sy = 1 + Math.sin(t * 1.6) * 0.05; tilt = 6;
      } else if (c.st === 'drunk') {
        // weaving, leaning, a hiccup halfway
        var de = u * u * (3 - 2 * u), wob = Math.sin(u * Math.PI * 5) * 0.14 * Math.sin(u * Math.PI);
        var ddx = c.to[0] - c.from[0], ddy = c.to[1] - c.from[1], dl = Math.hypot(ddx, ddy) || 1;
        x = lerp(c.from[0], c.to[0], de) - ddy / dl * wob; y = lerp(c.from[1], c.to[1], de) + ddx / dl * wob;
        var dsx = P(c.to[0], c.to[1], 0)[0] - P(c.from[0], c.from[1], 0)[0];
        if (Math.abs(dsx) > 2) c.face = dsx < 0 ? -1 : 1;
        tilt = Math.sin(t * 4.5 + c.R[0]) * 17; sy *= 1 + Math.sin(t * 9) * 0.04;
        hop = Math.abs(Math.sin(u * Math.PI * 4)) * 0.06;
        eyesShut = Math.sin(t * 2 + c.R[1]) > 0.2;
        if (c.hicAt && u > c.hicAt) { c.hicAt = 0; c.hicT = 0.7; c.jump = 0.35; c.jh = 0.3; SFX.tone(520, 0.08, 'sine', 0.03, 1.6); }
      } else if (c.st === 'party') {
        // everyone on the same beat (about 132 bpm)
        var bt = t * 2.2, bu = bt - Math.floor(bt);
        hop = Math.sin(bu * Math.PI) * 0.22;
        tilt = (Math.floor(bt) % 2 ? 1 : -1) * 13 * Math.sin(bu * Math.PI);
        if (bu < 0.12) { sy *= 0.84; sx *= 1.12; }
        if (Math.floor(bt) % 4 === 3) sx *= Math.cos(bu * Math.PI * 2) || 0.14;
        if (Math.abs(sx) < 0.14) sx = sx < 0 ? -0.14 : 0.14;
      }
      if (c.hicT > 0) c.hicT -= dt;
      if (c.land > 0) { c.land -= dt; sy *= 0.78; sx *= 1.22; }
      // knock-back from impacts, easing home
      c.kx *= Math.pow(0.05, dt); c.ky *= Math.pow(0.05, dt);
      x += c.kx; y += c.ky;
      if (c.scare > 0) c.scare -= dt;
      // react when the hero walks by
      var dh = Math.hypot(hero.x - x, hero.y - y);
      if (dh < 1.3 && !c.near) {
        c.near = true;
        if (hero.mode === 'travel') { c.jump = 0.5; c.jh = 0.6; SFX.squeak(); if (c.st === 'sleep') { c.st = 'idle'; c.timer = 0; c.dur = 0.5; } }
      }
      if (dh > 1.8) c.near = false;
      if (c.jump > 0) {
        c.jump -= dt;
        var jp = clamp(1 - c.jump / 0.6, 0, 1);
        hop += Math.sin(jp * Math.PI) * c.jh;
        sy *= 1 + Math.sin(jp * Math.PI) * 0.15; sx *= 1 - Math.sin(jp * Math.PI) * 0.1;
      }
      var gp = P(x, y, c.z), p = P(x, y, c.z + hop);
      c.sh.setAttribute('cx', gp[0].toFixed(1)); c.sh.setAttribute('cy', gp[1].toFixed(1));
      c.sh.setAttribute('rx', Math.max(4, 11 * c.sc - hop * 6).toFixed(1));
      var btf = ' scale(' + (c.face * c.sc * sx).toFixed(3) + ',' + (c.sc * sy).toFixed(3) + ') rotate(' + tilt.toFixed(1) + ',0,-13)';
      c.body.setAttribute('transform', 'translate(' + p[0].toFixed(1) + ',' + p[1].toFixed(1) + ')' + btf);
      // spinning shows the creature's thickness
      var spinOn = c.st === 'spin';
      c.edge.show(spinOn);
      if (spinOn) {
        var dep = Math.sin(u * Math.PI * 2) * 4.5 * c.sc * c.face;
        c.edge.set('translate(' + p[0].toFixed(1) + ',' + p[1].toFixed(1) + ')' + btf, dep / (c.face * c.sc * sx));
      }
      c.blink -= dt;
      var bl = eyesShut || c.blink < 0;
      if (c.blink < -0.12) c.blink = 1.2 + Math.random() * 3.8;
      var es = c.scare > 0 ? 1.45 : bl ? 0.15 : 1;
      c.eyes.setAttribute('transform', 'translate(0,-15) scale(' + (c.scare > 0 ? 1.25 : 1) + ',' + es + ') translate(0,15)');
      c.mouth.setAttribute('d', c.scare > 0 ? 'M-1.6,-9.6 a1.6,1.6 0 1,0 3.2,0 a1.6,1.6 0 1,0 -3.2,0' : 'M-2.6,-10.5 Q0,-7.8 2.6,-10.5');
      c.zz.setAttribute('display', c.st === 'sleep' ? '' : 'none');
      if (c.st === 'sleep') { var zu = (t * 0.6) % 1; c.zz.setAttribute('y', (-28 - zu * 12).toFixed(1)); c.zz.setAttribute('opacity', (1 - zu).toFixed(2)); }
      c.sx = p[0]; c.sy = p[1]; c.cx = x; c.cy = y;
      if (c.bub) {
        c.bub.t -= dt;
        c.bub.g.setAttribute('transform', 'translate(' + p[0].toFixed(1) + ',' + (p[1] - 36 * c.sc - 8).toFixed(1) + ')');
        if (c.bub.t <= 0) { c.bub.g.remove(); c.bub = null; }
      }
    });
  }
  function poke(i) {
    var c = CRE[i];
    c.jump = 0.6; c.jh = 0.7; SFX.squeak();
    if (c.st === 'sleep') { c.st = 'idle'; c.timer = 0; c.dur = 0.4; }
    if (c.bub) c.bub.g.remove();
    var g = el('g', { 'pointer-events': 'none' }, L.fx);
    var txt = NAMES[c.type] + ' KEYFRAME';
    var w = txt.length * 8 + 18;
    el('rect', { x: -w / 2 + 3, y: -22, width: w, height: 22, fill: C.ink }, g);
    el('rect', { x: -w / 2, y: -25, width: w, height: 22, fill: '#fff', stroke: C.ink, 'stroke-width': 2.5 }, g);
    el('path', { d: 'M-5,-3.5 L0,4 L5,-3.5', fill: '#fff', stroke: C.ink, 'stroke-width': 2.5, 'stroke-linejoin': 'round' }, g);
    el('text', { y: -8.5, 'text-anchor': 'middle', 'font-size': 17, fill: C.ink }, g).textContent = txt;
    c.bub = { g: g, t: 2.2 };
  }

  /* ---------- Kẹp: the v4 paperclip, hopping and dancing on top of G, M, T ---------- */
  var KEP = (function () {
    var LY = 10.35, TOP = 3.2, SC = 0.95;
    var SPOTS = [5.35, 5.85, 6.35, 7.35, 9.35, 10.35, 10.85, 11.35];
    var TOPS = [[5.1, 6.6], [7.1, 7.6], [9.1, 9.6], [10.1, 11.6]];
    var SILVER = '#c3c6ea', HOT = '#ff4a3d';
    var WIRE = 'M4,-24 V-14 a4,4 0 0 1 -8,0 V-36 a7,7 0 0 1 14,0 V-10 a10,10 0 0 1 -20,0 V-28';
    var BROWS = {
      happy: ['M-8,-34.5 q3.5,-2.6 7,-0.6', 'M1.5,-35.5 q3.5,-2.6 7,0.6'],
      scared: ['M-8,-37 q3.5,-2.6 7,-0.6', 'M1.5,-38 q3.5,-2.6 7,0.6'],
      angry: ['M-8.5,-36.5 L-1.2,-33', 'M1.2,-33.8 L8.8,-37.8']
    };
    var MOUTH = { smile: 'M-2.6,-21.6 q3,3.2 6,0', frown: 'M-2.6,-19 q3,-3.2 6,0', o: 'M-1.4,-20.3 a1.9,2.3 0 1,0 3.8,0 a1.9,2.3 0 1,0 -3.8,0' };
    var g = el('g', { 'data-kep': 1, 'pointer-events': 'none' }, L.actors);
    var sh = el('ellipse', { rx: 10, ry: 3.5, fill: 'rgba(22,22,29,.2)' }, g);
    var body = el('g', null, g);
    el('path', { d: WIRE, fill: 'none', stroke: C.ink, 'stroke-width': 5.4, 'stroke-linecap': 'round' }, body);
    var wire = el('path', { d: WIRE, fill: 'none', stroke: SILVER, 'stroke-width': 2.6, 'stroke-linecap': 'round' }, body);
    el('path', { d: WIRE, fill: 'none', stroke: '#fff', 'stroke-width': 0.9, 'stroke-linecap': 'round', opacity: 0.85, transform: 'translate(-0.5,-0.5)' }, body);
    var brows = [0, 1].map(function () { return el('path', { fill: 'none', stroke: C.ink, 'stroke-width': 2, 'stroke-linecap': 'round' }, body); });
    var eyes = [[-4.5, -28.5], [5, -29.5]].map(function (e) {
      var eg = el('g', null, body);
      el('ellipse', { cx: e[0], cy: e[1], rx: 4, ry: 3.7, fill: '#fff', stroke: C.ink, 'stroke-width': 1.4 }, eg);
      return { g: eg, c: e, pu: el('circle', { r: 1.9, fill: C.ink }, eg) };
    });
    var mouth = el('path', { stroke: C.ink, 'stroke-width': 1.6, 'stroke-linecap': 'round' }, body);
    // anger mark beside the head
    var vein = el('path', { d: 'M8,-47 q2.6,1 2.6,3.6 M15,-47 q-2.6,1 -2.6,3.6 M8,-38.5 q2.6,-1 2.6,-3.6 M15,-38.5 q-2.6,-1 -2.6,-3.6', fill: 'none', stroke: C.red, 'stroke-width': 1.9, 'stroke-linecap': 'round', display: 'none' }, body);
    var smokeG = el('g', null, g), puffs = [];

    var k = { x: SPOTS[1], st: 'idle', timer: 0, dur: 1, face: 1, h: 0, land: 0, heat: 0, blink: 2, puffT: 0, cx: SPOTS[1], sy: 0 };
    function letterOf(x) { return x < 6.85 ? 0 : x < 9.85 ? 1 : 2; }
    function lift(x) { return LET[letterOf(x)].oy || 0; }
    function onTop(x) { return TOPS.some(function (r) { return x > r[0] - 0.05 && x < r[1] + 0.05; }); }
    function next() {
      k.timer = 0;
      var r = Math.random();
      var nite = ENV && ENV.night;
      if (r < (nite ? 0.3 : 0.55)) {
        var near = SPOTS.filter(function (s) { return s !== k.x && Math.abs(s - k.x) < 2.1; });
        var pool = near.length && Math.random() < 0.7 ? near : SPOTS.filter(function (s) { return s !== k.x; });
        k.st = 'hop'; k.from = k.x; k.to = pool[Math.floor(Math.random() * pool.length)];
        var d = Math.abs(k.to - k.from);
        k.dur = 0.42 + 0.1 * d; k.hh = 0.4 + 0.22 * d; k.flip = d > 1.4 && Math.random() < 0.5;
        k.face = k.to > k.from ? 1 : -1;
      } else if (r < (nite ? 0.96 : 0.82)) { k.st = 'dance'; k.dur = nite ? 1.1 : 1.5; }
      else { k.st = 'idle'; k.dur = rnd(0.5, 1.6); }
    }
    function dust(x, oy) {
      var p = P(x, LY, TOP);
      for (var i = 0; i < 6; i++) {
        var side = i % 2 ? 1 : -1;
        var c = el('circle', { r: 2, fill: '#fff', stroke: C.ink, 'stroke-width': 1.4 }, L.fx);
        PARTS.push({ n: c, x: p[0] + side * 5, y: p[1] + oy, vx: side * rnd(25, 60), vy: -rnd(8, 30), r: 1.5 + Math.random() * 1.5, life: 0.45, max: 0.6 });
      }
    }
    function update(dt, t) {
      k.timer += dt;
      var u = clamp(k.timer / (k.dur || 1), 0, 1);
      var x = k.x, h = 0, sx = 1, sy = 1 + Math.sin(t * 4) * 0.03, rot = 0, shakeX = 0;
      var mood = 'happy', mo = 'smile', look = [Math.sin(t * 1.3) * 1.1, 0], wide = 1, oy = lift(x);
      // the hero hopping along the letters sends Kẹp leaping out of the way
      var heroOn = hero.mode === 'travel' && Math.abs(hero.y - LY) < 1.1;
      if (heroOn && Math.abs(hero.x - k.cx) < 1.6 && k.st !== 'dodge') {
        k.x = Math.abs(k.cx - nearestSpot(k.cx)) < 0.3 ? nearestSpot(k.cx) : k.cx;
        k.st = 'dodge'; k.ph = 'up'; k.timer = 0; k.h0 = k.h; k.heat = 0; u = 0;
        SFX.tone(420, 0.28, 'sine', 0.06, 2.6);
      }
      if (k.st === 'hop') {
        var a = clamp((u - 0.14) / 0.86, 0, 1), e = a * a * (3 - 2 * a);
        if (u < 0.14) { sy = 1 - 0.22 * Math.sin(u / 0.14 * Math.PI); sx = 1 + 0.15 * Math.sin(u / 0.14 * Math.PI); }
        else { sy = 1 + 0.18 * Math.sin(a * Math.PI); sx = 1 - 0.1 * Math.sin(a * Math.PI); }
        x = lerp(k.from, k.to, e); h = Math.sin(Math.PI * a) * k.hh;
        oy = lerp(lift(k.from), lift(k.to), e);
        if (k.flip) rot = 360 * e * k.face;
        look = [1.2, 0];
        if (u >= 1) { k.x = k.to; k.land = 0.2; dust(k.x, lift(k.x)); SFX.pop(); next(); }
      } else if (k.st === 'dance') {
        // two wiggle hops, then a spinning hop
        var q = u * 3, qi = Math.min(2, Math.floor(q)), qu = q - qi;
        h = Math.sin(qu * Math.PI) * [0.32, 0.28, 0.5][qi];
        rot = qi === 0 ? -14 * Math.sin(qu * Math.PI) : qi === 1 ? 16 * Math.sin(qu * Math.PI) : 360 * qu * k.face;
        var gq = 1 - Math.sin(qu * Math.PI);
        if (gq > 0.8) { sy = 0.86; sx = 1.12; } else { sy = 1.08; sx = 0.95; }
        look = [Math.sin(t * 9) > 0 ? 1.3 : -1.3, -0.5];
        if (u >= 1) next();
      } else if (k.st === 'dodge') {
        mood = 'scared'; mo = 'o'; wide = 1.3;
        if (k.ph === 'up') {
          var eu = 1 - Math.pow(1 - clamp(k.timer / 0.3, 0, 1), 3);
          h = lerp(k.h0, 2.5, eu); sy = 1.75 - 0.4 * eu; sx = 0.66 + 0.18 * eu;
          if (k.timer >= 0.3) { k.ph = 'hang'; k.timer = 0; }
        } else if (k.ph === 'hang') {
          // stretched tall as it can, peeking down at the hero passing below
          h = 2.5 + Math.sin(k.timer * 7) * 0.06; sy = 1.35 + Math.sin(t * 11) * 0.05; sx = 0.82;
          look = [clamp((hero.x - x) * 1.5, -1.6, 1.6), 1.4];
          var still = heroOn && Math.abs(hero.x - x) < 1.15;
          if ((!still && k.timer > 0.08) || k.timer > 2.6) { k.ph = 'down'; k.timer = 0; k.hd = h; }
        } else {
          var du = clamp(k.timer / 0.32, 0, 1);
          h = k.hd * (1 - du * du); sy = 1.25; sx = 0.88;
          if (du >= 1) {
            h = 0; k.land = 0.32; dust(x, oy); SFX.land();
            k.st = 'angry'; k.timer = 0; k.dur = 1.9; k.puffT = 0;
            [0, 0.22, 0.44].forEach(function (d0) { SFX.tone(130 + Math.random() * 30, 0.16, 'sawtooth', 0.03, 0.6, d0); });
          }
        }
      } else if (k.st === 'angry') {
        // glares at the hero, wire glowing hot, fuming
        mood = 'angry'; mo = 'frown';
        var hp = P(hero.x, hero.y, hero.z)[0] - P(x, LY, TOP)[0];
        if (Math.abs(hp) > 3) k.face = hp < 0 ? -1 : 1;
        look = [1.6, 0.4];
        k.heat = Math.min(1, k.heat + dt * 5);
        shakeX = Math.sin(t * 70) * 1.4 * (1 - u);
        if (u < 0.5) h = Math.abs(Math.sin(u * Math.PI * 4)) * 0.07;
        sy = 1 + Math.sin(t * 14) * 0.05; sx = 1 - Math.sin(t * 14) * 0.03;
        k.puffT -= dt;
        if (u < 0.85 && k.puffT <= 0) { k.puffT = 0.08; puff(x, oy); }
        if (u >= 1) { k.st = 'calm'; k.timer = 0; k.dur = 0.7; }
      } else if (k.st === 'calm') {
        // a long sigh, then back to smiling
        k.heat = Math.max(0, 1 - u * 1.6);
        sy = 1 - Math.sin(u * Math.PI) * 0.12; sx = 1 + Math.sin(u * Math.PI) * 0.06;
        mood = u < 0.5 ? 'angry' : 'happy'; mo = u < 0.5 ? 'frown' : 'smile';
        if (u >= 1) { k.st = 'dance'; k.timer = 0; k.dur = 1.5; }
      } else {
        if (u >= 1) next();
      }
      if (k.land > 0) { k.land -= dt; var lu = k.land / 0.32; sy *= 1 - 0.38 * lu; sx *= 1 + 0.3 * lu; }
      k.h = h; k.cx = x;
      // draw
      var gp = P(x, LY, TOP), p = P(x, LY, TOP + h);
      var bx = p[0] + shakeX, by = p[1] + oy;
      body.setAttribute('transform', 'translate(' + bx.toFixed(1) + ',' + by.toFixed(1) + ') rotate(' + rot.toFixed(1) + ',0,' + (-22 * SC * sy).toFixed(1) + ') scale(' + (k.face * SC * sx).toFixed(3) + ',' + (SC * sy).toFixed(3) + ')');
      var top = onTop(x);
      sh.setAttribute('display', top ? '' : 'none');
      sh.setAttribute('cx', gp[0].toFixed(1)); sh.setAttribute('cy', (gp[1] + lift(x)).toFixed(1));
      sh.setAttribute('rx', Math.max(3, 10 - h * 4).toFixed(1));
      wire.setAttribute('stroke', k.heat > 0 ? mix(SILVER, HOT, k.heat) : SILVER);
      vein.setAttribute('display', mood === 'angry' ? '' : 'none');
      if (mood === 'angry') vein.setAttribute('transform', 'translate(0,' + (Math.sin(t * 16) * 0.8).toFixed(1) + ')');
      brows[0].setAttribute('d', BROWS[mood][0]); brows[1].setAttribute('d', BROWS[mood][1]);
      mouth.setAttribute('d', MOUTH[mo]); mouth.setAttribute('fill', mo === 'o' ? C.ink : 'none');
      k.blink -= dt;
      var bl = k.blink < 0 && mood === 'happy';
      if (k.blink < -0.12) k.blink = 1.5 + Math.random() * 3;
      eyes.forEach(function (e) {
        var s = bl ? 0.15 : wide;
        e.g.setAttribute('transform', 'translate(' + e.c[0] + ',' + e.c[1] + ') scale(' + (wide > 1 ? 1.15 : 1) + ',' + s + ') translate(' + -e.c[0] + ',' + -e.c[1] + ')');
        e.pu.setAttribute('cx', (e.c[0] + look[0]).toFixed(1)); e.pu.setAttribute('cy', (e.c[1] + look[1] + (mood === 'angry' ? 0.6 : 0)).toFixed(1));
        e.pu.setAttribute('r', mood === 'scared' ? 1.4 : 1.9);
      });
      // smoke rising off the head, red-hot first then sooty grey
      for (var i = puffs.length - 1; i >= 0; i--) {
        var f = puffs[i];
        f.life -= dt;
        if (f.life <= 0) { f.n.remove(); puffs.splice(i, 1); continue; }
        var age = 1 - f.life / f.max;
        f.x += f.vx * dt; f.y -= (30 - age * 10) * dt; f.r = 2.2 + age * 4.5;
        f.n.setAttribute('cx', f.x.toFixed(1)); f.n.setAttribute('cy', f.y.toFixed(1)); f.n.setAttribute('r', f.r.toFixed(1));
        f.n.setAttribute('fill', mix('#ff8a5c', '#5d5d70', Math.min(1, age * 2.2)));
        f.n.setAttribute('opacity', Math.min(1, (1 - age) * 2).toFixed(2));
      }
      k.sy = gp[1] + oy;
    }
    function nearestSpot(x) { return SPOTS.reduce(function (b, s) { return Math.abs(s - x) < Math.abs(b - x) ? s : b; }, SPOTS[0]); }
    function puff(x, oy) {
      var p = P(x, LY, TOP);
      var n = el('circle', { r: 2, stroke: C.ink, 'stroke-width': 1.4 }, smokeG);
      puffs.push({ n: n, x: p[0] + rnd(-4, 6) * SC, y: p[1] + oy - 44 * SC, vx: rnd(-10, 12), life: 0.9, max: 0.9, r: 2 });
    }
    return { g: g, k: k, update: update, get x() { return k.cx; }, y: LY, get sy() { return k.sy; } };
  })();

  /* ================= TIME + SEASONS =================
     By default the clock decides: 0-6h winter, 6-12h spring, 12-18h summer, 18-24h autumn,
     and day and night take turns every 10 minutes (minutes 00-09 day, 10-19 night, ...).
     Picking a season or day/night by hand holds it, across reloads, until Auto is pressed again.
     Night recolours the world in place (so lit windows and lamps stay correctly in front of or
     behind things); actors and name tags are left at full brightness so the hero always reads. */
  var SEASONS = ['spring', 'summer', 'autumn', 'winter'];
  var ENV = (function () {
    var cityEl = svg;
    function stopG(g, o, c, a) { el('stop', { offset: o, 'stop-color': c, 'stop-opacity': a }, g); }
    var gw = el('radialGradient', { id: 'glowW' }, defs);
    stopG(gw, 0, '#fff0b8', 0.8); stopG(gw, 0.4, '#ffd36a', 0.32); stopG(gw, 1, '#ffd36a', 0);
    var gwin = el('radialGradient', { id: 'glowWin' }, defs);
    stopG(gwin, 0, '#fff4c4', 1); stopG(gwin, 0.5, '#ffd36a', 0.55); stopG(gwin, 1, '#ffd36a', 0);
    var gp = el('radialGradient', { id: 'glowPool' }, defs);
    stopG(gp, 0, '#ffe7a3', 0.6); stopG(gp, 0.55, '#ffd36a', 0.22); stopG(gp, 1, '#ffd36a', 0);

    /* ---- state ---- */
    var E = { season: 'spring', night: false, auto: true, prev: 'spring', sb: 1, ne: 0, applied: '' };
    function fromClock(d) {
      d = d || new Date();
      var h = d.getHours();
      return { season: h < 6 ? 'winter' : h < 12 ? 'spring' : h < 18 ? 'summer' : 'autumn', night: Math.floor(d.getMinutes() / 10) % 2 === 1 };
    }
    try {
      var sv = JSON.parse(localStorage.getItem('city-env') || 'null');
      if (sv && SEASONS.indexOf(sv.season) >= 0) { E.auto = false; E.season = sv.season; E.night = !!sv.night; }
    } catch (e) {}
    if (E.auto) { var c0 = fromClock(); E.season = c0.season; E.night = c0.night; }
    E.prev = E.season; E.ne = E.night ? 1 : 0;
    function save() {
      try { if (E.auto) localStorage.removeItem('city-env'); else localStorage.setItem('city-env', JSON.stringify({ season: E.season, night: E.night })); } catch (e) {}
    }

    /* ---- colour grading ---- */
    var GRADE = { spring: ['#ffd9ea', 0.06], summer: ['#fff0c0', 0.05], autumn: ['#e0893c', 0.1], winter: ['#e3ecf7', 0.17] };
    var NIGHT = [0.32, 0.34, 0.6], DUSK = [1, 0.78, 0.6];
    var PAPER = { spring: ['#f6f0ea', '#e9dde2'], summer: ['#f7f1df', '#e9dfc0'], autumn: ['#f4eadb', '#e6d3b6'], winter: ['#f3f7fc', '#d9e4f1'] };
    var NPAPER = ['#1d1c3d', '#2c2a58'];
    function parse(v) {
      if (!v || v.charAt(0) !== '#') return null;
      if (v.length === 4) return [parseInt(v[1] + v[1], 16), parseInt(v[2] + v[2], 16), parseInt(v[3] + v[3], 16)];
      if (v.length === 7) return [parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16)];
      return null;
    }
    function gradeRGB(rgb, s) { var m = GRADE[s], t = parse(m[0]); return rgb.map(function (v, i) { return v + (t[i] - v) * m[1]; }); }
    function nightMul(rgb, e) {
      var d = 0.75 * Math.sin(Math.PI * e);
      return rgb.map(function (v, i) { return v * lerp(1, NIGHT[i], e) * lerp(1, DUSK[i], d); });
    }
    var NODES = [];
    function collect(root) {
      if (!root || root.nodeType !== 1) return;
      if (root.hasAttribute('data-lit') || (root.classList && root.classList.contains('glow'))) return;
      ['fill', 'stroke', 'stop-color'].forEach(function (a) {
        var v = root.getAttribute(a), rgb = parse(v);
        if (rgb) NODES.push({ n: root, a: a, rgb: rgb, sc: root.__sc || null, ng: root.hasAttribute('data-nograde'), last: v });
      });
      for (var c = root.firstElementChild; c; c = c.nextElementSibling) collect(c);
    }
    var cache = {};
    function colourFor(nd, e, sb) {
      var a = nd.sc && nd.sc[E.prev] ? parse(nd.sc[E.prev]) : nd.rgb, b = nd.sc && nd.sc[E.season] ? parse(nd.sc[E.season]) : nd.rgb;
      var key = a.join() + '|' + b.join() + '|' + E.prev + E.season + sb + '|' + e + (nd.ng ? 'n' : '');
      var hit = cache[key];
      if (hit) return hit;
      var ga = nd.ng ? a : gradeRGB(a, E.prev), gb = nd.ng ? b : gradeRGB(b, E.season);
      var g = ga.map(function (v, i) { return v + (gb[i] - v) * sb; });
      return (cache[key] = r2h(nightMul(g, e)));
    }
    function apply(force) {
      var e = Math.round(E.ne * 30) / 30, sb = Math.round(E.sb * 10) / 10, key = e + '|' + sb + '|' + E.prev + E.season;
      if (!force && key === E.applied) return;
      E.applied = key;
      if (Object.keys(cache).length > 6000) cache = {};
      for (var i = 0; i < NODES.length; i++) {
        var nd = NODES[i], c = colourFor(nd, e, sb);
        if (c !== nd.last) { nd.n.setAttribute(nd.a, c); nd.last = c; }
      }
      // paper + grid behind everything
      var pa = PAPER[E.prev], pb = PAPER[E.season];
      var paper = mix(mix(pa[0], pb[0], sb), NPAPER[0], e), grid = mix(mix(pa[1], pb[1], sb), NPAPER[1], e);
      var rs = document.documentElement.style;
      rs.setProperty('--paper', paper); rs.setProperty('--grid', grid);
      sky.style.opacity = e.toFixed(2);
      var mc = document.querySelector('meta[name="theme-color"]');
      if (mc) mc.setAttribute('content', paper);
    }

    /* ---- sky (stars + moon) behind the city, weather canvas in front ---- */
    var sky = document.createElement('div');
    sky.className = 'nsky'; sky.setAttribute('aria-hidden', 'true');
    var R = srand(5), st = [];
    for (var i = 0; i < 90; i++) st.push(Math.round(R() * 100) + 'vw ' + Math.round(R() * 100) + 'vh 0 ' + (R() < 0.2 ? '1px' : '0') + ' rgba(255,255,255,' + (0.35 + R() * 0.6).toFixed(2) + ')');
    sky.innerHTML = '<i class="st" style="box-shadow:' + st.slice(0, 45).join(',') + '"></i><i class="st st2" style="box-shadow:' + st.slice(45).join(',') + '"></i><i class="moon"></i>';
    document.body.insertBefore(sky, svg);
    var wx = document.createElement('canvas');
    wx.className = 'wx'; wx.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(wx, svg.nextSibling);
    var cx2 = wx.getContext('2d'), CW = 0, CH = 0, DPR = 1;
    function sizeWx() { DPR = Math.min(2, window.devicePixelRatio || 1); CW = innerWidth; CH = innerHeight; wx.width = Math.round(CW * DPR); wx.height = Math.round(CH * DPR); }
    sizeWx(); addEventListener('resize', sizeWx);

    /* ---- snow on every box top, a snowy roof, seasonal tree crowns ---- */
    TOPS.forEach(function (t, i) {
      if (t.w * t.d < 0.03 || !t.after || !t.after.parentNode) return;
      var T = t.T, R2 = srand(i + 3), d = 'M' + T[0][0].toFixed(1) + ',' + (T[0][1] - 0.5).toFixed(1) + ' L' + T[1][0].toFixed(1) + ',' + T[1][1].toFixed(1);
      [[T[1], T[2]], [T[2], T[3]]].forEach(function (ed) {
        var n = Math.max(2, Math.round(Math.hypot(ed[1][0] - ed[0][0], ed[1][1] - ed[0][1]) / 9));
        for (var k = 1; k <= n; k++) {
          var u = k / n, x = lerp(ed[0][0], ed[1][0], u), y = lerp(ed[0][1], ed[1][1], u);
          var drip = k < n ? 2.5 + R2() * 2.5 + (R2() < 0.25 ? 4 : 0) : 0.5;
          var um = (k - 0.5) / n, xm = lerp(ed[0][0], ed[1][0], um), ym = lerp(ed[0][1], ed[1][1], um);
          d += ' Q' + xm.toFixed(1) + ',' + (ym + drip * 1.6).toFixed(1) + ' ' + x.toFixed(1) + ',' + (y + (k < n ? 1.2 : 0)).toFixed(1);
        }
      });
      d += ' L' + T[3][0].toFixed(1) + ',' + T[3][1].toFixed(1) + ' Z';
      var cap = el('path', { d: d, class: 'ss ss-winter', fill: '#ffffff', stroke: C.ink, 'stroke-width': 1.8, 'stroke-linejoin': 'round', 'data-nograde': 1 });
      t.after.parentNode.insertBefore(cap, t.after.nextSibling);
    });
    TREES.forEach(function (tr, i) {
      tr.crown.__sc = { spring: '#ffb6d3', summer: tr.col, autumn: i % 2 ? '#ff8a2c' : '#e5532f', winter: '#9fb6c9' };
      var R3 = srand(i + 20), bl = el('g', { class: 'ss ss-spring' }, tr.sway);
      for (var k = 0; k < 6; k++) el('circle', { cx: (R3() - 0.5) * 14, cy: -30 + (R3() - 0.5) * 14, r: 1.9, fill: '#fff', stroke: C.pink, 'stroke-width': 0.8 }, bl);
      el('path', { class: 'ss ss-winter', d: 'M-10.5,-33 Q-9,-42 0,-41.5 Q9,-42 10.5,-33 q-3,3 -5,0 q-3,3 -5.5,0 q-3,3 -5.5,0 q-2,2 -4,0 Z', fill: '#fbfdff', stroke: C.ink, 'stroke-width': 1.6, 'stroke-linejoin': 'round' }, tr.sway);
    });

    /* ---- lit windows: every window glows at night; now and then one flicks off for a moment ---- */
    var WL = [];
    WINS.forEach(function (w, i) {
      // a round lamp-style glow drawn in screen space, so it isn't squashed onto the wall's plane
      var m = svg.createSVGMatrix();
      for (var a = w.g; a && a !== L.world; a = a.parentNode) {
        var tl = a.transform && a.transform.baseVal.consolidate();
        if (tl) m = tl.matrix.multiply(m);
      }
      var sx = m.a * w.cx + m.c * w.cy + m.e, sy = m.b * w.cx + m.d * w.cy + m.f;
      var sw = Math.hypot(m.a, m.b) * w.w, sh = Math.hypot(m.c, m.d) * w.h, r = Math.max(sw, sh) * 0.95;
      var inv = m.inverse(), halo = el('g', { class: 'on-night glow', transform: 'matrix(' + [inv.a, inv.b, inv.c, inv.d, inv.e, inv.f].join(',') + ')' });
      el('circle', { cx: sx, cy: sy - sh * 0.08, r: r, fill: 'url(#glowWin)' }, halo);
      w.g.insertBefore(halo, w.n);
      w.n.classList.add('win-lit');
      WL.push({ w: w, halo: halo, on: true });
    });

    /* ---- the slide turns to ice in winter ---- */
    Array.prototype.forEach.call(svg.querySelectorAll('[data-slide]'), function (n) {
      var k = n.getAttribute('data-slide');
      n.__sc = { winter: k === 'body' ? '#bfe7ff' : k === 'hi' ? '#ffffff' : k === 'lip' ? '#e6f6ff' : null };
      if (!n.__sc.winter) delete n.__sc.winter;
    });

    collect(L.world); collect(L.over); collect(ropeO); collect(ropeI); collect(SLIDE_OVER);
    Array.prototype.forEach.call(defs.querySelectorAll('linearGradient stop, radialGradient[id^="sp"] stop'), function (s) { collect(s); });

    function classes() {
      SEASONS.forEach(function (s) { cityEl.classList.toggle('s-' + s, s === E.season); });
      cityEl.classList.toggle('night', E.ne >= 0.5);
      document.documentElement.setAttribute('data-season', E.season);
    }
    classes();
    apply(true);

    /* ---- creatures: accessories + night antics ---- */
    CRE.forEach(function (c, i) {
      var fg = c.mouth.parentNode, acc = {};
      acc.cheeks = el('g', { display: 'none' }, fg);
      el('ellipse', { cx: -6.6, cy: -11.2, rx: 2.3, ry: 1.4, fill: C.pink, opacity: 0.9 }, acc.cheeks);
      el('ellipse', { cx: 6.6, cy: -11.2, rx: 2.3, ry: 1.4, fill: C.pink, opacity: 0.9 }, acc.cheeks);
      acc.shades = el('path', { display: 'none', d: 'M-7.4,-17.2 h6 v3 q-3,2.6 -6,0 Z M1.4,-17.2 h6 v3 q-3,2.6 -6,0 Z M-1.4,-16.4 h2.8', fill: C.ink, stroke: C.ink, 'stroke-width': 1.2, 'stroke-linejoin': 'round' }, fg);
      acc.scarf = el('path', { display: 'none', d: 'M-8.5,-7.5 q8.5,3 17,0 v3.2 q-8.5,3 -17,0 Z M3,-5 l1.5,7.5 l3.5,-1 l-1.6,-7', fill: C.red, stroke: C.ink, 'stroke-width': 1.3, 'stroke-linejoin': 'round' }, fg);
      if (i % 2 === 0) {
        acc.glass = el('g', { display: 'none' }, c.body);
        el('path', { d: 'M10,-21 h11 l-5.5,6.5 Z', fill: C.pink, stroke: C.ink, 'stroke-width': 1.4, 'stroke-linejoin': 'round' }, acc.glass);
        el('path', { d: 'M15.5,-14.5 v6 M12.5,-8.5 h6', stroke: C.ink, 'stroke-width': 1.6, 'stroke-linecap': 'round' }, acc.glass);
        el('circle', { cx: 19, cy: -21, r: 1.8, fill: C.green, stroke: C.ink, 'stroke-width': 1 }, acc.glass);
      }
      acc.hic = el('text', { 'font-size': 13, fill: C.ink, stroke: '#fff', 'stroke-width': 3, 'paint-order': 'stroke', display: 'none' }, c.g);
      acc.hic.textContent = 'hic!';
      acc.state = '';
      c.acc = acc;
      c.hicT = 0;
    });
    function accState(c) {
      var s = E.season, n = E.ne >= 0.5;
      return (n ? 'n' : 'd') + s + (c.hicT > 0 ? 'h' : '');
    }
    function updateAcc(c) {
      var k = accState(c), a = c.acc;
      if (k === a.state) return;
      a.state = k;
      var n = E.ne >= 0.5;
      a.cheeks.setAttribute('display', n ? '' : 'none');
      a.shades.setAttribute('display', !n && E.season === 'summer' ? '' : 'none');
      a.scarf.setAttribute('display', E.season === 'winter' ? '' : 'none');
      if (a.glass) a.glass.setAttribute('display', n ? '' : 'none');
      a.hic.setAttribute('display', c.hicT > 0 ? '' : 'none');
    }
    function placeHic(c) {
      if (c.hicT > 0) { c.acc.hic.setAttribute('x', (c.sx + 8).toFixed(1)); c.acc.hic.setAttribute('y', (c.sy - 34 - (0.7 - c.hicT) * 14).toFixed(1)); }
    }

    /* ---- disco ball over the letters at night ---- */
    var disco = el('g', { class: 'on-night', 'pointer-events': 'none' }, L.fx);
    // it floats on its own (a string up into the sky would cut across the buildings behind it)
    var dp = P(8.35, 10.35, 6.4), ball = el('g', null, disco);
    el('circle', { class: 'glow', cx: dp[0], cy: dp[1] + 12, r: 34, fill: 'url(#glowW)' }, ball);
    el('circle', { cx: dp[0], cy: dp[1] + 12, r: 12, fill: '#c9cbe0', stroke: C.ink, 'stroke-width': 2 }, ball);
    var facets = el('g', { 'clip-path': 'url(#discoClip)' }, ball);
    var dc = el('clipPath', { id: 'discoClip' }, defs);
    el('circle', { cx: dp[0], cy: dp[1] + 12, r: 11 }, dc);
    var fc = [];
    for (var fr = 0; fr < 5; fr++) for (var fk = 0; fk < 7; fk++) fc.push(el('rect', { x: dp[0] - 14 + fk * 4.6, y: dp[1] + 1.5 + fr * 4.4, width: 3.8, height: 3.6, fill: '#fff', 'data-lit': 1 }, facets));
    var spots = [0, 1, 2, 3, 4, 5].map(function (k) { return el('ellipse', { rx: 7, ry: 3.5, fill: [C.pink, C.sky, C.yellow, C.green, C.lilac, C.orange][k], opacity: 0.55 }, disco); });

    /* ---- weather + night particles on the canvas ---- */
    // everything lives in the city's own coordinates (the camera's), inside the box around the city,
    // so dragging the view away leaves the weather behind instead of pinning it to the screen
    var parts = [], fireT = 4, fires = [], flies = [], rainOn = false, wind = 0, B = null, ks = 1;
    function wxBox() {
      if (B) return B;
      var bb = L.world.getBBox();
      if (!bb.width) return null;
      // a wide margin so a zoomed-out view still sits inside the weather, not in a patch of it
      var mx = bb.width * 0.55, my = bb.height * 0.55;
      B = { x0: bb.x - mx, y0: bb.y - my, x1: bb.x + bb.width + mx, y1: bb.y + bb.height + my };
      B.w = B.x1 - B.x0; B.h = B.y1 - B.y0;
      return B;
    }
    function want() { return { winter: 460, spring: 150, autumn: 130, summer: 50 }[E.season]; }
    function spawn(top) {
      var s = E.season, p = { s: s, x: B.x0 + Math.random() * B.w, y: top ? B.y0 - 12 : B.y0 + Math.random() * B.h, ph: Math.random() * 6.28, rot: Math.random() * 6.28 };
      if (s === 'winter') { p.r = 1.6 + Math.random() * 2.8; p.vy = 22 + p.r * 9; p.vx = 0; }
      else if (s === 'spring') { p.r = 3 + Math.random() * 2; p.vy = 26 + Math.random() * 18; p.vx = 14; p.vr = (Math.random() - 0.5) * 3; }
      else if (s === 'autumn') { p.r = 5 + Math.random() * 3; p.vy = 34 + Math.random() * 22; p.vx = 22; p.vr = (Math.random() - 0.5) * 4; p.c = ['#ff8a2c', '#e5532f', '#ffc233', '#c9682a'][Math.random() * 4 | 0]; }
      else { p.r = 1.5 + Math.random() * 2; p.vy = -6 - Math.random() * 8; p.vx = 4; p.life = 3 + Math.random() * 4; }
      return p;
    }
    function drawPart(p) {
      var c = cx2;
      c.save(); c.translate(p.x, p.y); c.scale(ks, ks);
      if (p.s === 'winter') {
        c.beginPath(); c.arc(0, 0, p.r, 0, 6.283); c.fillStyle = '#fff'; c.fill(); c.lineWidth = 1.1; c.strokeStyle = 'rgba(22,22,29,.75)'; c.stroke();
      } else if (p.s === 'spring') {
        c.rotate(p.rot); c.beginPath(); c.ellipse(0, 0, p.r, p.r * 0.55, 0, 0, 6.283); c.fillStyle = '#ffc2dc'; c.fill(); c.lineWidth = 1; c.strokeStyle = 'rgba(22,22,29,.7)'; c.stroke();
      } else if (p.s === 'autumn') {
        c.rotate(p.rot); c.scale(Math.cos(p.ph), 1);
        c.beginPath(); c.moveTo(-p.r, 0); c.quadraticCurveTo(0, -p.r * 0.9, p.r, 0); c.quadraticCurveTo(0, p.r * 0.9, -p.r, 0);
        c.fillStyle = p.c; c.fill(); c.lineWidth = 1.1; c.strokeStyle = 'rgba(22,22,29,.8)'; c.stroke();
      } else {
        var a = Math.max(0, Math.min(1, p.life)) * 0.8;
        c.beginPath(); c.arc(0, 0, p.r, 0, 6.283); c.fillStyle = 'rgba(255,240,170,' + a.toFixed(2) + ')'; c.fill();
      }
      c.restore();
    }
    function boom() {
      var x = B.x0 + B.w * (0.15 + Math.random() * 0.7), y = B.y0 + B.h * (0.05 + Math.random() * 0.25), y0 = B.y0 + B.h * 0.75;
      var col = [C.pink, C.yellow, C.sky, C.green, C.orange, C.lilac][Math.random() * 6 | 0], n = 26 + (Math.random() * 14 | 0);
      fires.push({ x: x, y: y0, ty: y, vy: -(y0 - y) / 0.9, t: 0, rise: true, col: col, n: n, sp: [] });
    }
    function drawWx(dt, t) {
      var c = cx2;
      c.setTransform(DPR, 0, 0, DPR, 0, 0);
      c.clearRect(0, 0, CW, CH);
      if (RM || !wxBox()) return;
      // draw in city space; sizes only grow gently with zoom
      c.setTransform(DPR * view.s, 0, 0, DPR * view.s, DPR * view.tx, DPR * view.ty);
      ks = 1 / Math.sqrt(Math.max(0.3, view.s));
      var vx0 = -view.tx / view.s - 20, vy0 = -view.ty / view.s - 20, vx1 = vx0 + CW / view.s + 40, vy1 = vy0 + CH / view.s + 40;
      wind = Math.sin(t * 0.13) * 0.6 + Math.sin(t * 0.41) * 0.3;
      var n = want();
      while (parts.length < n) parts.push(spawn(false));
      if (parts.length > n) parts.length = n;
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        if (p.s !== E.season) { parts[i] = spawn(false); continue; }
        p.ph += dt * 2;
        if (p.s === 'summer') { p.life -= dt; p.x += (p.vx + Math.sin(p.ph) * 6) * dt; p.y += p.vy * dt; if (p.life <= 0) { parts[i] = spawn(false); continue; } }
        else { p.x += (p.vx * (1 + wind) + Math.sin(p.ph) * (p.s === 'winter' ? 10 : 18)) * dt; p.y += p.vy * dt; if (p.vr) p.rot += p.vr * dt; }
        if (p.y > B.y1 + 12 || p.y < B.y0 - 40 || p.x > B.x1 + 20 || p.x < B.x0 - 20) { parts[i] = spawn(true); continue; }
        if (p.x > vx0 && p.x < vx1 && p.y > vy0 && p.y < vy1) drawPart(p);
      }
      // autumn: a passing drizzle every couple of minutes
      rainOn = E.season === 'autumn' && Math.sin(t / 37) > 0.45;
      if (rainOn) {
        c.strokeStyle = E.ne > 0.5 ? 'rgba(170,190,255,.55)' : 'rgba(80,110,170,.45)'; c.lineWidth = 1.4 * ks; c.beginPath();
        for (i = 0; i < 520; i++) {
          var rx = B.x0 + ((i * 97.13 + t * 260 * 0.35) % B.w), ry = B.y0 + ((i * 53.7 + t * 520) % B.h);
          c.moveTo(rx, ry); c.lineTo(rx - 4 * ks, ry + 13 * ks);
        }
        c.stroke();
      }
      // fireflies on warm nights
      var nf = E.ne > 0.5 && (E.season === 'spring' || E.season === 'summer') ? 22 : 0;
      // they live in the city (world coords) and follow the camera, so they stay put when the view is dragged away
      while (flies.length < nf) {
        var fp = P(1 + Math.random() * 20, 1 + Math.random() * 17, 0.6 + Math.random() * 1.8);
        flies.push({ x: fp[0], y: fp[1], ph: Math.random() * 6, sp: 0.6 + Math.random() });
      }
      if (flies.length > nf) flies.length = nf;
      var fr = 9 * ks;
      flies.forEach(function (f) {
        f.ph += dt * f.sp; f.x += Math.cos(f.ph * 0.7) * 14 * dt; f.y += Math.sin(f.ph) * 10 * dt;
        var fx = f.x, fy = f.y, a = 0.5 + 0.5 * Math.sin(f.ph * 3);
        var gr = c.createRadialGradient(fx, fy, 0, fx, fy, fr);
        gr.addColorStop(0, 'rgba(255,240,140,' + (0.9 * a).toFixed(2) + ')'); gr.addColorStop(1, 'rgba(255,220,90,0)');
        c.fillStyle = gr; c.beginPath(); c.arc(fx, fy, fr, 0, 6.283); c.fill();
      });
      // fireworks at night, more often in summer
      if (E.ne > 0.8) {
        fireT -= dt;
        if (fireT <= 0) { boom(); fireT = E.season === 'summer' ? 2 + Math.random() * 4 : 6 + Math.random() * 9; }
      }
      for (i = fires.length - 1; i >= 0; i--) {
        var f = fires[i];
        f.t += dt;
        if (f.rise) {
          f.y += f.vy * dt;
          c.fillStyle = '#fff3c4'; c.beginPath(); c.arc(f.x, f.y, 2.2 * ks, 0, 6.283); c.fill();
          if (f.y <= f.ty) {
            f.rise = false; f.t = 0;
            for (var k = 0; k < f.n; k++) { var an = k / f.n * 6.283, v = 90 + Math.random() * 40; f.sp.push([f.x, f.y, Math.cos(an) * v, Math.sin(an) * v]); }
            if (SFX.on) { SFX.tone(90, 0.3, 'sine', 0.035, 0.6); }
          }
        } else {
          var life = 1 - f.t / 1.6;
          if (life <= 0) { fires.splice(i, 1); continue; }
          c.fillStyle = f.col; c.globalAlpha = life;
          f.sp.forEach(function (s) {
            s[2] *= Math.pow(0.35, dt); s[3] = s[3] * Math.pow(0.35, dt) + 40 * dt;
            s[0] += s[2] * dt; s[1] += s[3] * dt;
            c.beginPath(); c.arc(s[0], s[1], 2.4 * ks, 0, 6.283); c.fill();
          });
          c.globalAlpha = 1;
        }
      }
    }

    /* ---- hero traces: footprints in snow, kicked-up leaves in autumn ---- */
    var prints = [], printT = 0, printSide = 1;
    function traces(dt) {
      for (var i = prints.length - 1; i >= 0; i--) {
        var q = prints[i];
        q.life -= dt;
        if (q.life <= 0 || prints.length > 70) { q.n.remove(); prints.splice(i, 1); continue; }
        if (q.leaf) {
          q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 160 * dt; q.r += q.vr * dt;
          if (q.y > q.gy) { q.y = q.gy; q.vx *= 0.5; q.vy = 0; q.vr = 0; }
          q.n.setAttribute('transform', 'translate(' + q.x.toFixed(1) + ',' + q.y.toFixed(1) + ') rotate(' + q.r.toFixed(0) + ')');
        }
        q.n.setAttribute('opacity', Math.min(1, q.life / 1.2).toFixed(2));
      }
      var s = hero.mode === 'travel' && hero.seg;
      if (!s || (s.t !== 'walk' && s.t !== 'stairs') || hero.char === 'astro') return;
      printT -= dt;
      if (printT > 0) return;
      printT = 0.2;
      var gp = P(hero.x, hero.y, hero.z);
      if (E.season === 'winter') {
        printSide = -printSide;
        var n = el('ellipse', { cx: (gp[0] + printSide * 3).toFixed(1), cy: (gp[1] + printSide).toFixed(1), rx: 3.4, ry: 1.8, fill: E.ne > 0.5 ? 'rgba(150,170,230,.5)' : 'rgba(110,140,185,.45)' }, L.route);
        prints.push({ n: n, life: 5 });
      } else if (E.season === 'autumn' && Math.random() < 0.6) {
        var lf = el('path', { d: 'M-4,0 q4,-4 8,0 q-4,4 -8,0 Z', fill: ['#ff8a2c', '#e5532f', '#ffc233'][Math.random() * 3 | 0], stroke: C.ink, 'stroke-width': 1 }, L.fx);
        prints.push({ n: lf, leaf: 1, life: 1.6, x: gp[0], y: gp[1] - 2, gy: gp[1] + 2, vx: (Math.random() - 0.5) * 70, vy: -60 - Math.random() * 50, r: 0, vr: (Math.random() - 0.5) * 600 });
      }
    }

    /* ---- clock + transitions ---- */
    var tickT = 0;
    function setState(season, night, instant) {
      if (season !== E.season) { E.prev = instant ? season : E.season; E.season = season; E.sb = instant ? 1 : 0; parts.length = 0; }
      if (night !== E.night) { E.night = night; if (instant) E.ne = night ? 1 : 0; }
      classes(); apply(instant); save(); ui();
    }
    function update(dt, t) {
      tickT -= dt;
      if (tickT <= 0) {
        tickT = 1;
        if (E.auto) { var c = fromClock(); if (c.season !== E.season || c.night !== E.night) setState(c.season, c.night, false); }
        if (pop && !pop.hidden) note();
      }
      var goal = E.night ? 1 : 0;
      if (E.ne !== goal) {
        E.ne = RM ? goal : goal > E.ne ? Math.min(goal, E.ne + dt / 3) : Math.max(goal, E.ne - dt / 3);
        if ((E.ne >= 0.5) !== cityEl.classList.contains('night')) classes();
      }
      if (E.sb < 1) E.sb = RM ? 1 : Math.min(1, E.sb + dt / 1.2);
      apply(false);
      // bulbs twinkle at night
      var night = E.ne >= 0.5;
      BULBS.forEach(function (b) {
        var f = night ? (b.lantern ? b.on : Math.sin(t * 3 + b.ph) > -0.35 ? b.on : shade(b.on, -0.45)) : b.off;
        if (b.f !== f) { b.n.setAttribute('fill', f); b.f = f; }
      });
      // a window now and then switches off or back on
      if (night && WL.length && Math.random() < dt * 0.15) {
        var w = WL[Math.random() * WL.length | 0];
        if (w.on) { w.on = false; w.back = 2 + Math.random() * 4; w.w.n.classList.remove('win-lit'); w.halo.style.display = 'none'; }
      }
      WL.forEach(function (w) {
        if (!w.on && (w.back -= dt) <= 0) { w.on = true; w.w.n.classList.add('win-lit'); w.halo.style.display = ''; }
      });
      if (night) {
        var sp = (t * 0.9) % 1;
        ball.setAttribute('transform', 'translate(0,' + (Math.sin(t * 1.6) * 3).toFixed(1) + ')');
        fc.forEach(function (f, k) { f.setAttribute('opacity', ((k * 7 + Math.floor(t * 8)) % 5) < 2 ? 1 : 0.35); });
        spots.forEach(function (s, k) {
          var a = t * 0.9 + k * 1.05, sx = P(8.35 + Math.cos(a) * 3.3, 10.35 + Math.sin(a) * 1.1, 3.2);
          s.setAttribute('cx', sx[0].toFixed(1)); s.setAttribute('cy', sx[1].toFixed(1));
        });
      }
      CRE.forEach(function (c) { updateAcc(c); placeHic(c); });
      traces(dt);
      drawWx(dt, t);
    }

    /* ---- UI: the button and its little panel ---- */
    var btn = document.getElementById('b-env'), pop = document.getElementById('envpop');
    var ICON = {
      day: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="3.2" fill="currentColor"/><path stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M3 13l1.4-1.4M11.6 4.4L13 3"/></svg>',
      night: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M10.2 1.2a6.8 6.8 0 1 0 4.6 11.6A5.6 5.6 0 0 1 10.2 1.2z"/></svg>',
      spring: '<svg viewBox="0 0 16 16" aria-hidden="true"><g fill="currentColor"><circle cx="8" cy="3.8" r="2.7"/><circle cx="12" cy="6.7" r="2.7"/><circle cx="10.5" cy="11.4" r="2.7"/><circle cx="5.5" cy="11.4" r="2.7"/><circle cx="4" cy="6.7" r="2.7"/></g><circle cx="8" cy="8" r="2" fill="var(--yellow)" stroke="currentColor" stroke-width="1.2"/></svg>',
      summer: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M1 8.2a7 6.4 0 0 1 14 0z"/><path stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round" d="M8 8v5.2q0 1.6-1.6 1.6T4.8 13.2"/></svg>',
      autumn: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 .8l1.6 3.4 2.7-1.1-.7 3.1 3.1-.4-2 2.6 1.6 1.2-3.5 1.1L11.3 13l-2.6-1.3-.4 3.5h-.6l-.4-3.5L4.7 13l.5-2.3-3.5-1.1 1.6-1.2-2-2.6 3.1.4-.7-3.1 2.7 1.1z"/></svg>',
      winter: '<svg viewBox="0 0 16 16" aria-hidden="true"><path stroke="currentColor" stroke-width="1.7" stroke-linecap="round" fill="none" d="M8 1v14M1.9 4.5l12.2 7M1.9 11.5l12.2-7M5.8 2.4L8 4.2l2.2-1.8M5.8 13.6L8 11.8l2.2 1.8"/></svg>',
      auto: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 4.4V8l2.6 1.7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
    };
    var NAMES_S = { spring: ['Spring', 'Xuân'], summer: ['Summer', 'Hạ'], autumn: ['Autumn', 'Thu'], winter: ['Winter', 'Đông'] };
    function bil(en, vi) { return '<span lang="en">' + en + '</span><span lang="vi">' + vi + '</span>'; }
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function note() {
      var nt = document.getElementById('env-note');
      if (!nt) return;
      if (!E.auto) { nt.innerHTML = bil('Held as you picked it. Press Auto to follow the clock again.', 'Đang giữ theo lựa chọn của bạn. Bấm Tự động để đổi theo giờ.'); return; }
      var d = new Date(), m = d.getMinutes(), nx = new Date(d.getTime());
      nx.setMinutes(m - m % 10 + 10, 0, 0);
      var nn = fromClock(nx), hh = pad(nx.getHours()) + ':' + pad(nx.getMinutes());
      var what = nn.season !== E.season ? bil(NAMES_S[nn.season][0], 'Mùa ' + NAMES_S[nn.season][1].toLowerCase()) : nn.night ? bil('Night', 'Đêm') : bil('Day', 'Ngày');
      nt.innerHTML = bil('Seasons turn every 6 hours, day and night every 10 minutes. Next: ', 'Mùa đổi mỗi 6 tiếng, ngày và đêm đổi mỗi 10 phút. Tiếp theo: ') + '<b>' + what + bil(' at ', ' lúc ') + hh + '</b>';
    }
    function ui() {
      if (!btn) return;
      btn.innerHTML = ICON[E.night ? 'night' : 'day'] + ICON[E.season];
      btn.setAttribute('aria-label', (E.night ? 'Night' : 'Day') + ', ' + NAMES_S[E.season][0] + (E.auto ? ' (auto)' : ''));
      btn.classList.toggle('manual', !E.auto);
      if (!pop) return;
      Array.prototype.forEach.call(pop.querySelectorAll('[data-night]'), function (b) { b.setAttribute('aria-pressed', String((b.getAttribute('data-night') === '1') === E.night)); });
      Array.prototype.forEach.call(pop.querySelectorAll('[data-season]'), function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-season') === E.season)); });
      var ab = pop.querySelector('[data-auto]');
      if (ab) ab.setAttribute('aria-pressed', String(E.auto));
      note();
    }
    function openPop(on) {
      if (!pop) return;
      pop.hidden = !on;
      btn.setAttribute('aria-expanded', String(on));
      if (on) { ui(); var f = pop.querySelector('[aria-pressed="true"]'); if (f) f.focus(); }
    }
    if (btn && pop) {
      Array.prototype.forEach.call(pop.querySelectorAll('[data-icon]'), function (s) { s.innerHTML = ICON[s.getAttribute('data-icon')]; });
      btn.addEventListener('click', function (e) { e.stopPropagation(); SFX.click(); openPop(pop.hidden); });
      pop.addEventListener('click', function (e) {
        e.stopPropagation();
        var b = e.target.closest('button');
        if (!b) return;
        SFX.click();
        if (b.hasAttribute('data-close')) { openPop(false); btn.focus(); return; }
        if (b.hasAttribute('data-auto')) { E.auto = true; var c = fromClock(); setState(c.season, c.night, false); return; }
        E.auto = false;
        var s = b.getAttribute('data-season') || E.season, n = b.hasAttribute('data-night') ? b.getAttribute('data-night') === '1' : E.night;
        setState(s, n, false);
      });
      document.addEventListener('click', function (e) { if (!pop.hidden && !pop.contains(e.target) && e.target !== btn) openPop(false); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !pop.hidden) { openPop(false); btn.focus(); } });
    }
    ui();

    return {
      update: update,
      get night() { return E.ne >= 0.5; },
      get season() { return E.season; },
      state: E,
      set: function (season, night) { E.auto = false; setState(season || E.season, night == null ? E.night : !!night, true); },
      auto: function () { E.auto = true; var c = fromClock(); setState(c.season, c.night, true); },
      count: function () { return NODES.length; },
      adopt: function (n) { collect(n); apply(true); }
    };
  })();

  /* ---------- clouds (screen-space parallax, inside camera) ---------- */
  var clouds = [];
  function cloud(x, y, s, sp) {
    var g = el('g', { 'pointer-events': 'none' }, L.world);
    L.world.insertBefore(g, L.world.firstChild);
    var d = 'M0,0 h16 v-8 h10 v-6 h18 v6 h8 v8 h12 v8 h-64 Z';
    el('path', { d: d, fill: '#fff', stroke: C.ink, 'stroke-width': 2.5, 'stroke-linejoin': 'round', transform: 'scale(' + s + ')' }, g);
    clouds.push({ g: g, x: x, y: y, sp: sp });
  }
  cloud(-380, -20, 1.2, 9); cloud(60, -110, 1, 6); cloud(320, 140, 1.05, 8); cloud(-260, 380, 0.9, 7);
  clouds.forEach(function (c) { ENV.adopt(c.g); });

  /* ================= CAMERA ================= */
  var view = { s: 1, tx: 0, ty: 0 }, goal = { s: 1, tx: 0, ty: 0 }, lastBg = [];
  var bbox = null, fitS = 1, follow = false, userMoved = false;
  var W = innerWidth, Hh = innerHeight;
  function topPad() { return W < 760 ? 64 : 74; }
  function botPad() { return W < 760 ? 64 : 80; }
  function computeFit() {
    W = innerWidth; Hh = innerHeight;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + Hh);
    if (!bbox) {
      var b1 = L.world.getBBox(), b2 = L.tags.getBBox();
      var x0 = Math.min(b1.x, b2.x), y0 = Math.min(b1.y, b2.y - 20), x1 = Math.max(b1.x + b1.width, b2.x + b2.width), y1 = Math.max(b1.y + b1.height, b2.y + b2.height);
      // ignore far-away clouds
      bbox = { x: Math.max(x0, -620), y: Math.max(y0, -260), w: 0, h: 0 };
      bbox.w = Math.min(x1, 700) - bbox.x; bbox.h = y1 - bbox.y;
    }
    var mW = W < 760 ? 10 : 40;
    var availW = W - mW * 2, availH = Hh - topPad() - botPad();
    fitS = Math.min(availW / bbox.w, availH / bbox.h);
  }
  function fitGoal() {
    goal.s = fitS;
    goal.tx = W / 2 - (bbox.x + bbox.w / 2) * fitS;
    goal.ty = topPad() + (Hh - topPad() - botPad()) / 2 - (bbox.y + bbox.h / 2) * fitS;
  }
  function clampGoal() {
    goal.s = clamp(goal.s, fitS * 0.85, Math.max(fitS * 5, 2.6));
    var m = 120;
    var bx0 = bbox.x * goal.s + goal.tx, bx1 = (bbox.x + bbox.w) * goal.s + goal.tx;
    var by0 = bbox.y * goal.s + goal.ty, by1 = (bbox.y + bbox.h) * goal.s + goal.ty;
    if (bx1 < m) goal.tx += m - bx1;
    if (bx0 > W - m) goal.tx -= bx0 - (W - m);
    if (by1 < m) goal.ty += m - by1;
    if (by0 > Hh - m) goal.ty -= by0 - (Hh - m);
  }
  function zoomAt(f, cx, cy) {
    var ns = clamp(goal.s * f, fitS * 0.85, Math.max(fitS * 5, 2.6));
    var k = ns / goal.s;
    goal.tx = cx - (cx - goal.tx) * k;
    goal.ty = cy - (cy - goal.ty) * k;
    goal.s = ns;
    userMoved = true;
    clampGoal();
  }
  function followTarget() {
    var p = hero.sp || P(hero.x, hero.y, hero.z);
    var cy = document.body.classList.contains('panel-open') ? (W < 760 ? Hh * 0.26 : Hh * 0.5) : Hh * 0.52;
    var cx = (!panel.hidden && W >= 760) ? (W - 470) / 2 : W / 2;
    goal.tx = cx - p[0] * goal.s;
    goal.ty = cy - (p[1] - 26) * goal.s;
  }
  function setFollow(on) {
    follow = on;
    var b = document.getElementById('z-follow');
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (on) goal.s = Math.max(goal.s, Math.min(Math.max(fitS * 2.4, 1.1), 2.2));
    SFX.click();
  }
  function applyCam(dt) {
    if (follow) followTarget();
    var k = 1 - Math.pow(0.0008, dt);
    if (RM) k = 1;
    view.s = lerp(view.s, goal.s, k); view.tx = lerp(view.tx, goal.tx, k); view.ty = lerp(view.ty, goal.ty, k);
    shake *= Math.pow(0.004, dt);
    var shx = RM ? 0 : (Math.random() - 0.5) * shake, shy = RM ? 0 : (Math.random() - 0.5) * shake;
    cam.setAttribute('transform', 'translate(' + (view.tx + shx).toFixed(2) + ',' + (view.ty + shy).toFixed(2) + ') scale(' + view.s.toFixed(4) + ')');
    // the grid paper is part of the world: it pans and zooms with the camera
    var cell = 64 * view.s;
    while (cell < 22) cell *= 2;
    var bgs = cell.toFixed(2) + 'px ' + cell.toFixed(2) + 'px', bgp = (view.tx + shx).toFixed(1) + 'px ' + (view.ty + shy).toFixed(1) + 'px';
    if (bgs !== lastBg[0] || bgp !== lastBg[1]) { document.body.style.backgroundSize = bgs; document.body.style.backgroundPosition = bgp; lastBg = [bgs, bgp]; }
  }

  /* ---------- pointer: pan, pinch, wheel, tap ---------- */
  var ptrs = {}, drag = null, pinch = null;
  function ptrCount() { return Object.keys(ptrs).length; }
  svg.addEventListener('pointerdown', function (e) {
    ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
    try { svg.setPointerCapture(e.pointerId); } catch (er) {}
    if (ptrCount() === 1) drag = { x: e.clientX, y: e.clientY, tx: goal.tx, ty: goal.ty, moved: false, target: e.target };
    else if (ptrCount() === 2) {
      var k = Object.keys(ptrs), a = ptrs[k[0]], b = ptrs[k[1]];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: goal.s, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, tx: goal.tx, ty: goal.ty };
      if (drag) drag.moved = true;
    }
  });
  svg.addEventListener('pointermove', function (e) {
    if (!ptrs[e.pointerId]) return;
    ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (pinch && ptrCount() >= 2) {
      var k = Object.keys(ptrs), a = ptrs[k[0]], b = ptrs[k[1]];
      var d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      var ns = clamp(pinch.s * d / pinch.d, fitS * 0.85, Math.max(fitS * 5, 2.6)), r = ns / pinch.s;
      goal.s = ns;
      userMoved = true;
      // while following, pinch only zooms; the camera stays on the hero
      if (follow) { view.s = goal.s; followTarget(); view.tx = goal.tx; view.ty = goal.ty; return; }
      goal.tx = mx - (pinch.mx - pinch.tx) * r;
      goal.ty = my - (pinch.my - pinch.ty) * r;
      view.s = goal.s; view.tx = goal.tx; view.ty = goal.ty;
    } else if (drag) {
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) > 6) { drag.moved = true; svg.classList.add('panning'); if (follow) setFollow(false); }
      if (drag.moved) {
        goal.tx = drag.tx + dx; goal.ty = drag.ty + dy;
        clampGoal();
        view.tx = goal.tx; view.ty = goal.ty;
        userMoved = true;
      }
    }
  });
  function endPtr(e) {
    var wasTap = drag && !drag.moved && ptrCount() === 1;
    var tgt = drag && drag.target;
    delete ptrs[e.pointerId];
    if (ptrCount() < 2) pinch = null;
    if (ptrCount() === 0) {
      svg.classList.remove('panning');
      if (wasTap && e.type === 'pointerup') tap(tgt);
      drag = null;
    }
  }
  svg.addEventListener('pointerup', endPtr);
  svg.addEventListener('pointercancel', endPtr);
  svg.addEventListener('wheel', function (e) {
    e.preventDefault();
    var f = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0016));
    zoomAt(f, e.clientX, e.clientY);
  }, { passive: false });
  function tap(t) {
    if (!t || !t.closest) return;
    var cre = t.closest('[data-cre]');
    if (cre) { poke(+cre.getAttribute('data-cre')); return; }
    if (t.closest('[data-arcade]')) { openArcade(); return; }
    var z = t.closest('[data-zone]');
    if (z) go(+z.getAttribute('data-zone'));
  }

  document.getElementById('z-in').addEventListener('click', function () { SFX.click(); zoomAt(1.35, W / 2, Hh / 2); });
  document.getElementById('z-out').addEventListener('click', function () { SFX.click(); zoomAt(1 / 1.35, W / 2, Hh / 2); });
  document.getElementById('z-fit').addEventListener('click', function () { SFX.click(); if (follow) setFollow(false); fitGoal(); userMoved = false; });
  document.getElementById('z-follow').addEventListener('click', function () { setFollow(!follow); if (!follow) { userMoved = true; } });

  /* ================= STATE / UI ================= */
  var state = { here: null, next: 0, seen: {} };
  var panel = document.getElementById('panel');
  var pxBody = document.getElementById('px-body');
  var pxFile = document.getElementById('px-file');
  var pxNextName = document.getElementById('px-next-name');
  var routeOl = document.getElementById('route');
  var hint = document.getElementById('hint');
  var content = document.getElementById('content');
  content.querySelectorAll('[id]').forEach(function (n) { n.removeAttribute('id'); });

  var lbl = document.createElement('li');
  lbl.innerHTML = '<span class="lbl">ROUTE</span>';
  lbl.className = 'rl';
  routeOl.appendChild(lbl);
  var chips = ZONES.map(function (z, i) {
    var li = document.createElement('li');
    var b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = z.n + ' <span class="nm"><span lang="en">' + z.en + '</span><span lang="vi">' + z.vi + '</span></span>';
    b.setAttribute('aria-label', z.n + ' ' + z.en);
    b.addEventListener('click', function () { go(i); });
    li.appendChild(b);
    routeOl.appendChild(li);
    return b;
  });
  // the first <li> is the label; its connector dash would look odd
  lbl.style.setProperty('--x', 0);

  function refreshChips() {
    chips.forEach(function (b, i) {
      b.classList.toggle('here', state.here === i && hero.mode !== 'travel');
      b.classList.toggle('next', state.next === i && hero.mode !== 'travel');
      b.classList.toggle('seen', !!state.seen[i]);
      b.setAttribute('aria-current', state.here === i ? 'location' : 'false');
    });
  }
  function zoneName(i) {
    var vi = document.documentElement.getAttribute('data-lang') === 'vi';
    return ZONES[i].n + ' ' + (vi ? ZONES[i].vi : ZONES[i].en);
  }

  // Touching the cabinet opens the games straight away; the hero strolls home behind the window.
  function openArcade() {
    SFX.click();
    if (!hint.classList.contains('off')) hint.classList.add('off');
    closePanel(true);
    if (window.GMTArcade) GMTArcade.open();
    if (state.here !== 0 || hero.mode === 'travel') { drawAnts(null, null); hero.travel(0, function () { state.here = 0; state.seen[0] = 1; state.next = 1; refreshChips(); drawAnts(0, 1); }); }
  }
  function go(i) {
    SFX.click();
    if (window.GMTArcade && document.body.classList.contains('arcade-open')) GMTArcade.close();
    if (!hint.classList.contains('off')) hint.classList.add('off');
    closePanel(true);
    drawAnts(null, null);
    hero.travel(i, function () { arrive(i); });
    refreshChips();
  }
  function arrive(i) {
    state.here = i; state.seen[i] = 1;
    state.next = (i + 1) % ZONES.length;
    refreshChips();
    drawAnts(i, state.next);
    setTimeout(function () { if (hero.mode === 'idle' && state.here === i) openPanel(i); }, 380);
  }

  function openPanel(i) {
    var src = content.querySelector('[data-zone="' + i + '"]');
    pxBody.innerHTML = '';
    pxBody.appendChild(src.cloneNode(true));
    pxBody.scrollTop = 0;
    pxFile.textContent = ZONES[i].file;
    panel.setAttribute('aria-label', zoneName(i));
    var nx = (i + 1) % ZONES.length;
    pxNextName.innerHTML = (nx === 0 ? '↺ ' : '') + ZONES[nx].n + ' <span lang="en">' + ZONES[nx].en + '</span><span lang="vi">' + ZONES[nx].vi + '</span>';
    panel.hidden = false;
    fitPanel();
    panel.classList.remove('pop'); void panel.offsetWidth; panel.classList.add('pop');
    document.body.classList.add('panel-open');
    SFX.open();
    // keep the hero visible above the bottom sheet on phones
    if (W < 760 && !follow) {
      var hp = hero.sp || P(hero.x, hero.y, hero.z);
      var sy = hp[1] * goal.s + goal.ty, room = panel.offsetTop - 20;
      var sx = hp[0] * goal.s + goal.tx;
      if (sy > room) goal.ty -= sy - room * 0.75;
      if (sx < 40 || sx > W - 40) goal.tx += W / 2 - sx;
    }
    pxBody.querySelectorAll('[data-go]').forEach(function (b) { b.addEventListener('click', function () { go(+b.getAttribute('data-go')); }); });
    var f = pxBody.querySelector('form[data-mailto]');
    if (f) f.addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(f);
      var subject = 'Motion — ' + (fd.get('name') || '');
      var body = (fd.get('msg') || '') + '\n\n— ' + (fd.get('name') || '') + ' <' + (fd.get('email') || '') + '>';
      window.location.href = 'mailto:gmttuts@gmail.com?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
    });
  }
  // Make the window fit its content without scrolling: go two-column when there
  // is room, then shrink the content a little as a last resort.
  function fitPanel() {
    var art = pxBody.firstElementChild;
    if (!art) return;
    panel.classList.remove('wide');
    art.style.zoom = '';
    function over() { return pxBody.scrollHeight - pxBody.clientHeight > 0; }
    if (over() && innerWidth >= 900) panel.classList.add('wide');
    var k = 1;
    var minK = innerWidth < 760 ? 0.8 : 0.72;
    while (over() && k > minK) { k -= 0.04; art.style.zoom = k.toFixed(2); }
  }
  window.addEventListener('resize', function () { if (!panel.hidden) fitPanel(); });
  function closePanel(silent) {
    if (panel.hidden) return;
    panel.hidden = true;
    document.body.classList.remove('panel-open');
    if (!silent) SFX.close();
  }
  document.getElementById('px-close').addEventListener('click', function () { closePanel(); });
  document.getElementById('px-next').addEventListener('click', function () { go(((state.here == null ? -1 : state.here) + 1) % ZONES.length); });
  document.getElementById('px-prev').addEventListener('click', function () { go(((state.here == null ? 1 : state.here) - 1 + ZONES.length) % ZONES.length); });
  document.addEventListener('keydown', function (e) {
    if (e.target.closest && e.target.closest('input,textarea')) return;
    if (document.body.classList.contains('arcade-open')) return;
    if (document.body.classList.contains('charsel-open')) {
      if (e.key === 'Escape') closeCharsel();
      else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && document.activeElement && document.activeElement.classList.contains('cs-card')) { var cs = charsel.querySelectorAll('.cs-card'); cs[e.key === 'ArrowRight' ? 1 : 0].focus(); e.preventDefault(); }
      return;
    }
    if (e.key === 'Escape') closePanel();
    else if (e.key === 'ArrowRight' || e.key === 'n') go(state.here == null ? 0 : (state.here + 1) % ZONES.length);
    else if (e.key === 'ArrowLeft' || e.key === 'p') go(state.here == null ? 0 : (state.here - 1 + ZONES.length) % ZONES.length);
    else if (e.key === '+' || e.key === '=') zoomAt(1.25, W / 2, Hh / 2);
    else if (e.key === '-') zoomAt(0.8, W / 2, Hh / 2);
    else if (e.key === 'f') setFollow(!follow);
  });

  // language + sound
  function applyLang(l) {
    document.documentElement.setAttribute('data-lang', l);
    document.documentElement.lang = l;
    try { localStorage.setItem('lang', l); } catch (e) {}
    layoutTags();
  }
  document.getElementById('b-lang').addEventListener('click', function () {
    SFX.click();
    applyLang(document.documentElement.getAttribute('data-lang') === 'vi' ? 'en' : 'vi');
  });
  var bs = document.getElementById('b-sound');
  function soundUI() { bs.setAttribute('aria-pressed', SFX.on ? 'true' : 'false'); bs.querySelector('.w').style.display = SFX.on ? '' : 'none'; }
  bs.addEventListener('click', function () { SFX.set(!SFX.on); soundUI(); SFX.click(); });
  soundUI();

  /* ================= CHARACTER SELECT + CLOSET ================= */
  var charsel = document.getElementById('charsel');
  function savedChar() { try { return localStorage.getItem('city-char'); } catch (e) { return null; } }
  // bump CS_VER when the closet gets something new: anyone who saw an older one gets it opened once more
  var CS_VER = 2;
  function seenVer() { try { return +localStorage.getItem('city-cs-ver') || 0; } catch (e) { return CS_VER; } }
  function T(en, vi) { return '<span lang="en">' + en + '</span><span lang="vi">' + vi + '</span>'; }
  var LOOK0 = { skin: '#f8c0a2', hair: 'curly', hairc: '#262d4a', eyes: 'dot', shirt: '#ffffff', pants: '#262d4a', acc: 'none', pet: 'bear', mount: 'bear', helm: 'classic' };
  var CLOSET = [
    { k: 'skin', en: 'Skin', vi: 'Da', sw: ['#ffe3d1', '#f8c0a2', '#e5a37c', '#c4834f', '#965c37', '#5e3a24'] },
    { k: 'pet', en: 'Pillow', vi: 'Gối cổ', only: 'walk', ch: [['bear', 'Bear', 'Gấu'], ['cat', 'Cat', 'Mèo'], ['bunny', 'Bunny', 'Thỏ'], ['frog', 'Frog', 'Ếch'], ['panda', 'Panda', 'Gấu trúc']] },
    { k: 'mount', en: 'Ride', vi: 'Thú cưỡi', only: 'astro', ch: [['bear', 'Bear', 'Gấu'], ['cat', 'Cat', 'Mèo'], ['bunny', 'Bunny', 'Thỏ'], ['frog', 'Frog', 'Ếch'], ['panda', 'Panda', 'Gấu trúc']] },
    { k: 'hair', en: 'Hair', vi: 'Tóc', only: 'walk', ch: [['curly', 'Curly', 'Xoăn'], ['straight', 'Straight', 'Thẳng'], ['long', 'Long', 'Dài'], ['bun', 'Bun', 'Búi']] },
    { k: 'helm', en: 'Helmet', vi: 'Mũ bay', only: 'astro', ch: [['classic', 'Antenna', 'Ăng-ten'], ['star', 'Star', 'Ngôi sao'], ['ears', 'Cat ears', 'Tai mèo'], ['gold', 'Gold visor', 'Kính vàng']] },
    { k: 'hairc', en: 'Colour', vi: 'Màu tóc', sw: ['#262d4a', '#16161d', '#6b3f26', '#e0a84a', '#ff7eb9', '#6d5cf0', '#e9e5dc'] },
    { k: 'eyes', en: 'Face', vi: 'Mặt', ch: [['dot', 'Classic', 'Cơ bản'], ['happy', 'Smiley', 'Cười híp'], ['sparkle', 'Sparkly', 'Long lanh'], ['freckle', 'Freckles', 'Tàn nhang']] },
    { k: 'shirt', en: 'Top', vi: 'Áo', sw: ['#ffffff', '#ffc933', '#ff7eb9', '#3db8ff', '#3fcf8e', '#ff6b2c', '#16161d'] },
    { k: 'pants', en: 'Pants', vi: 'Quần', sw: ['#262d4a', '#3d8bff', '#6b3f26', '#3fcf8e', '#c9b6ff', '#16161d', '#e9e5dc'] },
    { k: 'acc', en: 'Extra', vi: 'Phụ kiện', ch: [['none', 'None', 'Không'], ['glasses', 'Glasses', 'Kính'], ['shades', 'Shades', 'Kính râm'], ['cap', 'Cap', 'Mũ', 'walk'], ['phones', 'Headphones', 'Tai nghe', 'walk'], ['flower', 'Flower', 'Hoa cài', 'walk']] }
  ];
  function loadLook() {
    var o = {}, k;
    try { o = JSON.parse(localStorage.getItem('city-look')) || {}; } catch (e) {}
    var L2 = {};
    for (k in LOOK0) L2[k] = o[k] || LOOK0[k];
    return L2;
  }
  var look = loadLook();
  function lum(c) { var r = h2r(c); return (r[0] * 0.3 + r[1] * 0.59 + r[2] * 0.11) / 255; }
  // a look is a handful of CSS variables plus three switches; anything that holds a sprite copy can wear it
  // pal colours: body, inner ear, muzzle, ear
  var PALC = { bear: ['#a3563b', '#5e2f1f', '#fff7ee', '#a3563b'], cat: ['#f29a3a', '#ff9fb0', '#fff7ee', '#f29a3a'], bunny: ['#f1ece4', '#ff9fb0', '#ffffff', '#f1ece4'], frog: ['#5fc35a', '#ff9fb0', '#bff0a8', '#5fc35a'], panda: ['#f1ece4', '#16161d', '#ffffff', '#16161d'] };
  function wear(n, lk) {
    n.setAttribute('data-pet', lk.pet);
    n.setAttribute('data-mount', lk.mount);
    [['pet', lk.pet], ['mnt', lk.mount]].forEach(function (a) {
      var c = PALC[a[1]] || PALC.bear;
      n.style.setProperty('--h-' + a[0], c[0]);
      n.style.setProperty('--h-' + a[0] + 'in', c[1]);
      n.style.setProperty('--h-' + a[0] + 'mz', c[2]);
      n.style.setProperty('--h-' + a[0] + 'ear', c[3]);
      n.style.setProperty('--h-' + a[0] + 'hi', lum(c[0]) > 0.8 ? shade(c[0], -0.1) : shade(c[0], 0.2));
    });
    n.setAttribute('data-hair', lk.hair);
    n.setAttribute('data-helm', lk.helm);
    n.setAttribute('data-eyes', lk.eyes);
    n.setAttribute('data-acc', lk.acc);
    var st = n.style;
    st.setProperty('--h-skin', lk.skin);
    st.setProperty('--h-hair', lk.hairc);
    st.setProperty('--h-hairhi', lum(lk.hairc) > 0.6 ? shade(lk.hairc, -0.25) : shade(lk.hairc, 0.18));
    st.setProperty('--h-shirt', lk.shirt);
    st.setProperty('--h-sleeve', lum(lk.shirt) > 0.9 ? C.sleeve : shade(lk.shirt, lum(lk.shirt) > 0.3 ? -0.14 : 0.2));
    st.setProperty('--h-pants', lk.pants);
    st.setProperty('--h-cuff', lum(lk.pants) > 0.7 ? shade(lk.pants, -0.2) : shade(lk.pants, 0.2));
    st.setProperty('--h-shoe', lum(lk.pants) > 0.7 ? C.navy : shade(lk.pants, -0.12));
  }
  wear(hero.root, look);

  var opts = document.getElementById('cs-opts');
  opts.innerHTML = CLOSET.map(function (g) {
    // the last swatch opens the system colour picker for any colour
    var b = g.sw ? g.sw.map(function (c) { return '<button type="button" class="cs-sw" data-k="' + g.k + '" data-v="' + c + '" style="--sw:' + c + '" aria-label="' + g.en + ' ' + c + '"></button>'; })
        .concat('<label class="cs-sw cs-cust" data-ck="' + g.k + '"><input type="color" data-ck="' + g.k + '" aria-label="' + g.en + ': custom colour"></label>')
      : g.ch.map(function (c) { return '<button type="button" class="cs-chip" data-k="' + g.k + '" data-v="' + c[0] + '"' + (c[3] ? ' data-only="' + c[3] + '"' : '') + '>' + T(c[1], c[2]) + '</button>'; });
    return '<div class="cs-row"' + (g.only ? ' data-only="' + g.only + '"' : '') + '><span class="cs-lab">' + T(g.en, g.vi) + '</span><div class="cs-ch" role="group">' + b.join('') + '</div></div>';
  }).join('');
  function syncOpts() {
    opts.querySelectorAll('[data-k]').forEach(function (b) { b.setAttribute('aria-pressed', look[b.getAttribute('data-k')] === b.getAttribute('data-v') ? 'true' : 'false'); });
    opts.querySelectorAll('label[data-ck]').forEach(function (lb) {
      var k = lb.getAttribute('data-ck'), v = look[k], own = !CLOSET.some(function (g) { return g.k === k && g.sw.indexOf(v) >= 0; });
      lb.classList.toggle('on', own);
      lb.style.setProperty('--sw', v);
      lb.firstChild.value = v;
    });
  }
  function setLook(lk, quiet) {
    look = lk;
    try { localStorage.setItem('city-look', JSON.stringify(look)); } catch (e) {}
    wear(hero.root, look);
    charsel.querySelectorAll('.cs-pv svg, .cs-view svg').forEach(function (n) { wear(n, look); });
    syncOpts();
    if (!quiet) SFX.pop();
  }
  opts.addEventListener('click', function (e) {
    var b = e.target.closest('[data-k]');
    if (!b) return;
    var lk = {}, k;
    for (k in look) lk[k] = look[k];
    lk[b.getAttribute('data-k')] = b.getAttribute('data-v');
    setLook(lk);
  });
  function custom(e, done) {
    var k = e.target.getAttribute && e.target.getAttribute('data-ck');
    if (!k || e.target.tagName !== 'INPUT') return;
    var lk = {}, n;
    for (n in look) lk[n] = look[n];
    lk[k] = e.target.value;
    setLook(lk, !done);
  }
  opts.addEventListener('input', function (e) { custom(e, false); });
  opts.addEventListener('change', function (e) { custom(e, true); });
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  document.getElementById('cs-rand').addEventListener('click', function () {
    var lk = {};
    CLOSET.forEach(function (g) { lk[g.k] = g.sw ? pick(g.sw) : pick(g.ch)[0]; });
    setLook(lk);
  });
  document.getElementById('cs-reset').addEventListener('click', function () {
    var lk = {}, k;
    for (k in LOOK0) lk[k] = LOOK0[k];
    setLook(lk);
  });

  // the small card previews are live copies of the two sprites
  function fillPreviews() {
    [['walk', hero.snapWalker(0), '-30 -64 60 70'], ['astro', hero.snapShip(90), '-46 -64 92 70']].forEach(function (a) {
      var host = charsel.querySelector('[data-pv="' + a[0] + '"]');
      host.innerHTML = '';
      var sv = el('svg', { viewBox: a[2], 'aria-hidden': 'true' }, host);
      wear(sv, look);
      var c = a[1];
      c.removeAttribute('display');
      el('g', null, sv).appendChild(c);
    });
  }

  // turntable: eight directions like a game sprite sheet. 0/45/90/135/180 are drawn, 225-315 are their mirrors;
  // each step snaps to the next drawing with a little squash so it reads as a turn
  var TT = { kind: 'walk', th: 0, auto: true, drag: null, raf: 0, last: 0, acc: 0, pop: 9, cur: -1, views: [], wrap: null };
  var csView = document.getElementById('cs-view');
  function buildStage() {
    csView.innerHTML = '';
    charsel.querySelector('.cs-stage').setAttribute('data-k', TT.kind);
    charsel.setAttribute('data-kind', TT.kind);
    var walk = TT.kind === 'walk';
    var sv = el('svg', { viewBox: walk ? '-30 -66 60 72' : '-44 -70 88 80', 'aria-hidden': 'true' }, csView);
    wear(sv, look);
    el('ellipse', { class: 'cs-floor', cx: 0, cy: walk ? 1.5 : 4, rx: walk ? 15 : 20, ry: walk ? 4 : 5 }, sv);
    TT.wrap = el('g', null, sv);
    TT.views = [0, 45, 90, 135, 180].map(function (d) {
      var g = el('g', { display: 'none' }, TT.wrap);
      g.appendChild(walk ? hero.snapWalker(d) : hero.snapShip(d));
      return g;
    });
    TT.cur = -1;
    render();
  }
  // the rocket only has front, side and back drawings, so it turns in quarter steps; the walker in eighths
  function stepDeg() { return TT.kind === 'walk' ? 45 : 90; }
  function render() {
    var st = stepDeg(), idx = ((Math.round(TT.th / st) * st / 45 % 8) + 8) % 8, base = idx <= 4 ? idx : 8 - idx;
    if (idx !== TT.cur) {
      if (TT.cur >= 0) TT.pop = 0;
      TT.cur = idx;
      TT.views.forEach(function (g, i) { g.setAttribute('display', i === base ? '' : 'none'); });
    }
    var k = Math.max(0, 1 - TT.pop / 0.12), pop = 1 - 0.07 * k * k;
    var bob = TT.kind === 'walk' ? 0 : Math.sin(TT.last * 3) * 1.5;
    TT.wrap.setAttribute('transform', 'translate(0,' + bob.toFixed(2) + ') scale(' + ((idx > 4 ? -1 : 1) * pop).toFixed(3) + ',1)');
  }
  function ttLoop(now) {
    if (charsel.hidden) { TT.raf = 0; return; }
    var dt = Math.min(0.05, (now - (TT.t0 || now)) / 1000);
    TT.t0 = now; TT.last += dt; TT.pop += dt;
    if (TT.auto && !TT.drag) { TT.acc += dt; if (TT.acc > (RM ? 1.2 : TT.kind === 'walk' ? 0.36 : 0.6)) { TT.acc = 0; TT.th = Math.round(TT.th / stepDeg()) * stepDeg() + stepDeg(); } }
    TT.th = ((TT.th % 360) + 360) % 360;
    render();
    TT.raf = requestAnimationFrame(ttLoop);
  }
  function setAuto(v) { TT.auto = v; document.getElementById('cs-spin').setAttribute('aria-pressed', v ? 'true' : 'false'); }
  function nudge(step) {
    setAuto(false);
    var st = stepDeg();
    TT.th = Math.round(TT.th / st) * st + (step > 0 ? st : -st);
    TT.th = ((TT.th % 360) + 360) % 360;
    render();
    SFX.click();
  }
  document.getElementById('cs-left').addEventListener('click', function () { nudge(-45); });
  document.getElementById('cs-right').addEventListener('click', function () { nudge(45); });
  document.getElementById('cs-spin').addEventListener('click', function () { TT.acc = 0; setAuto(!TT.auto); SFX.click(); });
  csView.addEventListener('pointerdown', function (e) {
    TT.drag = { x: e.clientX, th: TT.th, moved: 0 };
    try { csView.setPointerCapture(e.pointerId); } catch (er) {}
  });
  csView.addEventListener('pointermove', function (e) {
    if (!TT.drag) return;
    var dx = e.clientX - TT.drag.x;
    TT.drag.moved = Math.max(TT.drag.moved, Math.abs(dx));
    if (TT.drag.moved > 3) setAuto(false);
    TT.th = TT.drag.th + dx * 0.9 * stepDeg() / 45;
  });
  function endDrag() { TT.drag = null; }
  csView.addEventListener('pointerup', endDrag);
  csView.addEventListener('pointercancel', endDrag);

  function selectKind(c) {
    TT.kind = c;
    charsel.querySelectorAll('.cs-card').forEach(function (b) { b.classList.toggle('sel', b.getAttribute('data-char') === c); });
    buildStage();
  }
  function openCharsel() {
    closePanel(true);
    fillPreviews();
    syncOpts();
    charsel.querySelectorAll('.cs-card').forEach(function (b) { b.classList.toggle('current', b.getAttribute('data-char') === hero.char); });
    charsel.hidden = false;
    TT.th = 0; TT.acc = 0; setAuto(true);
    selectKind(hero.char);
    charsel.classList.remove('pop'); void charsel.offsetWidth; charsel.classList.add('pop');
    document.body.classList.add('charsel-open');
    var cur = charsel.querySelector('.cs-card.current') || charsel.querySelector('.cs-card');
    try { cur.focus({ preventScroll: true }); } catch (e) {}
    if (!TT.raf) { TT.t0 = 0; TT.raf = requestAnimationFrame(ttLoop); }
    SFX.open();
  }
  function closeCharsel() {
    if (charsel.hidden) return;
    charsel.hidden = true;
    document.body.classList.remove('charsel-open');
    try { if (!savedChar()) localStorage.setItem('city-char', hero.char); localStorage.setItem('city-cs-ver', CS_VER); } catch (e) {}
  }
  function pickChar(c) {
    var changed = c !== hero.char;
    hero.setChar(c);
    try { localStorage.setItem('city-char', c); } catch (e) {}
    closeCharsel();
    if (changed) { SFX.pop(); impact(hero.x, hero.y, hero.z, 0.3); }
    else SFX.click();
  }
  charsel.querySelectorAll('.cs-card').forEach(function (b) { b.addEventListener('click', function () { if (TT.kind !== b.getAttribute('data-char')) { selectKind(b.getAttribute('data-char')); SFX.click(); } }); });
  document.getElementById('cs-play').addEventListener('click', function () { pickChar(TT.kind); });
  document.getElementById('cs-close').addEventListener('click', function () { SFX.click(); closeCharsel(); });
  document.getElementById('b-char').addEventListener('click', function () { SFX.click(); openCharsel(); });

  /* ================= LOOP ================= */
  var last = performance.now(), simT = 0, paused = false;
  function frame(now) {
    var dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (!paused) step(dt);
    requestAnimationFrame(frame);
  }
  function step(dt) {
    simT += dt;
    var t = RM ? simT * 0.25 : simT;
    for (var i = 0; i < anims.length; i++) anims[i](t, dt);
    hero.update(dt, t);
    updateCre(dt, t);
    KEP.update(dt, t);
    ENV.update(dt, t);
    drawRope(dt);
    updatePads(dt);
    updateParts(dt);
    clouds.forEach(function (c) {
      c.x += c.sp * dt; if (c.x > 520) c.x = -560;
      c.g.setAttribute('transform', 'translate(' + c.x.toFixed(1) + ',' + c.y + ')');
    });
    // depth-sort actors (hero + creatures) by screen y
    // on the move the hero rides above everything, name tags included; parked, it sorts by its ground spot
    var flying = hero.mode === 'travel';
    if ((frameN++ & 7) === 0 || flying !== (heroWrap.parentNode === L.sky)) {
      var list = CRE.map(function (c) { return { n: c.g, y: c.sy || 0, x: c.x, wy: c.y }; });
      list.push({ n: KEP.g, y: KEP.sy, x: KEP.x, wy: KEP.y });
      if (flying) {
        if (heroWrap.parentNode !== L.sky) L.sky.appendChild(heroWrap);
        // the moving hero rides above everything, except a creature standing nearer the viewer
        // close by on screen: that one is lifted above the hero until it's passed
        list = list.filter(function (it, i) {
          var front = it.x + it.wy > hero.x + hero.y + 0.25 && Math.abs((it.x - it.wy) - (hero.x - hero.y)) < 1.6;
          if (front) { L.sky.appendChild(it.n); return false; }
          return true;
        });
      }
      else list.push({ n: heroWrap, y: hero.char === 'astro' ? P(hero.x, hero.y, hero.z)[1] : (hero.sp ? hero.sp[1] : 0) + (hero.mode === 'travel' && hero.seg && hero.seg.t === 'rope' ? 60 : 0) });
      list.sort(function (a, b) { return a.y - b.y; });
      list.forEach(function (it) { L.actors.appendChild(it.n); });
    }
    lampsFront();
    if (hero.mode === 'travel') refreshChipsLazy();
    applyCam(dt);
  }
  var frameN = 0;
  // wrap hero + its shadow so they sort together
  var heroWrap = el('g', null, L.actors);
  heroWrap.appendChild(L.actors.querySelector('ellipse'));
  heroWrap.appendChild(hero.root);
  var lazy = 0;
  function refreshChipsLazy() { if (++lazy % 20 === 0) refreshChips(); }

  function init() {
    layoutTags();
    computeFit(); fitGoal();
    var sc = savedChar();
    if (sc === 'astro' || sc === 'walk') hero.setChar(sc);
    hero.update(0, 0);
    // phones start close up on the hero; zooming keeps following, dragging lets go
    if (W < 760) {
      follow = true;
      document.getElementById('z-follow').setAttribute('aria-pressed', 'true');
      goal.s = Math.min(Math.max(fitS * 2.4, 1.1), 2.2);
      followTarget();
    }
    view.s = goal.s; view.tx = goal.tx; view.ty = goal.ty;
    if (!sc || seenVer() < CS_VER) openCharsel();
    refreshChips();
    drawAnts(null, null);
    requestAnimationFrame(frame);
  }
  window.addEventListener('resize', function () {
    var wasFit = !userMoved;
    computeFit();
    if (wasFit && !follow) fitGoal(); else clampGoal();
  });
  // the label boxes are measured from the text, so measure again whenever a font file lands
  if (document.fonts) {
    if (document.fonts.ready) document.fonts.ready.then(layoutTags);
    if (document.fonts.load) document.fonts.load('24px VT323', 'Post Office Bưu điện ▶ ARCADE').then(layoutTags, function () {});
    if (document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', layoutTags);
  }
  setTimeout(layoutTags, 1200); setTimeout(layoutTags, 3500);
  init();

  window.GMTCity = { lookAt: function (x, y, z, sc) { var p = P(x, y, z || 0); if (sc) goal.s = sc; goal.tx = W / 2 - p[0] * goal.s; goal.ty = Hh / 2 - p[1] * goal.s; userMoved = true; }, env: ENV, kep: KEP, sfx: SFX, openArcade: openArcade, cre: CRE, boxes: BOXES, edges: function () { var out = []; ADJ.forEach(function (l, u) { l.forEach(function (e) { if (u < e.to) out.push({ a: GN[u], b: GN[e.to], t: e.t, u: u, v: e.to }); }); }); return out; }, P: P, pause: function (v) { paused = v; }, tick: function (sec) { for (var i = 0; i < sec * 60; i++) step(1 / 60); }, go: go, hero: hero, setFollow: setFollow, zoomAt: zoomAt, openCharsel: openCharsel, pickChar: pickChar, setLook: setLook, look: function () { return look; }, turn: function (d) { setAuto(false); TT.th = d; TT.pop = 9; render(); TT.pop = 9; render(); }, follow: function () { return follow; } };
})();
