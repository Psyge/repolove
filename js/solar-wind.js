/**
 * Solar wind data fetcher — NOAA SWPC.
 * HUOM: NOAA palauttaa ensimmäisellä rivillä OTSIKOT (esim. ["time_tag","Kp",...]).
 * Joten parseFloat("Kp") = NaN. Etsitään viimeisin rivi jonka kentässä on validi numero.
 */
(function () {
  const CFG = window.AURORA_CONFIG;

  async function fetchJSON(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`NOAA ${res.status}: ${url}`);
    return res.json();
  }

  // Etsi viimeisin rivi jossa annettu sarakeindeksi on validi numero
  function lastValidRow(rows, colIndex) {
    for (let i = rows.length - 1; i >= 1; i--) {
      const v = parseFloat(rows[i][colIndex]);
      if (!isNaN(v)) return rows[i];
    }
    return null;
  }

  async function getKp() {
    const rows = await fetchJSON(CFG.NOAA.KP_INDEX);
    const last = lastValidRow(rows, 1);
    if (!last) return { kp: null, time: null };
    return { kp: parseFloat(last[1]), time: last[0] };
  }

  async function getSolarWindPlasma() {
    const rows = await fetchJSON(CFG.NOAA.SOLAR_WIND);
    // [time, density, speed, temperature]
    const last = lastValidRow(rows, 2); // speed-sarake on luotettavin
    if (!last) return {};
    return {
      density: parseFloat(last[1]),
      speed:   parseFloat(last[2]),
      time:    last[0],
    };
  }

  async function getMagField() {
    const rows = await fetchJSON(CFG.NOAA.MAG_FIELD);
    // [time, bx_gsm, by_gsm, bz_gsm, lon_gsm, lat_gsm, bt]
    const last = lastValidRow(rows, 3);
    if (!last) return {};
    return {
      bz:   parseFloat(last[3]),
      bt:   parseFloat(last[6]),
      time: last[0],
    };
  }

  async function getAll() {
    const [kp, plasma, mag] = await Promise.all([
      getKp().catch((e) => { console.warn('Kp:', e); return { kp: null }; }),
      getSolarWindPlasma().catch((e) => { console.warn('Plasma:', e); return {}; }),
      getMagField().catch((e) => { console.warn('Mag:', e); return {}; }),
    ]);
    return { ...kp, ...plasma, ...mag, fetchedAt: Date.now() };
  }

  window.SolarWind = { getKp, getSolarWindPlasma, getMagField, getAll };
})();
