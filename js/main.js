/**
 * Sivun pääinit — ei mitään logiikkaa, vain liimaa moduulit yhteen.
 */
(async function () {
  const CFG = window.AURORA_CONFIG;

  // 1. Kieli
  await window.AuroraI18n.load(localStorage.getItem('aurora_lang') || CFG.DEFAULT_LANG);

  // 2. Kielivalitsin
  document.querySelectorAll('[data-set-lang]').forEach((btn) => {
    btn.addEventListener('click', () => window.AuroraI18n.load(btn.dataset.setLang));
  });

  // 3. Live-data
  async function refresh() {
    try {
      const data = await window.SolarWind.getAll();
      const aurora = window.AuroraEngine.calculate({
        kp: data.kp, speed: data.speed, density: data.density,
        bz: data.bz, latitude: 67, // oletuslat = Lappi keskiarvo
      });
      render(data, aurora);
    } catch (err) {
      console.error('[refresh]', err);
      document.querySelectorAll('[data-error]').forEach(
        (el) => (el.textContent = window.AuroraI18n.t('error.fetch'))
      );
    }
  }

  function render(data, aurora) {
    const set = (sel, val) => {
      const el = document.querySelector(sel);
      if (el) el.textContent = val;
    };
    set('[data-kp]',          data.kp?.toFixed(1) ?? '–');
    set('[data-speed]',       data.speed ? `${data.speed.toFixed(0)} km/s` : '–');
    set('[data-density]',     data.density?.toFixed(1) ?? '–');
    set('[data-bz]',          data.bz?.toFixed(1) ?? '–');
    set('[data-probability]', `${aurora.probability}%`);
    document.body.dataset.auroraLevel = aurora.level;
  }

  // 4. Haku (jos haku-input on sivulla)
  const searchInput = document.querySelector('#search-input');
  const searchResults = document.querySelector('#search-results');
  if (searchInput && searchResults) {
    window.AuroraSearch.attach(searchInput, searchResults, (place) => {
      console.log('Selected:', place);
      // TODO: keskitä kartta tähän pisteeseen
    });
  }

  refresh();
  setInterval(refresh, CFG.REFRESH_INTERVAL);
})();
