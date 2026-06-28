/**
 * Generator profesjonalnego audiogramu (SVG) dla raportu PDF.
 *
 * Konwencja kliniczna:
 *  - oś Y (próg słyszenia w dB) rośnie w dół — 0 dB na górze (słuch dobry),
 *    większe wartości niżej (słuch słabszy),
 *  - oś X (częstotliwość) w skali LOGARYTMICZNEJ od najniższej badanej
 *    częstotliwości (zwykle 250 Hz) do maksymalnej słyszalnej częstotliwości
 *    pacjenta — dzięki temu wykres pokazuje pełny zakres słyszenia,
 *  - tło podzielone na strefy ubytku słuchu wg klasyfikacji BIAP
 *    (norma ≤20 / lekki 21–40 / umiarkowany 41–70 / znaczny 71–90 / głęboki >90).
 *
 * Kolorystyka spójna z frontendem SprawdźSłuch (turkus #0E7490, zieleń #16A34A, Montserrat).
 */
class AudiogramChart {
  constructor() {
    this.width = 620;
    this.height = 440;
    this.padTop = 44;
    this.padBottom = 58;
    this.padLeft = 56;
    this.padRight = 118;
    this.maxDb = 100;

    // Strefy ubytku słuchu (zakres dB → kolor wypełnienia + etykieta) — BIAP
    this.zones = [
      { from: 0,  to: 20,  fill: '#E7F7EE', label: 'Norma',        text: '#1F7F1F' },
      { from: 20, to: 40,  fill: '#FBF1DE', label: 'Lekki',        text: '#9A6B00' },
      { from: 40, to: 70,  fill: '#FBE8DB', label: 'Umiarkowany',  text: '#B4470F' },
      { from: 70, to: 90,  fill: '#F7E0DC', label: 'Znaczny',      text: '#9F2417' },
      { from: 90, to: 100, fill: '#EFE2EF', label: 'Głęboki',      text: '#5B3A78' }
    ];
  }

  get plotW() { return this.width - this.padLeft - this.padRight; }
  get plotH() { return this.height - this.padTop - this.padBottom; }

  freqLabel(f) {
    if (f >= 1000) {
      const k = f / 1000;
      return `${Number.isInteger(k) ? k : k.toFixed(1)} kHz`;
    }
    return `${f} Hz`;
  }

  yForDb(db) {
    const clamped = Math.max(0, Math.min(this.maxDb, db));
    return this.padTop + (clamped / this.maxDb) * this.plotH;
  }

  generate(hearingLevels, maxAudibleFrequency) {
    const tested = Object.keys(hearingLevels || {})
      .map(Number)
      .filter(f => !Number.isNaN(f))
      .sort((a, b) => a - b);

    if (tested.length === 0) return '';

    const minFreq = Math.min(...tested);
    const maxFreq = Math.max(...tested);
    const maxAudible = Number(maxAudibleFrequency) || null;
    // Oś X kończy się na max. słyszalnej częstotliwości (lub najwyższej badanej)
    const axisMaxFreq = Math.max(maxFreq, maxAudible || 0);

    const logMin = Math.log2(minFreq);
    const logMax = Math.log2(axisMaxFreq);
    const logSpan = logMax - logMin || 1;
    const xForFreq = (f) => this.padLeft + ((Math.log2(f) - logMin) / logSpan) * this.plotW;

    const right = this.padLeft + this.plotW;
    const bottom = this.padTop + this.plotH;

    // Strefy tła (poziome pasy dB)
    const zoneRects = this.zones.map(z => {
      const y1 = this.yForDb(z.from);
      const y2 = this.yForDb(z.to);
      const midY = (y1 + y2) / 2;
      return `
        <rect x="${this.padLeft}" y="${y1.toFixed(1)}" width="${this.plotW}" height="${(y2 - y1).toFixed(1)}" fill="${z.fill}"/>
        <text x="${(right + 12).toFixed(1)}" y="${(midY + 4).toFixed(1)}" font-size="11" font-weight="600"
              font-family="Montserrat, sans-serif" fill="${z.text}">${z.label}</text>`;
    }).join('');

    // Linie poziome (co 10 dB) + etykiety dB
    const hLines = [];
    for (let db = 0; db <= this.maxDb; db += 10) {
      const y = this.yForDb(db);
      hLines.push(`<line x1="${this.padLeft}" y1="${y.toFixed(1)}" x2="${right}" y2="${y.toFixed(1)}"
        stroke="#FFFFFF" stroke-width="${db % 20 === 0 ? 1.4 : 0.8}" opacity="0.9"/>`);
      hLines.push(`<text x="${this.padLeft - 12}" y="${(y + 4).toFixed(1)}" text-anchor="end"
        font-size="11" font-family="Montserrat, sans-serif" fill="#64748B">${db}</text>`);
    }

    // Pionowe linie siatki + etykiety częstotliwości (badane + maks. słyszalna)
    const tickFreqs = [...tested];
    if (maxAudible && !tested.includes(maxAudible)) tickFreqs.push(maxAudible);
    const vLines = tickFreqs.map(freq => {
      const x = xForFreq(freq);
      const isMax = maxAudible && freq === maxAudible && !tested.includes(maxAudible);
      return `
        <line x1="${x.toFixed(1)}" y1="${this.padTop}" x2="${x.toFixed(1)}" y2="${bottom}"
              stroke="#FFFFFF" stroke-width="0.8" opacity="0.7"/>
        <text x="${x.toFixed(1)}" y="${(bottom + 22).toFixed(1)}" text-anchor="middle"
              font-size="10.5" font-weight="600" font-family="Montserrat, sans-serif"
              fill="${isMax ? '#15803D' : '#475569'}">${this.freqLabel(freq)}</text>`;
    }).join('');

    // Krzywa progu słyszenia (tylko badane częstotliwości)
    const pts = tested.map(f => ({ x: xForFreq(f), y: this.yForDb(hearingLevels[f]), db: hearingLevels[f] }));
    const polyline = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const markers = pts.map(p => `
      <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="6.5" fill="#FFFFFF"/>
      <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4.5" fill="#0E7490"/>
      <text x="${p.x.toFixed(1)}" y="${(p.y - 12).toFixed(1)}" text-anchor="middle"
            font-size="10" font-weight="700" font-family="Montserrat, sans-serif" fill="#155E75">${p.db != null ? p.db : ''}</text>`
    ).join('');

    // Znacznik maksymalnej słyszalnej częstotliwości (zielona linia, jak na froncie)
    let maxMarker = '';
    if (maxAudible) {
      const xm = xForFreq(maxAudible);
      const label = `Maks. zakres słyszalny: ${this.freqLabel(maxAudible)}`;
      const labelW = 8 + label.length * 5.5;
      const lx = Math.min(xm + 8, right - labelW);
      maxMarker = `
        <line x1="${xm.toFixed(1)}" y1="${this.padTop}" x2="${xm.toFixed(1)}" y2="${bottom}"
              stroke="#15803D" stroke-width="2" stroke-dasharray="4,4"/>
        <rect x="${lx.toFixed(1)}" y="${this.padTop - 1}" width="${labelW.toFixed(0)}" height="17" rx="5" fill="#166534"/>
        <text x="${(lx + labelW / 2).toFixed(1)}" y="${this.padTop + 11}" text-anchor="middle"
              font-size="9.5" font-weight="700" font-family="Montserrat, sans-serif" fill="#FFFFFF">${label}</text>`;
    }

    return `
    <svg viewBox="0 0 ${this.width} ${this.height}" width="100%" role="img"
         aria-label="Audiogram — próg słyszenia w funkcji częstotliwości" xmlns="http://www.w3.org/2000/svg">
      ${zoneRects}
      ${hLines.join('')}
      ${vLines}
      <polyline points="${polyline}" fill="none" stroke="#0E7490" stroke-width="3"
                stroke-linecap="round" stroke-linejoin="round"/>
      ${markers}
      ${maxMarker}
      <line x1="${this.padLeft}" y1="${this.padTop}" x2="${this.padLeft}" y2="${bottom}" stroke="#0F172A" stroke-width="1.5"/>
      <line x1="${this.padLeft}" y1="${bottom}" x2="${right}" y2="${bottom}" stroke="#0F172A" stroke-width="1.5"/>
      <text transform="translate(16,${(this.padTop + this.plotH / 2).toFixed(1)}) rotate(-90)" text-anchor="middle"
            font-size="11.5" font-weight="700" font-family="Montserrat, sans-serif" fill="#0F172A">Próg słyszenia (dB)</text>
      <text x="${(this.padLeft + this.plotW / 2).toFixed(1)}" y="${this.height - 14}" text-anchor="middle"
            font-size="11.5" font-weight="700" font-family="Montserrat, sans-serif" fill="#0F172A">Częstotliwość</text>
    </svg>`;
  }
}

module.exports = new AudiogramChart();
