// BinaMora — small progressive enhancements (site works without JS).
// UI strings follow the page language (<html lang>), so Hebrew pages stay Hebrew.
var BM_HE = document.documentElement.lang === 'he';
var BM_T = BM_HE ? {
  emailRequired: 'נא להזין כתובת אימייל.',
  emailInvalid: 'נא להזין כתובת אימייל תקינה.',
  messageRequired: 'נא למלא שדה זה.',
  sending: 'שולח…',
  success: 'תודה — ההודעה נשלחה. נחזור אליכם בקרוב.',
  error: 'מצטערים, משהו השתבש וההודעה לא נשלחה. נסו שוב בעוד רגע.',
  voteOpen: 'הצבעת בחירת הקהל פתוחה',
  voteNow: 'הצביעו עכשיו'
} : {
  emailRequired: 'Please enter your email address.',
  emailInvalid: 'Please enter a valid email address.',
  messageRequired: 'Please write a message.',
  sending: 'Sending…',
  success: 'Thank you — your message has been sent. We’ll be in touch soon.',
  error: 'Sorry, something went wrong and your message wasn’t sent. Please try again in a moment.',
  voteOpen: 'Audience Choice voting is open',
  voteNow: 'VOTE NOW'
};

(function () {
  var nav = document.getElementById('nav');
  var onScroll = function () { nav.classList.toggle('nav--solid', window.scrollY > 40); };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  var items = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    items.forEach(function (el) { el.classList.add('is-visible'); });
    return;
  }
  document.documentElement.classList.add('js');
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
    });
  }, { threshold: 0.12 });
  items.forEach(function (el) { io.observe(el); });
})();

// Contact form — AJAX submit to FormSubmit (falls back to a normal POST without JS).
(function () {
  var form = document.getElementById('contact-form');
  if (!form || !window.fetch || !window.JSON) return;

  var status = document.getElementById('cf-status');
  var button = form.querySelector('button[type="submit"]');
  var fields = {
    name: document.getElementById('cf-name'),
    email: document.getElementById('cf-email'),
    message: document.getElementById('cf-message'),
    updates: document.getElementById('cf-updates'),
    honey: document.getElementById('cf-honey')
  };
  var DEFAULT_SUBJECT = '[BINAMORA] - New message from binamora.com';
  var SUBJECT_PREFIX = form.getAttribute('data-subject-prefix'); // e.g. the AI Tutor access form
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function setError(input, msg) {
    var err = document.getElementById(input.id + '-err');
    if (msg) {
      input.setAttribute('aria-invalid', 'true');
      if (err) { err.textContent = msg; err.hidden = false; }
    } else {
      input.removeAttribute('aria-invalid');
      if (err) { err.textContent = ''; err.hidden = true; }
    }
  }

  function showStatus(type, msg) {
    status.className = 'contact-form__status is-' + type;
    status.textContent = msg;
    status.hidden = false;
  }

  function validate() {
    var firstBad = null;
    var email = fields.email.value.trim();
    var message = fields.message.value.trim();
    if (!email) { setError(fields.email, BM_T.emailRequired); firstBad = firstBad || fields.email; }
    else if (!EMAIL_RE.test(email)) { setError(fields.email, BM_T.emailInvalid); firstBad = firstBad || fields.email; }
    else setError(fields.email, '');
    if (!message) { setError(fields.message, BM_T.messageRequired); firstBad = firstBad || fields.message; }
    else setError(fields.message, '');
    if (firstBad) firstBad.focus();
    return !firstBad;
  }

  [fields.email, fields.message].forEach(function (el) {
    el.addEventListener('input', function () { if (el.getAttribute('aria-invalid')) validate(); });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    status.hidden = true;
    if (!validate()) return;

    var name = fields.name.value.trim();
    var email = fields.email.value.trim();
    var payload = {
      name: name,
      email: email,
      message: fields.message.value.trim(),
      'Updates signup': fields.updates.checked ? 'Yes' : 'No',
      _subject: SUBJECT_PREFIX
        ? SUBJECT_PREFIX + (name ? ' — ' + name : '')
        : (name ? '[BINAMORA] - Message from ' + name : DEFAULT_SUBJECT),
      _replyto: email,
      _template: 'table',
      _captcha: 'false',
      _honey: fields.honey.value
    };

    button.disabled = true;
    var label = button.textContent;
    button.textContent = BM_T.sending;

    fetch(form.getAttribute('data-ajax'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          if (!res.ok || String(data.success) !== 'true') throw new Error(data.message || 'Request failed');
        });
      })
      .then(function () {
        form.reset();
        showStatus('success', BM_T.success);
      })
      .catch(function () {
        showStatus('error', BM_T.error);
      })
      .then(function () {
        button.disabled = false;
        button.textContent = label;
        status.focus();
      });
  });
})();

// Contest countdown (Natural Fear card). Computed from UTC; refreshes every 30s.
(function () {
  var box = document.querySelector('[data-contest-deadline]');
  if (!box) return;
  var deadline = Date.parse(box.getAttribute('data-contest-deadline'));
  if (isNaN(deadline)) return;
  var clock = box.querySelector('[data-contest-clock]');
  var status = box.querySelector('[data-contest-status]');
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var timer;
  function tick() {
    var left = deadline - Date.now();
    if (left <= 0) {
      status.textContent = BM_T.voteOpen;
      clock.textContent = BM_T.voteNow;
      clock.hidden = false;
      clearInterval(timer);
      return;
    }
    var mins = Math.ceil(left / 60000);
    var d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
    clock.textContent = d + 'D : ' + pad(h) + 'H : ' + pad(m) + 'M';
    clock.hidden = false;
  }
  tick();
  timer = setInterval(tick, 30000);
})();

// Scroll depth: hero parallax + cinematic reveal of the film still.
// Skipped entirely for prefers-reduced-motion (page stays static).
(function () {
  if (!window.matchMedia || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var bg = document.querySelector('.hero__bg');
  var content = document.querySelector('.hero__content');
  var frame = document.querySelector('.film .video__frame');
  if (!bg || !content) return;
  document.documentElement.classList.add('bm-motion');
  var ticking = false;

  function update() {
    ticking = false;
    var y = window.scrollY, vh = window.innerHeight;
    if (y < vh * 1.2) {
      bg.style.setProperty('--sy', (y * 0.35) + 'px');
      content.style.setProperty('--cy', (y * 0.18) + 'px');
      content.style.setProperty('--co', Math.max(0, 1 - y / (vh * 0.7)).toFixed(3));
    }
    if (frame) {
      var top = frame.parentNode.getBoundingClientRect().top; // wrapper isn't transformed
      frame.style.setProperty('--p', Math.min(1, Math.max(0, (vh - top) / (vh * 0.5))).toFixed(3));
    }
  }
  function requestUpdate() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }

  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate);
  if (window.matchMedia('(pointer: fine)').matches) {
    window.addEventListener('pointermove', function (e) {
      bg.style.setProperty('--px', ((0.5 - e.clientX / window.innerWidth) * 24) + 'px');
      bg.style.setProperty('--py', ((0.5 - e.clientY / window.innerHeight) * 16) + 'px');
    }, { passive: true });
  }
  update();
})();

// Menu "camera dolly": the page tilts back into depth, jumps, and the target section flies in.
// In-page anchors keep the hash, Back button and focus; other site pages get the exit move, then load.
// prefers-reduced-motion (or no Web Animations support) gets a plain jump with the same hash/focus handling.
(function () {
  var main = document.querySelector('main');
  if (!main || !window.matchMedia) return;
  var still = !main.animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var small = window.matchMedia('(max-width: 600px)').matches;
  var html = document.documentElement;
  var depth = small ? { out: 'rotateX(6deg) translateZ(-160px)', inn: 'rotateX(-5deg) translateZ(-220px)', blur: 'brightness(.4)', t1: 300, t2: 450 }
                    : { out: 'rotateX(12deg) translateZ(-420px)', inn: 'rotateX(-9deg) translateZ(-600px)', blur: 'blur(6px) brightness(.4)', t1: 380, t2: 560 };
  var busy = false;

  function centre() { main.style.transformOrigin = '50% ' + (window.scrollY + window.innerHeight / 2) + 'px'; }
  function done(a) { return new Promise(function (r) { a.onfinish = r; a.oncancel = r; }); }
  function reset() { main.getAnimations().forEach(function (a) { a.cancel(); }); main.style.opacity = ''; busy = false; }

  function land(target) {
    var prev = html.style.scrollBehavior;
    html.style.scrollBehavior = 'auto';
    var hash = '#' + target.id;
    if (location.hash !== hash) history.pushState(null, '', hash);
    target.scrollIntoView({ block: 'start' });
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    html.style.scrollBehavior = prev;
  }

  function dolly(target, url) {
    if (still) { if (url) location.href = url; else land(target); return; }
    busy = true;
    centre();
    var out = main.animate([{ transform: 'none', filter: 'none', opacity: 1 },
      { transform: 'perspective(1200px) ' + depth.out, filter: depth.blur, opacity: .2 }],
      { duration: depth.t1, easing: 'cubic-bezier(.55,0,.8,.2)', fill: 'forwards' });
    done(out).then(function () {
      if (url) { location.href = url; return; }
      // Drop the exit transform before scrolling, or the target is measured on a shrunken page.
      main.style.opacity = '0';
      out.cancel();
      land(target);
      main.style.opacity = '';
      centre();
      window.dispatchEvent(new Event('scroll')); // let the hero/poster effects catch up
      return done(main.animate([
        { transform: 'perspective(1200px) ' + depth.inn, filter: depth.blur, opacity: 0 },
        { transform: 'none', filter: 'none', opacity: 1 }],
        { duration: depth.t2, easing: 'cubic-bezier(.15,.75,.3,1)' }));
    }).then(function () { busy = false; });
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest('.nav__links a, .nav__brand, .hero a[href^="#"]');
    if (!a || busy || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.target === '_blank' || a.classList.contains('lang-switch') || a.hasAttribute('hreflang')) return;
    var href = a.getAttribute('href') || '';
    if (href.charAt(0) === '#') {
      var target = document.getElementById(href.slice(1));
      if (!target) return;
      e.preventDefault();
      dolly(target);
    } else if (a.origin === location.origin) {
      e.preventDefault();
      dolly(null, a.href);
    }
  });
  window.addEventListener('pageshow', function (e) { if (e.persisted) reset(); });
})();

// ---- Cursor FX (desktop only): Robot / Devil / None switch in the header ----
// Desktop switch is currently disabled: no switch, regular cursor, no background (stored choice ignored).
// Set DESKTOP_MODES_ENABLED = true here AND in assets/bg/bg.js to bring it back. Touch devices are unaffected.
var DESKTOP_MODES_ENABLED = false;
// "Desktop" = a fine hovering pointer, or no touch support at all
var BM_DESKTOP = window.matchMedia('(hover:hover) and (pointer:fine)').matches ||
  (!window.matchMedia('(pointer:coarse)').matches && !navigator.maxTouchPoints && !('ontouchstart' in window));
(function () {
  var mq = window.matchMedia('(hover:hover) and (pointer:fine)');
  if (!mq.matches || !document.querySelector('.nav')) return;
  if (!DESKTOP_MODES_ENABLED) return;
  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var KEY = 'bm-cursor', html = document.documentElement;
  var base = (document.currentScript && document.currentScript.src) ||
    (document.querySelector('script[src*="main.js"]') || {}).src || '';
  base = base.replace(/main\.js.*$/, '');
  var A = base + 'assets/cursor/';
  var ART = { robot: { idle: A + 'robot-idle.webp', aim: A + 'robot-aim.webp', mx: .97, my: .30 },
              devil: { idle: A + 'devil-idle.webp', aim: A + 'devil-aim.webp', mx: .94, my: .17 } };
  [ART.robot.aim, ART.devil.aim, ART.robot.idle, ART.devil.idle].forEach(function (u) { new Image().src = u; });
  var ROBOT = '<img src="' + ART.robot.idle + '" alt="">', DEVIL = '<img src="' + ART.devil.idle + '" alt="">';
  var L = html.lang === 'he' ? { label: 'סמן', robot: 'רובוט', devil: 'שד', none: 'ללא' } : { label: 'Cursor', robot: 'Robot', devil: 'Devil', none: 'Off' };
  var mode = localStorage.getItem(KEY) || 'none';

  // Header switch
  var sw = document.createElement('div');
  sw.className = 'cfx-switch'; sw.setAttribute('role', 'radiogroup'); sw.setAttribute('aria-label', L.label);
  ['robot', 'devil', 'none'].forEach(function (m) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'cfx-switch__opt'; b.dataset.mode = m; b.setAttribute('role', 'radio');
    b.innerHTML = '<span class="cfx-switch__ico">' + (m === 'robot' ? ROBOT : m === 'devil' ? DEVIL : '<svg viewBox="0 0 24 24"><path d="M5 3l14 8-6 1.6L10 19z"/></svg>') + '</span><span class="cfx-switch__txt">' + L[m] + '</span>';
    b.addEventListener('click', function () { set(m); });
    sw.appendChild(b);
  });
  var nav = document.querySelector('.nav'), links = nav.querySelector('.nav__links');
  nav.insertBefore(sw, links);

  // Cursor sprite
  var sprite = document.createElement('div');
  sprite.className = 'cfx-sprite'; sprite.setAttribute('aria-hidden', 'true');
  document.body.appendChild(sprite);
  var x = -100, y = -100;
  function set(m) {
    mode = m; localStorage.setItem(KEY, m);
    window.dispatchEvent(new CustomEvent('bm-cursor-mode', { detail: m }));
    html.classList.toggle('cfx-on', m !== 'none');
    sprite.innerHTML = ART[m] ? '<img src="' + ART[m].idle + '" alt="">' : '';
    sprite.dataset.mode = m;
    [].forEach.call(sw.children, function (b) { b.setAttribute('aria-checked', b.dataset.mode === m); });
  }
  set(mode);
  var TEXTY = 'input, textarea, select, [contenteditable="true"]';
  document.addEventListener('mousemove', function (e) {
    x = e.clientX; y = e.clientY;
    sprite.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    sprite.classList.toggle('cfx-hide', !!(e.target.closest && e.target.closest(TEXTY)));
  }, { passive: true });
  document.addEventListener('mouseleave', function () { sprite.classList.add('cfx-hide'); });

  // Shots
  function shoot(target) {
    var r = target.getBoundingClientRect();
    var tx = r.left + r.width / 2, ty = r.top + Math.min(r.height / 2, 140);
    var img = sprite.firstChild, art = ART[mode], left = tx < x;
    img.src = art.aim; sprite.classList.add('cfx-aim'); sprite.classList.toggle('cfx-left', left);
    var ir = img.getBoundingClientRect(), w = ir.height * (img.naturalWidth / img.naturalHeight || .7);
    var ox = (left ? ir.right - w * art.mx : ir.left + w * art.mx), sy = ir.top + ir.height * art.my, sx = ox;
    var fx = document.createElement('div'); fx.className = 'cfx-fx'; document.body.appendChild(fx);
    var dx = tx - sx, dy = ty - sy, len = Math.hypot(dx, dy), ang = Math.atan2(dy, dx) * 180 / Math.PI;
    if (mode === 'robot') {
      var beam = document.createElement('i'); beam.className = 'cfx-beam';
      beam.style.cssText = 'left:' + sx + 'px;top:' + sy + 'px;width:' + len + 'px;transform:rotate(' + ang + 'deg)';
      fx.appendChild(beam);
    } else {
      for (var i = 0; i < 16; i++) {
        var p = document.createElement('i'); p.className = 'cfx-flame';
        var j = (Math.random() - .5) * 0.5, k = 0.85 + Math.random() * 0.3, d = 90 + i * 9;
        p.style.cssText = 'left:' + sx + 'px;top:' + sy + 'px';
        p.animate([{ transform: 'translate(-50%,-50%) scale(.3)', opacity: 1 },
          { transform: 'translate(calc(-50% + ' + (dx * k + dy * j) + 'px),calc(-50% + ' + (dy * k - dx * j) + 'px)) scale(' + (1.4 + Math.random()) + ')', opacity: 0 }],
          { duration: 280, delay: d, easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'both' });
        fx.appendChild(p);
      }
    }
    var hit = document.createElement('i'); hit.className = 'cfx-hit cfx-hit--' + mode;
    hit.style.cssText = 'left:' + tx + 'px;top:' + ty + 'px'; fx.appendChild(hit);
    sprite.classList.add('cfx-recoil');
    target.classList.remove('cfx-blasted', 'cfx-burnt'); void target.offsetWidth;
    target.classList.add(mode === 'robot' ? 'cfx-blasted' : 'cfx-burnt');
    setTimeout(function () { fx.remove(); sprite.classList.remove('cfx-recoil', 'cfx-aim', 'cfx-left'); if (ART[mode]) img.src = ART[mode].idle; }, 560);
    setTimeout(function () { target.classList.remove('cfx-blasted', 'cfx-burnt'); }, 900);
  }

  // Intercept before the dolly handler (capture phase), play the shot, then replay the click.
  var replaying = false, FX_MS = 430;
  document.addEventListener('click', function (e) {
    if (replaying || mode === 'none' || still) return;
    if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest('a[href]');
    if (!a || a.closest('.cfx-switch') || a.closest(TEXTY)) return;
    var target = a.closest('.card') || a;
    e.preventDefault(); e.stopImmediatePropagation();
    shoot(target);
    setTimeout(function () { replaying = true; a.click(); replaying = false; }, FX_MS);
  }, true);
})();

// ---- Cursor FX on touch devices: character rides the right edge with the scroll; taps fire at the target ----
(function () {
  if (window.matchMedia('(hover:hover) and (pointer:fine)').matches) return; // desktop handled above
  if (BM_DESKTOP && !DESKTOP_MODES_ENABLED) return;                              // desktop modes disabled
  var nav = document.querySelector('.nav');
  if (!nav) return;
  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var KEY = 'bm-cursor', html = document.documentElement;
  var base = ((document.querySelector('script[src*="main.js"]') || {}).src || '').replace(/main\.js.*$/, '');
  var A = base + 'assets/cursor/';
  var ART = { robot: { idle: A + 'robot-idle.webp', aim: A + 'robot-aim.webp', mx: .97, my: .30 },
              devil: { idle: A + 'devil-idle.webp', aim: A + 'devil-aim.webp', mx: .94, my: .17 } };
  var L = html.lang === 'he' ? { label: 'דמות', robot: 'רובוט', devil: 'שד', none: 'ללא' } : { label: 'Character', robot: 'Robot', devil: 'Devil', none: 'Off' };
  var OFF = '<svg viewBox="0 0 24 24"><path d="M5 3l14 8-6 1.6L10 19z"/></svg>';
  var mode = localStorage.getItem(KEY) || 'none';
  if (!ART[mode]) mode = 'none';
  html.classList.add('cfx-touch');

  // Compact header control: one round button that opens a small menu
  var wrap = document.createElement('div'); wrap.className = 'cfx-m';
  var btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'cfx-m__btn'; btn.setAttribute('aria-haspopup', 'true'); btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-label', L.label);
  var sw = document.createElement('div');
  sw.className = 'cfx-switch'; sw.setAttribute('role', 'radiogroup'); sw.setAttribute('aria-label', L.label);
  ['robot', 'devil', 'none'].forEach(function (m) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'cfx-switch__opt'; b.dataset.mode = m; b.setAttribute('role', 'radio');
    b.innerHTML = '<span class="cfx-switch__ico">' + (ART[m] ? '<img src="' + ART[m].idle + '" alt="">' : OFF) + '</span><span>' + L[m] + '</span>';
    b.addEventListener('click', function () { set(m); open(false); });
    sw.appendChild(b);
  });
  wrap.appendChild(btn); wrap.appendChild(sw); nav.appendChild(wrap);
  function open(o) { wrap.classList.toggle('cfx-m--open', o); btn.setAttribute('aria-expanded', o); }
  btn.addEventListener('click', function () { open(!wrap.classList.contains('cfx-m--open')); });
  document.addEventListener('click', function (e) { if (!wrap.contains(e.target)) open(false); }, true);

  // Rider
  var rider = document.createElement('div'); rider.className = 'cfx-rider'; rider.setAttribute('aria-hidden', 'true');
  var img = document.createElement('img'); img.alt = ''; rider.appendChild(img);
  document.body.appendChild(rider);
  function set(m) {
    mode = m; localStorage.setItem(KEY, m);
    window.dispatchEvent(new CustomEvent('bm-cursor-mode', { detail: m }));
    html.classList.toggle('cfx-on', m !== 'none');
    wrap.classList.toggle('cfx-m--on', m !== 'none');
    btn.innerHTML = ART[m] ? '<img src="' + ART[m].idle + '" alt="">' : OFF;
    if (ART[m]) { img.src = ART[m].idle; new Image().src = ART[m].aim; }
    [].forEach.call(sw.children, function (b) { b.setAttribute('aria-checked', b.dataset.mode === m); });
    cur = goal(); place(cur);
  }
  var cur = 0, raf = 0;
  function goal() {
    var top = nav.offsetHeight + 6, bot = 8, h = rider.offsetHeight || 46;
    var max = document.documentElement.scrollHeight - innerHeight;
    var p = max > 0 ? Math.min(Math.max(scrollY / max, 0), 1) : 0;
    return top + p * (innerHeight - top - bot - h);
  }
  function place(v) { rider.style.transform = 'translate3d(0,' + v.toFixed(1) + 'px,0)'; }
  function tick() {
    var g = goal(); cur += (g - cur) * (still ? 1 : .18); place(cur);
    raf = Math.abs(g - cur) > .3 ? requestAnimationFrame(tick) : 0;
  }
  function kick() { if (!raf && mode !== 'none') raf = requestAnimationFrame(tick); }
  addEventListener('scroll', kick, { passive: true });
  addEventListener('resize', kick);
  set(mode);

  function shoot(target, px, py) {
    var r = target.getBoundingClientRect();
    var tx = target.classList.contains('card') ? r.left + r.width / 2 : px, ty = target.classList.contains('card') ? Math.min(Math.max(py, r.top + 20), r.bottom - 20) : py;
    var art = ART[mode], rr = rider.getBoundingClientRect(), left = tx < rr.left + rr.width / 2;
    img.src = art.aim; rider.classList.add('cfx-recoil'); rider.classList.toggle('cfx-left', left);
    var h = rr.height, w = h * (img.naturalWidth / img.naturalHeight || .7), ir = rr.right - w;
    var sx = left ? rr.right - w * art.mx : ir + w * art.mx, sy = rr.bottom - h + h * art.my;
    var dx = tx - sx, dy = ty - sy, len = Math.hypot(dx, dy), ang = Math.atan2(dy, dx) * 180 / Math.PI;
    var fx = document.createElement('div'); fx.className = 'cfx-fx'; document.body.appendChild(fx);
    if (mode === 'robot') {
      var beam = document.createElement('i'); beam.className = 'cfx-beam';
      beam.style.cssText = 'left:' + sx + 'px;top:' + sy + 'px;width:' + len + 'px;transform:rotate(' + ang + 'deg)';
      fx.appendChild(beam);
    } else {
      for (var i = 0; i < 18; i++) {
        var p = document.createElement('i'); p.className = 'cfx-flame';
        var j = (Math.random() - .5) * .35, k = .85 + Math.random() * .3;
        p.style.cssText = 'left:' + sx + 'px;top:' + sy + 'px';
        p.animate([{ transform: 'translate(-50%,-50%) scale(.3)', opacity: 1 },
          { transform: 'translate(calc(-50% + ' + (dx * k + dy * j) + 'px),calc(-50% + ' + (dy * k - dx * j) + 'px)) scale(' + (1.4 + Math.random()) + ')', opacity: 0 }],
          { duration: 300, delay: 90 + i * 8, easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'both' });
        fx.appendChild(p);
      }
    }
    var hit = document.createElement('i'); hit.className = 'cfx-hit cfx-hit--' + mode;
    hit.style.cssText = 'left:' + tx + 'px;top:' + ty + 'px'; fx.appendChild(hit);
    target.classList.remove('cfx-blasted', 'cfx-burnt'); void target.offsetWidth;
    target.classList.add(mode === 'robot' ? 'cfx-blasted' : 'cfx-burnt');
    setTimeout(function () { fx.remove(); rider.classList.remove('cfx-recoil', 'cfx-left'); if (ART[mode]) img.src = ART[mode].idle; }, 560);
    setTimeout(function () { target.classList.remove('cfx-blasted', 'cfx-burnt'); }, 900);
  }

  var replaying = false;
  document.addEventListener('click', function (e) {
    if (replaying || mode === 'none' || still) return;
    if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest('a[href]');
    if (!a || wrap.contains(a)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    shoot(a.closest('.card') || a, e.clientX, e.clientY);
    setTimeout(function () { replaying = true; a.click(); replaying = false; }, 430);
  }, true);
})();

// ---- AI Tutor card promo video: click-to-play, native controls once started ----
(function () {
  [].forEach.call(document.querySelectorAll('.card__video'), function (box) {
    var v = box.querySelector('video'), b = box.querySelector('.card__play');
    if (!v || !b) return;
    // clicks in the video area play the video; the rest of the card keeps linking to the tutor page
    box.addEventListener('click', function (e) { e.stopPropagation(); });
    var badge = document.createElement('span'); badge.className = 'card__dur'; badge.setAttribute('aria-hidden', 'true'); box.appendChild(badge);
    function dur() { var d = Math.round(v.duration); if (d > 0 && isFinite(d)) badge.textContent = Math.floor(d / 60) + ':' + ('0' + d % 60).slice(-2); }
    if (v.readyState >= 1) dur(); else v.addEventListener('loadedmetadata', dur);
    box.addEventListener('click', function () { if (box.classList.contains('is-playing')) return;
      box.classList.add('is-playing'); v.controls = true;
      var p = v.play(); if (p && p.catch) p.catch(function () {});
    });
    v.addEventListener('ended', function () { box.classList.remove('is-playing'); v.controls = false; v.load(); });
    box.bmPlay = function () {
      if (box.classList.contains('is-playing')) return;
      box.classList.add('is-playing'); v.controls = true;
      var p = v.play();
      // without a user gesture the browser may refuse sound: start muted (controls let you unmute)
      if (p && p.catch) p.catch(function () { v.muted = true; v.play().catch(function () { box.classList.remove('is-playing'); v.controls = false; }); });
    };
  });
  // Deep links: #tutor scrolls to the AI Tutor card (brief highlight); #tutor-video scrolls there and plays the video
  function deep() {
    var h = location.hash, card = document.getElementById('tutor'), box = document.getElementById('tutor-video');
    if (!card || (h !== '#tutor' && h !== '#tutor-video')) return;
    card.classList.add('is-visible');
    card.scrollIntoView({ block: 'center' });
    card.classList.remove('card--flash'); void card.offsetWidth; card.classList.add('card--flash');
    setTimeout(function () { card.classList.remove('card--flash'); }, 2200);
    if (h === '#tutor-video' && box && box.bmPlay) box.bmPlay();
  }
  window.addEventListener('hashchange', deep);
  if (document.readyState === 'complete') setTimeout(deep, 60); else window.addEventListener('load', function () { setTimeout(deep, 60); });
})();
