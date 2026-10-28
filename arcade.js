/* GMT City — Mini Arcade.
   Four original games built on classic arcade gameplay (art and code are ours, free to ship). */
(function () {
  'use strict';

  var C = {
    ink: '#16161d', cream: '#fbf8f0', bg: '#100e1c', grid: '#1d1a33',
    orange: '#ff6b2c', green: '#3fcf8e', purple: '#6d5cf0', blue: '#3d8bff',
    yellow: '#ffc933', pink: '#ff7eb9', lilac: '#c9b6ff', sky: '#3db8ff', red: '#ff4d5e',
    skin: '#f8c0a2', navy: '#262d4a'
  };
  var W = 320, H = 240;
  var win = document.getElementById('arcade');
  var body = document.getElementById('ar-body');
  var keysEl = document.getElementById('ar-keys');
  var fileEl = document.getElementById('ar-file');

  function L(en, vi) { return '<span lang="en">' + en + '</span><span lang="vi">' + vi + '</span>'; }
  function vi() { return document.documentElement.getAttribute('data-lang') === 'vi'; }
  function sfx(n) { var s = window.GMTCity && GMTCity.sfx; if (s && s[n]) s[n](); }
  function beep(f, d, type, v, slide) { var s = window.GMTCity && GMTCity.sfx; if (s && s.tone) s.tone(f, d, type || 'square', v || 0.04, slide); }
  function best(id, v) {
    try { if (v != null) localStorage.setItem('arcade-best-' + id, v); return +localStorage.getItem('arcade-best-' + id) || 0; } catch (e) { return 0; }
  }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function ri(a, b) { return Math.floor(rnd(a, b + 1)); }
  function hit(a, b) { return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h; }
  function text(ctx, s, x, y, size, col, align) {
    ctx.font = size + 'px VT323, monospace';
    ctx.fillStyle = col || '#fff'; ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(s, x, y);
  }
  function rect(ctx, x, y, w, h, col) { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  function backdrop(ctx) {
    rect(ctx, 0, 0, W, H, C.bg);
    ctx.fillStyle = C.grid;
    for (var x = 0; x < W; x += 16) ctx.fillRect(x, 0, 1, H);
    for (var y = 0; y < H; y += 16) ctx.fillRect(0, y, W, 1);
  }
  // little keyframe creature (same family as the ones in the city)
  function keyframe(ctx, type, x, y, s, col, blink) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.beginPath();
    if (type === 0) { ctx.moveTo(0, -7); ctx.lineTo(7, 0); ctx.lineTo(0, 7); ctx.lineTo(-7, 0); }
    else if (type === 1) { ctx.moveTo(-6, -7); ctx.lineTo(6, -7); ctx.lineTo(2, 0); ctx.lineTo(6, 7); ctx.lineTo(-6, 7); ctx.lineTo(-2, 0); }
    else if (type === 2) { ctx.arc(0, 0, 7, 0, Math.PI * 2); }
    else { ctx.rect(-6, -6, 12, 12); }
    ctx.closePath();
    ctx.fillStyle = col; ctx.fill();
    ctx.lineWidth = 1.6; ctx.strokeStyle = C.ink; ctx.stroke();
    ctx.fillStyle = C.ink;
    var eh = blink ? 0.6 : 2.2;
    ctx.fillRect(-3.2, -1.6, 1.8, eh); ctx.fillRect(1.4, -1.6, 1.8, eh);
    ctx.restore();
  }

  /* ---------------- input ---------------- */
  var held = {}, tapped = {};
  var KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    Space: 'a', KeyZ: 'a', KeyJ: 'a', KeyX: 'b', KeyK: 'b', Enter: 'start', KeyP: 'pause'
  };
  function press(b) { if (!held[b]) tapped[b] = true; held[b] = true; }
  function release(b) { held[b] = false; }

  /* ================= GAMES ================= */
  var GAMES = [];

  /* ---- Snake ---- */
  GAMES.push({
    id: 'snake', en: 'Snake', vi: 'Rắn săn mồi', col: C.green,
    keys: [['← ↑ ↓ →', 'Turn', 'Rẽ hướng']],
    reset: function () {
      this.s = [{ x: 7, y: 7 }, { x: 6, y: 7 }, { x: 5, y: 7 }, { x: 4, y: 7 }];
      this.dir = { x: 1, y: 0 }; this.q = []; this.t = 0; this.step = 0.13;
      this.score = 0; this.dead = false; this.food = this.place();
    },
    place: function () {
      for (;;) {
        var f = { x: ri(0, 19), y: ri(0, 14) }, s = this.s;
        if (!s.some(function (p) { return p.x === f.x && p.y === f.y; })) return f;
      }
    },
    update: function (dt) {
      var self = this;
      [['left', -1, 0], ['right', 1, 0], ['up', 0, -1], ['down', 0, 1]].forEach(function (d) {
        if (tapped[d[0]] && self.q.length < 3) self.q.push({ x: d[1], y: d[2] });
      });
      this.t += dt;
      if (this.t < this.step) return;
      this.t -= this.step;
      while (this.q.length) {
        var n = this.q.shift();
        if (n.x !== -this.dir.x || n.y !== -this.dir.y) { this.dir = n; break; }
      }
      var h = { x: this.s[0].x + this.dir.x, y: this.s[0].y + this.dir.y };
      if (h.x < 0 || h.y < 0 || h.x > 19 || h.y > 14 || this.s.some(function (p) { return p.x === h.x && p.y === h.y; })) {
        this.dead = true; return;
      }
      this.s.unshift(h);
      if (h.x === this.food.x && h.y === this.food.y) {
        this.score += 10; this.food = this.place(); this.step = Math.max(0.06, this.step - 0.004);
        beep(880, 0.06, 'square', 0.04, 1.5);
      } else this.s.pop();
    },
    draw: function (ctx, t) {
      backdrop(ctx);
      var f = this.food, cs = 16;
      rect(ctx, f.x * cs + 3, f.y * cs + 4, 10, 10, C.red);
      rect(ctx, f.x * cs + 7, f.y * cs + 1, 2, 4, C.green);
      rect(ctx, f.x * cs + 5, f.y * cs + 6, 2, 2, '#fff');
      var n = this.s.length;
      this.s.forEach(function (p, i) {
        rect(ctx, p.x * cs + 1, p.y * cs + 1, 14, 14, C.ink);
        rect(ctx, p.x * cs + 2, p.y * cs + 2, 12, 12, i === 0 ? C.yellow : (i % 2 ? C.green : '#33b97c'));
      });
      var h = this.s[0], d = this.dir;
      var ex = h.x * cs + 8 + d.x * 3, ey = h.y * cs + 8 + d.y * 3;
      rect(ctx, ex - 4 + d.y * 0, ey - 4 + Math.abs(d.x) * 0, 3, 3, C.ink);
      rect(ctx, ex + 1, ey + 1, 3, 3, C.ink);
    }
  });

  /* ---- Brick Breaker ---- */
  GAMES.push({
    id: 'bricks', en: 'Brick Breaker', vi: 'Phá gạch', col: C.orange,
    keys: [['← →', 'Move paddle', 'Di chuyển thanh đỡ'], ['SPACE', 'Launch ball', 'Bắn bóng']],
    reset: function () {
      this.p = { x: 136, y: 222, w: 48, h: 7 };
      this.lives = 3; this.score = 0; this.level = 1; this.dead = false; this.speed = 165;
      this.build(); this.serve();
    },
    build: function () {
      var cols = [C.pink, C.orange, C.yellow, C.green, C.sky], self = this;
      this.bricks = [];
      for (var r = 0; r < 5; r++) for (var c = 0; c < 10; c++) {
        if (this.level > 1 && (r + c + this.level) % 7 === 0) continue;
        self.bricks.push({ x: 11 + c * 30, y: 28 + r * 13, w: 28, h: 11, col: cols[r], pts: (5 - r) * 10 });
      }
    },
    serve: function () { this.b = { x: this.p.x + 24, y: this.p.y - 4, vx: 0, vy: 0, r: 3, stuck: true }; },
    update: function (dt) {
      var p = this.p, b = this.b;
      if (held.left) p.x -= 240 * dt;
      if (held.right) p.x += 240 * dt;
      if (this.pointerX != null) p.x += (this.pointerX - p.w / 2 - p.x) * Math.min(1, dt * 18);
      p.x = Math.max(4, Math.min(W - 4 - p.w, p.x));
      if (b.stuck) {
        b.x = p.x + p.w / 2; b.y = p.y - 4;
        if (tapped.a || tapped.up || tapped.tap) { b.stuck = false; var a = rnd(-0.5, 0.5); b.vx = Math.sin(a) * this.speed; b.vy = -Math.cos(a) * this.speed; beep(520, 0.05); }
        return;
      }
      var steps = 4;
      for (var s = 0; s < steps; s++) {
        b.x += b.vx * dt / steps; b.y += b.vy * dt / steps;
        if (b.x < 4) { b.x = 4; b.vx = Math.abs(b.vx); beep(300, 0.03); }
        if (b.x > W - 4) { b.x = W - 4; b.vx = -Math.abs(b.vx); beep(300, 0.03); }
        if (b.y < 4) { b.y = 4; b.vy = Math.abs(b.vy); beep(300, 0.03); }
        var bb = { x: b.x - b.r, y: b.y - b.r, w: b.r * 2, h: b.r * 2 };
        if (b.vy > 0 && hit(bb, p)) {
          var off = (b.x - (p.x + p.w / 2)) / (p.w / 2), sp = Math.hypot(b.vx, b.vy);
          b.vx = off * sp * 0.85; b.vy = -Math.sqrt(Math.max(sp * sp - b.vx * b.vx, sp * sp * 0.2));
          b.y = p.y - b.r; beep(420, 0.04);
        }
        for (var i = 0; i < this.bricks.length; i++) {
          var k = this.bricks[i];
          if (!hit(bb, k)) continue;
          var ox = Math.min(bb.x + bb.w - k.x, k.x + k.w - bb.x), oy = Math.min(bb.y + bb.h - k.y, k.y + k.h - bb.y);
          if (ox < oy) b.vx = -b.vx; else b.vy = -b.vy;
          this.score += k.pts; this.bricks.splice(i, 1);
          beep(660 + Math.random() * 200, 0.05);
          break;
        }
      }
      if (b.y > H + 6) {
        this.lives--; beep(160, 0.3, 'triangle', 0.06, 0.5);
        if (this.lives <= 0) this.dead = true; else this.serve();
      }
      if (!this.bricks.length) { this.level++; this.speed *= 1.1; this.build(); this.serve(); beep(784, 0.2, 'square', 0.05, 1.5); }
    },
    draw: function (ctx) {
      backdrop(ctx);
      this.bricks.forEach(function (k) {
        rect(ctx, k.x, k.y, k.w, k.h, C.ink);
        rect(ctx, k.x + 1, k.y + 1, k.w - 2, k.h - 2, k.col);
        rect(ctx, k.x + 2, k.y + 2, k.w - 4, 2, 'rgba(255,255,255,.55)');
      });
      var p = this.p, b = this.b;
      rect(ctx, p.x, p.y, p.w, p.h, C.ink);
      rect(ctx, p.x + 1, p.y + 1, p.w - 2, p.h - 2, C.lilac);
      rect(ctx, b.x - 3, b.y - 3, 6, 6, '#fff');
      for (var i = 0; i < this.lives; i++) rect(ctx, 6 + i * 10, 8, 7, 4, C.lilac);
      text(ctx, 'LV ' + this.level, W - 8, 10, 14, '#fff', 'right');
    }
  });

  /* ---- Space Defender ---- */
  GAMES.push({
    id: 'defender', en: 'Space Defender', vi: 'Bảo vệ vũ trụ', col: C.purple,
    keys: [['← →', 'Move', 'Di chuyển'], ['SPACE', 'Fire', 'Bắn']],
    reset: function () {
      this.ship = { x: 152, y: 218, w: 16, h: 10 };
      this.shots = []; this.bombs = []; this.boom = [];
      this.lives = 3; this.score = 0; this.wave = 0; this.dead = false; this.cool = 0; this.inv = 0;
      this.next();
    },
    next: function () {
      this.wave++;
      var cols = [C.pink, C.yellow, C.green, C.sky];
      this.en = [];
      for (var r = 0; r < 4; r++) for (var c = 0; c < 8; c++) this.en.push({ x: 44 + c * 30, y: 34 + r * 22, w: 16, h: 14, type: r, col: cols[r] });
      this.dir = 1; this.t = 0; this.frame = 0; this.base = Math.max(0.28, 0.62 - this.wave * 0.06);
    },
    update: function (dt) {
      var s = this.ship, self = this;
      if (held.left) s.x -= 150 * dt;
      if (held.right) s.x += 150 * dt;
      if (this.pointerX != null) s.x += (this.pointerX - s.w / 2 - s.x) * Math.min(1, dt * 14);
      s.x = Math.max(4, Math.min(W - 4 - s.w, s.x));
      this.cool -= dt; this.inv -= dt;
      if ((tapped.a || tapped.up || (held.a && this.cool < -0.25)) && this.cool <= 0 && this.shots.length < 2) {
        this.shots.push({ x: s.x + 7, y: s.y - 4, w: 2, h: 6 }); this.cool = 0.28; beep(990, 0.05, 'square', 0.03, 0.6);
      }
      this.shots.forEach(function (b) { b.y -= 260 * dt; });
      this.shots = this.shots.filter(function (b) { return b.y > -8; });
      // march
      this.t += dt;
      var iv = Math.max(0.05, this.base * this.en.length / 32);
      if (this.t > iv && this.en.length) {
        this.t = 0; this.frame ^= 1;
        var minX = Infinity, maxX = -Infinity;
        this.en.forEach(function (e) { minX = Math.min(minX, e.x); maxX = Math.max(maxX, e.x + e.w); });
        if ((this.dir > 0 && maxX + 6 > W - 4) || (this.dir < 0 && minX - 6 < 4)) {
          this.dir = -this.dir; this.en.forEach(function (e) { e.y += 10; });
        } else this.en.forEach(function (e) { e.x += 6 * self.dir; });
        beep(this.frame ? 110 : 98, 0.05, 'triangle', 0.05);
      }
      // enemy fire from the lowest one in a random column
      if (this.en.length && Math.random() < dt * (0.9 + this.wave * 0.25)) {
        var pick = this.en[ri(0, this.en.length - 1)];
        var low = this.en.filter(function (e) { return Math.abs(e.x - pick.x) < 4; }).sort(function (a, b) { return b.y - a.y; })[0];
        this.bombs.push({ x: low.x + 7, y: low.y + 14, w: 3, h: 6 });
      }
      this.bombs.forEach(function (b) { b.y += 110 * dt; });
      this.bombs = this.bombs.filter(function (b) { return b.y < H + 8; });
      // hits
      for (var i = this.shots.length - 1; i >= 0; i--) {
        for (var j = this.en.length - 1; j >= 0; j--) {
          if (hit(this.shots[i], this.en[j])) {
            var e = this.en[j];
            this.boom.push({ x: e.x + 8, y: e.y + 7, t: 0.3, col: e.col });
            this.score += (4 - e.type) * 10; this.en.splice(j, 1); this.shots.splice(i, 1);
            beep(220, 0.12, 'sawtooth', 0.04, 0.4);
            break;
          }
        }
      }
      if (this.inv <= 0) {
        for (i = this.bombs.length - 1; i >= 0; i--) {
          if (hit(this.bombs[i], s)) {
            this.bombs.splice(i, 1); this.lives--; this.inv = 1.4;
            this.boom.push({ x: s.x + 8, y: s.y + 5, t: 0.5, col: C.orange });
            beep(140, 0.4, 'sawtooth', 0.06, 0.4);
            if (this.lives <= 0) this.dead = true;
          }
        }
      }
      this.boom.forEach(function (b) { b.t -= dt; });
      this.boom = this.boom.filter(function (b) { return b.t > 0; });
      if (this.en.some(function (e) { return e.y + e.h >= s.y; })) this.dead = true;
      if (!this.en.length) { this.next(); beep(784, 0.25, 'square', 0.05, 1.5); }
    },
    draw: function (ctx, t) {
      backdrop(ctx);
      var self = this;
      this.en.forEach(function (e) { keyframe(ctx, e.type, e.x + 8, e.y + 7 + (self.frame ? 1 : -1), 1, e.col, Math.sin(t * 3 + e.x) > 0.96); });
      this.shots.forEach(function (b) { rect(ctx, b.x, b.y, b.w, b.h, C.yellow); });
      this.bombs.forEach(function (b) { rect(ctx, b.x, b.y, b.w, b.h, C.red); rect(ctx, b.x - 1, b.y + 2, b.w + 2, 2, C.red); });
      this.boom.forEach(function (b) {
        var r = (0.5 - b.t) * 30;
        for (var k = 0; k < 6; k++) { var a = k * Math.PI / 3; rect(ctx, b.x + Math.cos(a) * r - 1, b.y + Math.sin(a) * r - 1, 3, 3, b.col); }
      });
      var s = this.ship;
      if (this.inv <= 0 || Math.floor(t * 12) % 2) {
        rect(ctx, s.x, s.y + 4, 16, 6, C.ink);
        rect(ctx, s.x + 1, s.y + 5, 14, 4, C.sky);
        rect(ctx, s.x + 6, s.y, 4, 5, C.ink);
        rect(ctx, s.x + 7, s.y + 1, 2, 4, C.cream);
      }
      for (var i = 0; i < this.lives; i++) rect(ctx, 6 + i * 12, 7, 9, 4, C.sky);
      text(ctx, (vi() ? 'ĐỢT ' : 'WAVE ') + this.wave, W - 8, 10, 14, '#fff', 'right');
      rect(ctx, 0, 230, W, 1, C.purple);
    }
  });

  /* ---- Keyframe Run ---- */
  GAMES.push({
    id: 'runner', en: 'Keyframe Run', vi: 'Chạy né keyframe', col: C.yellow,
    keys: [['SPACE / ↑', 'Jump (hold = higher)', 'Nhảy (giữ = cao hơn)'], ['↓', 'Duck', 'Cúi người']],
    reset: function () {
      this.g = 196; this.h = { x: 44, y: 196, vy: 0, duck: false }; this.obs = [];
      this.speed = 140; this.dist = 0; this.score = 0; this.dead = false; this.spawn = 1.1; this.run = 0;
    },
    update: function (dt) {
      var h = this.h, onGround = h.y >= this.g - 0.01;
      this.speed += dt * 5; this.dist += this.speed * dt; this.score = Math.floor(this.dist / 10);
      if ((tapped.a || tapped.up || tapped.tap) && onGround) { h.vy = -310; beep(520, 0.08, 'square', 0.04, 1.6); }
      var grav = (held.a || held.up || held.tap) && h.vy < 0 ? 620 : 1100;
      if (held.down && !onGround) grav = 2200;
      h.vy += grav * dt; h.y += h.vy * dt;
      if (h.y > this.g) { h.y = this.g; h.vy = 0; }
      h.duck = held.down && h.y >= this.g - 0.01;
      this.run += dt * this.speed / 14;
      this.spawn -= dt;
      if (this.spawn <= 0) {
        var r = Math.random(), o;
        if (this.score > 40 && r < 0.28) o = { x: W + 10, y: this.g - 34, w: 14, h: 14, type: 2, col: C.pink, fly: 1 };
        else if (this.score > 20 && r < 0.5) o = { x: W + 10, y: this.g - 28, w: 14, h: 28, type: 1, col: C.green, tall: 1 };
        else o = { x: W + 10, y: this.g - 14, w: 14, h: 14, type: [0, 3][ri(0, 1)], col: [C.sky, C.orange, C.purple][ri(0, 2)] };
        this.obs.push(o);
        this.spawn = rnd(0.75, 1.5) * 150 / this.speed + 0.35;
      }
      var self = this;
      this.obs.forEach(function (o) { o.x -= self.speed * dt; });
      this.obs = this.obs.filter(function (o) { return o.x > -30; });
      var hb = h.duck ? { x: h.x + 2, y: h.y - 14, w: 12, h: 14 } : { x: h.x + 3, y: h.y - 26, w: 10, h: 26 };
      for (var i = 0; i < this.obs.length; i++) {
        var o = this.obs[i], ob = { x: o.x + 2, y: o.y + 2, w: o.w - 4, h: o.h - 4 };
        if (hit(hb, ob)) { this.dead = true; beep(150, 0.4, 'sawtooth', 0.06, 0.4); return; }
      }
    },
    draw: function (ctx, t) {
      backdrop(ctx);
      var g = this.g, off = (this.dist || 0) % 16;
      rect(ctx, 0, g, W, 2, C.lilac);
      for (var x = -off; x < W; x += 16) rect(ctx, x, g + 6, 8, 2, C.purple);
      this.obs.forEach(function (o) {
        if (o.tall) { keyframe(ctx, 1, o.x + 7, o.y + 7, 1, o.col); keyframe(ctx, 1, o.x + 7, o.y + 21, 1, o.col); }
        else keyframe(ctx, o.type, o.x + 7, o.y + 7 + (o.fly ? Math.sin(t * 6) * 2 : 0), 1, o.col);
      });
      // hero: tiny chibi of the city hero
      var h = this.h, y = Math.round(h.y), x = Math.round(h.x), leg = Math.sin(this.run) > 0;
      if (h.duck) {
        rect(ctx, x, y - 12, 16, 8, '#fff'); rect(ctx, x, y - 5, 16, 5, C.navy);
        rect(ctx, x + 9, y - 16, 8, 8, C.skin); rect(ctx, x + 8, y - 18, 10, 4, C.navy);
        rect(ctx, x + 3, y - 14, 5, 4, '#a3563b');
      } else {
        var air = h.y < this.g - 0.5;
        rect(ctx, x + 4, y - 9, 3, 9 - (air ? 2 : leg ? 2 : 0), C.navy);
        rect(ctx, x + 9, y - 9, 3, 9 - (air ? 0 : leg ? 0 : 2), C.navy);
        rect(ctx, x + 3, y - 18, 10, 9, '#fff');
        rect(ctx, x + 2, y - 20, 12, 4, '#a3563b');
        rect(ctx, x + 3, y - 28, 10, 9, C.skin);
        rect(ctx, x + 2, y - 31, 12, 5, C.navy); rect(ctx, x + 2, y - 27, 2, 4, C.navy);
        rect(ctx, x + 9, y - 25, 2, 2, C.ink);
      }
      rect(ctx, x + 1, g + 1, 14, 2, 'rgba(0,0,0,.35)');
    }
  });


  /* ---- Flappy GMT: the hero rides a little winged bear ---- */
  GAMES.unshift({
    id: 'flappy', en: 'Flappy GMT', vi: 'Flappy GMT', col: C.sky,
    keys: [['SPACE / ↑', 'Flap', 'Vỗ cánh bay lên']],
    reset: function () {
      this.y = 110; this.vy = 0; this.pipes = []; this.t = 0; this.score = 0; this.dead = false; this.gx = 0; this.flap = 0;
      this.next = 0.9;
    },
    update: function (dt) {
      if (tapped.a || tapped.up || tapped.tap) { this.vy = -235; this.flap = 0.25; beep(620, 0.06, 'square', 0.035, 1.4); }
      this.vy += 760 * dt; this.y += this.vy * dt; this.flap -= dt;
      var sp = 92 + Math.min(40, this.score * 2);
      this.gx = (this.gx + sp * dt) % 16;
      this.next -= dt;
      if (this.next <= 0) {
        var gap = Math.max(64, 84 - this.score);
        this.pipes.push({ x: W + 10, w: 30, top: ri(30, 196 - gap - 20), gap: gap, col: [C.orange, C.green, C.purple, C.pink, C.yellow][ri(0, 4)], done: false });
        this.next = 150 / sp + 0.15;
      }
      var self = this, me = { x: 58, y: this.y - 12, w: 28, h: 22 };
      this.pipes.forEach(function (p) {
        p.x -= sp * dt;
        if (!p.done && p.x + p.w < me.x) { p.done = true; self.score++; beep(990, 0.07, 'square', 0.04, 1.3); }
        if (hit(me, { x: p.x, y: 0, w: p.w, h: p.top }) || hit(me, { x: p.x, y: p.top + p.gap, w: p.w, h: 400 })) self.dead = true;
      });
      this.pipes = this.pipes.filter(function (p) { return p.x > -40; });
      if (this.y > 196 - 11 || this.y < 8) this.dead = true;
      if (this.dead) beep(150, 0.4, 'sawtooth', 0.06, 0.4);
    },
    draw: function (ctx, t) {
      rect(ctx, 0, 0, W, H, '#1c2a52');
      for (var i = 0; i < 18; i++) rect(ctx, (i * 53 + 17) % W, (i * 37) % 150, 2, 2, 'rgba(255,255,255,.5)');
      this.pipes.forEach(function (p) {
        var bot = p.top + p.gap;
        rect(ctx, p.x, 0, p.w, p.top, C.ink); rect(ctx, p.x + 2, 0, p.w - 4, p.top - 2, p.col);
        rect(ctx, p.x - 3, p.top - 10, p.w + 6, 10, C.ink); rect(ctx, p.x - 1, p.top - 8, p.w + 2, 6, '#fff');
        rect(ctx, p.x, bot, p.w, 200, C.ink); rect(ctx, p.x + 2, bot + 2, p.w - 4, 200, p.col);
        rect(ctx, p.x - 3, bot, p.w + 6, 10, C.ink); rect(ctx, p.x - 1, bot + 2, p.w + 2, 6, '#fff');
        for (var k = bot + 18; k < 196; k += 14) rect(ctx, p.x + 8, k, 5, 7, 'rgba(0,0,0,.35)');
      });
      rect(ctx, 0, 196, W, 44, '#2a2447');
      rect(ctx, 0, 196, W, 3, C.lilac);
      for (var x = -this.gx; x < W; x += 16) rect(ctx, x, 204, 8, 3, C.purple);
      // bear with tiny wings, hero on its back
      var y = Math.round(this.y), x0 = 56, tilt = Math.max(-0.4, Math.min(0.6, this.vy / 500));
      ctx.save(); ctx.translate(x0 + 14, y); ctx.rotate(tilt); ctx.scale(1.35, 1.35);
      var up = this.flap > 0 || Math.floor(t * 10) % 2;
      rect(ctx, -6, up ? -14 : -2, 10, 8, '#fff'); rect(ctx, -5, up ? -13 : -1, 8, 6, C.lilac);
      rect(ctx, -12, -6, 24, 14, C.ink); rect(ctx, -11, -5, 22, 12, '#a3563b');
      rect(ctx, 8, -9, 9, 10, C.ink); rect(ctx, 9, -8, 7, 8, '#a3563b');
      rect(ctx, 9, -11, 3, 3, '#5e2f1f'); rect(ctx, 14, -11, 3, 3, '#5e2f1f');
      rect(ctx, 12, -4, 5, 4, '#fff7ee'); rect(ctx, 14, -4, 2, 1, C.ink); rect(ctx, 11, -6, 1, 1, C.ink);
      // rider
      rect(ctx, -4, -16, 8, 10, C.ink); rect(ctx, -3, -15, 6, 8, '#fff');
      rect(ctx, -4, -24, 9, 9, C.ink); rect(ctx, -3, -23, 7, 7, C.skin);
      rect(ctx, -5, -27, 11, 5, C.navy); rect(ctx, -5, -23, 2, 3, C.navy);
      rect(ctx, 2, -21, 1, 2, C.ink);
      ctx.restore();
      text(ctx, String(this.score), W / 2, 22, 30, '#fff');
    }
  });

  /* ---- Ping Pong ---- */
  GAMES.push({
    id: 'pong', en: 'Ping Pong', vi: 'Ping Pong', col: C.lilac, drag: 'y',
    keys: [['↑ ↓', 'Move paddle', 'Di chuyển vợt'], ['SPACE', 'Serve', 'Giao bóng']],
    reset: function () {
      this.me = { x: 12, y: 96, w: 8, h: 44 }; this.ai = { x: W - 20, y: 96, w: 8, h: 44 };
      this.ps = 0; this.as = 0; this.score = 0; this.dead = false; this.serve(1);
    },
    serve: function (dir) { this.b = { x: W / 2, y: H / 2, vx: 0, vy: 0, s: 6, wait: 0.7, dir: dir }; },
    update: function (dt) {
      var me = this.me, ai = this.ai, b = this.b;
      if (held.up) me.y -= 220 * dt;
      if (held.down) me.y += 220 * dt;
      if (this.pointerY != null) me.y += (this.pointerY - me.h / 2 - me.y) * Math.min(1, dt * 16);
      me.y = Math.max(4, Math.min(H - 4 - me.h, me.y));
      var target = b.vx > 0 ? b.y - ai.h / 2 : H / 2 - ai.h / 2;
      var maxv = 150 + this.ps * 12;
      ai.y += Math.max(-maxv * dt, Math.min(maxv * dt, target - ai.y));
      ai.y = Math.max(4, Math.min(H - 4 - ai.h, ai.y));
      if (b.wait > 0) {
        b.wait -= dt;
        if (b.wait <= 0 || tapped.a) { b.wait = 0; var a = rnd(-0.5, 0.5); b.vx = Math.cos(a) * 170 * b.dir; b.vy = Math.sin(a) * 170; beep(520, 0.05); }
        return;
      }
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.y < 4) { b.y = 4; b.vy = Math.abs(b.vy); beep(300, 0.03); }
      if (b.y > H - 4 - b.s) { b.y = H - 4 - b.s; b.vy = -Math.abs(b.vy); beep(300, 0.03); }
      var bb = { x: b.x, y: b.y, w: b.s, h: b.s };
      [me, ai].forEach(function (p, k) {
        if (hit(bb, p) && (k === 0 ? b.vx < 0 : b.vx > 0)) {
          var off = (b.y + b.s / 2 - (p.y + p.h / 2)) / (p.h / 2), sp = Math.min(380, Math.hypot(b.vx, b.vy) * 1.06);
          b.vx = (k === 0 ? 1 : -1) * Math.cos(off * 0.9) * sp; b.vy = Math.sin(off * 0.9) * sp;
          beep(k === 0 ? 660 : 560, 0.05);
        }
      });
      if (b.x < -10) { this.as++; beep(160, 0.25, 'triangle', 0.06, 0.6); this.serve(-1); }
      if (b.x > W + 10) { this.ps++; this.score += 10; beep(880, 0.15, 'square', 0.05, 1.5); this.serve(1); }
      if (this.ps >= 7 || this.as >= 7) { if (this.ps >= 7) this.score += 50; this.dead = true; }
    },
    overText: function () { return this.ps >= 7 ? (vi() ? 'BẠN THẮNG!' : 'YOU WIN!') : (vi() ? 'MÁY THẮNG' : 'CPU WINS'); },
    draw: function (ctx, t) {
      backdrop(ctx);
      for (var y = 6; y < H; y += 14) rect(ctx, W / 2 - 1, y, 2, 8, C.purple);
      text(ctx, String(this.ps), W / 2 - 34, 24, 34, C.yellow);
      text(ctx, String(this.as), W / 2 + 34, 24, 34, C.pink);
      [[this.me, C.yellow], [this.ai, C.pink]].forEach(function (q) {
        var p = q[0];
        rect(ctx, p.x, p.y, p.w, p.h, C.ink); rect(ctx, p.x + 1, p.y + 1, p.w - 2, p.h - 2, q[1]);
        rect(ctx, p.x + 2, p.y + p.h / 2 - 4, 1, 3, C.ink); rect(ctx, p.x + 5, p.y + p.h / 2 - 4, 1, 3, C.ink);
      });
      var b = this.b;
      if (b.wait <= 0 || Math.floor(t * 8) % 2) rect(ctx, b.x, b.y, b.s, b.s, '#fff');
    }
  });

  /* ---- Windows classics from version 4 (DOM games) ---- */
  GAMES.push({
    id: 'mines', en: 'Minesweeper', vi: 'Dò mìn', col: '#c0c0c0', dom: 'minesweeper',
    keys: [['CLICK', 'Open a cell', 'Mở ô'], ['RIGHT-CLICK / HOLD', 'Flag', 'Cắm cờ'], ['← ↑ ↓ → · ENTER · F', 'Play with keys', 'Chơi bằng phím']],
    reset: function () { this.score = 0; }, update: function () {},
    draw: function (ctx) {
      rect(ctx, 0, 0, W, H, '#c0c0c0');
      rect(ctx, 20, 12, W - 40, 30, '#9a9a9a'); rect(ctx, 30, 18, 40, 18, '#000'); text(ctx, '010', 50, 27, 18, '#ff1a1a');
      rect(ctx, W - 70, 18, 40, 18, '#000'); text(ctx, '042', W - 50, 27, 18, '#ff1a1a');
      rect(ctx, W / 2 - 10, 17, 20, 20, C.yellow); text(ctx, ':)', W / 2, 27, 16, C.ink);
      var map = ['.12.1F..1', '.1F21..12', '.111.112F', '....12F21', '11..1F1..', 'F1..111..'];
      for (var r = 0; r < 6; r++) for (var c = 0; c < 9; c++) {
        var x = 34 + c * 28, y = 52 + r * 28, ch = map[r][c];
        if (ch === 'F' || (r + c) % 5 === 0) { rect(ctx, x, y, 27, 27, '#fff'); rect(ctx, x + 2, y + 2, 25, 25, '#808080'); rect(ctx, x + 2, y + 2, 23, 23, '#c0c0c0'); if (ch === 'F') { rect(ctx, x + 12, y + 7, 2, 13, '#000'); rect(ctx, x + 6, y + 7, 7, 6, '#ff0000'); } }
        else { rect(ctx, x, y, 27, 27, '#9a9a9a'); rect(ctx, x + 1, y + 1, 26, 26, '#c8c8c8'); if (ch !== '.') text(ctx, ch, x + 14, y + 14, 22, ch === '1' ? '#0000ff' : '#008000'); }
      }
    }
  });
  GAMES.push({
    id: 'solitaire', en: 'Solitaire', vi: 'Xếp bài', col: '#2f9e5b', dom: 'solitaire',
    keys: [['DRAG / CLICK', 'Move cards', 'Kéo thả / bấm để chuyển bài'], ['DOUBLE-CLICK', 'Send to foundation', 'Đưa lên ô đích']],
    reset: function () { this.score = 0; }, update: function () {},
    draw: function (ctx) {
      rect(ctx, 0, 0, W, H, '#1f7a46');
      var suits = ['♠', '♥', '♦', '♣'];
      for (var f = 0; f < 4; f++) { rect(ctx, 150 + f * 42, 12, 34, 46, 'rgba(255,255,255,.25)'); }
      rect(ctx, 14, 12, 34, 46, '#fff'); rect(ctx, 16, 14, 30, 42, C.blue);
      for (var c = 0; c < 7; c++) for (var k = 0; k <= c && k < 4; k++) {
        var x = 14 + c * 43, y = 72 + k * 14, last = k === Math.min(c, 3);
        rect(ctx, x, y, 34, 46, C.ink); rect(ctx, x + 1, y + 1, 32, 44, last ? '#fff' : C.blue);
        if (last) { var s = suits[(c + k) % 4]; text(ctx, ['A', '7', 'K', '3', 'Q', '9', '5'][c] + s, x + 17, y + 14, 16, s === '♥' || s === '♦' ? '#d22' : '#111'); }
      }
    }
  });

  /* ================= SHELL ================= */
  var mode = 'list', sel = 0, game = null, gstate = 'ready', raf = 0, last = 0, T = 0;
  var canvas = null, ctx = null, thumbs = [], scoreEl = null, bestEl = null, domGame = null;

  function legend(rows) {
    keysEl.innerHTML = rows.map(function (r) { return '<span><kbd>' + r[0] + '</kbd> ' + L(r[1], r[2]) + '</span>'; }).join('');
  }

  function unmountDom() { if (domGame) { try { domGame.destroy(); } catch (e) {} domGame = null; } }
  function renderList() {
    unmountDom();
    mode = 'list'; game = null;
    fileEl.textContent = 'ARCADE.EXE';
    body.innerHTML = '<div class="ar-head"><h2>Mini Arcade</h2><p>' + L('Pick a game — the yellow frame is your selection.', 'Chọn một trò — khung vàng là trò đang chọn.') + '</p></div>' +
      '<div class="ar-grid" role="listbox" aria-label="Games">' + GAMES.map(function (g, i) {
        return '<button type="button" class="ar-card" role="option" data-i="' + i + '" style="--c:' + g.col + '">' +
          '<span class="ar-thumb"><canvas width="320" height="240"></canvas><span class="ar-play">▶ PLAY</span></span>' +
          '<span class="ar-name">' + L(g.en, g.vi) + '</span><span class="ar-best">' + (g.dom ? 'WINDOWS CLASSIC' : 'BEST ' + best(g.id)) + '</span></button>';
      }).join('') + '</div>';
    legend([['← → ↑ ↓', 'Choose a game', 'Chọn trò'], ['ENTER / SPACE', 'Play', 'Chơi'], ['ESC', 'Close arcade', 'Đóng máy']]);
    thumbs = [].map.call(body.querySelectorAll('.ar-card'), function (card, i) {
      var cv = card.querySelector('canvas'), c2 = cv.getContext('2d');
      c2.imageSmoothingEnabled = false;
      card.addEventListener('mouseenter', function () { select(i); });
      card.addEventListener('focus', function () { select(i, true); });
      card.addEventListener('click', function () { start(i); });
      var demo = Object.create(GAMES[i]); demo.reset();
      return { card: card, ctx: c2, demo: demo };
    });
    select(sel, false, true);
    fit();
  }
  function select(i, fromFocus, quiet) {
    sel = (i + GAMES.length) % GAMES.length;
    thumbs.forEach(function (t, k) {
      t.card.classList.toggle('active', k === sel);
      t.card.setAttribute('aria-selected', k === sel ? 'true' : 'false');
    });
    if (!fromFocus && thumbs[sel] && document.activeElement !== thumbs[sel].card && win.contains(document.activeElement)) thumbs[sel].card.focus({ preventScroll: true });
    if (!quiet) beep(700, 0.03, 'square', 0.025);
  }

  var DOM_SFX = { click: [700, 0.03], flag: [520, 0.06], reset: [440, 0.08], boom: [90, 0.4, 'sawtooth'], win: [880, 0.3, 'square', 0.05, 1.5], deal: [330, 0.12, 'triangle'], flip: [760, 0.03], place: [520, 0.04], invalid: [180, 0.08, 'triangle'] };
  function startDom(i) {
    var g = GAMES[i];
    sel = i; mode = 'dom'; game = null; canvas = null;
    fileEl.textContent = g.id.toUpperCase() + '.EXE';
    body.innerHTML = '<div class="ar-top"><button type="button" class="ar-back">◀ ' + L('GAMES', 'DANH SÁCH') + '</button><b>' + L(g.en, g.vi) + '</b></div><div class="ar-dom" id="ar-dom"></div>';
    legend(g.keys.concat([['ESC', 'Back to games', 'Về danh sách']]));
    body.querySelector('.ar-back').addEventListener('click', function () { renderList(); sfx('close'); });
    var host = document.getElementById('ar-dom');
    fit();
    if (window.GMTGames && GMTGames[g.dom]) {
      domGame = GMTGames[g.dom](host, { lang: vi() ? 'vi' : 'en', sfx: function (n) { var p = DOM_SFX[n]; if (p) beep(p[0], p[1], p[2], p[3], p[4]); } });
    }
    sfx('open');
  }
  function start(i) {
    if (GAMES[i].dom) { startDom(i); return; }
    sel = i; game = Object.create(GAMES[i]); game.reset(); gstate = 'ready'; mode = 'game';
    var g = GAMES[i];
    fileEl.textContent = g.id.toUpperCase() + '.ROM';
    body.innerHTML =
      '<div class="ar-top"><button type="button" class="ar-back">◀ ' + L('GAMES', 'DANH SÁCH') + '</button>' +
      '<b>' + L(g.en, g.vi) + '</b><span class="ar-score">' + L('SCORE', 'ĐIỂM') + ' <i id="ar-sc">0</i> · BEST <i id="ar-best">' + best(g.id) + '</i></span></div>' +
      '<div class="ar-screen"><canvas id="ar-cv" width="640" height="480" aria-label="' + g.en + '"></canvas></div>' +
      '<div class="ar-pad" aria-hidden="true">' +
        '<div class="dpad"><button data-b="up">▲</button><button data-b="left">◀</button><button data-b="right">▶</button><button data-b="down">▼</button></div>' +
        '<div class="mid"><button data-b="pause">PAUSE</button></div>' +
        '<div class="ab"><button data-b="b">B</button><button data-b="a">A</button></div>' +
      '</div>';
    legend(g.keys.concat([['P', 'Pause', 'Tạm dừng'], ['ESC', 'Back to games', 'Về danh sách']]));
    canvas = document.getElementById('ar-cv'); ctx = canvas.getContext('2d');
    ctx.setTransform(2, 0, 0, 2, 0, 0); ctx.imageSmoothingEnabled = false;
    scoreEl = document.getElementById('ar-sc'); bestEl = document.getElementById('ar-best');
    body.querySelector('.ar-back').addEventListener('click', function () { renderList(); sfx('close'); });
    body.querySelectorAll('.ar-pad button').forEach(function (b) {
      var k = b.getAttribute('data-b');
      b.addEventListener('pointerdown', function (e) { e.preventDefault(); b.setPointerCapture && b.setPointerCapture(e.pointerId); press(k); b.classList.add('on'); });
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (ev) { b.addEventListener(ev, function () { release(k); b.classList.remove('on'); }); });
    });
    // touch / mouse on the screen: drag steers paddle & ship, tap = A
    function px(e) { var r = canvas.getBoundingClientRect(); return (e.clientX - r.left) / r.width * W; }
    function py(e) { var r = canvas.getBoundingClientRect(); return (e.clientY - r.top) / r.height * H; }
    canvas.addEventListener('pointerdown', function (e) {
      e.preventDefault(); canvas.setPointerCapture(e.pointerId);
      if (game.id === 'bricks' || game.id === 'defender') game.pointerX = px(e);
      if (game.drag === 'y') game.pointerY = py(e);
      press('tap'); if (gstate !== 'play') press('a');
      if (game.id === 'defender') press('a');
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!e.buttons) return;
      if (game.id === 'bricks' || game.id === 'defender') game.pointerX = px(e);
      if (game.drag === 'y') game.pointerY = py(e);
    });
    ['pointerup', 'pointercancel'].forEach(function (ev) { canvas.addEventListener(ev, function () { release('tap'); release('a'); if (game) { game.pointerX = null; game.pointerY = null; } }); });
    held = {}; tapped = {};
    fit();
    sfx('open');
  }

  function fit() {
    if (win.hidden) return;
    var vw = window.innerWidth, vh = window.innerHeight;
    if (mode === 'dom') {
      var host = document.getElementById('ar-dom');
      if (host) host.style.height = Math.max(300, Math.min(560, vh - (vw < 760 ? 150 : 210))) + 'px';
    }
    if (mode === 'game' && canvas) {
      var screen = body.querySelector('.ar-screen');
      var other = win.offsetHeight - screen.offsetHeight;
      var maxH = Math.max(150, Math.min(480, vh - 24 - other));
      var maxW = body.clientWidth - 8;
      var w = Math.min(maxW, maxH * 4 / 3);
      canvas.style.width = Math.floor(w) + 'px'; canvas.style.height = Math.floor(w * 3 / 4) + 'px';
    }
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    var dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
    if (!paused) frame(dt);
  }
  var paused = false;
  function frame(dt) {
    T += dt;
    if (mode === 'dom') { tapped = {}; return; }
    if (mode === 'list') {
      thumbs.forEach(function (th, k) {
        var d = th.demo;
        if (k === sel) { autoplay(d, dt); }
        th.ctx.setTransform(1, 0, 0, 1, 0, 0);
        d.draw(th.ctx, T);
      });
      tapped = {};
      return;
    }
    if (!game) return;
    if (tapped.pause || (tapped.start && (gstate === 'play' || gstate === 'paused'))) {
      if (gstate === 'play') gstate = 'paused'; else if (gstate === 'paused') gstate = 'play';
      beep(440, 0.05);
    } else if (gstate === 'ready' || gstate === 'over') {
      if (tapped.a || tapped.start || tapped.tap) { game.reset(); gstate = 'play'; beep(660, 0.08); tapped = {}; }
    } else if (gstate === 'play') {
      game.update(dt);
      if (game.dead) {
        gstate = 'over';
        if (game.score > best(game.id)) { best(game.id, game.score); bestEl.textContent = game.score; }
        beep(196, 0.5, 'triangle', 0.07, 0.5);
      }
    }
    tapped = {};
    game.draw(ctx, T);
    if (scoreEl && scoreEl.textContent !== String(game.score)) scoreEl.textContent = game.score;
    var v = vi();
    if (gstate !== 'play') {
      rect(ctx, 0, 0, W, H, 'rgba(16,14,28,.62)');
      if (gstate === 'ready') {
        text(ctx, v ? GAMES[sel].vi.toUpperCase() : GAMES[sel].en.toUpperCase(), W / 2, 92, 30, C.yellow);
        if (Math.floor(T * 2) % 2) text(ctx, v ? 'BẤM SPACE / CHẠM ĐỂ BẮT ĐẦU' : 'PRESS SPACE / TAP TO START', W / 2, 132, 18, '#fff');
      } else if (gstate === 'paused') {
        text(ctx, v ? 'TẠM DỪNG' : 'PAUSED', W / 2, 108, 32, C.yellow);
        text(ctx, v ? 'BẤM P ĐỂ CHƠI TIẾP' : 'PRESS P TO RESUME', W / 2, 140, 16, '#fff');
      } else {
        text(ctx, game.overText ? game.overText() : 'GAME OVER', W / 2, 92, 34, C.pink);
        text(ctx, (v ? 'ĐIỂM ' : 'SCORE ') + game.score + '   BEST ' + best(game.id), W / 2, 124, 18, '#fff');
        if (Math.floor(T * 2) % 2) text(ctx, v ? 'BẤM SPACE / CHẠM ĐỂ CHƠI LẠI' : 'PRESS SPACE / TAP TO RETRY', W / 2, 154, 16, C.yellow);
      }
    }
  }
  // the highlighted thumbnail plays itself so you can see what you'd get
  function autoplay(d, dt) {
    var save = held; held = {};
    if (d.id === 'snake') {
      var h = d.s[0], f = d.food;
      held = {};
      tapped = {};
      var want = f.x > h.x ? 'right' : f.x < h.x ? 'left' : f.y > h.y ? 'down' : 'up';
      tapped[want] = true;
    } else if (d.id === 'bricks') { d.pointerX = d.b.x + Math.sin(T * 2) * 10; tapped = { a: d.b.stuck }; }
    else if (d.id === 'defender') { d.pointerX = 160 + Math.sin(T * 0.9) * 110; tapped = { a: Math.random() < 0.05 }; d.inv = 9; }
    else if (d.id === 'flappy') { var pp = d.pipes.filter(function (p) { return p.x + p.w > 50; })[0]; var gy = pp ? pp.top + pp.gap * 0.62 : 110; tapped = { a: d.y > gy && d.vy > -40 }; }
    else if (d.id === 'pong') { d.pointerY = d.b.y - 4 + Math.sin(T * 3) * 8; tapped = { a: true }; }
    else if (d.id === 'runner') { var o = d.obs[0]; tapped = { a: !!(o && !o.fly && o.x - d.h.x < 34 && o.x > d.h.x) }; held = { down: !!(o && o.fly && o.x - d.h.x < 40) }; }
    d.update(dt);
    if (d.dead) d.reset();
    held = save; tapped = {};
  }

  /* ---------------- open / close / keys ---------------- */
  function open() {
    if (win.hidden) {
      win.hidden = false;
      document.body.classList.add('arcade-open');
      win.classList.remove('pop'); void win.offsetWidth; win.classList.add('pop');
      sfx('open');
    }
    renderList();
    setTimeout(function () { if (thumbs[sel]) thumbs[sel].card.focus({ preventScroll: true }); }, 30);
    last = performance.now();
    if (!raf) raf = requestAnimationFrame(loop);
  }
  function close() {
    unmountDom();
    win.hidden = true; document.body.classList.remove('arcade-open');
    cancelAnimationFrame(raf); raf = 0; game = null; mode = 'list'; held = {};
    sfx('close');
  }
  function back() { if (mode === 'game' || mode === 'dom') { renderList(); sfx('close'); } else close(); }
  document.getElementById('ar-close').addEventListener('click', close);

  // capture phase so the city's own shortcuts never see these keys
  document.addEventListener('keydown', function (e) {
    if (win.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); back(); return; }
    if (mode === 'list') {
      var cols = window.innerWidth < 760 ? 3 : 4, d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols }[e.key];
      if (d) { e.preventDefault(); e.stopPropagation(); select(Math.max(0, Math.min(GAMES.length - 1, sel + d))); thumbs[sel].card.focus({ preventScroll: true }); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); start(sel); }
      return;
    }
    if (mode === 'dom') return;
    var b = KEYMAP[e.code];
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    press(b);
  }, true);
  document.addEventListener('keyup', function (e) {
    if (win.hidden) return;
    var b = KEYMAP[e.code];
    if (b) { release(b); e.stopPropagation(); }
  }, true);
  window.addEventListener('resize', fit);
  window.addEventListener('blur', function () { held = {}; if (mode === 'game' && gstate === 'play') gstate = 'paused'; });

  // test hooks: drive the shell frame by frame
  window.GMTArcade = {
    open: open, close: close, games: GAMES, start: start,
    pause: function (v) { paused = v; },
    tick: function (sec) { for (var i = 0; i < sec * 60; i++) frame(1 / 60); },
    press: press, release: release,
    get game() { return game; }, get state() { return gstate; }
  };
})();
