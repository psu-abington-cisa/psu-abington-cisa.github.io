/* =========================================================================
   Come Hack presentations — index + viewer
   Reads data/presentations.json at load time (cache: no-cache) so hand edits
   to that file show up without touching code. Everything rendered from the
   JSON goes through escapeHtml(); links go through safeHttpUrl()/safePdfPath().
   ========================================================================= */

(function (root) {
  'use strict';

  var DATA_URL = 'data/presentations.json';
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // =======================================================================
  // Pure helpers (also exported for scripts/test-app.js)
  // =======================================================================

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (ch) {
      if (ch === '&') return '&amp;';
      if (ch === '<') return '&lt;';
      if (ch === '>') return '&gt;';
      if (ch === '"') return '&quot;';
      return '&#39;';
    });
  }

  /** Returns the URL if it is an absolute http(s) URL, otherwise ''. */
  function safeHttpUrl(url) {
    var s = typeof url === 'string' ? url.trim() : '';
    if (!/^https?:\/\/\S+$/i.test(s)) return '';
    try {
      var u = new URL(s);
      return u.protocol === 'http:' || u.protocol === 'https:' ? s : '';
    } catch (e) {
      return '';
    }
  }

  /**
   * Returns the path if it is a relative PDF path under presentations/
   * (same rule as scripts/validate.py), otherwise ''.
   */
  function safePdfPath(path) {
    var s = typeof path === 'string' ? path : '';
    if (!/^presentations\/[A-Za-z0-9._ \/-]+\.pdf$/i.test(s)) return '';
    if (s.split('/').indexOf('..') !== -1) return '';
    return s;
  }

  /** Parse YYYY-MM-DD as a local date (avoids the UTC off-by-one). */
  function parseDate(str) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(str || ''));
    if (!m) return null;
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    return d.getMonth() === +m[2] - 1 ? d : null;
  }

  function fmtDate(str) {
    var d = parseDate(str);
    if (!d) return String(str || '');
    return WEEKDAYS[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }

  function shortDate(str) {
    var d = parseDate(str);
    if (!d) return String(str || '');
    return MONTHS[d.getMonth()].slice(0, 3) + ' ' + d.getDate() + ', ' + d.getFullYear();
  }

  /** Keep entries that have what a card needs; coerce the rest. */
  function normalize(data) {
    var list = data && Array.isArray(data.presentations) ? data.presentations : [];
    var out = [];
    list.forEach(function (p) {
      if (!p || typeof p !== 'object') return;
      if (typeof p.id !== 'string' || !p.id || typeof p.title !== 'string' || !p.title) return;
      var session = typeof p.session === 'number' && isFinite(p.session) ? p.session : null;
      out.push({
        id: p.id,
        title: p.title,
        date: typeof p.date === 'string' ? p.date : '',
        session: session,
        pdf: safePdfPath(p.pdf),
        kaltura: safeHttpUrl(p.kaltura)
      });
    });
    return out;
  }

  /** Newest first: by date, then by session number. */
  function sortNewestFirst(list) {
    return list.slice().sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return (b.session || 0) - (a.session || 0);
    });
  }

  /** Case-insensitive match on title, dates and session number; every word must hit. */
  function matches(p, query) {
    var words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return true;
    var hay = [
      p.title, p.date, fmtDate(p.date), shortDate(p.date),
      p.session != null ? 'session ' + p.session + ' #' + p.session : '',
      p.kaltura ? 'recording' : ''
    ].join(' ').toLowerCase();
    return words.every(function (w) { return hay.indexOf(w) !== -1; });
  }

  function sessionLabel(p) {
    return p.session != null ? 'Session ' + p.session : 'Session';
  }

  function viewHref(p) {
    return 'view.html?id=' + encodeURIComponent(p.id);
  }

  var api = {
    escapeHtml: escapeHtml,
    safeHttpUrl: safeHttpUrl,
    safePdfPath: safePdfPath,
    parseDate: parseDate,
    fmtDate: fmtDate,
    normalize: normalize,
    sortNewestFirst: sortNewestFirst,
    matches: matches
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
    return;
  }

  // =======================================================================
  // Browser-only code
  // =======================================================================

  var THEME_KEY = 'cisa-theme';

  function safeLocalGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function safeLocalSet(key, val) {
    try { window.localStorage.setItem(key, val); } catch (e) { /* ignore */ }
  }

  function loadPresentations() {
    return fetch(DATA_URL, { cache: 'no-cache' }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(function (data) {
      return sortNewestFirst(normalize(data));
    });
  }

  function wireThemeToggle() {
    var btn = document.getElementById('theme-toggle');
    var meta = document.querySelector('meta[name="theme-color"]');
    var mql = null;
    try { mql = window.matchMedia('(prefers-color-scheme: light)'); } catch (e) { mql = null; }

    function resolve() {
      var stored = safeLocalGet(THEME_KEY);
      if (stored === 'light' || stored === 'dark') return stored;
      return mql && mql.matches ? 'light' : 'dark';
    }
    function apply(theme) {
      if (btn) btn.setAttribute('aria-label', theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme');
      if (meta) meta.setAttribute('content', theme === 'light' ? '#0b1f3a' : '#070e1c');
    }

    var current = resolve();
    apply(current);
    if (btn) {
      btn.addEventListener('click', function () {
        current = current === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', current);
        safeLocalSet(THEME_KEY, current);
        apply(current);
      });
    }
    if (mql) {
      var onChange = function () { current = resolve(); apply(current); };
      if (mql.addEventListener) mql.addEventListener('change', onChange);
      else if (mql.addListener) mql.addListener(onChange);
    }
  }

  /** Mobile menu: same behaviour as the main site's header. */
  function wireMenu() {
    var btn = document.getElementById('menu-toggle');
    var nav = document.getElementById('site-nav');
    if (!btn || !nav) return;
    function setOpen(open) {
      nav.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    btn.addEventListener('click', function () {
      setOpen(btn.getAttribute('aria-expanded') !== 'true');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') {
        setOpen(false);
        btn.focus();
      }
    });
  }

  /** The header blends into the hero at the top; its edge fades in on scroll. */
  function wireHeaderScroll() {
    var header = document.querySelector('.site-header');
    if (!header) return;
    var onScroll = function () { header.classList.toggle('is-scrolled', window.scrollY > 4); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // ---------------- Index page ----------------

  function initIndex() {
    var grid = document.getElementById('deck-grid');
    var input = document.getElementById('search');
    var count = document.getElementById('result-count');
    var all = [];

    function cardHtml(p, latest) {
      var html = '<a class="deck' + (latest ? ' deck-latest' : '') + '" href="' + escapeHtml(viewHref(p)) + '">';
      html += '<span class="deck-top"><span class="deck-session">' + escapeHtml(sessionLabel(p)) +
        (latest ? ' · Latest' : '') + '</span>';
      if (p.kaltura) html += '<span class="badge">Recording</span>';
      html += '</span>';
      html += '<span class="deck-title">' + escapeHtml(p.title) + '</span>';
      html += '<span class="deck-date"><time datetime="' + escapeHtml(p.date) + '">' + escapeHtml(fmtDate(p.date)) + '</time></span>';
      html += '<span class="deck-foot">View slides →</span>';
      html += '</a>';
      return html;
    }

    function render() {
      var q = input ? input.value : '';
      var shown = all.filter(function (p) { return matches(p, q); });
      if (!all.length) {
        grid.innerHTML = '<p class="empty-msg">No presentations yet. Check back after the first session.</p>';
      } else if (!shown.length) {
        grid.innerHTML = '<p class="empty-msg">Nothing matches “' + escapeHtml(q.trim()) + '”.</p>';
      } else {
        grid.innerHTML = shown.map(function (p) {
          return cardHtml(p, !q.trim() && p === all[0]);
        }).join('');
      }
      if (count) {
        count.textContent = q.trim()
          ? shown.length + ' of ' + all.length + ' presentation' + (all.length === 1 ? '' : 's')
          : all.length + ' presentation' + (all.length === 1 ? '' : 's') + ', newest first';
      }
    }

    if (input) {
      input.addEventListener('input', render);
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { input.value = ''; render(); }
      });
    }

    loadPresentations().then(function (list) {
      all = list;
      render();
    }).catch(function (err) {
      console.error(err);
      grid.innerHTML = '<p class="empty-msg">Couldn’t load the list of presentations. Try reloading the page.</p>';
      if (count) count.textContent = '';
    });
  }

  // ---------------- Viewer page ----------------

  function initViewer() {
    var hero = document.getElementById('viewer-copy');
    var body = document.getElementById('viewer-body');
    var id = new URLSearchParams(window.location.search).get('id') || '';
    var back = '<a class="back-link" href="./"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"></path></svg>All presentations</a>';

    function notFound(msg) {
      document.title = 'Presentation not found — Come Hack slides';
      hero.innerHTML = back + '<h1>Presentation not found</h1><p class="lede">' + escapeHtml(msg) + '</p>';
      body.innerHTML = '';
      body.parentNode.hidden = true;
    }

    loadPresentations().then(function (list) {
      var p = null;
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === id) { p = list[i]; break; }
      }
      if (!p) {
        notFound(id ? 'There’s no presentation with the id “' + id + '”.' : 'No presentation was selected.');
        return;
      }

      document.title = p.title + ' — Come Hack slides';

      var html = back;
      html += '<p class="viewer-meta">' + escapeHtml(sessionLabel(p)) + ' · <time datetime="' + escapeHtml(p.date) + '">' + escapeHtml(fmtDate(p.date)) + '</time></p>';
      html += '<h1>' + escapeHtml(p.title) + '</h1>';
      html += '<div class="cta-row">';
      if (p.kaltura) {
        html += '<a class="btn btn-accent btn-lg" href="' + escapeHtml(p.kaltura) + '" target="_blank" rel="noopener noreferrer">' +
          '<svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg>Watch the recording</a>';
      }
      if (p.pdf) {
        html += '<a class="btn btn-light btn-lg" href="' + escapeHtml(encodeURI(p.pdf)) + '" download>' +
          '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"></path></svg>Download PDF</a>';
      }
      html += '</div>';
      if (!p.kaltura) {
        html += '<span class="pill pill-soon"><span class="dot" aria-hidden="true"></span>Recording coming soon</span>';
      }
      hero.innerHTML = html;

      if (p.pdf) {
        var src = escapeHtml(encodeURI(p.pdf));
        if (navigator.pdfViewerEnabled === false) {
          // Browser cannot render PDFs inline (e.g. Android Chrome): skip the iframe.
          body.innerHTML =
            '<p class="note">This browser can’t show PDFs inline. <a href="' + src + '" target="_blank" rel="noopener">Open the PDF in a new tab</a> or use the Download button above.</p>';
        } else {
          body.innerHTML =
            '<iframe class="pdf-frame" src="' + src + '" title="' + escapeHtml(p.title) + ' (PDF slides)"></iframe>' +
            '<p class="note">Slides not showing? <a href="' + src + '" target="_blank" rel="noopener">Open the PDF in a new tab</a> or download it.</p>';
        }
      } else {
        body.innerHTML = '<p class="empty-msg">The slides for this session aren’t available yet.</p>';
      }
    }).catch(function (err) {
      console.error(err);
      notFound('Couldn’t load the list of presentations. Try reloading the page.');
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    wireThemeToggle();
    wireMenu();
    wireHeaderScroll();
    var year = document.getElementById('footer-year');
    if (year) year.textContent = String(new Date().getFullYear());
    if (document.getElementById('deck-grid')) initIndex();
    if (document.getElementById('viewer-body')) initViewer();
  });
})(this);
