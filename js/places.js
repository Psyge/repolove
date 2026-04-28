/**
 * Lataa kohteet data/places.json -tiedostosta.
 * Voit muokata kohteita lisäämättä koodiriviä.
 */
(function () {
  const CFG = window.AURORA_CONFIG;
  let cache = null;

  async function load() {
    if (cache) return cache;
    const res = await fetch(`data/places.json?v=${CFG.VERSION}`, { cache: 'no-store' });
    cache = await res.json();
    return cache;
  }

  window.AuroraPlaces = { load };
})();
