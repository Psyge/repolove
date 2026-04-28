/**
 * Karttamarkerit — käyttää CFG.WORKER_URL säätietoihin.
 * EI hardkoodattua Worker-osoitetta.
 *
 * HUOM: Tämä on luuranko. Kun yhdistät tuotantoon, säilytä oma
 * Leaflet-init -koodi ja käytä tästä vain fetchWeather/buildPopup -funktioita.
 */
(function () {
  const CFG = window.AURORA_CONFIG;

  async function fetchWeather(lat, lon) {
    const url = `${CFG.WORKER_URL}/?lat=${lat}&lon=${lon}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Worker ${res.status}`);
    return res.json();
  }

  function buildPopup({ name, weather, aurora }) {
    const t = (k, f) => window.AuroraI18n?.t(k, f) ?? f;
    return `
      <div class="popup">
        <h3>${name}</h3>
        <p>${t('probability.label','Aurora probability')}:
           <strong>${aurora.probability}%</strong>
           (${t('probability.' + aurora.level, aurora.level)})</p>
        <p>${t('kp.label','Kp')}: ${weather.kp ?? '–'}</p>
        <p>☁ ${weather.cloudCover ?? '–'}%</p>
      </div>`;
  }

  window.AuroraMarkers = { fetchWeather, buildPopup };
})();
