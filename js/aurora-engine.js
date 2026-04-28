/**
 * Aurora probability engine (6-factor).
 * Input:  { kp, speed, density, bz, bt, cloudCover, latitude }
 * Output: { probability: 0–100, level: 'low'|'medium'|'high'|'veryhigh' }
 *
 * Painot:
 *  - Kp:           35 %
 *  - Bz (etelä):   25 %
 *  - Wind speed:   15 %
 *  - Density:      10 %
 *  - Cloud cover:  10 % (käänteinen)
 *  - Latitude:      5 % (sopivuus)
 */
(function () {
  function scoreKp(kp) {
    if (kp == null) return 0;
    return Math.min(100, (kp / 9) * 100);
  }
  function scoreBz(bz) {
    if (bz == null) return 0;
    if (bz >= 0) return 0;          // pohjoinen Bz = ei revontulia
    return Math.min(100, (Math.abs(bz) / 15) * 100);
  }
  function scoreSpeed(s) {
    if (s == null) return 0;
    if (s < 300) return 0;
    return Math.min(100, ((s - 300) / 500) * 100);
  }
  function scoreDensity(d) {
    if (d == null) return 0;
    return Math.min(100, (d / 20) * 100);
  }
  function scoreClouds(c) {
    if (c == null) return 50; // tuntematon = neutraali
    return Math.max(0, 100 - c);
  }
  function scoreLatitude(lat, kp) {
    if (lat == null) return 50;
    // Karkea: revontulivyöhyke laskee etelämmäs kun Kp nousee.
    const auroralLat = 67 - (kp || 0) * 1.5;
    const diff = Math.abs(lat - auroralLat);
    return Math.max(0, 100 - diff * 10);
  }

  function calculate(input) {
    const { kp, speed, density, bz, cloudCover, latitude, ovation } = input;
    let score =
        scoreKp(kp)         * 0.35
      + scoreBz(bz)         * 0.25
      + scoreSpeed(speed)   * 0.15
      + scoreDensity(density) * 0.10
      + scoreClouds(cloudCover) * 0.10
      + scoreLatitude(latitude, kp) * 0.05;

    // OVATION-intensiteetti (0–100) kuvaa paikallista revontulipilveä juuri nyt.
    // Käytetään sitä pilvinäkyvyyden kanssa kerrottuna paikallisena tarkennuksena.
    let ovationProb = null;
    if (ovation != null && !isNaN(ovation)) {
      const cloudVis = cloudCover != null ? (100 - cloudCover) / 100 : 0.7;
      ovationProb = Math.min(100, (ovation / 50) * 100) * cloudVis;
      // Käytetään suurempaa kahdesta — paikallinen pilvi voittaa globaalin Kp:n
      score = Math.max(score, ovationProb);
    }

    // Kp toimii porttina, mutta vahva paikallinen OVATION saa nostaa kattoa.
    if (kp != null && !isNaN(kp)) {
      let kpCap = kp < 4 ? 5 + kp * 11.25 : 100;
      if (ovationProb != null) kpCap = Math.max(kpCap, ovationProb);
      score = Math.min(score, kpCap);
    } else if (ovationProb == null) {
      score = 0;
    }

    const probability = Math.round(score);
    let level = 'low';
    if (probability >= 75) level = 'veryhigh';
    else if (probability >= 50) level = 'high';
    else if (probability >= 25) level = 'medium';
    return { probability, level };
  }

  window.AuroraEngine = { calculate };
})();
