/**
 * Karttasivun pääinit — Leaflet, markerit, popupit, KP-päivitys.
 */
(async function () {
  const CFG = window.AURORA_CONFIG;
  await window.AuroraI18n.load(localStorage.getItem('aurora_lang') || CFG.DEFAULT_LANG);

  document.querySelectorAll('[data-set-lang]').forEach((btn) => {
    btn.addEventListener('click', () => window.AuroraI18n.load(btn.dataset.setLang));
  });

  // Init Leaflet
  const map = L.map('map', { zoomControl: true, attributionControl: true })
    .setView([67.5, 26], 5);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap © CARTO',
    maxZoom: 18,
  }).addTo(map);

  // Lataa kohteet ja luo markerit
  const places = await window.AuroraPlaces.load();
  const placeMarkers = new Map();

  places.forEach((p) => {
    const marker = L.circleMarker([p.lat, p.lon], {
      radius: 10, color: '#00ffcc', weight: 2,
      fillColor: '#00ffcc', fillOpacity: 0.4,
    }).addTo(map);

    const popupHtml = `
      <strong class="popup-title">${p.name}</strong>
      <div class="popup-body">${p.short || ''}</div>
      <div class="popup-weather"><em>${window.AuroraI18n.t('loading','Loading…')}</em></div>
    `;
    marker.bindPopup(popupHtml);

    marker.on('popupopen', async (e) => {
      const el = e.popup.getElement().querySelector('.popup-weather');
      if (!el || el.dataset.loaded) return;
      const w = await window.AuroraWeather.getWeather(p.lat, p.lon);
      if (w) {
        el.innerHTML = `
          <div>🌡 ${w.temp}°C · ☁ ${w.clouds ?? '–'}% · 💨 ${w.wind} m/s</div>
          <div style="margin-top:4px;color:var(--fg-dim);">${w.desc}</div>
        `;
      } else {
        el.textContent = window.AuroraI18n.t('error.fetch','Weather not available');
      }
      el.dataset.loaded = 'true';
    });

    placeMarkers.set(p.id, { marker, place: p });
  });

  // URL-parametrit: ?id=rovaniemi tai ?lat=&lon=
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  const lat = params.get('lat');
  const lon = params.get('lon');
  if (id && placeMarkers.has(id)) {
    const { marker, place } = placeMarkers.get(id);
    map.setView([place.lat, place.lon], 8);
    marker.openPopup();
  } else if (lat && lon) {
    map.setView([parseFloat(lat), parseFloat(lon)], 8);
    L.marker([parseFloat(lat), parseFloat(lon)]).addTo(map);
  }

  // KP-data headeriin
  async function refreshSolar() {
    try {
      const data = await window.SolarWind.getAll();
      const aurora = window.AuroraEngine.calculate({
        kp: data.kp, speed: data.speed, density: data.density, bz: data.bz, latitude: 67,
      });
      const set = (sel, val) => document.querySelectorAll(sel).forEach(el => el.textContent = val);
      set('[data-kp]', data.kp != null ? data.kp.toFixed(1) : '–');
      set('[data-probability]', `${aurora.probability}%`);
      document.body.dataset.auroraLevel = aurora.level;
    } catch (e) { console.error(e); }
  }
  refreshSolar();
  setInterval(refreshSolar, CFG.REFRESH_INTERVAL);
})();
