/* theme.js — light/dark theme toggle.
   Runs synchronously in <head> so data-theme is set before first paint, then
   wires the #theme-toggle button in the header. Dark is the default, matching
   the main CISA site; the OS preference and the visitor's saved choice
   override. The sun/moon icons are switched by CSS, as on the main site. */
(function () {
  var STORAGE_KEY = 'cisa-theme';
  var root = document.documentElement;

  try {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') {
      root.setAttribute('data-theme', saved);
    }
  } catch (e) { /* localStorage blocked */ }

  function getEffective() {
    var attr = root.getAttribute('data-theme');
    if (attr === 'light' || attr === 'dark') return attr;
    return (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark';
  }

  function setTheme(mode) {
    root.setAttribute('data-theme', mode);
    try { localStorage.setItem(STORAGE_KEY, mode); } catch (e) { /* ignore */ }
    sync();
  }

  function onToggle(btn) {
    var next = getEffective() === 'dark' ? 'light' : 'dark';
    var reduceMotion = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Circular reveal from the button where the browser supports it.
    if (!reduceMotion && typeof document.startViewTransition === 'function') {
      var rect = btn.getBoundingClientRect();
      var x = rect.left + rect.width / 2;
      var y = rect.top + rect.height / 2;
      var endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      );
      var t = document.startViewTransition(function () { setTheme(next); });
      t.ready.then(function () {
        document.documentElement.animate(
          { clipPath: [
            'circle(0 at ' + x + 'px ' + y + 'px)',
            'circle(' + endRadius + 'px at ' + x + 'px ' + y + 'px)'
          ] },
          { duration: 900, easing: 'cubic-bezier(0.2, 0, 0.2, 1)',
            pseudoElement: '::view-transition-new(root)' }
        );
      }).catch(function () {});
      return;
    }

    if (!reduceMotion) {
      root.classList.add('theme-transition');
      setTheme(next);
      setTimeout(function () { root.classList.remove('theme-transition'); }, 850);
    } else {
      setTheme(next);
    }
  }

  function sync() {
    var effective = getEffective();
    var btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.setAttribute('aria-label',
        effective === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    }
    // The header stays navy in both themes, so the browser chrome does too.
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', effective === 'light' ? '#0b1f3a' : '#070e1c');
  }

  function wire() {
    var btn = document.getElementById('theme-toggle');
    if (btn && !btn.dataset.wired) {
      btn.dataset.wired = '1';
      btn.addEventListener('click', function () { onToggle(btn); });
    }
    sync();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }

  if (window.matchMedia) {
    var mql = window.matchMedia('(prefers-color-scheme: light)');
    if (mql.addEventListener) mql.addEventListener('change', sync);
    else if (mql.addListener) mql.addListener(sync); // older Safari
  }
})();
