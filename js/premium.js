/**
 * Aurora Premium — client side helper
 * ====================================
 * Tarkistaa onko tämä laite premium ja exposes:
 *   window.AuroraPremium.isActive()           → boolean (sync, cache)
 *   window.AuroraPremium.refresh()            → Promise<{active, daysLeft, expiresAt}>
 *   window.AuroraPremium.activate(token)      → Promise<{ok, deviceKey, expiresAt}>
 *   window.AuroraPremium.openCheckout(tier)   → redirect to Stripe
 *   window.AuroraPremium.bySession(sessionId) → poll worker for token after checkout
 *
 * localStorage:
 *   aurora_premium = JSON { deviceKey, expiresAt, tier, lastCheck }
 */
(function () {
  const CFG = window.AURORA_CONFIG;
  const BASE = CFG.REPORT_WORKER_URL || CFG.WORKER_URL;
  const LS_KEY = 'aurora_premium';
  const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1h

  function read() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); }
    catch { return null; }
  }
  function write(v) {
    if (v) localStorage.setItem(LS_KEY, JSON.stringify(v));
    else localStorage.removeItem(LS_KEY);
  }

  function isActive() {
    const p = read();
    if (!p || !p.deviceKey || !p.expiresAt) return false;
    return p.expiresAt > Date.now();
  }

  async function refresh() {
    const p = read();
    if (!p || !p.deviceKey) return { active: false };
    try {
      const res = await fetch(`${BASE}/api/premium/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceKey: p.deviceKey }),
      });
      const data = await res.json();
      if (data.active) {
        write({ ...p, expiresAt: data.expiresAt, tier: data.tier, lastCheck: Date.now() });
      } else {
        write(null);
      }
      return data;
    } catch (e) {
      console.warn('[premium] refresh failed', e);
      return { active: isActive() }; // fallback: luota cacheen jos verkko-ongelma
    }
  }

  async function activate(token) {
    const res = await fetch(`${BASE}/api/premium/activate?token=${encodeURIComponent(token)}`);
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.message || data.error || 'Activation failed');
      err.status = res.status;
      err.data = data;
      throw err;
    }
    write({
      deviceKey: data.deviceKey,
      expiresAt: data.expiresAt,
      tier: data.tier,
      lastCheck: Date.now(),
    });
    document.body.classList.add('is-premium');
    return data;
  }

  async function openCheckout(tier) {
    const res = await fetch(`${BASE}/api/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier }),
    });
    const data = await res.json();
    if (!res.ok || !data.url) {
      alert((data && data.detail) || 'Checkout could not be started.');
      return;
    }
    window.location.href = data.url;
  }

  async function bySession(sessionId, { maxAttempts = 30, intervalMs = 2000 } = {}) {
    for (let i = 0; i < maxAttempts; i++) {
      const res = await fetch(`${BASE}/api/premium/by-session?session_id=${encodeURIComponent(sessionId)}`);
      const data = await res.json().catch(() => ({}));
      if (data.ready && data.token) return data.token;
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error('Timeout waiting for payment confirmation');
  }

  // Init: lisää body-luokka jos premium aktiivinen
  if (isActive()) document.body.classList.add('is-premium');

  // Tausta-refresh kun aikaa kulunut
  const p = read();
  if (p && (!p.lastCheck || Date.now() - p.lastCheck > CHECK_INTERVAL_MS)) {
    refresh().then((d) => {
      if (d.active) document.body.classList.add('is-premium');
      else document.body.classList.remove('is-premium');
    });
  }

  window.AuroraPremium = { isActive, refresh, activate, openCheckout, bySession, read };
})();
