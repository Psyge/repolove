/**
 * Aurora Tracker — Global Configuration
 * ======================================
 * KAIKKI muokattavat asetukset tässä tiedostossa.
 * Älä hardkoodaa URL:eja tai avaimia muihin tiedostoihin.
 */
window.AURORA_CONFIG = {
  // --- Versio (cachebusting) ---
  VERSION: '2.4.0',

  // --- Backend ---
  // Sää-Worker (vanha)
  WORKER_URL: 'https://proud-union-1e84.masto84.workers.dev',
  // Crowdsource-Worker (report). Jos sama Worker hoitaa molemmat, laita tähän sama URL.
  REPORT_WORKER_URL: 'https://report.masto84.workers.dev',

  // --- Cloudflare Turnstile (julkinen Site Key — OK koodissa) ---
  TURNSTILE_SITE_KEY: '0x4AAAAAADF29-_iSqwRQWf2',

  // --- NOAA-data (ei avainta tarvita) ---
  NOAA: {
    KP_INDEX:     'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json',
    SOLAR_WIND:   'https://services.swpc.noaa.gov/products/solar-wind/plasma-1-day.json',
    MAG_FIELD:    'https://services.swpc.noaa.gov/products/solar-wind/mag-1-day.json',
    AURORA_OVATION: 'https://services.swpc.noaa.gov/json/ovation_aurora_latest.json',
  },

  // --- Päivitysväli (ms) ---
  REFRESH_INTERVAL: 5 * 60 * 1000, // 5 min

  // --- Nominatim-haku (kaupungit) ---
  NOMINATIM: {
    URL: 'https://nominatim.openstreetmap.org/search',
    USER_AGENT: 'AuroraTracker/2.0 (contact: your-email@example.com)', // PÄIVITÄ
    BBOX: { // Lapland-painotus, mutta haku toimii globaalisti
      north: 71.5, south: 65.0, east: 32.0, west: 19.0,
    },
  },

  // --- Kielet ---
  DEFAULT_LANG: 'en',
  SUPPORTED_LANGS: ['en', 'fi'],

  // --- Premium / push (käytetään myöhemmin) ---
  PUSH_THRESHOLD_FREE: 5,    // Push kun KP >= 5
  PUSH_THRESHOLD_PREMIUM: 4, // Premium saa jo KP 4

  // --- Debug ---
  DEBUG: false,
};
