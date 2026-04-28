/**
 * Pääinit etusivulle: kieli, KP-data, kohdelista, esikatselukartta, haku.
 */
(async function () {
  const CFG = window.AURORA_CONFIG;

  // ---------- Kieli ----------
  await window.AuroraI18n.load(localStorage.getItem('aurora_lang') || CFG.DEFAULT_LANG);
  document.querySelectorAll('[data-set-lang]').forEach((btn) => {
    btn.addEventListener('click', () => {
      window.AuroraI18n.load(btn.dataset.setLang);
      document.querySelectorAll('[data-set-lang]').forEach(b => b.classList.toggle('active', b === btn));
    });
    if (btn.dataset.setLang === window.AuroraI18n.current) btn.classList.add('active');
  });

  // ---------- KP / aurora ----------
  let currentKp = null;

  async function refreshSolar() {
    try {
      const data = await window.SolarWind.getAll();
      currentKp = data.kp;
      const aurora = window.AuroraEngine.calculate({
        kp: data.kp, speed: data.speed, density: data.density,
        bz: data.bz, latitude: 67,
      });
      const set = (sel, val) => document.querySelectorAll(sel).forEach(el => el.textContent = val);
      set('[data-kp]',          data.kp != null ? data.kp.toFixed(1) : '–');
      set('[data-speed]',       data.speed ? `${data.speed.toFixed(0)} km/s` : '–');
      set('[data-bz]',          data.bz != null ? `${data.bz.toFixed(1)} nT` : '–');
      set('[data-probability]', `${aurora.probability}%`);
      document.body.dataset.auroraLevel = aurora.level;
      // päivitä myös kohderivien KP-arvot
      updateRowKp();
    } catch (err) {
      console.error('[refreshSolar]', err);
      document.querySelectorAll('[data-error]').forEach(el => el.textContent = window.AuroraI18n.t('error.fetch'));
    }
  }

  function kpClass(kp) {
    if (kp == null) return '';
    if (kp >= 5) return 'kp-high';
    if (kp >= 3) return 'kp-mid';
    return 'kp-low';
  }
  function updateRowKp() {
    document.querySelectorAll('.place-row .kp-val').forEach(el => {
      el.textContent = currentKp != null ? currentKp.toFixed(1) : '–';
      el.className = `value kp-val ${kpClass(currentKp)}`;
    });
  }

  // ---------- Kohdelista ----------
  const grid = document.getElementById('places-grid');
  if (grid) {
    try {
      const all = await window.AuroraPlaces.load();
      // Näytetään 4 ekaa (voit muuttaa)
      const shown = all.slice(0, 4);
      grid.innerHTML = '';
      shown.forEach((p) => {
        const row = document.createElement('div');
        row.className = 'place-row';
        row.innerHTML = `
          <div class="place-name">${p.name}</div>
          <div class="data-group">
            <div class="data-item"><span class="label">KP</span><span class="value kp-val">–</span></div>
            <div class="data-item"><span class="label" data-i18n="row.clouds">CLOUDS</span><span class="value cloud-val">–</span></div>
            <div class="data-item"><span class="label" data-i18n="row.temp">TEMP</span><span class="value temp-val">–</span></div>
          </div>`;
        row.addEventListener('click', () => { window.location.href = `map.html?id=${p.id}`; });
        grid.appendChild(row);

        window.AuroraWeather.getWeather(p.lat, p.lon).then(w => {
          if (!w) return;
          row.querySelector('.cloud-val').textContent = w.clouds != null ? `${w.clouds}%` : '–';
          row.querySelector('.temp-val').textContent  = `${w.temp}°C`;
        });
      });
      updateRowKp();
      window.AuroraI18n.load(window.AuroraI18n.current); // re-apply käännökset
    } catch (e) {
      grid.innerHTML = `<div style="color:var(--fg-muted);text-align:center;padding:40px;">Could not load locations</div>`;
    }
  }

  // ---------- Esikatselukartta ----------
  const previewEl = document.getElementById('map-preview');
  if (previewEl && typeof L !== 'undefined') {
    const preview = L.map('map-preview', {
      center: [67.5, 26], zoom: 4, zoomControl: false, attributionControl: false,
      dragging: false, scrollWheelZoom: false, doubleClickZoom: false,
      touchZoom: false, boxZoom: false, keyboard: false,
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(preview);
    L.circleMarker([67.5, 26], {
      radius: 30, color: '#00ffcc', fillColor: '#00ffcc', fillOpacity: 0.15, weight: 2,
    }).addTo(preview);
  }

  // ---------- Haku ----------
  const searchInput = document.querySelector('#search-input');
  const searchResults = document.querySelector('#search-results');
  if (searchInput && searchResults) {
    window.AuroraSearch.attach(searchInput, searchResults, (place) => {
      window.location.href = `map.html?lat=${place.lat}&lon=${place.lon}`;
    });
  }

  refreshSolar();
  setInterval(refreshSolar, CFG.REFRESH_INTERVAL);
})();
