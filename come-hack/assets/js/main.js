/* COME HACK — theme toggle, mobile menu, and the live meeting card.
   Shares the 'cisa-theme' key with the main CISA site so the choice carries
   over, and reads the main site's data files (../data/*.json) so the meeting
   details and contacts on this page never drift from the schedule. */
(function () {
  'use strict';

  var THEME_KEY = 'cisa-theme';
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function safeLocalGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function safeLocalSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* storage unavailable */ }
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (ch) {
      if (ch === '&') return '&amp;';
      if (ch === '<') return '&lt;';
      if (ch === '>') return '&gt;';
      if (ch === '"') return '&quot;';
      return '&#39;';
    });
  }

  function getJson(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    });
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  // ---------------- Theme toggle (same logic as the main site) ----------------

  /* An explicit stored choice wins; otherwise follow the OS preference. */
  function resolveTheme(stored, systemPrefersLight) {
    if (stored === 'light' || stored === 'dark') return stored;
    return systemPrefersLight ? 'light' : 'dark';
  }

  function nextTheme(current) {
    return current === 'light' ? 'dark' : 'light';
  }

  function wireThemeToggle() {
    var btn = document.getElementById('theme-toggle');
    var metaThemeColor = document.querySelector('meta[name="theme-color"]');
    var mql = null;
    try { mql = window.matchMedia('(prefers-color-scheme: light)'); } catch (e) { mql = null; }

    function systemPrefersLight() {
      return !!(mql && mql.matches);
    }

    function applyLabelAndMeta(theme) {
      if (btn) btn.setAttribute('aria-label', theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme');
      if (metaThemeColor) metaThemeColor.setAttribute('content', theme === 'light' ? '#0b1f3a' : '#070e1c');
    }

    var current = resolveTheme(safeLocalGet(THEME_KEY), systemPrefersLight());
    applyLabelAndMeta(current);

    if (btn) {
      btn.addEventListener('click', function () {
        current = nextTheme(current);
        document.documentElement.setAttribute('data-theme', current);
        safeLocalSet(THEME_KEY, current);
        applyLabelAndMeta(current);
      });
    }

    if (mql) {
      var onSystemChange = function () {
        var stored = safeLocalGet(THEME_KEY);
        if (stored === 'light' || stored === 'dark') return; // explicit choice wins
        current = resolveTheme(null, systemPrefersLight());
        applyLabelAndMeta(current);
      };
      if (mql.addEventListener) mql.addEventListener('change', onSystemChange);
      else if (mql.addListener) mql.addListener(onSystemChange); // older Safari
    }
  }

  // ---------------- Mobile menu (same logic as the main site) ----------------

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

  // ---------------- Meeting card from ../data/events.json ----------------

  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  /** YYYY-MM-DD (+ optional HH:MM) -> local Date, without the UTC day shift. */
  function parseLocal(dateStr, timeStr) {
    var d = String(dateStr).split('-');
    var hh = 0, mm = 0;
    if (timeStr) { var t = String(timeStr).split(':'); hh = parseInt(t[0], 10); mm = parseInt(t[1], 10); }
    return new Date(parseInt(d[0], 10), parseInt(d[1], 10) - 1, parseInt(d[2], 10), hh, mm, 0, 0);
  }

  function addDays(dateStr, days) {
    var d = parseLocal(dateStr);
    d.setDate(d.getDate() + days);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function fmtTime12(hh, mm) {
    var h12 = hh % 12; if (h12 === 0) h12 = 12;
    return h12 + ':' + pad2(mm) + ' ' + (hh >= 12 ? 'PM' : 'AM');
  }

  /** "12:15 – 1:15 PM" from HH:MM strings (end optional). */
  function fmtTime(start, end) {
    if (!start) return '';
    var s = start.split(':').map(function (n) { return parseInt(n, 10); });
    if (!end) return fmtTime12(s[0], s[1]);
    var e = end.split(':').map(function (n) { return parseInt(n, 10); });
    var sh = s[0] % 12; if (sh === 0) sh = 12;
    if ((s[0] >= 12) === (e[0] >= 12)) return sh + ':' + pad2(s[1]) + ' – ' + fmtTime12(e[0], e[1]);
    return fmtTime12(s[0], s[1]) + ' – ' + fmtTime12(e[0], e[1]);
  }

  /** Expand an event's optional `repeat` block into dated occurrences. */
  function expandRepeat(ev) {
    if (!ev.repeat) return [ev];
    var step = ev.repeat.every === '2w' ? 14 : 7;
    var skip = ev.repeat.skip || [];
    var out = [];
    var cur = ev.date;
    var guard = 0;
    while (cur <= ev.repeat.until && guard++ < 500) {
      if (skip.indexOf(cur) === -1) {
        var occ = {};
        for (var k in ev) if (Object.prototype.hasOwnProperty.call(ev, k)) occ[k] = ev[k];
        occ.date = cur;
        out.push(occ);
      }
      cur = addDays(cur, step);
    }
    return out;
  }

  function loadMeeting() {
    getJson('../data/events.json').then(function (data) {
      var now = new Date();
      var upcoming = [];
      (Array.isArray(data.events) ? data.events : []).forEach(function (ev) {
        if (ev.type !== 'come-hack') return;
        expandRepeat(ev).forEach(function (occ) {
          if (occ.cancelled) return;
          if (parseLocal(occ.date, occ.end || occ.start || '23:59') >= now) upcoming.push(occ);
        });
      });
      upcoming.sort(function (a, b) { return parseLocal(a.date, a.start || '00:00') - parseLocal(b.date, b.start || '00:00'); });
      var next = upcoming[0];
      if (!next) {
        setText('meeting-when', 'Dates coming soon');
        setText('meeting-when-sub', 'Check the schedule or Instagram for the next announcement');
        return;
      }
      var d = parseLocal(next.date);
      var cadence = !next.repeat ? '' : (next.repeat.every === '2w' ? 'Every other ' : 'Every ');
      setText('meeting-when', cadence ? cadence + WEEKDAYS[d.getDay()] : WEEKDAYS[d.getDay()] + ', ' + MONTHS_SHORT[d.getMonth()] + ' ' + d.getDate());
      var sub = [];
      if (next.start) sub.push(fmtTime(next.start, next.end));
      sub.push('Next: ' + WEEKDAYS_SHORT[d.getDay()] + ', ' + MONTHS_SHORT[d.getMonth()] + ' ' + d.getDate());
      setText('meeting-when-sub', sub.join(' · '));
      if (next.location) setText('meeting-where', next.location);
    }).catch(function (err) {
      console.error('Could not load ../data/events.json; keeping the static meeting card', err);
    });
  }

  // ---------------- Contacts from ../data/board.json ----------------

  function loadContacts() {
    getJson('../data/board.json').then(function (data) {
      var el = document.getElementById('contact-people');
      if (!el) return;
      var members = (Array.isArray(data.members) ? data.members : []).filter(function (m) {
        return m && m.contact === true && m.name;
      });
      if (!members.length) return; // keep the static fallback
      el.innerHTML = members.map(function (m) {
        var initials = String(m.name).split(/\s+/).map(function (w) { return w.charAt(0); }).join('').slice(0, 2).toUpperCase();
        var email = m.email && /^[^@\s]+@[^@\s]+$/.test(m.email)
          ? '<a href="mailto:' + escapeHtml(m.email) + '">' + escapeHtml(m.email) + '</a><br>' : '';
        return '<div class="person">' +
          '<span class="avatar" aria-hidden="true">' + escapeHtml(initials) + '</span>' +
          '<div><h3>' + escapeHtml(m.name) + '</h3>' +
          '<p class="person-role">' + escapeHtml(m.role || '') + '</p>' +
          '<p>' + email + 'Available on Microsoft Teams &amp; Outlook</p></div>' +
          '</div>';
      }).join('');
    }).catch(function (err) {
      console.error('Could not load ../data/board.json; keeping the static contacts', err);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    wireThemeToggle();
    wireMenu();
    loadMeeting();
    loadContacts();
  });
})();
