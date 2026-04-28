/**
 * Nominatim-kaupunkihaku.
 * - Vapaa, ei avainta
 * - Max 1 req/s (debouncing)
 * - User-Agent vaaditaan (CFG.NOMINATIM.USER_AGENT)
 */
(function () {
  const CFG = window.AURORA_CONFIG;
  let lastRequest = 0;

  async function search(query) {
    if (!query || query.length < 2) return [];
    // Rate limit: yksi pyyntö sekunnissa
    const now = Date.now();
    const wait = Math.max(0, 1000 - (now - lastRequest));
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequest = Date.now();

    const params = new URLSearchParams({
      q: query,
      format: 'json',
      limit: '5',
      addressdetails: '1',
      'accept-language': window.AuroraI18n?.current || 'en',
    });

    const res = await fetch(`${CFG.NOMINATIM.URL}?${params}`, {
      headers: { 'Accept': 'application/json' },
      // HUOM: Selain ei salli User-Agent-headerin asettamista; Nominatim
      // sallii siltikin selainpohjaiset pyynnöt kun Referer/Origin näkyy.
    });
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);
    const data = await res.json();
    return data.map((d) => ({
      name: d.display_name,
      lat: parseFloat(d.lat),
      lon: parseFloat(d.lon),
      type: d.type,
    }));
  }

  // Debounced handler — käyttöön <input>-kuuntelijassa
  function attach(inputEl, resultsEl, onSelect) {
    let timer = null;
    inputEl.addEventListener('input', () => {
      clearTimeout(timer);
      const q = inputEl.value.trim();
      if (q.length < 2) { resultsEl.innerHTML = ''; return; }
      timer = setTimeout(async () => {
        try {
          const results = await search(q);
          render(results, resultsEl, onSelect);
        } catch (err) {
          console.error('[search]', err);
        }
      }, 350);
    });
  }

  function render(results, el, onSelect) {
    el.innerHTML = '';
    results.forEach((r) => {
      const li = document.createElement('li');
      li.className = 'search-result';
      li.textContent = r.name;
      li.addEventListener('click', () => onSelect(r));
      el.appendChild(li);
    });
  }

  window.AuroraSearch = { search, attach };
})();
