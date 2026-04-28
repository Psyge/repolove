/**
 * Solar wind data fetcher — NOAA SWPC.
 * Tarjoaa: kp, speed, density, bz, timestamp.
 * Käyttää AURORA_CONFIG.NOAA-osoitteita. Ei kovakoodattuja URL:eja.
 */
(function () {
  const CFG = window.AURORA_CONFIG;

  async function fetchJSON(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`NOAA ${res.status}: ${url}`);
    return res.json();
  }

  // NOAA:n formaatti: ensimmäinen rivi otsikot, loput dataa.
  function lastRow(rows) { return rows[rows.length - 1]; }

  async function getKp() {
    const rows = await fetchJSON(CFG.NOAA.KP_INDEX);
    const last = lastRow(rows);
    return { kp: parseFloat(last[1]), time: last[0] };
  }

  async function getSolarWindPlasma() {
    const rows = await fetchJSON(CFG.NOAA.SOLAR_WIND);
    const last = lastRow(rows);
    // [time, density, speed, temperature]
    return {
      density: parseFloat(last[1]),
      speed:   parseFloat(last[2]),
      time:    last[0],
    };
  }

  async function getMagField() {
    const rows = await fetchJSON(CFG.NOAA.MAG_FIELD);
    const last = lastRow(rows);
    // [time, bx_gsm, by_gsm, bz_gsm, lon_gsm, lat_gsm, bt]
    return {
      bz:   parseFloat(last[3]),
      bt:   parseFloat(last[6]),
      time: last[0],
    };
  }

  async function getAll() {
    const [kp, plasma, mag] = await Promise.all([
      getKp().catch(() => ({ kp: null })),
      getSolarWindPlasma().catch(() => ({})),
      getMagField().catch(() => ({})),
    ]);
    return { ...kp, ...plasma, ...mag, fetchedAt: Date.now() };
  }

  window.SolarWind = { getKp, getSolarWindPlasma, getMagField, getAll };
})();
