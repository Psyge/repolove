/**
 * Aurora 3-day forecast widget
 * ============================
 * Renders a 72h forecast (3h slots) into a container.
 * Premium gating happens server-side: free users simply do not get
 * probability/cloud data in the response, so it cannot be unlocked
 * via DOM/CSS hacks.
 *
 * Usage:
 *   AuroraForecast.render(containerEl, { lat, lon, compact: false });
 *
 * Options:
 *   compact: only render the next ~6 slots (next night) + link to full
 */
(function () {
  const CFG = window.AURORA_CONFIG;
  const BASE = CFG.REPORT_WORKER_URL || CFG.WORKER_URL;

  const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

  function t(k, f) {
    return (window.AuroraI18n && window.AuroraI18n.t) ? window.AuroraI18n.t(k, f) : f;
  }

  function levelColor(level) {
    return ({
      low: 'var(--accent-bad)',
      medium: 'var(--accent-warm)',
      high: '#00ff88',
      veryhigh: 'var(--accent)',
    })[level] || 'var(--fg-muted)';
  }

  function localDayKey(d) {
    // "YYYY-MM-DD" in user's local TZ
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    });
    return fmt.format(d);
  }

  function dayLabel(d, todayKey, tomorrowKey, dayAfterKey) {
    const k = localDayKey(d);
    const dateStr = new Intl.DateTimeFormat(undefined, {
      timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short',
    }).format(d);
    if (k === todayKey)        return `${t('forecast.today', 'Today')} · ${dateStr}`;
    if (k === tomorrowKey)     return `${t('forecast.tomorrow', 'Tomorrow')} · ${dateStr}`;
    if (k === dayAfterKey)     return `${t('forecast.dayafter', 'Day after')} · ${dateStr}`;
    return dateStr;
  }

  function localHour(d) {
    return Number(new Intl.DateTimeFormat('en-GB', {
      timeZone: TZ, hour: '2-digit', hour12: false,
    }).format(d));
  }

  function isNightHour(h) {
    // Aurora-relevant local night: 18:00 → 06:00
    return h >= 18 || h < 6;
  }

  async function fetchForecast(lat, lon) {
    const p = window.AuroraPremium && window.AuroraPremium.read();
    const deviceKey = p?.deviceKey || '';
    const res = await fetch(`${BASE}/api/aurora/forecast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lon, deviceKey }),
    });
    if (!res.ok) throw new Error(`forecast ${res.status}`);
    return res.json();
  }

  function slotHtml(s, isPremium) {
    const d = new Date(s.tsUtc);
    const h = localHour(d);
    const night = isNightHour(h);
    const hourLabel = new Intl.DateTimeFormat('en-GB', {
      timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(d);

    if (isPremium) {
      const color = levelColor(s.level);
      const cloudIcon = s.clouds == null ? '–'
        : s.clouds >= 80 ? '☁️'
        : s.clouds >= 40 ? '⛅'
        : '🌙';
      return `
        <div class="fc-slot${night ? ' fc-night' : ''}" data-level="${s.level}">
          <div class="fc-time">${hourLabel}</div>
          <div class="fc-prob" style="color:${color}">${s.probability ?? 0}%</div>
          <div class="fc-kp">Kp ${s.kp ?? '–'}</div>
          <div class="fc-cloud" title="${s.clouds ?? '?'}% ${s.cloudSource || ''}">
            ${cloudIcon} ${s.clouds != null ? s.clouds + '%' : '–'}
          </div>
        </div>
      `;
    }

    // FREE
    return `
      <div class="fc-slot fc-locked${night ? ' fc-night' : ''}" data-level="${s.level}">
        <div class="fc-time">${hourLabel}</div>
        <div class="fc-prob">🔒</div>
        <div class="fc-kp">Kp ${s.kp ?? '–'}</div>
        <div class="fc-cloud">🔒</div>
      </div>
    `;
  }

  function groupByLocalDay(slots) {
    const groups = new Map();
    for (const s of slots) {
      const k = localDayKey(new Date(s.tsUtc));
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(s);
    }
    return groups;
  }

  function render(container, opts) {
    if (!container) return;
    const { lat, lon, compact = false } = opts || {};
    container.innerHTML = `<div class="fc-loading">${t('loading', 'Loading…')}</div>`;

    fetchForecast(lat, lon).then((data) => {
      const isPremium = data.tier === 'premium';
      let slots = data.slots || [];
      if (!slots.length) {
        container.innerHTML = `<div class="fc-empty">${t('forecast.empty', 'Forecast unavailable.')}</div>`;
        return;
      }

      // Compact: next ~18h (6 slots), starting from now
      if (compact) {
        const now = Date.now();
        slots = slots.filter(s => new Date(s.tsUtc).getTime() >= now - 60*60*1000).slice(0, 6);
      } else {
        // Drop slots already in the past (>3h ago)
        const cut = Date.now() - 3*60*60*1000;
        slots = slots.filter(s => new Date(s.tsUtc).getTime() >= cut);
      }

      const today = new Date();
      const tomorrow = new Date(today.getTime() + 24*60*60*1000);
      const dayAfter = new Date(today.getTime() + 48*60*60*1000);
      const todayKey    = localDayKey(today);
      const tomorrowKey = localDayKey(tomorrow);
      const dayAfterKey = localDayKey(dayAfter);

      const groups = groupByLocalDay(slots);
      const dayHtml = [];
      for (const [k, daySlots] of groups) {
        const head = dayLabel(new Date(daySlots[0].tsUtc), todayKey, tomorrowKey, dayAfterKey);
        dayHtml.push(`
          <div class="fc-day">
            <div class="fc-day-head">${head}</div>
            <div class="fc-row">
              ${daySlots.map(s => slotHtml(s, isPremium)).join('')}
            </div>
          </div>
        `);
      }

      const upsell = !isPremium
        ? `<a class="fc-unlock" href="premium.html">🔒 ${t('forecast.unlock', 'Unlock full 3-day forecast')}</a>`
        : '';

      const fullLink = compact
        ? `<a class="fc-more" href="map.html#forecast">${t('forecast.full', 'Full 3-day forecast')} →</a>`
        : '';

      container.innerHTML = `
        <div class="fc-wrap${compact ? ' fc-compact' : ''}">
          <div class="fc-head">
            <h3>${t('forecast.title', '3-day aurora forecast')}</h3>
            <span class="fc-tz">${TZ}</span>
          </div>
          <div class="fc-days">${dayHtml.join('')}</div>
          ${upsell}
          ${fullLink}
        </div>
      `;
    }).catch((e) => {
      console.warn('[forecast]', e);
      container.innerHTML = `<div class="fc-empty">${t('error.fetch', 'Failed to load forecast')}</div>`;
    });
  }

  window.AuroraForecast = { render };
})();
