/* GMT City · the Motion God easter egg. Loaded on demand by city.js when the rocket, on star power,
   is clicked up past the top of the screen. Draws with clones of the site's own sprites. */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg', H = GMTCity.hero;
  var INK = '#16161d', YEL = '#ffc933', ORA = '#ff6b2c';
  function el(t, a, p) { var e = document.createElementNS(NS, t); for (var k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; }
  function wrap(p) {
    var w = el('g', {}, p);
    [].slice.call(H.root.attributes).forEach(function (a) { if (/^data-|^style$/.test(a.name)) w.setAttribute(a.name, a.value); });
    if (H.char === 'cloud') w.setAttribute('class', 'cloud');
    return w;
  }
  // a posed copy of the site's walker. o: { x, y, s, rot, look: { '--h-shirt': ... }, noPillow }
  function walker(p, o) {
    var w = wrap(p), c = H.snapWalker(0);
    w.appendChild(c);
    if (o.look) for (var k in o.look) w.style.setProperty(k, o.look[k]);
    if (o.noPillow) c.querySelector('[data-part=pillow]').setAttribute('display', 'none');
    w.setAttribute('transform', 'translate(' + o.x + ',' + o.y + ') rotate(' + (o.rot || 0) + ',0,-24) scale(' + (o.flip ? -o.s : o.s) + ',' + o.s + ')');
    return w;
  }
  function ship(p, o) {
    var w = wrap(p), c = H.ship.cloneNode(true);
    c.removeAttribute('display'); w.appendChild(c);
    w.setAttribute('transform', 'translate(' + o.x + ',' + o.y + ') rotate(' + (o.rot || 0) + ') scale(' + o.s + ')');
    if (o.op != null) w.setAttribute('opacity', o.op);
    return w;
  }
  function puff(p, x, y, r, f, st) { return el('circle', { cx: x, cy: y, r: r, fill: f || '#fff', stroke: st || 'none', 'stroke-width': 2 }, p); }
  function cloudBank(p, x, y, w, r, f, st) {
    var g = el('g', {}, p);
    for (var i = 0; i <= w; i += r * 0.9) puff(g, x + i, y - Math.sin(i * 0.05 + x) * r * 0.35, r * (0.8 + 0.3 * Math.sin(i * 0.13 + y)), f, st);
    el('rect', { x: x - r, y: y, width: w + 2 * r, height: r * 2, fill: f || '#fff' }, g);
    return g;
  }
  // iso buildings half sunk in the clouds: the city's own palette, washed out with distance
  function platform(p, x, y, w) {
    var g = el('g', { transform: 'translate(' + x + ',' + y + ')' }, p);
    el('path', { d: 'M-4,4 h' + (w + 8) + ' l-10,30 l' + (-w * 0.2) + ',26 l' + (-w * 0.22) + ',30 l' + (-w * 0.2) + ',-24 l' + (-w * 0.2) + ',-34 Z', fill: '#8a5a44', stroke: INK, 'stroke-width': 3, 'stroke-linejoin': 'round' }, g);
    for (var i = 14; i < w - 10; i += 24) el('path', { d: 'M' + i + ',16 l8,10 M' + (i + 10) + ',34 l-6,10', stroke: '#5e3a2b', 'stroke-width': 2.4, 'stroke-linecap': 'round' }, g);
    el('path', { d: 'M-6,6 Q-6,-8 10,-8 H' + (w - 10) + ' Q' + (w + 6) + ',-8 ' + (w + 6) + ',6 Z', fill: '#4fc66a', stroke: INK, 'stroke-width': 3, 'stroke-linejoin': 'round' }, g);
    for (i = 6; i < w; i += 14) el('path', { d: 'M' + i + ',6 l3,8 l3,-8', fill: '#4fc66a', stroke: INK, 'stroke-width': 1.6, 'stroke-linejoin': 'round' }, g);
    el('path', { d: 'M4,-3 H' + (w * 0.6), stroke: '#9df0a8', 'stroke-width': 3, 'stroke-linecap': 'round' }, g);
    return g;
  }
  // a hazy floating island in the distance (no outline, tinted toward the sky)
  function farIsland(p, x, y, s, op) {
    var g = el('g', { transform: 'translate(' + x + ',' + y + ') scale(' + s + ')', opacity: op }, p);
    el('path', { d: 'M-40,0 L40,0 L28,26 L10,60 L-6,38 L-26,22 Z', fill: '#8ea6d8' }, g);
    el('path', { d: 'M-44,2 Q-44,-10 -30,-10 H30 Q44,-10 44,2 Z', fill: '#7fcfb7' }, g);
    return g;
  }
  function star(p, x, y, s, f) { return el('path', { d: 'M0,-14 L4,-4 L14,-4 L6,3 L9,13 L0,7 L-9,13 L-6,3 L-14,-4 L-4,-4 Z', transform: 'translate(' + x + ',' + y + ') scale(' + s + ')', fill: f || YEL, stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' }, p); }
  function sparkle(p, x, y, s, f) { return el('path', { d: 'M0,-10 L2.4,-2.4 L10,0 L2.4,2.4 L0,10 L-2.4,2.4 L-10,0 L-2.4,-2.4 Z', transform: 'translate(' + x + ',' + y + ') scale(' + s + ')', fill: f || '#fff' }, p); }

  var root = null, W = 0, Hh = 0, KS = 1, HOST = null;
  function stage(bgTop, bgBot) {
    if (root) root.remove();
    W = innerWidth; Hh = innerHeight; KS = Math.min(Hh / 800, W / 760);
    root = el('svg', { viewBox: '0 0 ' + W + ' ' + Hh, style: 'position:absolute;inset:0;width:100%;height:100%;background:' + (bgBot || '#bfe6ff') }, HOST);
    var d = el('defs', {}, root);
    var lg = el('linearGradient', { id: 'mkSky', x1: 0, y1: 0, x2: 0, y2: 1 }, d);
    el('stop', { offset: 0, 'stop-color': bgTop || '#4fa8ec' }, lg); el('stop', { offset: 1, 'stop-color': bgBot || '#cdeeff' }, lg);
    var rg = el('radialGradient', { id: 'mkGlow' }, d);
    el('stop', { offset: 0, 'stop-color': '#fffbe0', 'stop-opacity': 0.95 }, rg); el('stop', { offset: 0.5, 'stop-color': '#ffd23f', 'stop-opacity': 0.4 }, rg); el('stop', { offset: 1, 'stop-color': '#ffd23f', 'stop-opacity': 0 }, rg);
    var bl = el('filter', { id: 'mkBlur' }, d); el('feGaussianBlur', { stdDeviation: 3 }, bl);
    el('rect', { width: W, height: Hh, fill: 'url(#mkSky)' }, root);
    return root;
  }
  // the cloud realm, v3. Everything behind the actors is flat and outline-free (only the actors and what they
  // stand on carry the ink line, like the city): sky -> a far range of cloud hills -> hazy floating islands ->
  // a nearer bank of cumulus -> the sea of cloud the scene floats on. Each step back gets bluer and paler.
  var BASE = 0.64;   // where GMT's island and the God's cloud both rest
  function haze(r, op) { el('rect', { width: W, height: Hh, fill: '#dcefff', opacity: op }, r); }
  function hills(r, y, rad, col, ph) {
    var g = el('g', {}, r);
    for (var x = -rad; x < W + rad; x += rad * 1.1) puff(g, x, y - Math.abs(Math.sin(x * 0.004 + ph)) * rad * 0.9, rad * (0.9 + 0.35 * Math.sin(x * 0.011 + ph)), col);
    el('rect', { x: 0, y: y, width: W, height: Hh - y, fill: col }, g);
    return g;
  }
  // a row of cloud tops drawn as one shape: every puff's outline first, then every fill on top
  function seaU(r, y, rad, fill, ph, k) {
    var g = el('g', {}, r), cs = [];
    for (var x = -rad; x < W + rad; x += rad * 1.1) cs.push([x, y - Math.abs(Math.sin(x * 0.004 + ph)) * rad * 0.9, rad * (0.9 + 0.35 * Math.sin(x * 0.011 + ph))]);
    cs.forEach(function (c) { puff(g, c[0], c[1], c[2] + 2.5 * k, STY.line); });
    el('rect', { x: 0, y: y, width: W, height: Hh - y, fill: STY.line }, g);
    cs.forEach(function (c) { puff(g, c[0], c[1], c[2], fill); });
    el('rect', { x: 0, y: y + 2, width: W, height: Hh - y, fill: fill }, g);
    return g;
  }
  // handles on the layers that keep moving while the scene plays (see live())
  var LIVE = null;
  function realm(bg) {
    var r = stage(bg && bg.sky ? bg.sky[0] : '#5fb6f2', bg && bg.sky ? bg.sky[1] : '#e6f5ff'), k = KS;
    LIVE = { high: [], hills: [], shafts: [], sea: [], sun: null };
    LIVE.sun = puff(r, W * 0.8, Hh * 0.14, 190 * k, 'url(#mkGlow)');
    // high clouds, warm underneath
    [[0.1, 0.13, 2.2], [0.46, 0.07, 1.5], [0.9, 0.2, 2.6]].forEach(function (c) {
      var g = el('g', { transform: 'translate(' + W * c[0] + ',' + Hh * c[1] + ') scale(' + c[2] * k + ')' }, r);
      LIVE.high.push({ g: g, x: W * c[0], y: Hh * c[1], s: c[2] * k, ph: c[0] * 7 });
      [[-40, 6, 26], [-12, -6, 32], [22, -2, 28], [48, 8, 20]].forEach(function (q) { puff(g, q[0], q[1] + 5, q[2], '#ffe0ec'); puff(g, q[0], q[1], q[2], '#fff'); });
    });
    // far range of cloud hills on the horizon
    if (bg && bg.far) bg.far(r, k);
    LIVE.hills.push(hills(r, Hh * 0.5, 70 * k, '#eef6ff', 1.2));
    haze(r, 0.25);
    if (bg && bg.mid) bg.mid(r, k);
    // hazy floating islands, small and pale with distance
    [[0.07, 0.3, 0.7], [0.2, 0.42, 0.45], [0.38, 0.24, 0.35], [0.56, 0.36, 0.5], [0.95, 0.33, 0.6]].forEach(function (f) { farIsland(r, W * f[0], Hh * f[1], f[2] * k, 0.7); });
    LIVE.hills.push(hills(r, Hh * 0.58, 58 * k, '#f6faff', 3.1));
    haze(r, 0.12);
    if (bg && bg.near) bg.near(r, k);
    // light shafts
    LIVE.shafts.push(el('path', { d: 'M' + W * 0.62 + ',0 L' + W * 0.48 + ',' + Hh + ' L' + W * 0.66 + ',' + Hh + ' L' + W * 0.7 + ',0 Z', fill: '#fff', opacity: 0.16 }, r));
    LIVE.shafts.push(el('path', { d: 'M' + W * 0.74 + ',0 L' + W * 0.7 + ',' + Hh + ' L' + W * 0.78 + ',' + Hh + ' L' + W * 0.77 + ',0 Z', fill: '#fff', opacity: 0.12 }, r));
    // the sea of cloud the scene floats on, with a pale rim so it reads as a surface
    if (bg && bg.near2) bg.near2(r, k);
    LIVE.sea.push(seaU(r, Hh * 0.8, 52 * k, '#ffffff', 0.4, k));
    // a second, closer row of cloud tops and soft blue troughs so the bottom isn't a flat white slab
    LIVE.sea.push(seaU(r, Hh * 0.92, 44 * k, '#f7fbff', 2.2, k));
    for (var i = 0; i < 7; i++) el('ellipse', { cx: W * (0.07 + i * 0.15), cy: Hh * (0.86 + (i % 2) * 0.02), rx: 70 * k, ry: 9 * k, fill: '#e4effb', opacity: 0.8 }, r);
    return r;
  }
  function frontClouds(r) { var g = el('g', { filter: 'url(#mkBlur)', opacity: 0.9 }, r); cloudBank(g, -80, Hh * 0.97, W + 160, 46, '#fff'); return g; }

  // Motion God: the same GMT a thousand years on, riding a cloud. Hair gone white, a beard to the belt,
  // a cape, a keyframe staff, a halo of light. Built on the site's walker so the face is the hero's.
  function motionGod(p, x, y, s, pose) {
    var g = el('g', { transform: 'translate(' + x + ',' + y + ') scale(' + s + ')' }, p);
    var point = pose === 'point';
    g.__glow = puff(g, 0, -40, 70, 'url(#mkGlow)');
    // halo + rays
    var rays = g.__rays = el('g', { opacity: 0.8 }, g);
    for (var i = 0; i < 12; i++) { var a = i * Math.PI / 6; el('path', { d: 'M' + (Math.cos(a) * 18).toFixed(1) + ',' + (-39 + Math.sin(a) * 18).toFixed(1) + ' L' + (Math.cos(a) * 34).toFixed(1) + ',' + (-39 + Math.sin(a) * 34).toFixed(1), stroke: '#fff3b0', 'stroke-width': 2.4, 'stroke-linecap': 'round' }, rays); }
    el('circle', { cx: 0, cy: -39, r: 19, fill: 'none', stroke: YEL, 'stroke-width': 2.4 }, g);
    // cape behind the body
    var cape = g.__cape = el('g', {}, g);
    el('path', { d: 'M-11,-31 Q-30,-14 -38,8 Q-20,4 -12,12 Q0,8 12,12 Q20,4 38,8 Q30,-14 11,-31 Z', fill: '#5a3fb3', stroke: INK, 'stroke-width': 1.6, 'stroke-linejoin': 'round' }, cape);
    el('path', { d: 'M-38,8 Q-20,4 -12,12 Q0,8 12,12 Q20,4 38,8', fill: 'none', stroke: YEL, 'stroke-width': 1.8 }, cape);
    var w = walker(g, { x: 0, y: 0, s: 1, look: { '--h-hair': '#f6f6f2', '--h-hairhi': '#d6d6d0', '--h-pet': '#9a8a80', '--h-petear': '#9a8a80', '--h-petmz': '#e8e2da', '--h-shirt': '#f4ecff', '--h-sleeve': '#e2d6ff', '--h-pants': '#5a3fb3', '--h-cuff': '#7a63cf' } });
    // beard down to the belt, bushy brows, glowing lenses
    // a long wavy beard that splits into two curls at the tip, with a moustache over the mouth
    el('path', { d: 'M-10,-35 Q-13,-24 -9,-16 Q-6,-9 -8,-3 Q-4,-6 -2,-1 Q0,-5 2,-1 Q4,-6 8,-3 Q6,-9 9,-16 Q13,-24 10,-35 Q5,-30 0,-31 Q-5,-30 -10,-35 Z', fill: '#fbfbf8', stroke: INK, 'stroke-width': 1.3, 'stroke-linejoin': 'round' }, g);
    el('path', { d: 'M-5,-26 q2,4 0,8 M0,-27 q2,5 0,10 M5,-26 q-2,4 0,8', fill: 'none', stroke: '#d6d6cf', 'stroke-width': 1 }, g);
    el('path', { d: 'M-8,-33.5 Q-4,-36.5 0,-34 Q4,-36.5 8,-33.5 Q4,-31.5 0,-32.5 Q-4,-31.5 -8,-33.5 Z', fill: '#fbfbf8', stroke: INK, 'stroke-width': 1.1, 'stroke-linejoin': 'round' }, g);
    el('path', { d: 'M-10,-43.5 q4,-3 8,-0.5 M2,-44 q4,-2.5 8,0.5', fill: 'none', stroke: '#fbfbf8', 'stroke-width': 2.6, 'stroke-linecap': 'round' }, g);
    el('path', { d: 'M-10,-43.5 q4,-3 8,-0.5 M2,-44 q4,-2.5 8,0.5', fill: 'none', stroke: INK, 'stroke-width': 0.6, 'stroke-linecap': 'round', opacity: 0.5 }, g);
    sparkle(g, -4.5, -39.5, 0.35, '#fffbe0'); sparkle(g, 5, -40, 0.35, '#fffbe0');
    // keyframe staff: upright in his right hand, or thrust out from his left hand straight at GMT
    var sp = point ? { d: 'M-8,-12 L-50,-34', tip: [-55, -37] } : { d: 'M17,8 V-46', tip: [17, -52] };
    // the upright staff sits in its own group, pivoting on his hand, so he can twirl it
    var stf = g.__staff = el('g', {}, g);
    el('path', { d: sp.d, stroke: INK, 'stroke-width': 4.4, 'stroke-linecap': 'round' }, stf);
    el('path', { d: sp.d, stroke: '#b07a3a', 'stroke-width': 2.2, 'stroke-linecap': 'round' }, stf);
    g.__tipGlow = puff(stf, sp.tip[0], sp.tip[1], point ? 22 : 11, 'url(#mkGlow)');
    g.__tipR = point ? 22 : 11;
    var gem = el('g', { transform: 'translate(' + sp.tip[0] + ',' + sp.tip[1] + ') rotate(' + (point ? -62 : 0) + ')' }, stf);
    el('path', { d: 'M0,-8 L7,0 L0,8 L-7,0 Z', fill: YEL, stroke: INK, 'stroke-width': 1.6, 'stroke-linejoin': 'round' }, gem);
    el('path', { d: 'M0,-5 L4,0 L0,5 L-4,0 Z', fill: '#fff6c8' }, gem);
    if (point) el('circle', { cx: -10, cy: -13, r: 3, fill: SKIN, stroke: INK, 'stroke-width': 1.2 }, g);
    // the cloud he rides: drawn exactly like every other cloud here, one clean outline, shade underneath
    g.__ride = cloudShape(g, [[-22, 6, 8], [-11, 2, 10], [2, 1, 11], [15, 3, 10], [26, 7, 7.5], [-14, 11, 8], [0, 12, 9], [14, 11, 8], [32, 10, 4.5], [37, 8, 3.4], [41, 5, 2.6]], '#fff', '#e3edfb', STY.line, 0.55);
    // keyframe diamonds orbiting him: the power he hands over
    g.__kf = [[-34, -36], [-30, -6], [36, -44], [30, -14]].map(function (k, i) { return { x: k[0], y: k[1], s: 0.55 + (i % 2) * 0.25, n: el('path', { d: 'M0,-5 L5,0 L0,5 L-5,0 Z', transform: 'translate(' + k[0] + ',' + k[1] + ') scale(' + (0.55 + (i % 2) * 0.25) + ')', fill: YEL, stroke: INK, 'stroke-width': 1.2 }, g) }; });
    g.__sp = [[-30, -60, 0.6], [34, -20, 0.5], [-36, -14, 0.45, '#fff3b0']].map(function (q) { return { x: q[0], y: q[1], s: q[2], n: sparkle(g, q[0], q[1], q[2], q[3]) }; });
    return g;
  }

  var STY = { line: '#a9bfdc', lw: 1.5 };   // one outline for every cloud: soft blue-grey, or INK
  function cloudShape(p, puffs, fill, shadeCol, line, lw) {
    var g = el('g', {}, p);
    puffs.forEach(function (c) { puff(g, c[0], c[1], c[2] + (line === undefined ? 1.5 : lw || 1.5), line === undefined ? INK : line); });
    puffs.forEach(function (c) { puff(g, c[0], c[1], c[2], fill || '#fff'); });
    if (shadeCol) puffs.forEach(function (c) { if (c[1] >= 4) el('ellipse', { cx: c[0], cy: c[1] + c[2] * 0.55, rx: c[2] * 0.6, ry: c[2] * 0.26, fill: shadeCol }, g); });
    return g;
  }
  var STAND = 'ease';
  // what GMT stands on: the grass island, or a relic of the old keyframes rising out of the clouds
  function pedestal(r, kind, x, y, k) {
    var g = el('g', {}, r), S0 = '#d9d1c1', S1 = '#bdb3a2', S2 = '#9d9383', ln = { stroke: INK, 'stroke-width': 3 * k, 'stroke-linejoin': 'round' };
    function shape(d, sc, ty) {
      var sg = el('g', { transform: 'translate(' + x + ',' + (y + ty) + ') scale(' + sc + ')' }, g);
      el('path', { d: d, fill: S1, transform: 'translate(2.2,0)' }, sg);
      el('path', { d: d, fill: S0, stroke: INK, 'stroke-width': 3 * k / sc, 'stroke-linejoin': 'round' }, sg);
      return sg;
    }
    if (kind === 'ease') {
      // the Easy Ease hourglass, turned to stone; its flat top is the stage
      var sg = shape(KF.ease, 9.6 * k, 26 * 9.6 * k);
      el('path', { d: 'M-4,-14 q2,1.4 4,0 M1,-14 q2,1.4 4,0', fill: 'none', stroke: S2, 'stroke-width': 0.5, 'stroke-linecap': 'round' }, sg);
      el('path', { d: 'M-8,-20 l2,3 2,-2 3,4', fill: 'none', stroke: S2, 'stroke-width': 0.3 }, sg);
    } else if (kind === 'hold') {
      var sh = shape(KF.hold, 9 * k, 26 * 9 * k);
      el('path', { d: 'M0,-19 L4,-15 L0,-11 L-4,-15 Z', fill: GOLD, stroke: INK, 'stroke-width': 0.3 }, sh);
      el('path', { d: 'M-8,-8 l3,-3 2,2 3,-4', fill: 'none', stroke: S2, 'stroke-width': 0.3 }, sh);
    } else if (kind === 'column') {
      // a broken column of the old temple, capital on top, fluting down into the cloud
      var cw = 150 * k, ch = 300 * k;
      el('rect', { x: x - cw / 2, y: y + 26 * k, width: cw, height: ch, fill: S0, stroke: INK, 'stroke-width': 3 * k }, g);
      el('rect', { x: x + cw * 0.18, y: y + 26 * k, width: cw * 0.32, height: ch, fill: S1 }, g);
      for (var i = 1; i < 5; i++) el('path', { d: 'M' + (x - cw / 2 + i * cw / 5) + ',' + (y + 30 * k) + ' v' + ch, stroke: S2, 'stroke-width': 2 * k, opacity: 0.6 }, g);
      el('path', { d: 'M' + (x - cw * 0.62) + ',' + (y + 26 * k) + ' Q' + x + ',' + (y + 46 * k) + ' ' + (x + cw * 0.62) + ',' + (y + 26 * k) + ' Z', fill: S1, stroke: INK, 'stroke-width': 3 * k }, g);
      el('rect', { x: x - cw * 0.7, y: y, width: cw * 1.4, height: 26 * k, fill: S0, stroke: INK, 'stroke-width': 3 * k }, g);
      el('path', { d: 'M' + (x - 10 * k) + ',' + (y + 13 * k) + ' l10,-8 10,8 -10,8 Z', fill: GOLD, stroke: INK, 'stroke-width': 1.5 * k }, g);
    } else if (kind === 'slab') {
      // a carved slab: a gold keyframe diamond inlaid in its face, a ragged rock underneath
      var sw = 250 * k;
      el('path', { d: 'M' + (x - sw / 2) + ',' + (y + 40 * k) + ' L' + (x + sw / 2) + ',' + (y + 40 * k) + ' L' + (x + sw * 0.3) + ',' + (y + 120 * k) + ' L' + (x + sw * 0.02) + ',' + (y + 175 * k) + ' L' + (x - sw * 0.3) + ',' + (y + 110 * k) + ' Z', fill: S2, stroke: INK, 'stroke-width': 3 * k, 'stroke-linejoin': 'round' }, g);
      el('rect', { x: x - sw / 2, y: y, width: sw, height: 42 * k, rx: 4 * k, fill: S0, stroke: INK, 'stroke-width': 3 * k }, g);
      el('rect', { x: x - sw / 2 + 6 * k, y: y + 26 * k, width: sw - 12 * k, height: 10 * k, fill: S1 }, g);
      [-80, 0, 80].forEach(function (dx, j) { el('path', { d: 'M' + (x + dx * k) + ',' + (y + 8 * k) + ' l' + (j === 1 ? 14 : 9) * k + ',' + (j === 1 ? 13 : 8) * k + ' ' + -(j === 1 ? 14 : 9) * k + ',' + (j === 1 ? 13 : 8) * k + ' ' + -(j === 1 ? 14 : 9) * k + ',' + -(j === 1 ? 13 : 8) * k + ' Z', fill: j === 1 ? GOLD : S1, stroke: INK, 'stroke-width': 1.6 * k }, g); });
    }
    if (kind !== 'grass') {
      // moss on the top edge, and a wisp of cloud wrapping its foot
      el('path', { d: 'M' + (x - 90 * k) + ',' + (y + 2 * k) + ' q20,-6 40,0 q20,-6 40,0', fill: 'none', stroke: MOSS, 'stroke-width': 6 * k, 'stroke-linecap': 'round' }, g);
      cloudShape(g, [[x - 110 * k, y + 160 * k, 40 * k], [x - 50 * k, y + 175 * k, 46 * k], [x + 20 * k, y + 170 * k, 44 * k], [x + 90 * k, y + 160 * k, 38 * k]], '#fff', '#e3edfb', STY.line, 2.8 * k);
    }
    return g;
  }
  function stageLeft(r, s) {
    var y = Hh * BASE, k = KS, w = 240 * k;
    if (STAND === 'grass') platform(r, W * 0.26 - w / 2, y, w); else pedestal(r, STAND, W * 0.26, y, k);
    walker(r, { x: W * 0.26, y: y - 8, s: s || 3.4 * k }); return [W * 0.26, y - 8];
  }
  function godAt(r, pose) { return motionGod(r, W * 0.7, Hh * BASE - 14 * KS, 5 * KS, pose); }
  var KF = {
    linear: 'M0,-27 L13,-13.5 L0,0 L-13,-13.5 Z',
    ease: 'M-11,-26 H11 Q12.5,-26 11.5,-24 L4,-13.5 L11.5,-3 Q12.5,0 11,0 H-11 Q-12.5,0 -11.5,-3 L-4,-13.5 L-11.5,-24 Q-12.5,-26 -11,-26 Z',
    hold: 'M-11,-23 Q-11,-26 -8,-26 H8 Q11,-26 11,-23 V-3 Q11,0 8,0 H-8 Q-11,0 -11,-3 Z',
    bezier: 'M-13,-13 A13,13 0 1,0 13,-13 A13,13 0 1,0 -13,-13 Z',
    easeIn: 'M-11,-26 H1 L13,-13 L1,0 H-11 L-1,-13 Z',
    easeOut: 'M11,-26 H-1 L-13,-13 L-1,0 H11 L1,-13 Z'
  };
  var STONE = ['#d8d0c1', '#b9b0a0', '#9c9384'], MOSS = '#9ccc8c', GOLD = '#e8c46a';
  function tint(c, t, k) { var a = parseInt(c.slice(1), 16), b = parseInt(t.slice(1), 16); var r2 = function (sh) { return Math.round(((a >> sh) & 255) * (1 - k) + ((b >> sh) & 255) * k); }; return 'rgb(' + r2(16) + ',' + r2(8) + ',' + r2(0) + ')'; }
  // a petrified keyframe creature: the silhouette in stone with a thick side, closed eyes, cracks and moss
  function kfStatue(p, type, x, y, s, fade) {
    var g = el('g', { transform: 'translate(' + x + ',' + y + ') scale(' + s + ')' }, p), f = fade || 0;
    var c0 = tint(STONE[0], '#dcefff', f), c1 = tint(STONE[1], '#dcefff', f), c2 = tint(STONE[2], '#dcefff', f);
    el('rect', { x: -15, y: -1, width: 30, height: 6, fill: c1 }, g); el('rect', { x: -15, y: 5, width: 30, height: 3, fill: c2 }, g);
    el('path', { d: KF[type], fill: c2, transform: 'translate(3.5,0)' }, g);
    el('path', { d: KF[type], fill: c0 }, g);
    el('path', { d: 'M-5,-15 q1.6,1.2 3.2,0 M2,-15 q1.6,1.2 3.2,0', fill: 'none', stroke: c2, 'stroke-width': 1.2, 'stroke-linecap': 'round' }, g);
    el('path', { d: 'M-6,-6 l3,-4 2,3 3,-5', fill: 'none', stroke: c1, 'stroke-width': 0.8 }, g);
    el('ellipse', { cx: -6, cy: -1, rx: 5, ry: 1.6, fill: tint(MOSS, '#dcefff', f) }, g);
    return g;
  }
  function column(p, x, y, w, h, c, broken) {
    var g = el('g', {}, p);
    el('rect', { x: x - w * 0.62, y: y - h - w * 0.35, width: w * 1.24, height: w * 0.35, fill: c[1] }, g);
    el('rect', { x: x - w / 2, y: y - h, width: w, height: h, fill: c[0] }, g);
    el('rect', { x: x + w * 0.18, y: y - h, width: w * 0.32, height: h, fill: c[1] }, g);
    for (var i = 1; i < 3; i++) el('rect', { x: x - w / 2 + i * w / 3 - 0.6, y: y - h, width: 1.2, height: h, fill: c[2], opacity: 0.5 }, g);
    if (broken) el('path', { d: 'M' + (x - w * 0.62) + ',' + (y - h - w * 0.35) + ' l' + w * 0.4 + ',-' + w * 0.5 + ' l' + w * 0.3 + ',' + w * 0.3 + ' l' + w * 0.3 + ',-' + w * 0.4 + ' l' + w * 0.24 + ',' + w * 0.6 + ' Z', fill: p.__sky || '#e6f5ff' }, g);
    else el('rect', { x: x - w * 0.7, y: y - h - w * 0.55, width: w * 1.4, height: w * 0.22, fill: c[0] }, g);
    return g;
  }
  // a Greek-style temple: steps, a row of columns, a pediment with a gold keyframe diamond carved in it
  function temple(p, x, y, s, f, n) {
    var c = [tint(STONE[0], '#dcefff', f), tint(STONE[1], '#dcefff', f), tint(STONE[2], '#dcefff', f)], g = el('g', { transform: 'translate(' + x + ',' + y + ') scale(' + s + ')' }, p);
    n = n || 6; var W2 = n * 22;
    el('rect', { x: -W2 / 2 - 14, y: 0, width: W2 + 28, height: 8, fill: c[1] }, g); el('rect', { x: -W2 / 2 - 8, y: -6, width: W2 + 16, height: 7, fill: c[0] }, g);
    for (var i = 0; i < n; i++) column(g, -W2 / 2 + 11 + i * 22, -6, 11, 60, c);
    el('rect', { x: -W2 / 2 - 8, y: -80, width: W2 + 16, height: 10, fill: c[0] }, g);
    el('path', { d: 'M' + (-W2 / 2 - 12) + ',-80 L0,-112 L' + (W2 / 2 + 12) + ',-80 Z', fill: c[0] }, g);
    el('path', { d: 'M' + (-W2 / 2 + 6) + ',-83 L0,-106 L' + (W2 / 2 - 6) + ',-83 Z', fill: c[1] }, g);
    el('path', { d: 'M0,-102 L8,-94 L0,-86 L-8,-94 Z', fill: tint(GOLD, '#dcefff', f) }, g);
    return g;
  }
  function rock(p, x, y, w, h, c) { el('path', { d: 'M' + (x - w / 2) + ',' + y + ' L' + (x + w / 2) + ',' + y + ' L' + (x + w * 0.3) + ',' + (y + h * 0.5) + ' L' + (x + w * 0.05) + ',' + (y + h) + ' L' + (x - w * 0.25) + ',' + (y + h * 0.55) + ' Z', fill: c }, p); }
  function cloudBand(p, y, k, col, seed) { var g = el('g', {}, p); for (var x = -40; x < W + 40; x += 46 * k) puff(g, x, y + Math.sin(x * 0.01 + seed) * 8 * k, (30 + 14 * Math.sin(x * 0.02 + seed)) * k, col); el('rect', { x: 0, y: y, width: W, height: 60 * k, fill: col }, g); return g; }
  // a hooded colossus seated on a throne, staff with a keyframe gem: the old gods
  function colossus(p, x, y, s, f, flip) {
    var c = [tint(STONE[0], '#dcefff', f), tint(STONE[1], '#dcefff', f), tint(STONE[2], '#dcefff', f)];
    var g = el('g', { transform: 'translate(' + x + ',' + y + ') scale(' + (flip ? -s : s) + ',' + s + ')' }, p);
    el('rect', { x: -40, y: -20, width: 80, height: 20, fill: c[1] }, g);
    el('path', { d: 'M-30,-20 L-26,-90 Q0,-112 26,-90 L30,-20 Z', fill: c[0] }, g);
    el('path', { d: 'M4,-20 L8,-92 Q20,-98 26,-90 L30,-20 Z', fill: c[1] }, g);
    el('path', { d: 'M-18,-118 Q0,-150 18,-118 L16,-92 Q0,-84 -16,-92 Z', fill: c[0] }, g);
    el('path', { d: 'M-10,-112 Q0,-122 10,-112 L9,-98 Q0,-94 -9,-98 Z', fill: c[2] }, g);
    el('path', { d: 'M-8,-96 Q0,-70 8,-96 Z', fill: c[0] }, g);
    el('rect', { x: 34, y: -150, width: 5, height: 132, fill: c[1] }, g);
    el('path', { d: 'M36.5,-166 L46,-156 L36.5,-146 L27,-156 Z', fill: tint(GOLD, '#dcefff', f) }, g);
    el('path', { d: 'M-24,-60 Q-10,-50 10,-60 L28,-58', fill: 'none', stroke: c[1], 'stroke-width': 6, 'stroke-linecap': 'round' }, g);
    return g;
  }
  function stairs(p, x, y, w, n, step, c) { for (var i = 0; i < n; i++) { var ww = w - i * (w * 0.6 / n); el('rect', { x: x - ww / 2, y: y - i * step, width: ww, height: step + 1, fill: i % 2 ? c[0] : c[1] }, p); } }
  var BG = {
    // B1 · the Keyframe Temple: one great temple on a floating rock between them, keyframe statues guarding it
    1: { mid: function (r, k) {
        var fx = W * 0.48, fy = Hh * 0.47;
        rock(r, fx, fy + 8 * k, 520 * k, 200 * k, tint(STONE[2], '#dcefff', 0.35));
        el('path', { d: 'M' + (fx - 30 * k) + ',0 L' + (fx - 120 * k) + ',' + fy + ' L' + (fx + 120 * k) + ',' + fy + ' L' + (fx + 30 * k) + ',0 Z', fill: '#fff', opacity: 0.3 }, r);
        temple(r, fx, fy, 2.4 * k, 0.2, 7);
        kfStatue(r, 'linear', fx - 230 * k, fy, 3.6 * k, 0.22); kfStatue(r, 'bezier', fx + 232 * k, fy, 3.6 * k, 0.22);
      }, far: function (r, k) { [[0.08, 0.47, 'hold'], [0.94, 0.46, 'ease']].forEach(function (q) { kfStatue(r, q[2], W * q[0], Hh * q[1], 4.2 * k, 0.45); }); temple(r, W * 0.82, Hh * 0.42, 0.8 * k, 0.55, 4); } },
    // B2 · the Valley of Petrified Keyframes: giant stone creatures in a row, the nearest the biggest
    2: { far: function (r, k) {
        [['easeOut', 0.9, 0.47, 5, 0.55], ['hold', 0.72, 0.47, 6, 0.5], ['ease', 0.12, 0.48, 6, 0.5]].forEach(function (q) { kfStatue(r, q[0], W * q[1], Hh * q[2], q[3] * k, q[4]); });
      }, mid: function (r, k) { [['bezier', 0.6, 0.56, 9, 0.25], ['linear', 0.4, 0.57, 10.5, 0.2]].forEach(function (q) { kfStatue(r, q[0], W * q[1], Hh * q[2], q[3] * k, q[4]); }); } },
    // B3 · the Sky Gate: a great archway on top of stairs climbing out of the clouds, light pouring through
    3: { mid: function (r, k) {
        var gx = W * 0.48, gy = Hh * 0.6, c = [tint(STONE[0], '#dcefff', 0.15), tint(STONE[1], '#dcefff', 0.15), tint(STONE[2], '#dcefff', 0.15)];
        puff(r, gx, gy - 300 * k, 220 * k, 'url(#mkGlow)');
        stairs(r, gx, gy, 460 * k, 10, 14 * k, c);
        column(r, gx - 130 * k, gy - 140 * k, 52 * k, 300 * k, c); column(r, gx + 130 * k, gy - 140 * k, 52 * k, 300 * k, c);
        el('rect', { x: gx - 175 * k, y: gy - 500 * k, width: 350 * k, height: 44 * k, fill: c[0] }, r);
        el('rect', { x: gx - 160 * k, y: gy - 460 * k, width: 320 * k, height: 12 * k, fill: c[1] }, r);
        el('path', { d: 'M' + gx + ',' + (gy - 540 * k) + ' l22,22 -22,22 -22,-22 Z', fill: GOLD }, r);
      }, far: function (r, k) { [[0.16, 0.48, 160, true], [0.26, 0.5, 100, false], [0.76, 0.5, 130, true], [0.88, 0.48, 180, false]].forEach(function (q) { column(r, W * q[0], Hh * q[1], 34 * k, q[2] * k, [tint(STONE[0], '#dcefff', 0.45), tint(STONE[1], '#dcefff', 0.45), tint(STONE[2], '#dcefff', 0.45)], q[3]); }); } },
    // B4 · the Sunken City: domes, towers and colonnades of the old city drowning in cloud, warm evening light
    4: { sky: ['#f2a97a', '#fde9d6'], far: function (r, k) {
        var c = [tint(STONE[0], '#f7dcc8', 0.35), tint(STONE[1], '#f7dcc8', 0.35), tint(STONE[2], '#f7dcc8', 0.35)];
        [[0.08, 230, 60], [0.22, 320, 52], [0.6, 380, 64], [0.76, 270, 56], [0.92, 200, 50], [0.4, 260, 48]].forEach(function (q) { var x = W * q[0], y = Hh * 0.54; el('rect', { x: x - q[2] * k / 2, y: y - q[1] * k, width: q[2] * k, height: q[1] * k, fill: c[0] }, r); el('rect', { x: x + q[2] * k * 0.15, y: y - q[1] * k, width: q[2] * k * 0.35, height: q[1] * k, fill: c[1] }, r); for (var j = 1; j < 4; j++) el('rect', { x: x - q[2] * k * 0.25, y: y - q[1] * k + j * 50 * k, width: q[2] * k * 0.2, height: 22 * k, fill: c[2] }, r); el('path', { d: 'M' + (x - q[2] * k * 0.62) + ',' + (y - q[1] * k) + ' Q' + x + ',' + (y - q[1] * k - q[2] * k * 1.1) + ' ' + (x + q[2] * k * 0.62) + ',' + (y - q[1] * k) + ' Z', fill: c[0] }, r); el('rect', { x: x - 2 * k, y: y - q[1] * k - q[2] * k * 1.1, width: 4 * k, height: 26 * k, fill: c[1] }, r); });
        // petrified keyframes standing among the drowned towers
        kfStatue(r, 'bezier', W * 0.3, Hh * 0.53, 5.2 * k, 0.4); kfStatue(r, 'easeIn', W * 0.84, Hh * 0.53, 4.6 * k, 0.4);
      }, mid: function (r, k) { temple(r, W * 0.48, Hh * 0.58, 1.9 * k, 0.15, 6);
        kfStatue(r, 'linear', W * 0.14, Hh * 0.62, 7 * k, 0.12); kfStatue(r, 'hold', W * 0.62, Hh * 0.6, 5.5 * k, 0.15); var c = [tint(STONE[0], '#f7dcc8', 0.1), tint(STONE[1], '#f7dcc8', 0.1), tint(STONE[2], '#f7dcc8', 0.1)]; [0.04, 0.3, 0.66, 0.97].forEach(function (x, i) { column(r, W * x, Hh * 0.64, 30 * k, (110 + (i % 2) * 60) * k, c, i % 2 === 0); }); } },
    // B5 · the Hall of the Old Gods: two hooded colossi on thrones face each other across a road of cloud
    5: { far: function (r, k) {
        el('path', { d: 'M' + W * 0.4 + ',' + Hh * 0.66 + ' L' + W * 0.47 + ',' + Hh * 0.38 + ' L' + W * 0.53 + ',' + Hh * 0.38 + ' L' + W * 0.6 + ',' + Hh * 0.66 + ' Z', fill: '#fff', opacity: 0.6 }, r);
        temple(r, W * 0.5, Hh * 0.4, 0.9 * k, 0.45, 5);
      }, mid: function (r, k) { colossus(r, W * 0.4, Hh * 0.6, 3.4 * k, 0.15, false); colossus(r, W * 0.58, Hh * 0.6, 3.4 * k, 0.15, true); kfStatue(r, 'hold', W * 0.08, Hh * 0.55, 4 * k, 0.3); kfStatue(r, 'bezier', W * 0.94, Hh * 0.55, 4 * k, 0.3); } }
  };

  /* ================= the cutscene ================= */
  var SKIN = getComputedStyle(H.root).getPropertyValue('--h-skin').trim() || '#f8c0a2';
  var RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var LINES = {
    vi: [
      ['GMT', 'Ông là ai? Đây là đâu vậy?'],
      ['Motion God', 'Ta là chúa tể của vùng đất này. Ta đã chờ 1000 năm để gặp một người xứng đáng kế vị ta. Giờ ta sẽ kể cho ngươi câu chuyện của vùng đất này.'],
      ['Motion God', 'Thuở xưa, thế giới bên dưới đứng yên như một tấm ảnh. Không gió, không nước chảy, không một chiếc lá nào rơi.'],
      ['Motion God', 'Ta đặt chiếc keyframe đầu tiên. Từ đó mặt trời biết mọc, mặt trăng biết lặn, và bốn mùa bắt đầu luân phiên.'],
      ['Motion God', 'Ta dạy những sinh vật nhỏ cách chuyển động: linear, easy ease, hold, auto bezier… Những kẻ không chịu học đã hoá đá quanh đây.'],
      ['Motion God', 'Nhưng ta đã già. Thành phố cần một người mới giữ cho mọi thứ tiếp tục chuyển động.'],
      ['Motion God', 'Ngươi đã tìm ra bí mật của ngôi sao và tìm được tới vùng đất của chuyển động này.'],
      ['Motion God', 'Là truyền nhân xứng đáng của ta và từ giờ, hãy nhận lấy sức mạnh này. Và nên nhớ là...']
    ],
    en: [
      ['GMT', 'Who are you? Where is this place?'],
      ['Motion God', 'I am the lord of this land. For a thousand years I have waited for one worthy to succeed me. Now hear the story of this land.'],
      ['Motion God', 'Long ago, the world below stood still like a photograph. No wind, no flowing water, not a single falling leaf.'],
      ['Motion God', 'I set the very first keyframe. From then on the sun learned to rise, the moon to set, and the four seasons began to turn.'],
      ['Motion God', 'I taught the little creatures how to move: linear, easy ease, hold, auto bezier… The ones who would not learn turned to stone around here.'],
      ['Motion God', 'But I have grown old. The city needs someone new to keep everything in motion.'],
      ['Motion God', 'You found the secret of the star and made your way to this land of motion.'],
      ['Motion God', 'You are my worthy heir, and from now on, take this power. And remember...']
    ]
  };
  // two fixed lines, so no word is ever left dangling on its own on a narrow screen
  var MOTTO = { vi: ['SỨC MẠNH CÀNG LỚN,', 'TRÁCH NHIỆM CÀNG CAO'], en: ['WITH GREAT POWER', 'COMES GREAT RESPONSIBILITY'] };
  // every later visit: the God has had enough. Two of these eleven, picked at random each time
  var RANT = {
    vi: ['Ngươi đã có sức mạnh rồi, lên đây làm gì nữa, đi về đi!', 'Lại là ngươi nữa hả? Đủ rồi!', 'Sao ta mệt mỏi với ngươi quá đi, biến dùm...', 'Để cho ta yên đi mà, ta van xin ngươi đấy...',
      'Ta vừa chợp mắt được một chút thôi đấy!', 'Ngàn năm ta chờ một người, giờ ngày nào cũng phải gặp ngươi...', 'Ngôi sao đó không phải để ăn vặt đâu nhé!', 'Hết sức mạnh rồi, không còn gì để cho nữa đâu!',
      'Bấm chuột nhiều thế không mỏi tay à?', 'Xuống! Thành phố đang cần ngươi kìa!', 'Hết After Credit rồi ông nội, nhấc cái mông lên mà đi về đi.'],
    en: ['You already have the power. What are you doing up here? Go home!', 'You again? Enough!', 'You wear me out. Please, just go...', 'Leave me in peace, I am begging you...',
      'I had only just dozed off!', 'A thousand years I waited for one visitor, and now I see you every single day...', 'That star is not a snack, you know!', 'There is no more power. Nothing left to give!',
      'All that clicking, doesn\'t your hand get tired?', 'Down you go! The city needs you!', 'The after-credits scene is over, gramps. Get your butt up and go home.']
  };

  function wait(ms) { return new Promise(function (r) { setTimeout(r, RM ? Math.min(ms, 300) : ms); }); }
  // run fn(u) every frame for ms milliseconds, u going 0 -> 1
  function tween(ms, fn) {
    if (RM) ms = Math.min(ms, 250);
    return new Promise(function (res) {
      var t0 = performance.now();
      (function step(now) {
        var u = Math.min(1, (now - t0) / ms);
        fn(u);
        if (u < 1) requestAnimationFrame(step); else res();
      })(t0);
    });
  }
  function easeOut(u) { return 1 - Math.pow(1 - u, 3); }
  function easeIO(u) { return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; }

  // ---- sound, on the city's own audio graph (effects bus) ----
  var AU = window.__cityAudio || {};
  function sndOn() { return AU.ctx && AU.sfxBus && GMTCity.sfx && GMTCity.sfx.on; }
  function noise(dur, vol, freq, q) {
    if (!sndOn()) return null;
    var a = AU.ctx, n = Math.floor(a.sampleRate * dur), b = a.createBuffer(1, n, a.sampleRate), ch = b.getChannelData(0);
    for (var i = 0; i < n; i++) ch[i] = Math.random() * 2 - 1;
    var s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(), t = a.currentTime;
    s.buffer = b; f.type = 'bandpass'; f.frequency.value = freq || 2000; f.Q.value = q || 0.6;
    g.gain.setValueAtTime(vol, t); g.gain.setValueAtTime(vol, t + dur * 0.8); g.gain.linearRampToValueAtTime(0, t + dur);
    s.connect(f); f.connect(g); g.connect(AU.sfxBus); s.start(t);
    return s;
  }
  function tone(f, d, type, v, slide, delay) {
    if (!sndOn()) return;
    var a = AU.ctx, t = a.currentTime + (delay || 0), o = a.createOscillator(), g = a.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + Math.min(0.04, d / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(AU.sfxBus); o.start(t); o.stop(t + d + 0.05);
  }
  // a slow, glowing pad: the sacred land
  function pad(sec) { [[57, 0], [64, 0.4], [69, 0.8], [72, 1.4], [76, 2]].forEach(function (n) { tone(440 * Math.pow(2, (n[0] - 69) / 12), sec - n[1], 'sine', 0.035, 0, n[1]); }); }
  function chime() { [84, 88, 91, 96].forEach(function (m, i) { tone(440 * Math.pow(2, (m - 69) / 12), 0.5, 'triangle', 0.05, 0, i * 0.09); }); }

  // ---- 1 · the old TV losing its signal ----
  function staticTV(host) {
    var cv = document.createElement('canvas'), cx = cv.getContext('2d');
    var w = Math.ceil(innerWidth / 3), h = Math.ceil(innerHeight / 3);
    cv.width = w; cv.height = h;
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated';
    host.appendChild(cv);
    var img = cx.createImageData(w, h), d = img.data;
    noise(1.7, 0.09, 3200, 0.5);
    return tween(1600, function (u) {
      for (var i = 0; i < d.length; i += 4) { var v = Math.random() * 255 * (Math.random() < 0.9 ? 1 : 0.4); d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
      cx.putImageData(img, 0, 0);
      // a bright rolling bar, coloured fringes, scanlines
      var by = ((u * 2.2) % 1) * h;
      cx.fillStyle = 'rgba(255,255,255,.35)'; cx.fillRect(0, by, w, h * 0.06);
      cx.fillStyle = 'rgba(125,249,255,.35)'; cx.fillRect(0, h * 0.42, w, 1.5);
      cx.fillStyle = 'rgba(255,79,216,.35)'; cx.fillRect(0, h * 0.58, w, 1.5);
      cx.fillStyle = 'rgba(0,0,0,.35)'; for (var y = 0; y < h; y += 2) cx.fillRect(0, y, w, 1);
      host.style.transform = 'translate(' + ((Math.random() - 0.5) * 8).toFixed(1) + 'px,' + ((Math.random() - 0.5) * 6).toFixed(1) + 'px)';
    }).then(function () {
      host.style.transform = '';
      // the picture collapses into one bright line, then the screen goes dark
      tone(1400, 0.25, 'square', 0.04, 0.2);
      cx.fillStyle = '#000'; cx.fillRect(0, 0, w, h);
      return tween(320, function (u) {
        cx.fillStyle = '#000'; cx.fillRect(0, 0, w, h);
        var lh = Math.max(1, h * (1 - easeOut(u)) * 0.5), lw = w * (u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3);
        cx.fillStyle = '#fff'; cx.fillRect((w - lw) / 2, h / 2 - lh / 2, lw, lh);
      });
    }).then(function () { return wait(250); }).then(function () { cv.remove(); });
  }

  // ---- 2 · the sacred land: the statue rises carrying GMT, the God comes down in a column of light ----
  var S = {};
  function buildLand() {
    var r = realm(BG[4]), k = KS, gx = W * 0.7, gy = Hh * BASE - 14 * k;
    S = { r: r, k: k, gx: gx, gy: gy, bobY: 0, tilt: 0, staffAng: null, colHold: false };
    S.statue = el('g', {}, r);
    pedestal(S.statue, 'ease', W * 0.26, Hh * BASE, k);
    S.gmt = walker(S.statue, { x: W * 0.26, y: Hh * BASE - 8, s: 3.4 * k });
    S.churn = el('g', {}, r);
    cloudShape(S.churn, [[W * 0.26 - 140 * k, Hh * 0.79, 36 * k], [W * 0.26 - 70 * k, Hh * 0.77, 44 * k], [W * 0.26 + 10 * k, Hh * 0.765, 46 * k], [W * 0.26 + 90 * k, Hh * 0.78, 40 * k], [W * 0.26 + 150 * k, Hh * 0.8, 30 * k]], '#fff', '#e3edfb', STY.line, 2.8 * k);
    // the cloud sea's surface drawn over the statue so it truly comes up through it
    S.front = el('g', {}, r);
    seaU(S.front, Hh * 0.8, 52 * k, '#ffffff', 0.4, k);
    seaU(S.front, Hh * 0.92, 44 * k, '#f7fbff', 2.2, k);
    S.col = el('g', { opacity: 0 }, r);
    el('path', { d: 'M' + (gx - 120 * k) + ',0 L' + (gx - 190 * k) + ',' + Hh * 0.7 + ' L' + (gx + 190 * k) + ',' + Hh * 0.7 + ' L' + (gx + 120 * k) + ',0 Z', fill: '#fff6c8', opacity: 0.55 }, S.col);
    el('path', { d: 'M' + (gx - 50 * k) + ',0 L' + (gx - 90 * k) + ',' + Hh * 0.7 + ' L' + (gx + 90 * k) + ',' + Hh * 0.7 + ' L' + (gx + 50 * k) + ',0 Z', fill: '#fff', opacity: 0.6 }, S.col);
    S.colSp = [];
    for (var q = 0; q < 12; q++) S.colSp.push({ x: gx + (q % 2 ? 1 : -1) * (30 + (q * 37 % 110)) * k, y: Hh * (q / 12) * 0.7, v: (24 + q % 4 * 9) * k, s: (0.7 + q % 3 * 0.35) * k, n: sparkle(S.col, 0, 0, 1, '#fff3b0') });
    S.godWrap = el('g', {}, r);
    S.godBob = el('g', {}, S.godWrap);
    S.god = motionGod(S.godBob, gx, gy, 5 * k);
    // motes of light drifting up through the whole scene
    var mg = el('g', {}, r);
    S.motes = [];
    for (q = 0; q < 26; q++) S.motes.push({ x: Math.random() * W, y: Math.random() * Hh, v: (14 + Math.random() * 26) * k, ph: Math.random() * 6, s: (0.35 + Math.random() * 0.5) * k, n: sparkle(mg, 0, 0, 1, q % 3 ? '#fff' : '#fff3b0') });
    S.fx = el('g', {}, r);
    live();
  }
  // everything keeps breathing while the scene plays: clouds sway and drift, the light pulses, the God bobs on his
  // cloud with his cape stirring, his halo turns and the keyframes circle him
  function live() {
    if (RM) return;
    S.liveOn = true;
    var t0 = performance.now(), me = S;
    (function step(now) {
      if (!me.liveOn || S !== me) return;
      var t = (now - t0) / 1000, k = S.k, i;
      LIVE.high.forEach(function (c) { c.g.setAttribute('transform', 'translate(' + (c.x + Math.sin(t * 0.22 + c.ph) * 46 * k).toFixed(1) + ',' + (c.y + Math.sin(t * 0.4 + c.ph) * 5 * k).toFixed(1) + ') scale(' + c.s + ')'); });
      LIVE.hills.forEach(function (g, j) { g.setAttribute('transform', 'translate(' + (Math.sin(t * 0.35 + j * 2) * 10 * k).toFixed(1) + ',0)'); });
      LIVE.sea.concat(S.front ? [].slice.call(S.front.childNodes) : []).forEach(function (g, j) { g.setAttribute('transform', 'translate(' + (Math.sin(t * 0.6 + j * 1.7) * 18 * k).toFixed(1) + ',' + (Math.sin(t * 0.9 + j) * 3 * k).toFixed(1) + ')'); });
      S.churn.setAttribute('transform', 'translate(' + (Math.sin(t * 0.8) * 10 * k).toFixed(1) + ',0)');
      LIVE.shafts.forEach(function (p, j) { p.setAttribute('opacity', (0.07 + 0.11 * (0.5 + 0.5 * Math.sin(t * 0.9 + j * 2.1))).toFixed(3)); });
      LIVE.sun.setAttribute('r', (190 * k * (1 + 0.06 * Math.sin(t * 0.8))).toFixed(1));
      if (S.colHold) S.col.setAttribute('opacity', (0.3 + 0.14 * Math.sin(t * 1.4)).toFixed(2));
      S.colSp.forEach(function (c) { var y = ((c.y - t * c.v) % (Hh * 0.7) + Hh * 0.7) % (Hh * 0.7); c.n.setAttribute('transform', 'translate(' + (c.x + Math.sin(t * 2 + c.y) * 6 * k).toFixed(1) + ',' + y.toFixed(1) + ') scale(' + (c.s * (0.6 + 0.6 * Math.abs(Math.sin(t * 3 + c.y)))).toFixed(2) + ')'); });
      S.motes.forEach(function (m) { var y = ((m.y - t * m.v) % (Hh + 40) + Hh + 40) % (Hh + 40) - 20; m.n.setAttribute('transform', 'translate(' + (m.x + Math.sin(t * 0.8 + m.ph) * 18 * k).toFixed(1) + ',' + y.toFixed(1) + ') scale(' + (m.s * (0.5 + 0.5 * Math.abs(Math.sin(t * 2.2 + m.ph)))).toFixed(2) + ')'); });
      // the God
      S.bobY = Math.sin(t * 1.5) * 8 * k;
      S.godBob.setAttribute('transform', 'translate(0,' + S.bobY.toFixed(1) + ') rotate(' + (Math.sin(t * 0.9) * 1.5 + S.tilt).toFixed(2) + ',' + S.gx + ',' + S.gy + ')');
      var g = S.god;
      if (g.__rays) g.__rays.setAttribute('transform', 'rotate(' + (t * 30 % 360).toFixed(1) + ',0,-39)');
      g.__glow.setAttribute('r', (70 * (1 + 0.12 * Math.sin(t * 2.4))).toFixed(1));
      g.__cape.setAttribute('transform', 'translate(0,-31) skewX(' + (Math.sin(t * 2.1) * 6).toFixed(2) + ') translate(0,31)');
      g.__ride.setAttribute('transform', 'translate(' + (Math.sin(t * 1.7) * 1.5).toFixed(2) + ',' + (Math.sin(t * 2.3) * 0.8).toFixed(2) + ')');
      g.__tipGlow.setAttribute('r', (g.__tipR * (1 + 0.25 * Math.sin(t * 4.5))).toFixed(1));
      g.__staff.setAttribute('transform', S.staffAng == null ? '' : 'rotate(' + S.staffAng.toFixed(1) + ',17,-14)');
      for (i = 0; i < g.__kf.length; i++) { var f = g.__kf[i]; f.n.setAttribute('transform', 'translate(' + (f.x + Math.cos(t * 1.2 + i * 1.6) * 4).toFixed(2) + ',' + (f.y + Math.sin(t * 1.5 + i * 1.9) * 5).toFixed(2) + ') rotate(' + ((t * 80 + i * 45) % 360).toFixed(0) + ') scale(' + f.s + ')'); }
      for (i = 0; i < g.__sp.length; i++) { var p = g.__sp[i]; p.n.setAttribute('transform', 'translate(' + p.x + ',' + p.y + ') scale(' + (p.s * (0.4 + 0.8 * Math.abs(Math.sin(t * 2.6 + i * 2)))).toFixed(2) + ')'); }
      requestAnimationFrame(step);
    })(t0);
  }
  function riseAndDescend() {
    var k = S.k, drop = 320 * k;
    S.statue.setAttribute('transform', 'translate(0,' + drop + ')');
    S.godWrap.setAttribute('transform', 'translate(0,' + (-Hh * 0.75) + ')');
    noise(2.8, 0.05, 160, 0.8); pad(6);
    var a = tween(2800, function (u) {
      var e = easeOut(u), sh = (1 - u) * 3 * k;
      S.statue.setAttribute('transform', 'translate(' + ((Math.random() - 0.5) * sh).toFixed(1) + ',' + (drop * (1 - e)).toFixed(1) + ')');
      S.churn.setAttribute('opacity', (1 - u).toFixed(2));
    });
    var b = wait(900).then(function () {
      tone(523, 1.4, 'sine', 0.04, 1.5);
      return tween(2600, function (u) {
        S.col.setAttribute('opacity', Math.min(1, u * 3).toFixed(2));
        S.godWrap.setAttribute('transform', 'translate(0,' + (-Hh * 0.75 * (1 - easeOut(u))).toFixed(1) + ')');
      });
    }).then(function () { chime(); return tween(700, function (u) { S.col.setAttribute('opacity', (1 - u * 0.65).toFixed(2)); }); })
      .then(function () { S.colHold = true; });
    // once it is up, the near cloud layer drifts away so the whole Easy Ease statue shows, wisp at its waist
    return Promise.all([a, b]).then(function () { return tween(700, function (u) { S.front.setAttribute('opacity', (1 - u).toFixed(2)); }); });
  }

  // ---- 3 · the dialogue: typed out with a blip, tap / key to go on, SKIP jumps to the last line ----
  function portrait(who) {
    var sv = el('svg', { viewBox: '-26 -64 52 52', 'aria-hidden': 'true' });
    if (who === 'GMT') walker(sv, { x: 0, y: -6, s: 1 });
    else motionGod(sv, 0, -6, 0.95);
    return sv;
  }
  function talk(host, lines) {
    return new Promise(function (done) {
      var box = document.createElement('div');
      box.className = 'egg-dlg';
      box.innerHTML = '<div class="egg-pt"></div><div class="egg-tx"><b></b><p></p></div><button type="button" class="egg-skip">SKIP ▶</button><i class="egg-more">▼</i>';
      host.appendChild(box);
      var pt = box.querySelector('.egg-pt'), nm = box.querySelector('b'), tx = box.querySelector('p'), more = box.querySelector('.egg-more');
      var i = -1, typing = null, full = '', who = '';
      function show(n) {
        i = n; var L = lines[i];
        if (L[0] !== who) { who = L[0]; pt.innerHTML = ''; pt.appendChild(portrait(who)); nm.textContent = who; }
        full = L[1]; tx.textContent = ''; more.style.visibility = 'hidden';
        var c = 0;
        clearInterval(typing);
        typing = setInterval(function () {
          c += 1; tx.textContent = full.slice(0, c);
          if (c % 3 === 0 && /\S/.test(full[c - 1] || '')) tone(who === 'GMT' ? 880 : 520, 0.04, 'square', 0.02);
          if (c >= full.length) { clearInterval(typing); typing = null; more.style.visibility = ''; }
        }, RM ? 5 : 28);
      }
      function next() {
        if (typing) { clearInterval(typing); typing = null; tx.textContent = full; more.style.visibility = ''; return; }
        if (i + 1 < lines.length) show(i + 1); else finish();
      }
      function finish() { cleanup(); box.remove(); done(); }
      function onKey(e) { if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); next(); } else if (e.key === 'Escape') skip(e); }
      function skip(e) { if (e) { e.stopPropagation(); e.preventDefault(); } tone(660, 0.08, 'square', 0.03); if (i < lines.length - 1) show(lines.length - 1); else next(); }
      function onTap(e) { if (e.target.closest('.egg-skip')) return; next(); }
      function cleanup() { clearInterval(typing); document.removeEventListener('keydown', onKey, true); host.removeEventListener('click', onTap); }
      box.querySelector('.egg-skip').addEventListener('click', skip);
      document.addEventListener('keydown', onKey, true);
      host.addEventListener('click', onTap);
      show(0);
    });
  }

  // ---- 4 · the wand dance: he twirls the staff, a ring of keyframes gathers, then he points it at GMT ----
  var DIA = 'M0,-6 L6,0 L0,6 L-6,0 Z';
  function wandDance() {
    var k = S.k, sc = 5 * k, cx = S.gx, cy = S.gy - 140 * k;
    var trail = el('g', {}, S.fx), ring = el('g', { opacity: 0 }, S.fx), bits = [];
    var oval = el('ellipse', { cx: cx, cy: cy, rx: 1, ry: 1, fill: 'none', stroke: '#fff3b0', 'stroke-width': 3 * k, 'stroke-dasharray': 12 * k + ' ' + 9 * k }, ring);
    var oval2 = el('ellipse', { cx: cx, cy: cy, rx: 1, ry: 1, fill: 'none', stroke: YEL, 'stroke-width': 2 * k, opacity: 0.7 }, ring);
    var gems = []; for (var i = 0; i < 10; i++) gems.push(el('path', { d: DIA, fill: i % 2 ? '#fff' : YEL, stroke: INK, 'stroke-width': 1.4 }, ring));
    // a rising run of chimes, a swish for every swing
    [72, 76, 79, 84, 79, 84, 88, 91, 96].forEach(function (m, j) { tone(440 * Math.pow(2, (m - 69) / 12), 0.45, 'triangle', 0.04, 0, j * 0.27); });
    [0, 0.5, 1, 1.5, 2].forEach(function (d) { setTimeout(function () { noise(0.3, 0.05, 2400, 1.4); }, d * 1000); });
    var lastT = performance.now();
    return tween(2700, function (u) {
      var now = performance.now(), dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
      // swings left and right, with one full whirl in the middle
      var whirl = u < 0.38 ? 0 : u < 0.66 ? (u - 0.38) / 0.28 * 360 : 360;
      var ang = Math.sin(u * Math.PI * 5) * 62 * Math.sin(Math.PI * Math.min(1, u * 1.2)) + whirl;
      S.staffAng = ang; S.tilt = Math.sin(u * Math.PI * 5) * 4;
      var a = ang * Math.PI / 180, lx = 17 + 38 * Math.sin(a), ly = -14 - 38 * Math.cos(a);
      var px = S.gx + lx * sc, py = S.gy + S.bobY + ly * sc;
      bits.push({ n: sparkle(trail, px, py, (0.9 + Math.random() * 0.8) * k, Math.random() < 0.35 ? '#fff3b0' : '#fff'), x: px + (Math.random() - 0.5) * 10 * k, y: py, life: 0.55 });
      if (Math.random() < 0.3) bits.push({ n: el('path', { d: DIA, fill: YEL, stroke: INK, 'stroke-width': 1.2 }, trail), x: px, y: py, life: 0.7, kf: 1 });
      for (var j = bits.length - 1; j >= 0; j--) {
        var b = bits[j]; b.life -= dt; b.y += (b.kf ? 30 : -18) * k * dt;
        if (b.life <= 0) { b.n.remove(); bits.splice(j, 1); continue; }
        b.n.setAttribute('transform', 'translate(' + b.x.toFixed(1) + ',' + b.y.toFixed(1) + ') scale(' + (b.kf ? b.life * 1.4 * k : b.life * 1.8 * k).toFixed(2) + ')');
      }
      var rr = 240 * k * easeOut(u);
      ring.setAttribute('opacity', Math.min(1, u * 2).toFixed(2));
      oval.setAttribute('rx', rr.toFixed(1)); oval.setAttribute('ry', (rr * 0.34).toFixed(1)); oval.setAttribute('stroke-dashoffset', (-u * 300 * k).toFixed(1));
      oval2.setAttribute('rx', (rr * 0.8).toFixed(1)); oval2.setAttribute('ry', (rr * 0.27).toFixed(1));
      gems.forEach(function (gm, j) { var q = j / gems.length * Math.PI * 2 + u * 9; gm.setAttribute('transform', 'translate(' + (cx + Math.cos(q) * rr).toFixed(1) + ',' + (cy + Math.sin(q) * rr * 0.34).toFixed(1) + ') rotate(' + (u * 720 + j * 36).toFixed(0) + ') scale(' + (k * (1 + 0.4 * Math.sin(q))).toFixed(2) + ')'); });
    }).then(function () {
      S.staffAng = null; S.tilt = 0;
      bits.forEach(function (b) { b.n.remove(); });
      return { ring: ring };
    });
  }
  // the staff swings to GMT and pours its light into him
  function bestow(lang) {
    var k = S.k;
    return wandDance().then(function (d) {
      S.godBob.innerHTML = '';
      S.god = motionGod(S.godBob, S.gx, S.gy, 5 * k, 'point');
      return beam(lang, d.ring);
    });
  }
  function beam(lang, ring) {
    var k = S.k;
    var tip = [S.gx - 275 * k, Hh * BASE - 14 * k - 185 * k + S.bobY], tx = W * 0.26, ty = Hh * BASE - 8 - 80 * k;
    var flash = el('rect', { width: W, height: Hh, fill: '#fffbe0', opacity: 0 }, S.fx);
    var defs = el('defs', {}, S.fx), bg = el('linearGradient', { id: 'eggBeam', x1: 1, y1: 0, x2: 0, y2: 0 }, defs);
    el('stop', { offset: 0, 'stop-color': '#fff' }, bg); el('stop', { offset: 0.5, 'stop-color': '#ffe14d' }, bg); el('stop', { offset: 1, 'stop-color': '#fff6c8' }, bg);
    var ang = Math.atan2(ty - tip[1], tx - tip[0]) * 180 / Math.PI, len = Math.hypot(tx - tip[0], ty - tip[1]);
    var beamG = el('g', { transform: 'translate(' + tip[0] + ',' + tip[1] + ') rotate(' + ang + ')', opacity: 0 }, S.fx);
    el('path', { d: 'M0,-26 L' + len + ',-70 L' + len + ',70 L0,26 Z', fill: '#fff6c8', opacity: 0.45 }, beamG);
    var core = el('path', { d: 'M0,-12 L' + len + ',-34 L' + len + ',34 L0,12 Z', fill: 'url(#eggBeam)', opacity: 0.9 }, beamG);
    el('path', { d: 'M0,-4 L' + len + ',-10 L' + len + ',10 L0,4 Z', fill: '#fff' }, beamG);
    // pulses of light running down the beam
    var runs = [0, 1, 2, 3].map(function () { return el('ellipse', { cx: 0, cy: 0, rx: 26, ry: 12, fill: '#fff', opacity: 0.85 }, beamG); });
    var halo = el('g', { opacity: 0 }, S.fx);
    puff(halo, tx, ty, 170 * k, 'url(#mkGlow)');
    var rings = [90, 130, 175].map(function (rr, j) { return el('ellipse', { cx: tx, cy: ty, rx: rr * k, ry: rr * 0.86 * k, fill: 'none', stroke: j ? '#fff' : YEL, 'stroke-width': (6 - j * 1.5) * k, opacity: 0.9 - j * 0.25 }, halo); });
    var rays = el('g', {}, halo);
    for (var i = 0; i < 16; i++) { var a = i * Math.PI / 8; el('path', { d: 'M' + (tx + Math.cos(a) * 60 * k) + ',' + (ty + Math.sin(a) * 60 * k) + ' L' + (tx + Math.cos(a) * (i % 2 ? 120 : 160) * k) + ',' + (ty + Math.sin(a) * (i % 2 ? 120 : 160) * k), stroke: i % 2 ? '#fff' : '#ffe14d', 'stroke-width': 4 * k, 'stroke-linecap': 'round' }, rays); }
    var sparks = el('g', {}, S.fx);
    var banner = document.createElement('div'); banner.className = 'egg-motto'; banner.innerHTML = '<span>' + MOTTO[lang][0] + '</span><span>' + MOTTO[lang][1] + '</span>';
    noise(2.6, 0.06, 900, 0.4); tone(196, 2.4, 'sawtooth', 0.025, 2); chime();
    return tween(450, function (u) { beamG.setAttribute('opacity', u.toFixed(2)); halo.setAttribute('opacity', u.toFixed(2)); flash.setAttribute('opacity', (0.6 * (1 - Math.abs(u * 2 - 1))).toFixed(2)); ring.setAttribute('opacity', (1 - u).toFixed(2)); })
      .then(function () {
        ring.remove();
        S.r.parentNode.appendChild(banner);
        S.gmt.style.filter = 'brightness(1.25) drop-shadow(0 0 18px #ffe14d)';
        return tween(2600, function (u) {
          rings.forEach(function (rg, j) { var f = 1 + ((u * 3 + j / 3) % 1) * 0.35; rg.setAttribute('transform', 'translate(' + tx + ',' + ty + ') scale(' + f.toFixed(3) + ') translate(' + -tx + ',' + -ty + ')'); });
          rays.setAttribute('transform', 'rotate(' + (u * 180).toFixed(1) + ',' + tx + ',' + ty + ')');
          runs.forEach(function (rn, j) { var q = (u * 4 + j / 4) % 1; rn.setAttribute('cx', (q * len).toFixed(1)); rn.setAttribute('rx', (18 + q * 30).toFixed(1)); rn.setAttribute('ry', (8 + q * 22).toFixed(1)); });
          core.setAttribute('opacity', (0.75 + 0.25 * Math.sin(u * 60)).toFixed(2));
          if (Math.random() < 0.5) { var sp = sparkle(sparks, tx + (Math.random() - 0.5) * 360 * k, ty + (Math.random() - 0.5) * 300 * k, (0.8 + Math.random()) * k * 1.4, Math.random() < 0.3 ? '#fff3b0' : '#fff'); setTimeout(function () { sp.remove(); }, 500); }
          S.gmt.style.filter = 'brightness(' + (1.15 + 0.15 * Math.sin(u * 30)).toFixed(2) + ') drop-shadow(0 0 18px #ffe14d)';
        });
      })
      .then(function () {
        // the God dissolves into light and sparkles; the beam fades
        tone(880, 0.9, 'sine', 0.04, 0.5);
        for (var j = 0; j < 22; j++) sparkle(sparks, S.gx + (Math.random() - 0.5) * 260 * k, S.gy - Math.random() * 320 * k, (0.8 + Math.random()) * k * 1.6, j % 3 ? '#fff' : '#fff3b0');
        return tween(1000, function (u) { S.godWrap.setAttribute('opacity', (1 - u).toFixed(2)); S.col.setAttribute('opacity', (0.35 * (1 - u)).toFixed(2)); S.colHold = false; beamG.setAttribute('opacity', (1 - u).toFixed(2)); halo.setAttribute('opacity', (1 - u).toFixed(2)); sparks.setAttribute('opacity', (1 - u * 0.6).toFixed(2)); banner.style.opacity = (1 - u).toFixed(2); });
      })
      .then(function () {
        banner.remove(); sparks.remove(); S.gmt.style.filter = '';
        var q = el('text', { x: W * 0.26 + 50 * k, y: Hh * BASE - 190 * k, 'font-family': 'VT323', 'font-size': 60 * k, fill: INK }, S.statue);
        q.textContent = '…?';
        return wait(1000);
      })
      .then(quake);
  }
  // ---- a later visit: a grumble or two, then an angry flick of the staff sends GMT straight back down ----
  function shoo() {
    var k = S.k, sc = 5 * k;
    var mark = el('text', { x: S.gx + 70 * k, y: S.gy - 300 * k, 'font-family': 'VT323', 'font-size': 70 * k, fill: '#d63b48', stroke: INK, 'stroke-width': 1.5 * k }, S.fx);
    mark.textContent = '!!';
    tone(220, 0.25, 'square', 0.05, 0.6); tone(180, 0.3, 'square', 0.05, 0.6, 0.18);
    return tween(700, function (u) {
      S.tilt = Math.sin(u * Math.PI * 8) * 6; S.staffAng = Math.sin(u * Math.PI * 6) * 50;
      mark.setAttribute('transform', 'translate(0,' + (Math.sin(u * 30) * 4 * k).toFixed(1) + ')');
    }).then(function () {
      S.tilt = 0; S.staffAng = null; mark.remove();
      S.godBob.innerHTML = '';
      S.god = motionGod(S.godBob, S.gx, S.gy, sc, 'point');
      // a blast of wind out of the staff
      var tip = [S.gx - 275 * k, Hh * BASE - 14 * k - 185 * k + S.bobY], tx = W * 0.26, ty = Hh * BASE - 8 - 80 * k;
      var ang = Math.atan2(ty - tip[1], tx - tip[0]) * 180 / Math.PI, len = Math.hypot(tx - tip[0], ty - tip[1]);
      var gust = el('g', { transform: 'translate(' + tip[0] + ',' + tip[1] + ') rotate(' + ang + ')' }, S.fx), ws = [];
      for (var i = 0; i < 7; i++) ws.push(el('path', { d: 'M0,' + (i - 3) * 14 + ' q' + len * 0.3 + ',' + (i % 2 ? -18 : 18) + ' ' + len * 0.6 + ',0', fill: 'none', stroke: i % 2 ? '#fff' : '#8cc3f0', 'stroke-width': (i % 2 ? 4 : 6) * k, 'stroke-linecap': 'round', opacity: 0.9 }, gust));
      noise(0.9, 0.14, 900, 0.5); tone(140, 0.5, 'sawtooth', 0.05, 0.4);
      var x0 = W * 0.26, y0 = Hh * BASE;
      return tween(900, function (u) {
        ws.forEach(function (w, j) { w.setAttribute('transform', 'translate(' + ((u * 1.4 - 0.2 + j * 0.03) * len).toFixed(1) + ',0)'); w.setAttribute('opacity', (0.9 * (1 - u)).toFixed(2)); });
        S.r.style.transform = 'translate(' + ((Math.random() - 0.5) * 14 * (1 - u)).toFixed(1) + 'px,' + ((Math.random() - 0.5) * 14 * (1 - u)).toFixed(1) + 'px) scale(1.05)';
        var q = Math.max(0, u - 0.15) / 0.85;
        S.statue.setAttribute('transform', 'translate(' + (-q * 40 * k).toFixed(1) + ',' + (q * q * Hh).toFixed(1) + ') rotate(' + (-q * 14).toFixed(1) + ',' + x0 + ',' + y0 + ')');
      });
    }).then(function () { S.r.style.transform = ''; });
  }

  // ---- 4b · with the God gone the land starts to shake apart, the statue cracks and drops away ----
  function quake() {
    var k = S.k, sv = S.r, x0 = W * 0.26, y0 = Hh * BASE, top = 9.6 * k;
    noise(2.3, 0.14, 90, 0.7); tone(55, 2.2, 'sawtooth', 0.05, 0.6); tone(82, 2.2, 'square', 0.025, 0.5);
    var cracks = [[0, 2, -3, 6, 2, 10, -2, 15, 1, 21], [-8, 4, -5, 9, -9, 13], [7, 3, 4, 8, 8, 14, 5, 19]].map(function (c) {
      var d = 'M' + (x0 + c[0] * top) + ',' + (y0 + c[1] * top);
      for (var j = 2; j < c.length; j += 2) d += ' L' + (x0 + c[j] * top) + ',' + (y0 + c[j + 1] * top);
      var p = el('path', { d: d, fill: 'none', stroke: INK, 'stroke-width': 2.6 * k, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, S.statue);
      var L = p.getTotalLength ? p.getTotalLength() : 600; p.setAttribute('stroke-dasharray', L); p.setAttribute('stroke-dashoffset', L); p.__L = L;
      return p;
    });
    var deb = el('g', {}, S.fx), rocks = [], lastT = performance.now();
    function moveRocks(dt) { rocks.forEach(function (q) { q.vy += 900 * k * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.r += 400 * dt; q.n.setAttribute('transform', 'translate(' + q.x.toFixed(1) + ',' + q.y.toFixed(1) + ') rotate(' + q.r.toFixed(0) + ') scale(' + q.s.toFixed(2) + ')'); }); }
    return tween(2100, function (u) {
      var now = performance.now(), dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
      var amp = 3 + 22 * u * u;
      sv.style.transform = 'translate(' + ((Math.random() - 0.5) * amp).toFixed(1) + 'px,' + ((Math.random() - 0.5) * amp).toFixed(1) + 'px) scale(1.08)';
      cracks.forEach(function (p, j) { p.setAttribute('stroke-dashoffset', (p.__L * (1 - Math.min(1, Math.max(0, u * 1.6 - j * 0.2)))).toFixed(1)); });
      if (Math.random() < 0.25 + u * 0.6) {
        var n = el('path', { d: 'M-4,-3 L3,-4 L5,2 L-1,5 L-5,1 Z', fill: ['#d9d1c1', '#bdb3a2', '#9d9383'][Math.random() * 3 | 0], stroke: INK, 'stroke-width': 1 }, deb);
        rocks.push({ n: n, x: x0 + (Math.random() - 0.5) * 220 * k, y: y0 + Math.random() * 120 * k, vx: (Math.random() - 0.5) * 120 * k, vy: -Math.random() * 160 * k, r: Math.random() * 360, s: (1 + Math.random() * 1.5) * k });
      }
      moveRocks(dt);
      S.statue.setAttribute('transform', 'translate(' + ((Math.random() - 0.5) * amp * 0.5).toFixed(1) + ',' + (u * u * 14 * k).toFixed(1) + ')');
    }).then(function () {
      // crack! the statue gives way and GMT drops with it
      tone(70, 0.7, 'square', 0.08, 0.4); noise(0.6, 0.16, 500, 0.5);
      var fl = el('rect', { width: W, height: Hh, fill: '#fff', opacity: 0.7 }, S.fx);
      lastT = performance.now();
      return tween(750, function (u) {
        var now = performance.now(), dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
        moveRocks(dt);
        fl.setAttribute('opacity', (0.7 * (1 - u)).toFixed(2));
        sv.style.transform = 'translate(' + ((Math.random() - 0.5) * 18 * (1 - u)).toFixed(1) + 'px,' + ((Math.random() - 0.5) * 18 * (1 - u)).toFixed(1) + 'px) scale(1.08)';
        S.statue.setAttribute('transform', 'translate(0,' + (14 * k + u * u * Hh).toFixed(1) + ') rotate(' + (u * 8).toFixed(1) + ',' + x0 + ',' + y0 + ')');
      });
    }).then(function () { sv.style.transform = ''; });
  }

  // ---- 5 · the long fall: tumbling and yelling through layer after layer of cloud, then white ----
  function fall(dur) {
    var k = KS, r = stage('#5fb3f0', '#e6f5ff'), DUR = dur || 6400;
    var back = el('g', { opacity: 0.85 }, r), lines = el('g', {}, r), cs = [];
    for (var i = 0; i < 14; i++) cs.push({ x: Math.random() * W, y: Math.random() * Hh * 2, s: (0.6 + Math.random() * 1.2) * k, sp: 0.5 + Math.random() * 0.6 });
    var cl = cs.map(function () { var g = el('g', {}, back); cloudShape(g, [[-40, 6, 26], [-12, -6, 32], [22, -2, 28], [48, 8, 20]], '#fff', '#e3edfb', STY.line, 2); return g; });
    var ls = []; for (i = 0; i < 20; i++) ls.push({ x: Math.random() * W, y: Math.random() * Hh, l: (60 + Math.random() * 140) * k, n: el('path', { stroke: '#fff', 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0.85 }, lines) });
    var gm = walker(r, { x: W / 2, y: Hh * 0.45, s: 3 * k });
    // "AAAA!" in a comic bubble that trails above him
    var yell = el('g', {}, r);
    el('rect', { x: -78 * k, y: -26 * k, width: 156 * k, height: 46 * k, rx: 10 * k, fill: '#fff', stroke: INK, 'stroke-width': 3 * k }, yell);
    var yt = el('text', { x: 0, y: 10 * k, 'text-anchor': 'middle', 'font-family': 'VT323', 'font-size': 40 * k, fill: INK }, yell);
    // clouds in front of him: a few loose ones, and three thick banks he plunges straight through
    var front = el('g', {}, r), fs = [];
    for (i = 0; i < 5; i++) { var fg = el('g', {}, front); cloudShape(fg, [[-40, 6, 26], [-12, -6, 32], [22, -2, 28], [48, 8, 20]], '#fff', '#e3edfb', STY.line, 1.2); fs.push({ g: fg, x: Math.random() * W, y: Math.random() * Hh * 2, s: (2 + Math.random() * 1.5) * k, sp: 1.3 + Math.random() * 0.5 }); }
    var BH = Hh * 0.9;
    var banks = [[0.16, 0.3], [0.42, 0.55], [0.68, 0.8], [0.88, 1.02]].map(function (w, j) {
      var g = el('g', {}, front), pf = [];
      for (var x = -60; x < W + 80; x += 64 * k) { pf.push([x, 30 * k * Math.sin(x * 0.02 + j), (52 + 26 * Math.sin(x * 0.05 + j * 2)) * k]); pf.push([x + 30 * k, BH - 30 * k * Math.sin(x * 0.03 + j), (50 + 22 * Math.sin(x * 0.04 + j)) * k]); }
      cloudShape(g, pf, '#fff', null, STY.line, 2.4 * k);
      el('rect', { x: -80, y: 0, width: W + 160, height: BH, fill: '#fff' }, g);
      for (x = 0; x < 6; x++) el('ellipse', { cx: W * (0.1 + x * 0.17), cy: BH * (0.3 + (x % 3) * 0.2), rx: 90 * k, ry: 14 * k, fill: '#e8f1fc' }, g);
      g.setAttribute('display', 'none');
      return { g: g, a: w[0], b: w[1], hit: false };
    });
    var white = el('rect', { width: W, height: Hh, fill: '#fff', opacity: 0 }, r);
    noise(DUR / 1000, 0.05, 700, 0.6); tone(1300, DUR / 1000, 'sine', 0.03, 0.2);
    return tween(DUR, function (u) {
      cs.forEach(function (c, j) { var y = (c.y - u * Hh * 3 * c.sp) % (Hh * 2); if (y < -200) y += Hh * 2 + 200; cl[j].setAttribute('transform', 'translate(' + c.x + ',' + y + ') scale(' + c.s + ')'); });
      fs.forEach(function (c) { var y = ((c.y - u * Hh * 7 * c.sp) % (Hh * 2.5) + Hh * 2.5) % (Hh * 2.5) - Hh * 0.5; c.g.setAttribute('transform', 'translate(' + c.x + ',' + y.toFixed(1) + ') scale(' + c.s + ')'); });
      ls.forEach(function (l) { var y = ((l.y - u * Hh * 9) % Hh + Hh) % Hh; l.n.setAttribute('d', 'M' + l.x + ',' + y + ' v' + l.l); });
      // a wild tumble: weaving across the screen, flipping end over end and turning round and round
      var x = W / 2 + Math.sin(u * 6.3) * W * 0.18, y = Hh * 0.45 + Math.sin(u * 11) * Hh * 0.05;
      var rot = u * 1800 + Math.sin(u * 20) * 40, sx = 3 * k * Math.cos(u * 17);
      gm.setAttribute('transform', 'translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ') rotate(' + rot.toFixed(0) + ',0,-24) scale(' + sx.toFixed(3) + ',' + 3 * k + ')');
      yt.textContent = 'A' + new Array(2 + Math.floor((u * 40) % 6)).join('A') + '!';
      yell.setAttribute('transform', 'translate(' + (x + (Math.random() - 0.5) * 4).toFixed(1) + ',' + (y - 150 * k + (Math.random() - 0.5) * 4).toFixed(1) + ') rotate(' + (Math.sin(u * 30) * 4).toFixed(1) + ')');
      banks.forEach(function (bk) {
        if (u < bk.a || u > bk.b) { bk.g.setAttribute('display', 'none'); return; }
        if (!bk.hit) { bk.hit = true; noise(0.8, 0.12, 380, 0.5); tone(240, 0.6, 'sine', 0.03, 0.5); }
        var q = (u - bk.a) / (bk.b - bk.a);
        bk.g.setAttribute('display', '');
        bk.g.setAttribute('transform', 'translate(0,' + (Hh + 80 * k - q * (Hh + BH + 160 * k)).toFixed(1) + ')');
      });
      r.style.transform = 'translate(' + ((Math.random() - 0.5) * 4).toFixed(1) + 'px,' + ((Math.random() - 0.5) * 4).toFixed(1) + 'px)';
      white.setAttribute('opacity', Math.max(0, (u - 0.9) / 0.1).toFixed(2));
    });
  }

  // the reward's styles and card live here, so the page itself never mentions the Cloud Rider
  var CSS = '.hero.cloud [data-c=sleeve],.cloud [data-c=sleeve]{display:none}.charsel[data-kind=cloud] [data-only=astro]{display:none}.cs-stage[data-k=cloud]{background-color:#eaf5ff}' +
    '.cs-card[data-char=cloud]{box-shadow:0 0 0 3px #ffc933,4px 4px 0 var(--ink)}' +
    '.cr-puff{fill:#fff;stroke:#b4c9e4;stroke-width:1.2;transform-box:fill-box;transform-origin:center;animation:crPuff 2.3s ease-out infinite}' +
    '@keyframes crPuff{0%{opacity:0;transform:translate(0,0) scale(.4)}25%{opacity:.95}100%{opacity:0;transform:translate(var(--dx),-26px) scale(2)}}' +
    '#b-char.egg-new{position:relative;animation:eggGlow 1s ease-in-out infinite}#b-char.egg-new::after{content:"NEW";position:absolute;top:-12px;right:-10px;background:#d63b48;color:#fff;font:400 14px/1 var(--px);padding:2px 5px;border:2px solid var(--ink)}' +
    '@keyframes eggGlow{0%,100%{box-shadow:4px 4px 0 var(--ink),0 0 0 3px #ffc933}50%{box-shadow:4px 4px 0 var(--ink),0 0 0 3px #ffc933,0 0 22px 8px #ffd23f}}' +
    '.egg{position:fixed;inset:0;z-index:90;background:#000;overflow:hidden;cursor:default;user-select:none;-webkit-user-select:none}' +
    '.egg-dlg{position:absolute;left:50%;bottom:24px;transform:translateX(-50%);width:min(980px,calc(100% - 24px));min-height:150px;display:flex;gap:16px;align-items:stretch;padding:14px 16px 16px;background:rgba(43,33,64,.95);border:4px solid #e7c97a;border-radius:4px;box-shadow:6px 6px 0 #16161d;color:#fff}' +
    '.egg-pt{flex:none;width:118px;height:118px;background:#f4e3c8;border:3px solid #e7c97a;overflow:hidden}.egg-pt svg{width:100%;height:100%;display:block}' +
    '.egg-tx{flex:1;min-width:0;padding-top:4px}.egg-tx b{display:inline-block;margin:-30px 0 8px;background:#e7c97a;color:#16161d;border:3px solid #16161d;padding:2px 12px;font:400 24px/1 VT323,monospace}' +
    '.egg-tx p{margin:0;font:400 26px/1.3 VT323,monospace;letter-spacing:.3px;min-height:3.9em}' +
    '.egg-skip{position:absolute;right:16px;bottom:12px;background:#fbf8f0;color:#16161d;border:3px solid #16161d;font:400 22px/1 VT323,monospace;padding:4px 12px;cursor:pointer}' +
    '.egg-skip:hover{background:#ffc933}.egg-more{position:absolute;right:136px;bottom:18px;color:#e7c97a;font-style:normal;animation:eggBob .6s ease-in-out infinite alternate}' +
    '@keyframes eggBob{to{transform:translateY(4px)}}' +
    '.egg-motto{position:absolute;left:50%;top:7%;transform:translateX(-50%);max-width:calc(100% - 24px);text-align:center;background:rgba(43,33,64,.94);border:4px solid #e7c97a;color:#ffe14d;font:400 clamp(22px,5.4vw,46px)/1.15 VT323,monospace;padding:10px 22px;animation:eggShake .12s steps(2) infinite}' +
    '.egg-motto span{display:block;white-space:nowrap}' +
    '@keyframes eggShake{50%{transform:translateX(-50%) translate(1px,-1px)}}' +
    '.egg-fade{transition:opacity .7s ease}' +
    '@media (max-width:600px){.egg-pt{width:72px;height:72px}.egg-tx p{font-size:21px}.egg-dlg{min-height:130px;padding:12px}.egg-more{right:120px}}';

  function play(o) {
    o = o || {};
    var lang = o.lang === 'vi' ? 'vi' : 'en';
    if (!document.getElementById('egg-css')) { var st = document.createElement('style'); st.id = 'egg-css'; st.textContent = CSS; document.head.appendChild(st); }
    var ov = document.createElement('div'); ov.className = 'egg'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Motion God');
    document.body.appendChild(ov);
    HOST = ov;
    function end() {
      // fade the white back to the city, which is already waiting at Home
      if (o.onDone) o.onDone();
      ov.style.background = 'transparent';
      ov.innerHTML = '<div style="position:absolute;inset:0;background:#fff"></div>';
      ov.classList.add('egg-fade');
      requestAnimationFrame(function () { ov.style.opacity = '0'; });
      setTimeout(function () { ov.remove(); }, 800);
    }
    var rant = RANT[lang].slice(), a = rant.splice(Math.random() * rant.length | 0, 1)[0], b = rant[Math.random() * rant.length | 0];
    staticTV(ov)
      .then(function () { buildLand(); return riseAndDescend(); })
      .then(function () { return talk(ov, o.again ? [['Motion God', a], ['Motion God', b]] : LINES[lang]); })
      .then(function () { return o.again ? shoo() : bestow(lang); })
      .then(function () { S.liveOn = false; ov.innerHTML = ''; return fall(o.again ? 3600 : 6400); })
      .then(end, function (err) { if (window.console) console.error(err); end(); });
  }
  var CARD = '<button type="button" class="cs-card" data-char="cloud" style="--c:#eaf5ff">' +
    '<span class="cs-pv" data-pv="cloud"></span><span class="cs-txt">' +
    '<b class="cs-name"><span lang="en">03 · Cloud Rider</span><span lang="vi">03 · Cưỡi mây</span></b>' +
    '<span class="cs-desc"><span lang="en">A gift from the Motion God: glides on a bear cloud. Gone when you reload.</span><span lang="vi">Quà của Motion God: lướt trên mây gấu. Tải lại trang là biến mất.</span></span>' +
    '<span class="cs-spd"><span lang="en">SPEED</span><span lang="vi">TỐC ĐỘ</span><i><b class="on"></b><b class="on"></b><b class="on"></b><b class="on"></b><b class="on"></b></i></span>' +
    '<span class="cs-cur"><span lang="en">▶ PLAYING</span><span lang="vi">▶ ĐANG CHƠI</span></span></span></button>';
  window.GMTEgg = { play: play, card: CARD };
})();
