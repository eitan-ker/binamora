// BinaMora — small progressive enhancements (site works without JS).
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
    if (!email) { setError(fields.email, 'Please enter your email address.'); firstBad = firstBad || fields.email; }
    else if (!EMAIL_RE.test(email)) { setError(fields.email, 'Please enter a valid email address.'); firstBad = firstBad || fields.email; }
    else setError(fields.email, '');
    if (!message) { setError(fields.message, 'Please write a message.'); firstBad = firstBad || fields.message; }
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
    button.textContent = 'Sending…';

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
        showStatus('success', 'Thank you — your message has been sent. We’ll be in touch soon.');
      })
      .catch(function () {
        showStatus('error', 'Sorry, something went wrong and your message wasn’t sent. Please try again in a moment.');
      })
      .then(function () {
        button.disabled = false;
        button.textContent = label;
        status.focus();
      });
  });
})();
