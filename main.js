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
