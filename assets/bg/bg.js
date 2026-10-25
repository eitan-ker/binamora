/* BinaMora living background.
   A fixed, full-viewport layer behind the page: a slow glow field plus embers that drift with the scroll position
   (parallax), change tone from section to section, and respond to SMOOTHED SCROLL VELOCITY, so quick scrolling is
   livelier and stopping eases back to a calm idle. On desktop a faint 3D devil (assets/3d) is lazy-loaded after idle.
   Light by design: one 2D canvas (glow drawn at ~1/3 resolution), DPR cap, 30fps on phones and when idle,
   paused while the tab is hidden, static glow for prefers-reduced-motion. */
(function () {
  'use strict';
  if (window.__bmBg || !document.body || !window.requestAnimationFrame) return;
  var doc = document, root = doc.documentElement, body = doc.body;
  var mm = function (q) { return !!(window.matchMedia && window.matchMedia(q).matches); };
  var reduce = mm('(prefers-reduced-motion: reduce)');
  var coarse = mm('(pointer: coarse)') || window.innerWidth <= 700;
  var saveData = !!(navigator.connection && navigator.connection.saveData);
  var tutor = body.classList.contains('page-tutor');
  var script = doc.currentScript;
  var base = ((script && script.src) || '').replace(/[^\/]*$/, '');           // .../assets/bg/
  var devilBase = base.replace(/bg\/$/, '3d/');                                 // .../assets/3d/
  var TAU = Math.PI * 2;

  /* ---------- palettes: one per section, blended by scroll position ---------- */
  // c: three glow colours; k: overall glow strength; dv: devil visibility; e: ember colour
  var GOLD = [237, 187, 0], AMBER = [214, 126, 30], EMBER = [226, 62, 24], DEEP = [140, 28, 22],
      MAG = [214, 0, 108], CYAN = [0, 136, 176], ICE = [98, 197, 238];
  var PAL = {
    hero:  { c: [AMBER, EMBER, DEEP], k: .8, dv: 0,   e: [255, 176, 70] },
    film:  { c: [EMBER, AMBER, DEEP], k: 1,  dv: 1,   e: [255, 120, 40] },
    soon:  { c: [GOLD, AMBER, MAG],   k: .85, dv: .55, e: [255, 188, 70] },
    proj:  { c: [GOLD, CYAN, MAG],    k: .8,  dv: .3,  e: [255, 196, 90] },
    cont:  { c: [GOLD, AMBER, DEEP],  k: .7,  dv: .2,  e: [255, 180, 80] },
    t1:    { c: [CYAN, ICE, MAG],     k: .95, dv: 0,   e: [130, 214, 255] },
    t2:    { c: [CYAN, ICE, GOLD],    k: .8,  dv: 0,   e: [130, 214, 255] },
    t3:    { c: [CYAN, MAG, ICE],     k: .75, dv: 0,   e: [150, 220, 255] },
    t4:    { c: [CYAN, ICE, MAG],     k: .7,  dv: 0,   e: [130, 214, 255] },
    t5:    { c: [GOLD, CYAN, ICE],    k: .75, dv: 0,   e: [255, 205, 110] }
  };
  var SECTIONS = tutor
    ? [['.tutor-hero', 't1'], ['#how', 't2'], ['#features', 't3'], ['#faq', 't4'], ['#access', 't5']]
    : [['.hero', 'hero'], ['#film', 'film'], ['#coming-soon', 'soon'], ['#projects', 'proj'], ['#contact', 'cont']];

  var stops = [];                       // [{y: centre in document px, p: palette}]
  function docTop(el) { var y = 0; while (el) { y += el.offsetTop; el = el.offsetParent; } return y; }  // transform-proof (unlike getBoundingClientRect)
  var docH = 0;
  function measure() {
    docH = root.scrollHeight;
    stops = [];
    SECTIONS.forEach(function (s) {
      var el = doc.querySelector(s[0]);
      if (el) stops.push({ y: docTop(el) + el.offsetHeight / 2, p: PAL[s[1]] });
    });
    if (!stops.length) stops.push({ y: 0, p: PAL[tutor ? 't1' : 'film'] });
    stops.sort(function (a, b) { return a.y - b.y; });
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function sstep(t) { return t * t * (3 - 2 * t); }
  var cur = { c: [[0, 0, 0], [0, 0, 0], [0, 0, 0]], k: 1, dv: 0, e: [255, 170, 70] };
  function paletteAt(y) {
    var i = 0, n = stops.length, a, b, t;
    if (y <= stops[0].y || n === 1) { a = b = stops[0].p; t = 0; }
    else if (y >= stops[n - 1].y) { a = b = stops[n - 1].p; t = 0; }
    else {
      while (i < n - 2 && y > stops[i + 1].y) i++;
      a = stops[i].p; b = stops[i + 1].p;
      t = sstep((y - stops[i].y) / (stops[i + 1].y - stops[i].y));
    }
    for (var j = 0; j < 3; j++) for (var q = 0; q < 3; q++) cur.c[j][q] = lerp(a.c[j][q], b.c[j][q], t);
    for (q = 0; q < 3; q++) cur.e[q] = lerp(a.e[q], b.e[q], t);
    cur.k = lerp(a.k, b.k, t); cur.dv = lerp(a.dv, b.dv, t);
    return cur;
  }

  /* ---------- DOM ---------- */
  var layer = doc.createElement('div');
  layer.className = 'bm-bg';
  layer.setAttribute('aria-hidden', 'true');
  var cv = doc.createElement('canvas');
  cv.className = 'bm-bg__cv';
  layer.appendChild(cv);
  body.insertBefore(layer, body.firstChild);
  var ctx = cv.getContext('2d');
  if (!ctx) { layer.remove(); return; }
  var gcv = doc.createElement('canvas');           // glow field, rendered small and upscaled (smooth + cheap)
  var gctx = gcv.getContext('2d');

  var W = 0, H = 0, dpr = 1, gs = 1;
  var maxDpr = coarse ? 1 : 1.5;
  function resize() {
    W = layer.clientWidth || window.innerWidth; H = layer.clientHeight || window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    var pw = Math.round(W * dpr), ph = Math.round(H * dpr);
    if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
    gs = Math.min(1 / 3, 560 / W);
    var gw = Math.max(8, Math.round(W * gs)), gh = Math.max(8, Math.round(H * gs));
    if (gcv.width !== gw || gcv.height !== gh) { gcv.width = gw; gcv.height = gh; }
    gs = gw / W;
    layoutDevil();
  }

  /* ---------- state: scroll, smoothed scroll, smoothed velocity ---------- */
  var scrollY = window.pageYOffset || 0;    // raw (passive listener)
  var scrollS = scrollY;                     // eased scroll position that the parallax follows
  var lastY = scrollY;
  var vs = 0;                                // 0..1 smoothed speed
  var sv = 0;                                // signed smoothed px/s (+ = scrolling down)
  var clock = 0;                             // seconds, advanced faster when scrolling fast

  /* ---------- glow blobs ---------- */
  // x0/y0: anchor (fractions), r: radius (fraction of the longer side), col: palette slot, a: alpha,
  // f: parallax factor (px of travel per px of scroll), amp: idle sway, sp: idle speed (rad/s)
  var BLOBS = [
    { x0: .16, y0: .18, r: .58, col: 0, a: .25, f: .30, amp: .06, sp: .11, ph: 0 },
    { x0: .88, y0: .52, r: .52, col: 1, a: .21, f: .42, amp: .05, sp: .09, ph: 2.1 },
    { x0: .52, y0: .88, r: .62, col: 2, a: .15, f: .22, amp: .08, sp: .07, ph: 4.0 },
    { x0: .94, y0: .06, r: .40, col: 2, a: .11, f: .55, amp: .05, sp: .13, ph: 1.2 },
    { x0: .08, y0: .74, r: .44, col: 0, a: .10, f: .50, amp: .06, sp: .10, ph: 5.2 }
  ];
  function rgb(c) { return Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]); }
  var FALL = [[0, 1], [.25, .6], [.5, .27], [.75, .08], [1, 0]];     // soft, gaussian-ish falloff (no hard disc edge)
  function blob(g, x, y, r, sx, sy, col, a) {
    if (a < .004) return;
    g.save(); g.translate(x, y); g.scale(sx, sy);
    var gr = g.createRadialGradient(0, 0, 0, 0, 0, r), c = rgb(col);
    for (var i = 0; i < FALL.length; i++) gr.addColorStop(FALL[i][0], 'rgba(' + c + ',' + (a * FALL[i][1]).toFixed(4) + ')');
    g.fillStyle = gr; g.fillRect(-r, -r, 2 * r, 2 * r); g.restore();
  }

  var devilBox = { x: 0, y: 0, w: 0, h: 0, op: 0 };   // current devil rectangle (css px), shared with the halo
  function drawGlow(dt, animate) {
    var g = gctx, M = Math.max(W, H);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, gcv.width, gcv.height);
    g.setTransform(gs, 0, 0, gs, 0, 0);
    g.globalCompositeOperation = 'lighter';
    var boost = 1 + vs * .6, stretch = 1 + vs * .85, squeeze = 1 - vs * .12;
    for (var i = 0; i < BLOBS.length; i++) {
      var b = BLOBS[i], R = b.r * M;
      if (animate) b.ph += dt * b.sp * (1 + vs * 3);
      var range = H + 2 * R * stretch;
      var y = (((b.y0 * range - scrollS * b.f) % range) + range) % range - R * stretch + (animate ? Math.cos(b.ph * .8) * b.amp * H * .5 : 0);
      var x = b.x0 * W + (animate ? Math.sin(b.ph) * b.amp * W : 0);
      blob(g, x, y, R, squeeze, stretch, cur.c[b.col], b.a * cur.k * boost);
    }
    // the devil's halo: a warm glow that sits behind the silhouette and breathes with scroll speed
    if (devilBox.op > .01) {
      var hr = devilBox.h * .62, hx = devilBox.x + devilBox.w / 2, hy = devilBox.y + devilBox.h * .58, d = devilBox.op;
      blob(g, hx, hy, hr, 1, 1 + vs * .35, EMBER, Math.min(.3, .2 * d * (1 + vs * .9)));
      blob(g, hx, hy + devilBox.h * .2, hr * .5, 1, 1 + vs * .5, AMBER, Math.min(.2, .12 * d * (1 + vs * 1.1)));
    }
    // floor glow: a low warm light along the bottom edge that heats up with speed
    var fh = H * .5, fy = H + fh * .15;
    blob(g, W / 2, fy, W * .7, 1, fh / (W * .7), cur.c[0], (.07 + vs * .09) * cur.k);
    g.globalCompositeOperation = 'source-over';
  }

  /* ---------- embers ---------- */
  var embers = [], nEmber = reduce ? 0 : (coarse ? 16 : 40), emberLive = nEmber;
  for (var e = 0; e < nEmber; e++) {
    var z = .25 + Math.pow(Math.random(), 1.4) * .75;           // depth: small/slow/dim .. big/fast/bright
    embers.push({ x: Math.random(), y: Math.random(), z: z, ph: Math.random() * TAU, w: .5 + Math.random() });
  }
  var sprite = doc.createElement('canvas'); sprite.width = sprite.height = 48;
  var spriteCol = [-99, 0, 0];
  function buildSprite(c) {
    var s = sprite.getContext('2d'), gr = s.createRadialGradient(24, 24, 0, 24, 24, 24), cs = rgb(c);
    s.clearRect(0, 0, 48, 48);
    gr.addColorStop(0, 'rgba(255,248,225,1)'); gr.addColorStop(.12, 'rgba(' + cs + ',.95)');
    gr.addColorStop(.35, 'rgba(' + cs + ',.28)'); gr.addColorStop(.7, 'rgba(' + cs + ',.05)'); gr.addColorStop(1, 'rgba(' + cs + ',0)');
    s.fillStyle = gr; s.fillRect(0, 0, 48, 48);
    spriteCol = [c[0], c[1], c[2]];
  }
  function drawEmbers(dt) {
    var c = cur.e;
    if (Math.abs(c[0] - spriteCol[0]) + Math.abs(c[1] - spriteCol[1]) + Math.abs(c[2] - spriteCol[2]) > 14) buildSprite(c);
    ctx.globalCompositeOperation = 'lighter';
    var idle = 9 + 7 * vs;
    for (var i = 0; i < emberLive; i++) {
      var p = embers[i], z = p.z;
      // idle rise + parallax: embers travel with the page at a fraction of its speed (nearer = faster)
      var vy = -idle * z - sv * .5 * z;
      p.y += (vy * dt) / H;
      p.x += (Math.sin(clock * .5 + p.ph) * (5 + vs * 28) * z * dt) / W;
      if (p.y < -.06) { p.y = 1.06; p.x = Math.random(); } else if (p.y > 1.06) { p.y = -.06; p.x = Math.random(); }
      if (p.x < -.05) p.x += 1.1; else if (p.x > 1.05) p.x -= 1.1;
      var tw = .65 + .35 * Math.sin(clock * 1.7 * p.w + p.ph);
      var a = Math.min(1, (.14 + .42 * z) * tw * (1 + vs * .8) * cur.k);
      if (a < .01) continue;
      var size = (2.2 + 4.8 * z) * (1 + vs * .25), len = size * (1 + vs * 5 * z);   // streaks lengthen with speed
      ctx.globalAlpha = a;
      ctx.drawImage(sprite, p.x * W - size, p.y * H - len, size * 2, len * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ---------- devil (desktop: lazy 3D; phones: faint poster only) ---------- */
  var devilEl = null, devilCanvas = null, devilImg = null, devilApi = null, devilLost = false, devilOn = false, devilW = 0, devilH = 0;
  var devilAllowed = !tutor && !reduce && !saveData;
  var devil3D = devilAllowed && !coarse && window.innerWidth >= 900 && (navigator.hardwareConcurrency || 4) >= 4;
  var lastFlare = -9, devilAcc = 0;
  function layoutDevil() {
    if (!devilEl) return;
    var h, w;
    if (coarse) { h = H * .8; w = h * .8; } else { h = H; w = h * .8; if (w > W * .62) { w = W * .62; h = w / .8; } }
    devilBox.w = w; devilBox.h = h;
    devilEl.style.width = w + 'px'; devilEl.style.height = h + 'px';
    if (devilApi && (w !== devilW || h !== devilH)) { devilW = w; devilH = h; try { devilApi.resize(w, h); } catch (err) {} }
  }
  function initDevil() {
    if (!devilAllowed || devilEl) return;
    devilEl = doc.createElement('div'); devilEl.className = 'bm-bg__devil';
    devilImg = new Image(); devilImg.alt = ''; devilImg.decoding = 'async';
    devilImg.src = devilBase + 'devil-poster.webp';
    devilEl.appendChild(devilImg);
    layer.appendChild(devilEl);
    layoutDevil();
    devilOn = true;
    if (devil3D) load3D();
  }
  function webglOK() {
    try { var c = doc.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (e) { return false; }
  }
  function load3D() {
    if (!webglOK()) return;
    devilCanvas = doc.createElement('canvas');
    devilEl.appendChild(devilCanvas);
    import(devilBase + 'devil.js?v=1').then(function (m) {
      return m.createDevil(devilCanvas, { src: devilBase + 'devil-web.glb?v=1', mobile: false, dpr: 1 });
    }).then(function (api) {
      devilApi = api; devilW = devilH = 0; layoutDevil();
      api.tick(0); api.frame(0);
      requestAnimationFrame(function () { if (!devilLost) devilEl.classList.add('is-live'); });
      devilCanvas.addEventListener('webglcontextlost', function (ev) { ev.preventDefault(); devilLost = true; devilEl.classList.remove('is-live'); });
      devilCanvas.addEventListener('webglcontextrestored', function () { devilLost = false; devilEl.classList.add('is-live'); });
    }).catch(function (err) {
      if (window.console) console.warn('Background devil: keeping poster', err && err.message);
      if (devilCanvas && devilCanvas.parentNode) devilCanvas.parentNode.removeChild(devilCanvas);
      devilApi = null;
    });
  }
  function updateDevil(dt, prog) {
    if (!devilEl) return;
    var A = coarse ? .1 : .3;
    var xc = W * (.5 + A * Math.cos(prog * TAU * 1.5));                        // sweeps across the page as you scroll
    var yc = H * .52 + Math.sin(prog * TAU * 2) * H * .035 - (sv / 6000) * H * .05;
    devilBox.x = xc - devilBox.w / 2; devilBox.y = yc - devilBox.h / 2;
    var op = cur.dv * (coarse ? .15 : .18 + .12 * vs);                           // faint at rest, a little stronger when moving
    devilBox.op = cur.dv;
    devilEl.style.opacity = op < .01 ? '0' : op.toFixed(3);
    devilEl.style.transform = 'translate3d(' + devilBox.x.toFixed(1) + 'px,' + devilBox.y.toFixed(1) + 'px,0)';
    if (devilApi && !devilLost && op >= .01) {
      var moving = vs > .03;
      devilAcc += dt;
      if (moving || devilAcc >= 1 / 24) {
        var step = devilAcc; devilAcc = 0;
        var yawDeg = (prog * 2 - 1) * 12 + (sv / 6000) * 8;                       // turns slowly with progress, leans into fast scrolls
        devilApi.aim(yawDeg / 10);
        if (vs > .35 && clock - lastFlare > .6) { devilApi.flare(); lastFlare = clock; }   // flames flare when you scroll quickly
        try { devilApi.tick(step); devilApi.frame(clock); } catch (err) { devilLost = true; devilEl.classList.remove('is-live'); }
      }
    }
  }

  /* ---------- main loop ---------- */
  var raf = 0, last = 0, acc = 0, hidden = doc.hidden;
  var perf = { n: 0, sum: 0, max: 0, dtSum: 0, dtN: 0 };
  var slow = 0;
  var REF = 2200;                                      // px/s that counts as "fast" (scaled with viewport height below)
  function frame(now) {
    raf = 0;
    if (hidden) return;
    var dt = Math.min(.1, (now - last) / 1000 || 0);
    var calm = vs < .012 && Math.abs(sv) < 30;
    var minDt = (coarse || calm) ? 1 / 30 - .002 : 0;   // 30fps on phones and whenever idle
    acc += dt; last = now;
    if (acc < minDt) { raf = requestAnimationFrame(frame); return; }
    dt = acc; acc = 0;
    var t0 = performance.now();

    var y = scrollY, dy = y - lastY; lastY = y;
    var vpx = Math.abs(dy) > H * .9 ? 0 : dy / Math.max(dt, .001);               // ignore teleports (menu camera-dolly jumps)
    var ref = Math.max(1400, H * 2.2);
    var vn = Math.min(1, Math.abs(vpx) / ref);
    vs += (vn - vs) * (1 - Math.exp(-dt / (vn > vs ? .1 : .6)));                  // quick attack, slow release
    var tv = Math.max(-6000, Math.min(6000, vpx));
    sv += (tv - sv) * (1 - Math.exp(-dt / (Math.abs(tv) > Math.abs(sv) ? .14 : .5)));
    if (vs < .002) vs = 0;
    scrollS += (y - scrollS) * (1 - Math.exp(-dt / .16));                         // background follows the page with a soft lag
    if (Math.abs(y - scrollS) < .3) scrollS = y;
    clock += dt * (1 + vs * 1.8);

    paletteAt(scrollS + H * .5);
    var maxS = Math.max(1, (docH || root.scrollHeight) - H), prog = Math.min(1, Math.max(0, scrollS / maxS));
    updateDevil(dt, prog);
    drawGlow(dt, true);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(gcv, 0, 0, cv.width, cv.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawEmbers(dt);

    var ms = performance.now() - t0;
    perf.n++; perf.sum += ms; if (ms > perf.max) perf.max = ms; perf.dtSum += dt * 1000; perf.dtN++;
    // safety valve: if the page is crawling (<~15fps for ~2s), thin the embers, then drop the 3D devil
    if (dt > .066 && !calm) { if (++slow > 40) { slow = 0; if (emberLive > 8) emberLive = Math.floor(emberLive / 2); else if (devilApi) { devilLost = true; devilEl.classList.remove('is-live'); } } } else if (slow > 0) slow--;
    raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf && !hidden && !reduce) { last = performance.now(); raf = requestAnimationFrame(frame); } }

  /* ---------- reduced motion: static, subtle glow; tone still follows the section, nothing moves ---------- */
  var rmPending = false;
  function drawStatic() {
    rmPending = false;
    paletteAt(window.pageYOffset + H * .5);
    gs = gcv.width / W;
    drawGlow(0, false);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(gcv, 0, 0, cv.width, cv.height);
  }

  /* ---------- wiring ---------- */
  function onScroll() {
    scrollY = window.pageYOffset;
    if (reduce) { if (!rmPending) { rmPending = true; requestAnimationFrame(drawStatic); } }
    else kick();
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  var rt = 0;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { resize(); measure(); if (reduce) drawStatic(); }, 120);
  }, { passive: true });
  doc.addEventListener('visibilitychange', function () {
    hidden = doc.hidden;
    if (!hidden) { acc = 0; kick(); }
  });
  if (window.ResizeObserver) { var ro = new ResizeObserver(function () { measure(); }); ro.observe(body); }
  window.addEventListener('load', function () { measure(); });

  measure(); resize();
  root.classList.add('bm-bg-on');
  if (reduce) { drawStatic(); }
  else {
    paletteAt(scrollS + H * .5);
    buildSprite(cur.e);
    kick();
    // the 3D devil / poster wait until the browser is idle after load (never competes with first paint)
    var idle = window.requestIdleCallback || function (f) { return setTimeout(f, 600); };
    var go = function () { idle(initDevil, { timeout: 3500 }); };
    if (doc.readyState === 'complete') go(); else window.addEventListener('load', go);
  }
  window.__bmBg = { stats: function () { var r = { frames: perf.n, avgDrawMs: perf.n ? perf.sum / perf.n : 0, maxDrawMs: perf.max, avgFrameMs: perf.dtN ? perf.dtSum / perf.dtN : 0, vs: vs, devil3D: !!devilApi, embers: emberLive }; perf = { n: 0, sum: 0, max: 0, dtSum: 0, dtN: 0 }; return r; } };
})();
