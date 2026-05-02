/**
 * Yksinkertainen i18n — lataa lang/{code}.json ja korvaa [data-i18n]-elementit.
 */
(function () {
  const CFG = window.AURORA_CONFIG;
  let translations = {};
  let currentLang = localStorage.getItem('aurora_lang') || CFG.DEFAULT_LANG;

  async function load(lang) {
    if (!CFG.SUPPORTED_LANGS.includes(lang)) lang = CFG.DEFAULT_LANG;
    // Resolve lang/ relative to where i18n.js is loaded from, so subfolder pages (e.g. blog/) work too.
    const scriptEl = document.querySelector('script[src*="i18n.js"]');
    const base = scriptEl ? scriptEl.src.replace(/js\/i18n\.js.*$/, '') : '';
    const res = await fetch(`${base}lang/${lang}.json?v=${CFG.VERSION}`);
    translations = await res.json();
    currentLang = lang;
    localStorage.setItem('aurora_lang', lang);
    document.documentElement.lang = lang;
    apply();
  }

  function t(key, fallback = key) {
    return translations[key] || fallback;
  }

  function apply() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      el.innerHTML = t(key);
    });
    document.querySelectorAll('[data-i18n-attr]').forEach((el) => {
      // formaatti: "title:hero.title,placeholder:hero.search"
      const spec = el.getAttribute('data-i18n-attr');
      spec.split(',').forEach((pair) => {
        const [attr, key] = pair.split(':');
        el.setAttribute(attr, t(key));
      });
    });
    document.dispatchEvent(new CustomEvent('i18n:changed', { detail: { lang: currentLang } }));
  }

  window.AuroraI18n = { load, t, get current() { return currentLang; } };
})();
