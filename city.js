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
    return el('path', { d: d, fill: fill || C.ink, stroke: C.ink, 'stroke-width': 1.5, 'vector-effect': 'non-scaling-stroke' }, g);
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
  function slab(g, x, y, w, d, z, col) {
    box(g, x, y, z - 0.25, w, d, 0.25, col);
    if (w * d > 2.2) {
      var cx = x + w / 2 - 0.15, cy = y + d / 2 - 0.15;
      box(g, cx, cy, 0, 0.3, 0.3, z - 0.25, col);
    }
  }

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
    el('circle', { cx: 0, cy: -30, r: 11, fill: col, stroke: C.ink, 'stroke-width': 2 }, sway);
    el('path', { d: 'M-5,-35 q3,-4 7,-3', stroke: '#fff', 'stroke-width': 2.2, fill: 'none', 'stroke-linecap': 'round', opacity: 0.8 }, sway);
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
    { p: [13.5, 4.75, 2] },
    { p: [13.5, 9.82, 1], t: 'jump' },
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
    var c = t === 'rope' ? len * 1.6 : t === 'jump' ? 4 : t === 'hop' ? 0.9 : t === 'stairs' ? len * 1.3 : len;
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

  /* draw list sorted by depth */
  var items = [];
  function item(key, fn) { items.push({ k: key, f: fn }); }

  // the loop's bridges + stairs
  item(2 + 16.5 + 0.1, function (g) { slab(g, 2, 16.2, 4, 1, 1, C.orange); slab(g, 2, 14, 1, 2.2, 1, C.orange); });
  item(2.5 + 13, function (g) { stairs(g, 'y', 14, 12, 2, 1, 2, C.green); });
  item(2.5 + 8, function (g) { slab(g, 2, 7, 1, 2, 2, C.green); });
  item(2.5 + 6, function (g) { stairs(g, 'y', 7, 5, 2, 2, 3, C.purple); });
  item(11 + 3.5, function (g) { stairs(g, 'x', 10, 12, 3.6, 3, 2, C.yellow); });
  item(13.5 + 13.5, function (g) { slab(g, 13, 12, 1, 3, 1, C.pink); });
  item(11 + 16.5, function (g) { slab(g, 10, 16.2, 2, 1, 1, C.lilac); });

  ZONES.forEach(function (z, i) {
    var b = z.b;
    item(b[0] + b[2] / 2 + b[1] + b[3] / 2, function (g) {
      var zg = el('g', { 'data-zone': i }, g);
      box(zg, b[0], b[1], 0, b[2], b[3], b[4], z.col, { grid: true });
      // arches on the tall faces
      var fl = el('g', { transform: faceL(b[0], b[1], 0, b[2], b[3], b[4]) }, zg);
      var fr = el('g', { transform: faceR(b[0], b[1], 0, b[2], b[3], b[4]) }, zg);
      for (var k = 0; k < b[2]; k++) if (b[4] >= 1) arch(fl, k + 0.32, b[4] - 0.85, 0.36, 0.6, shade(z.col, -0.55));
      for (k = 0; k < b[3]; k++) if (b[4] >= 2 && k !== 1) arch(fr, k + 0.32, 0.35, 0.36, 0.6, shade(z.col, -0.6));
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
      pad(g, 13.25, 4.56, 2);
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
      pad(g, 13.25, 9.62, 1);
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
        lg.setAttribute('transform', 'translate(0,' + (o * 6 + L0.dip + quake(x0 + wcols * vx / 2, ly) * 1.5).toFixed(1) + ')');
        shadow.setAttribute('rx', (30 + o * 4).toFixed(1));
      });
    });
  });

  /* ---------- floating shapes ---------- */
  function floater(key, fn) { item(key, fn); }
  [[9.6, 6.2, 1.0, C.pink], [15.8, 7.2, 1.6, C.yellow], [16.2, 13.5, 2.2, C.sky], [4.2, 19.2, 1.8, C.green], [5.6, 0.6, 4.6, C.orange]].forEach(function (f, i) {
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
  floater(20, function (g) { sphere(g, 16.6, 4.6, 2.6, 11, C.lilac, 2); });
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
    return {
      step: function () { tone(150 + Math.random() * 50, 0.045, 'triangle', 0.035); },
      open: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.08, 'square', 0.03, 0, i * 0.055); }); },
      close: function () { tone(520, 0.1, 'square', 0.03, 0.5); },
      click: function () { tone(700, 0.035, 'square', 0.025); },
      boing: function () { tone(180, 0.38, 'sine', 0.09, 3.2); },
      land: function () { tone(110, 0.12, 'triangle', 0.08, 0.5); noise(0.08, 0.05, 500); },
      zip: function () { noise(0.5, 0.05, 2400); },
      grab: function () { tone(330, 0.07, 'square', 0.03, 1.5); },
      thud: function () { tone(70, 0.3, 'sine', 0.14, 0.5); noise(0.2, 0.09, 300); },
      squeak: function () { tone(880 + Math.random() * 300, 0.12, 'sine', 0.06, 1.7); },
      pop: function () { tone(260, 0.06, 'square', 0.04, 2.5); },
      tone: tone,
      get on() { return on; },
      set: function (v) { on = v; try { localStorage.setItem('city-sound', v ? '1' : '0'); } catch (e) {} if (v) ac(); }
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
          if ((prev < 0) !== (Math.sin(H.phase) < 0)) SFX.step();
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
    { type: 'easeIn', col: C.purple, a: [14.65, 4.75], b: [14.65, 3.3], z: 2 },
    { type: 'easeOut', col: C.orange, a: [12.4, 11.1], b: [12.6, 11.8], z: 1 },
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
        if (c.st === 'move') { c.x = c.to[0]; c.y = c.to[1]; if (c.type === 'hold' || c.type === 'easeIn') c.land = 0.25; }
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
      }
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
      var list = CRE.map(function (c) { return { n: c.g, y: c.sy || 0 }; });
      if (flying) { if (heroWrap.parentNode !== L.sky) L.sky.appendChild(heroWrap); }
      else list.push({ n: heroWrap, y: hero.char === 'astro' ? P(hero.x, hero.y, hero.z)[1] : (hero.sp ? hero.sp[1] : 0) + (hero.mode === 'travel' && hero.seg && hero.seg.t === 'rope' ? 60 : 0) });
      list.sort(function (a, b) { return a.y - b.y; });
      list.forEach(function (it) { L.actors.appendChild(it.n); });
    }
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

  window.GMTCity = { sfx: SFX, openArcade: openArcade, cre: CRE, boxes: BOXES, edges: function () { var out = []; ADJ.forEach(function (l, u) { l.forEach(function (e) { if (u < e.to) out.push({ a: GN[u], b: GN[e.to], t: e.t, u: u, v: e.to }); }); }); return out; }, P: P, pause: function (v) { paused = v; }, tick: function (sec) { for (var i = 0; i < sec * 60; i++) step(1 / 60); }, go: go, hero: hero, setFollow: setFollow, zoomAt: zoomAt, openCharsel: openCharsel, pickChar: pickChar, setLook: setLook, look: function () { return look; }, turn: function (d) { setAuto(false); TT.th = d; TT.pop = 9; render(); TT.pop = 9; render(); }, follow: function () { return follow; } };
})();
