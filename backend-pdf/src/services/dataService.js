const { MongoClient } = require('mongodb');
const config = require('../config/config');
const logger = require('../utils/logger');

class DataService {
  constructor() {
    this.client = null;
    this.db = null;
    this.isConnected = false;
  }
  
  async connect() {
    if (this.isConnected) return;
    
    try {
      logger.info('Łączenie z MongoDB...');
      this.client = new MongoClient(config.mongodb.uri);
      await this.client.connect();
      this.db = this.client.db(config.mongodb.database);
      this.isConnected = true;
      logger.info('Połączono z MongoDB');
    } catch (error) {
      logger.error('Błąd podczas łączenia z MongoDB:', error);
      throw error;
    }
  }
  
  async disconnect() {
    if (this.client && this.isConnected) {
      await this.client.close();
      this.isConnected = false;
      logger.info('Rozłączono z MongoDB');
    }
  }
  
  async getTestResultById(testId) {
    try {
      await this.connect();
      
      const collection = this.db.collection(config.mongodb.collections.hearingResults);
      const result = await collection.findOne({ testId: testId });
      
      if (!result) {
        logger.warn(`Nie znaleziono wyniku testu dla ID: ${testId}`);
        return null;
      }
      
      logger.info(`Pobrano dane testu: ${testId}`);
      return result;
      
    } catch (error) {
      logger.error('Błąd podczas pobierania danych testu:', error);
      throw error;
    }
  }
  
  async getTestResultByUserEmail(userEmail) {
    try {
      await this.connect();
      
      const collection = this.db.collection(config.mongodb.collections.hearingResults);
      const results = await collection.find({ userEmail: userEmail }).toArray();
      
      logger.info(`Pobrano ${results.length} wyników dla użytkownika: ${userEmail}`);
      return results;
      
    } catch (error) {
      logger.error('Błąd podczas pobierania danych użytkownika:', error);
      throw error;
    }
  }
  
  // Mapowanie częstotliwości na opis
  getFrequencyDescription(frequency) {
    const descriptions = {
      125: 'Bardzo niskie tony',
      250: 'Niskie tony',
      500: 'Średnie-niskie tony',
      1000: 'Średnie tony',
      2000: 'Średnie-wysokie tony',
      4000: 'Wysokie tony',
      8000: 'Bardzo wysokie tony'
    };
    
    return descriptions[frequency] || `${frequency} Hz`;
  }
  
  // Interpretacja progu słyszenia wg klasyfikacji BIAP (próg w dB)
  //  ≤20 norma · 21–40 lekki · 41–70 umiarkowany · 71–90 znaczny · >90 głęboki
  getHearingLevelInterpretation(level) {
    if (level <= 20) return { status: 'Normalny', color: '#1F7F1F' };
    if (level <= 40) return { status: 'Lekki ubytek', color: '#8A6100' };
    if (level <= 70) return { status: 'Umiarkowany ubytek', color: '#B4470F' };
    if (level <= 90) return { status: 'Znaczny ubytek', color: '#9F2417' };
    return { status: 'Głęboki ubytek', color: '#5B3A78' };
  }

  // Ogólna ocena słuchu na podstawie średniego progu (PTA) — klasyfikacja BIAP
  getOverallHearingAssessment(hearingLevels) {
    if (!hearingLevels || Object.keys(hearingLevels).length === 0) {
      return { status: 'Brak danych', recommendation: 'Skontaktuj się z audiologiem', color: '#6B7280' };
    }

    const averageLevel = this.calculatePTA(hearingLevels);

    if (averageLevel <= 20) {
      return {
        status: 'Słuch w normie',
        recommendation: 'Twój słuch jest w dobrym stanie. Kontynuuj dbanie o higienę słuchu.',
        color: '#1F7F1F'
      };
    } else if (averageLevel <= 40) {
      return {
        status: 'Lekki ubytek słuchu',
        recommendation: 'Zalecana konsultacja z laryngologiem lub audiologiem.',
        color: '#8A6100'
      };
    } else if (averageLevel <= 70) {
      return {
        status: 'Umiarkowany ubytek słuchu',
        recommendation: 'Konieczna konsultacja z audiologiem. Możliwe zastosowanie aparatów słuchowych.',
        color: '#B4470F'
      };
    } else if (averageLevel <= 90) {
      return {
        status: 'Znaczny ubytek słuchu',
        recommendation: 'Pilna konsultacja z audiologiem. Wskazane zastosowanie aparatów słuchowych.',
        color: '#9F2417'
      };
    } else {
      return {
        status: 'Głęboki ubytek słuchu',
        recommendation: 'Pilna konsultacja z audiologiem. Konieczna pełna diagnostyka i rehabilitacja słuchu.',
        color: '#5B3A78'
      };
    }
  }

  /**
   * Średni próg słyszenia (PTA — Pure Tone Average).
   * Liczony z częstotliwości mowy 500/1000/2000/4000 Hz (jeśli dostępne),
   * w przeciwnym razie ze wszystkich badanych częstotliwości.
   */
  calculatePTA(hearingLevels) {
    const speech = [500, 1000, 2000, 4000]
      .map(f => hearingLevels[f])
      .filter(v => typeof v === 'number');
    const used = speech.length ? speech : Object.values(hearingLevels);
    if (!used.length) return 0;
    return Math.round(used.reduce((sum, v) => sum + v, 0) / used.length);
  }

  /**
   * Interpretacja maksymalnej słyszalnej częstotliwości (zakres wysokich tonów).
   * Progi spójne z interpretacją na stronie wyników (frontend).
   */
  getFrequencyRangeInterpretation(maxAudibleFrequency) {
    const f = Number(maxAudibleFrequency);
    if (!f || Number.isNaN(f)) return null;
    const k = f / 1000;
    const valueLabel = `${Number.isInteger(k) ? k : k.toFixed(1)} kHz`;

    // Pozycja na pasku zakresu (skala logarytmiczna 3–20 kHz, jak na froncie)
    const minScale = 3000, maxScale = 20000;
    const clamped = Math.max(minScale, Math.min(maxScale, f));
    const barPercent = Math.round((Math.log2(clamped / minScale) / Math.log2(maxScale / minScale)) * 100);
    // Wyrównanie etykiety zakresu, by nie wychodziła poza pasek na skrajach
    const pillShift = barPercent >= 86 ? '-100%' : (barPercent <= 14 ? '0' : '-50%');
    const base = { valueLabel, barPercent, pillShift };

    if (f >= 17000) return {
      ...base, rating: 'Bardzo dobry', levelClass: 'level-normal',
      text: 'Twój słuch w zakresie wysokich częstotliwości funkcjonuje na poziomie lepszym niż przeciętny dla osoby dorosłej — wykracza poza typowy zakres dla wieku dorosłego.'
    };
    if (f >= 14000) return {
      ...base, rating: 'Dobry', levelClass: 'level-normal',
      text: 'Twój słuch funkcjonuje na poziomie typowym dla młodej osoby dorosłej. Nie stwierdzono znaczących odchyleń od normy w zakresie wysokich częstotliwości.'
    };
    if (f >= 10000) return {
      ...base, rating: 'W normie', levelClass: 'level-normal',
      text: 'Wynik w normie dla osoby dorosłej. Z wiekiem naturalnie tracimy zdolność słyszenia najwyższych częstotliwości, ale Twój słuch funkcjonuje prawidłowo.'
    };
    if (f >= 6000) return {
      ...base, rating: 'Lekkie ograniczenie', levelClass: 'level-mild',
      text: 'Wyniki sugerują lekkie ograniczenie w słyszeniu wysokich częstotliwości. Może to być naturalne dla wieku lub skutek ekspozycji na hałas. Zalecana konsultacja z audiologiem.'
    };
    return {
      ...base, rating: 'Znaczące ograniczenie', levelClass: 'level-moderate',
      text: 'Wyniki wskazują na znaczące ograniczenie w słyszeniu wysokich częstotliwości. Zalecamy konsultację z lekarzem audiologiem w celu przeprowadzenia pełnego badania słuchu.'
    };
  }

  /**
   * Oznacza testId jako przetworzony (idempotentność).
   * Zwraca true jeśli udało się oznaczyć (czyli jeszcze nie był przetworzony).
   * Zwraca false jeśli już istnieje (duplikat).
   */
  async markEventAsProcessed(testId) {
    try {
      await this.connect();
      const collection = this.db.collection('processed_pdf_events');
      await collection.createIndex({ testId: 1 }, { unique: true });
      await collection.insertOne({ testId, processedAt: new Date() });
      return true;
    } catch (error) {
      if (error.code === 11000) {
        // Duplicate key — już przetworzony
        return false;
      }
      throw error;
    }
  }

  async deleteProcessedEvent(testId) {
    try {
      await this.connect();
      const collection = this.db.collection('processed_pdf_events');
      await collection.deleteOne({ testId });
      logger.info(`Usunięto marker przetworzenia dla testId: ${testId}`);
    } catch (error) {
      logger.error(`Błąd podczas usuwania markera przetworzenia dla testId ${testId}:`, error);
      throw error;
    }
  }
}

module.exports = new DataService();