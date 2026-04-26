(function () {
  'use strict';

  const STORAGE_KEY = 'theme';
  const root = document.documentElement;

  function current() {
    return root.getAttribute('data-theme') || 'light';
  }

  function apply(theme) {
    root.setAttribute('data-theme', theme);
    try { localStorage.setItem(STORAGE_KEY, theme); } catch (_) {}
  }

  function toggle() {
    apply(current() === 'dark' ? 'light' : 'dark');
  }

  document.addEventListener('click', function (e) {
    const btn = e.target.closest('.theme-toggle');
    if (btn) {
      e.preventDefault();
      toggle();
    }
  });

  try {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', function (e) {
      if (!localStorage.getItem(STORAGE_KEY)) {
        apply(e.matches ? 'dark' : 'light');
      }
    });
  } catch (_) {}
})();
