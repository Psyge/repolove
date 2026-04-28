/**
 * Säätiedot Cloudflare Workerin kautta (OpenWeather-proxy).
 * Worker palauttaa OpenWeatherin alkuperäisen JSON-rakenteen.
 */
(function () {
  const CFG = window.AURORA_CONFIG;

  async function getWeather(lat, lon) {
    try {
      const res = await fetch(`${CFG.WORKER_URL}/?lat=${lat}&lon=${lon}`, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`Worker ${res.status}`);
      const data = await res.json();
      return {
        temp:   Math.round(data.main?.temp ?? 0),
        feels:  Math.round(data.main?.feels_like ?? 0),
        wind:   data.wind?.speed ?? 0,
        desc:   data.weather?.[0]?.description ?? '',
        icon:   data.weather?.[0]?.icon ?? '01d',
        clouds: data.clouds?.all ?? null,
      };
    } catch (e) {
      console.warn('[weather]', e);
      return null;
    }
  }

  window.AuroraWeather = { getWeather };
})();
