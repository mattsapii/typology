// Loaded in <head> before CSS paints: picks the theme without a flash, then wires the header toggle.
(function () {
  var KEY = 'typology.theme';
  var root = document.documentElement;
  root.className = root.className.replace('no-js', 'js');
  function saved() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function system() { return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }
  function apply(t) {
    root.setAttribute('data-theme', t);
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', t === 'dark' ? '#1C1B18' : '#F2EEE3');
    var b = document.querySelector('[data-theme-toggle]');
    if (b) {
      b.setAttribute('aria-pressed', String(t === 'dark'));
      b.setAttribute('aria-label', t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
      b.title = b.getAttribute('aria-label');
    }
    document.dispatchEvent(new CustomEvent('themechange', { detail: t }));
  }
  apply(saved() || system());
  if (window.matchMedia) {
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) { if (!saved()) apply(e.matches ? 'dark' : 'light'); });
  }
  document.addEventListener('DOMContentLoaded', function () {
    apply(root.getAttribute('data-theme'));
    var b = document.querySelector('[data-theme-toggle]');
    if (!b) return;
    b.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(KEY, next); } catch (e) {}
      apply(next);
    });
  });
})();
