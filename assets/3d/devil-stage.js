/* BinaMora 3D devil stage: lazy loader.
   Shows the static poster first; only when the stage nears the viewport (and the browser is idle)
   does it fetch the three.js module + the model. Poster stays if WebGL / motion preferences / loading fail. */
(function () {
  'use strict';
  var stage = document.querySelector('[data-devil-stage]');
  if (!stage) return;
  var canvas = stage.querySelector('canvas');
  if (!canvas) return;
  var base = ((document.currentScript && document.currentScript.src) || '').replace(/[^\/]*$/, '');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) return; // poster only

  var mobile = window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(max-width: 700px)').matches;
  var started = false, inView = false, pageVisible = !document.hidden;
  var api = null, raf = 0, last = 0, clock = 0, lost = false, acc = 0;

  function webglOK() {
    try {
      var c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (e) { return false; }
  }

  function size() {
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (api && w > 0 && h > 0) api.resize(w, h);
  }

  function loop(now) {
    raf = 0;
    if (!api || !inView || !pageVisible || lost) return;
    var dt = Math.min(0.1, (now - last) / 1000 || 0);
    last = now;
    if (mobile) { acc += dt; if (acc < 1 / 30) { raf = requestAnimationFrame(loop); return; } dt = acc; acc = 0; }
    clock += dt;
    try { api.tick(dt); api.frame(clock); } catch (e) { stop(); stage.classList.remove('is-live'); return; }
    raf = requestAnimationFrame(loop);
  }
  function kick() {
    if (!raf && api && inView && pageVisible && !lost) { last = performance.now(); raf = requestAnimationFrame(loop); }
  }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }

  function boot() {
    if (started) return;
    started = true;
    if (!webglOK()) return;
    import(base + 'devil.js?v=1').then(function (m) {
      return m.createDevil(canvas, { src: base + 'devil-web.glb?v=1', mobile: mobile });
    }).then(function (a) {
      api = a;
      size();
      a.tick(0); a.frame(0);
      requestAnimationFrame(function () { stage.classList.add('is-live'); });
      if ('ResizeObserver' in window) new ResizeObserver(size).observe(canvas); else window.addEventListener('resize', size);
      canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); lost = true; stop(); stage.classList.remove('is-live'); });
      canvas.addEventListener('webglcontextrestored', function () { lost = false; stage.classList.add('is-live'); kick(); });
      // tiny interaction: tap / click flares the flames, pointer nudges the pose (desktop)
      canvas.addEventListener('pointerdown', function () { a.flare(); });
      if (!mobile) {
        stage.addEventListener('pointermove', function (e) {
          var r = stage.getBoundingClientRect();
          a.aim(Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2)));
        });
        stage.addEventListener('pointerleave', function () { a.aim(0); });
      }
      kick();
    }).catch(function (err) {
      if (window.console) console.warn('Devil stage: keeping poster', err && err.message);
    });
  }

  var io = new IntersectionObserver(function (entries) {
    inView = entries[entries.length - 1].isIntersecting;
    if (inView) { if (!started) { (window.requestIdleCallback || function (f) { setTimeout(f, 200); })(boot, { timeout: 2000 }); } else kick(); }
    else stop();
  }, { rootMargin: '250px 0px' });
  io.observe(stage);
  document.addEventListener('visibilitychange', function () { pageVisible = !document.hidden; if (pageVisible) kick(); else stop(); });
})();
