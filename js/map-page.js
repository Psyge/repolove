/**
 * Karttasivu — klikkaus mihin tahansa avaa revontuli-popupin.
 * Iso prosentti + level (tärkein), lisädata "Näytä lisätiedot" alla.
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

  // Animoitu NOAA OVATION revontulipilvi
  const auroraOverlay = window.AuroraOverlay && window.AuroraOverlay.create();
  if (auroraOverlay) auroraOverlay.addTo(map);
  async function refreshOvation() {
    if (!auroraOverlay) return;
    try {
      const data = await window.AuroraOverlay.fetch();
      auroraOverlay.setData(data);
    } catch (e) { console.warn('[ovation]', e); }
  }
  refreshOvation();
  setInterval(refreshOvation, 5 * 60 * 1000);

  // Globaali nykytila
  let solar = { kp: null, speed: null, density: null, bz: null, bt: null };

  function fmt(v, suffix = '', digits = 1) {
    if (v == null || isNaN(v)) return '0' + suffix;
    return Number(v).toFixed(digits) + suffix;
  }
  function levelLabel(level) {
    return window.AuroraI18n.t('probability.' + level, level);
  }
  function levelColor(level) {
    return ({
      low: 'var(--accent-bad)',
      medium: 'var(--accent-warm)',
      high: '#00ff88',
      veryhigh: 'var(--accent)',
    })[level] || 'var(--fg-muted)';
  }

  function buildPopupHtml(name, lat, lon, weather) {
    const ovation = window.AuroraOverlay ? window.AuroraOverlay.intensityAt(lat, lon) : null;
    const aurora = window.AuroraEngine.calculate({
      kp: solar.kp, speed: solar.speed, density: solar.density,
      bz: solar.bz, cloudCover: weather?.clouds, latitude: lat, ovation,
    });
    const prob = isNaN(aurora.probability) ? 0 : aurora.probability;
    const color = levelColor(aurora.level);
    const t = (k, f) => window.AuroraI18n.t(k, f);

    return `
      <div class="aurora-popup">
        <div class="ap-name">${name}</div>
        <div class="ap-prob" style="color:${color}">${prob}%</div>
        <div class="ap-level" style="color:${color}">${levelLabel(aurora.level)}</div>
        <div class="ap-quick">
          <div><span>${t('kp.label','Kp')}</span><strong>${fmt(solar.kp)}</strong></div>
          <div><span>${t('row.clouds','Clouds')}</span><strong>${weather?.clouds ?? 0}%</strong></div>
          <div><span>${t('row.temp','Temp')}</span><strong>${weather ? weather.temp + '°C' : '–'}</strong></div>
        </div>
        <button class="ap-toggle" type="button">${t('details.show','Show details ▾')}</button>
        <div class="ap-details" hidden>
          <div><span>${t('wind.speed','Solar wind')}</span><strong>${fmt(solar.speed, ' km/s', 0)}</strong></div>
          <div><span>${t('bz.label','Bz')}</span><strong>${fmt(solar.bz, ' nT')}</strong></div>
          <div><span>${t('wind.density','Density')}</span><strong>${fmt(solar.density, ' p/cm³')}</strong></div>
          ${weather ? `<div><span>${t('weather.wind','Wind')}</span><strong>${weather.wind} m/s</strong></div>` : ''}
          ${weather?.desc ? `<div class="ap-desc">${weather.desc}</div>` : ''}
        </div>
      </div>
    `;
  }

  function wirePopup(popup) {
    const root = popup.getElement();
    if (!root) return;
    const btn = root.querySelector('.ap-toggle');
    const det = root.querySelector('.ap-details');
    if (btn && det) {
      btn.addEventListener('click', () => {
        const open = !det.hasAttribute('hidden');
        if (open) { det.setAttribute('hidden', ''); btn.textContent = window.AuroraI18n.t('details.show','Show details ▾'); }
        else      { det.removeAttribute('hidden');   btn.textContent = window.AuroraI18n.t('details.hide','Hide details ▴'); }
      });
    }
  }

  async function openAuroraPopup(lat, lon, name) {
    const placeName = name || `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
    // Loading-popup
    const loading = L.popup({ maxWidth: 320 })
      .setLatLng([lat, lon])
      .setContent(`<div class="aurora-popup"><div class="ap-name">${placeName}</div><div class="ap-loading">${window.AuroraI18n.t('loading','Loading…')}</div></div>`)
      .openOn(map);

    const weather = await window.AuroraWeather.getWeather(lat, lon).catch(() => null);
    loading.setContent(buildPopupHtml(placeName, lat, lon, weather));
    setTimeout(() => wirePopup(loading), 0);
  }

  // Lataa esivalitut kohteet markereiksi
  const places = await window.AuroraPlaces.load();
  const placeMarkers = new Map();
  places.forEach((p) => {
    const marker = L.circleMarker([p.lat, p.lon], {
      radius: 10, color: '#00ffcc', weight: 2,
      fillColor: '#00ffcc', fillOpacity: 0.4,
    }).addTo(map);
    marker.on('click', () => openAuroraPopup(p.lat, p.lon, p.name));
    placeMarkers.set(p.id, { marker, place: p });
  });

  // Klikkaus mihin tahansa kartalla
  map.on('click', (e) => {
    openAuroraPopup(e.latlng.lat, e.latlng.lng);
  });

  // URL-parametrit
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  const lat = params.get('lat');
  const lon = params.get('lon');

  // KP-data headeriin + initial popup
  async function refreshSolar(initial) {
    try {
      const data = await window.SolarWind.getAll();
      solar = data;
      const aurora = window.AuroraEngine.calculate({
        kp: data.kp, speed: data.speed, density: data.density, bz: data.bz, latitude: 67,
      });
      const set = (sel, val) => document.querySelectorAll(sel).forEach(el => el.textContent = val);
      set('[data-kp]', (data.kp != null && !isNaN(data.kp)) ? data.kp.toFixed(1) : '0');
      set('[data-probability]', `${isNaN(aurora.probability) ? 0 : aurora.probability}%`);
      document.body.dataset.auroraLevel = aurora.level;

      if (initial) {
        if (id && placeMarkers.has(id)) {
          const { place } = placeMarkers.get(id);
          map.setView([place.lat, place.lon], 8);
          openAuroraPopup(place.lat, place.lon, place.name);
        } else if (lat && lon) {
          const la = parseFloat(lat), lo = parseFloat(lon);
          map.setView([la, lo], 8);
          openAuroraPopup(la, lo);
        }
      }
    } catch (e) { console.error(e); }
  }
  refreshSolar(true);
  setInterval(() => refreshSolar(false), CFG.REFRESH_INTERVAL);

  // ---------- Crowdsource sightings -kerros ----------
  const sightingsLayer = L.layerGroup().addTo(map);
  const BASE = CFG.REPORT_WORKER_URL || CFG.WORKER_URL;

  async function refreshSightings() {
    try {
      const res = await fetch(`${BASE}/api/sightings/clusters`, { cache: 'no-cache' });
      if (!res.ok) return;
      const data = await res.json();
      sightingsLayer.clearLayers();
      (data.clusters || []).forEach((c) => {
        if (c.lat == null || c.lon == null) return;
        const radius = Math.min(8 + c.count * 2, 24);
        const marker = L.circleMarker([c.lat, c.lon], {
          radius,
          color: '#ff3366',
          weight: 2,
          fillColor: '#ff3366',
          fillOpacity: 0.55,
          className: 'sighting-pulse',
        });
        const t = (k, f) => window.AuroraI18n?.t(k, f) ?? f;
        marker.bindPopup(
          `<div class="aurora-popup">
             <div class="ap-name">📍 ${c.region || ''}</div>
             <div class="ap-prob" style="color:#ff3366">${c.count}</div>
             <div class="ap-level">${t('sightings.reports','reports')} · ${c.minutesAgo} min</div>
           </div>`
        );
        sightingsLayer.addLayer(marker);
      });
    } catch (e) { console.warn('[sightings]', e); }
  }
  refreshSightings();
  setInterval(refreshSightings, 2 * 60 * 1000);
  window.__refreshSightings = refreshSightings;
})();
