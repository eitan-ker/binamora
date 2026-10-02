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
