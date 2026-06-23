class AudiogramChart {
  constructor() {
    this.width = 500;
    this.height = 400;
    this.padding = 50;
    this.frequencies = [250, 500, 1000, 2000, 4000, 8000];
  }

  generate(hearingLevels) {
    const plotPoints = this.calculatePlotPoints(hearingLevels);

    return `<svg viewBox="0 0 ${this.width} ${this.height}" class="audiogram-chart">
      <defs>
        <linearGradient id="gridGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#E6F2FF;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#F1F5F9;stop-opacity:1" />
        </linearGradient>
        <marker id="dot" markerWidth="8" markerHeight="8" refX="4" refY="4">
          <circle cx="4" cy="4" r="3" fill="#0066CC" stroke="white" stroke-width="1.5"/>
        </marker>
      </defs>

      <!-- Background -->
      <rect width="${this.width}" height="${this.height}" fill="url(#gridGradient)"/>

      <!-- Grid lines (vertical - frequency) -->
      ${this.frequencies.map((freq, i) => {
        const x = this.padding + (i / (this.frequencies.length - 1)) * (this.width - 2 * this.padding);
        return `<line x1="${x}" y1="${this.padding}" x2="${x}" y2="${this.height - this.padding}"
                       stroke="#CBD5E1" stroke-width="1" stroke-dasharray="2,2" opacity="0.5"/>`;
      }).join('')}

      <!-- Grid lines (horizontal - decibels) -->
      ${Array.from({length: 11}, (_, i) => {
        const db = i * 10;
        const y = this.height - this.padding - (db / 100) * (this.height - 2 * this.padding);
        return `<line x1="${this.padding}" y1="${y}" x2="${this.width - this.padding}" y2="${y}"
                       stroke="#CBD5E1" stroke-width="1" ${i % 2 === 0 ? '' : 'stroke-dasharray="2,2"'} opacity="0.3"/>`;
      }).join('')}

      <!-- Audiometric curve -->
      <polyline points="${plotPoints.join(' ')}"
                fill="none" stroke="#0066CC" stroke-width="2.5"
                stroke-linecap="round" stroke-linejoin="round"/>

      <!-- Data points -->
      ${plotPoints.map((_, i) => {
        const point = plotPoints[i].split(',');
        return `<circle cx="${point[0]}" cy="${point[1]}" r="5" fill="#0066CC"
                        stroke="white" stroke-width="2" opacity="0.9"/>`;
      }).join('')}

      <!-- Left axis (Decibels) -->
      <line x1="${this.padding}" y1="${this.padding}" x2="${this.padding}" y2="${this.height - this.padding}"
            stroke="#0F172A" stroke-width="2"/>

      <!-- Bottom axis (Frequency) -->
      <line x1="${this.padding}" y1="${this.height - this.padding}" x2="${this.width - this.padding}" y2="${this.height - this.padding}"
            stroke="#0F172A" stroke-width="2"/>

      <!-- Left axis labels (dB) -->
      ${Array.from({length: 11}, (_, i) => {
        const db = i * 10;
        const y = this.height - this.padding - (db / 100) * (this.height - 2 * this.padding);
        return `<text x="${this.padding - 30}" y="${y + 4}" text-anchor="end" font-size="11" fill="#475569">
                  ${db}
                </text>`;
      }).join('')}

      <!-- Bottom axis labels (Hz) -->
      ${this.frequencies.map((freq, i) => {
        const x = this.padding + (i / (this.frequencies.length - 1)) * (this.width - 2 * this.padding);
        const label = freq >= 1000 ? (freq / 1000) + 'k' : freq;
        return `<text x="${x}" y="${this.height - this.padding + 20}" text-anchor="middle" font-size="11" fill="#475569">
                  ${label}
                </text>`;
      }).join('')}

      <!-- Axis labels -->
      <text x="${this.padding - 40}" y="20" text-anchor="middle" font-size="12" font-weight="600" fill="#0F172A">
        Próg słyszenia (dB)
      </text>
      <text x="${this.width / 2}" y="${this.height - 10}" text-anchor="middle" font-size="12" font-weight="600" fill="#0F172A">
        Częstotliwość (Hz)
      </text>

      <!-- Status indicator -->
      <rect x="${this.width - 150}" y="10" width="140" height="28" rx="6" fill="white" stroke="#CBD5E1" stroke-width="1"/>
      <text x="${this.width - 80}" y="30" text-anchor="middle" font-size="11" font-weight="600" fill="#0F172A">
        Audiogram
      </text>
    </svg>`;
  }

  calculatePlotPoints(hearingLevels) {
    return this.frequencies.map((freq, i) => {
      const level = hearingLevels[freq] || 0;
      const x = this.padding + (i / (this.frequencies.length - 1)) * (this.width - 2 * this.padding);
      const y = this.height - this.padding - (level / 100) * (this.height - 2 * this.padding);
      return `${x},${y}`;
    });
  }
}

module.exports = new AudiogramChart();
