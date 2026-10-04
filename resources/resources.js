/* Resources page: theme toggle, mobile menu, header edge, footer year and the
   copy button. Shares the 'cisa-theme' key with the main site so the choice
   carries over. No data files and no third-party requests. */
(function () {
  'use strict';

  var THEME_KEY = 'cisa-theme';

  function safeLocalGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function safeLocalSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* storage unavailable */ }
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

  /** The header blends into the hero at the top; its edge fades in on scroll. */
  function wireHeaderScroll() {
    var header = document.querySelector('.site-header');
    if (!header) return;
    var onScroll = function () { header.classList.toggle('is-scrolled', window.scrollY > 4); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // ---------------- Copy-to-clipboard buttons ----------------

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy') ? resolve() : reject(new Error('copy failed')); }
      catch (e) { reject(e); }
      document.body.removeChild(ta);
    });
  }

  function wireCopyButtons() {
    document.querySelectorAll('.res-copy[data-copy]').forEach(function (btn) {
      var label = btn.textContent;
      btn.addEventListener('click', function () {
        copyText(btn.getAttribute('data-copy')).then(function () {
          btn.textContent = 'Copied!';
          btn.classList.add('is-done');
        }, function () {
          btn.textContent = 'Select & copy';
        }).then(function () {
          setTimeout(function () { btn.textContent = label; btn.classList.remove('is-done'); }, 2000);
        });
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var year = document.getElementById('footer-year');
    if (year) year.textContent = String(new Date().getFullYear());
    wireThemeToggle();
    wireMenu();
    wireHeaderScroll();
    wireCopyButtons();
  });
})();
