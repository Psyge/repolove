/**
 * Crowdsource sightings — raportointi + klusterien näyttö.
 * Käyttää Cloudflare Turnstilea (invisible) suojaukseen.
 */
(function () {
  const CFG = window.AURORA_CONFIG;
  const BASE = CFG.REPORT_WORKER_URL || CFG.WORKER_URL;
  const SITE_KEY = CFG.TURNSTILE_SITE_KEY;

  let turnstileWidgetId = null;
  let pendingResolve = null;
  let tokenPromise = null;

  // Globaali callback Turnstilelle
  window.__auroraTurnstileCb = function (token) {
    if (pendingResolve) { pendingResolve(token); pendingResolve = null; }
  };
  window.__auroraTurnstileErr = function () {
    if (pendingResolve) { pendingResolve(null); pendingResolve = null; }
  };

  function ensureWidget() {
    if (turnstileWidgetId !== null) return;
    if (!window.turnstile) return;
    let host = document.getElementById('turnstile-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'turnstile-host';
      host.style.cssText = 'position:fixed;bottom:8px;right:8px;z-index:9999;';
      document.body.appendChild(host);
    }
    turnstileWidgetId = window.turnstile.render(host, {
      sitekey: SITE_KEY,
      size: 'invisible',
      execution: 'execute',
      appearance: 'execute',
      callback: window.__auroraTurnstileCb,
      'error-callback': window.__auroraTurnstileErr,
      'expired-callback': window.__auroraTurnstileErr,
      'timeout-callback': window.__auroraTurnstileErr,
    });
  }

  function getToken() {
    if (tokenPromise) return tokenPromise;

    tokenPromise = new Promise((resolve) => {
      const finish = (token) => {
        tokenPromise = null;
        resolve(token);
      };

      if (!window.turnstile || !SITE_KEY) return finish(null);
      ensureWidget();
      if (turnstileWidgetId === null) return finish(null);

      pendingResolve = finish;
      try { window.turnstile.reset(turnstileWidgetId); } catch {}

      // Pieni viive jotta reset ehtii viimeistellä ennen executea
      setTimeout(() => {
        try {
          window.turnstile.execute(turnstileWidgetId);
        } catch (e) {
          console.warn('turnstile execute', e);
          if (pendingResolve === finish) { pendingResolve = null; finish(null); }
        }
      }, 80);

      // failsafe timeout
      setTimeout(() => {
        if (pendingResolve === finish) {
          pendingResolve = null;
          try { window.turnstile.reset(turnstileWidgetId); } catch {}
          finish(null);
        }
      }, 15000);
    });

    return tokenPromise;
  }

  function getPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('No geolocation'));
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
        (e) => reject(e),
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
      );
    });
  }

  async function report() {
    const t = (k, f) => window.AuroraI18n?.t(k, f) ?? f;
    let pos;
    try { pos = await getPosition(); }
    catch { alert(t('sightings.geo_denied', 'Location permission is required to report.')); return; }

    const token = await getToken();
    if (!token) { alert(t('sightings.captcha_failed', 'Captcha failed. Try again.')); return; }

    try {
      const res = await fetch(`${BASE}/api/sightings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: pos.lat, lon: pos.lon, turnstileToken: token }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 429) { alert(t('sightings.cooldown', 'You can only report once every 30 minutes.')); return; }
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      alert(t('sightings.thanks', 'Thanks! Your sighting was reported.') + (data.region ? ` (${data.region})` : ''));
      loadClusters();
      if (typeof window.__refreshSightings === 'function') window.__refreshSightings();
    } catch (e) {
      console.error('[report]', e);
      alert(t('sightings.error', 'Could not send report. Try again later.'));
    }
  }

  async function loadClusters() {
    const list = document.getElementById('sightings-list');
    if (!list) return;
    try {
      const res = await fetch(`${BASE}/api/sightings/clusters`, { cache: 'no-cache' });
      const data = await res.json();
      const t = (k, f) => window.AuroraI18n?.t(k, f) ?? f;
      if (!data.clusters?.length) {
        list.innerHTML = `<div class="sightings-empty">${t('sightings.empty', 'No active sightings right now.')}</div>`;
        return;
      }
      list.innerHTML = data.clusters.map((c) => `
        <div class="sighting-row">
          <span class="sighting-region">📍 ${c.region}</span>
          <span class="sighting-meta">${c.count} ${t('sightings.reports', 'reports')} · ${c.minutesAgo} min</span>
        </div>
      `).join('');
    } catch (e) {
      console.warn('[clusters]', e);
    }
  }

  // Kytke nappi
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('report-sighting-btn');
    if (btn) btn.addEventListener('click', report);
    loadClusters();
    setInterval(loadClusters, 2 * 60 * 1000); // 2 min
  });

  window.AuroraSightings = { report, loadClusters };
})();
