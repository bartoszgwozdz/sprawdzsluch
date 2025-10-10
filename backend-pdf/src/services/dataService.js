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
  
  // Interpretacja poziomu słyszenia
  getHearingLevelInterpretation(level) {
    if (level <= 20) return { status: 'Normalny', color: '#28a745' };
    if (level <= 40) return { status: 'Lekki ubytek', color: '#ffc107' };
    if (level <= 60) return { status: 'Umiarkowany ubytek', color: '#fd7e14' };
    if (level <= 80) return { status: 'Znaczny ubytek', color: '#dc3545' };
    return { status: 'Głęboki ubytek', color: '#6f42c1' };
  }
  
  // Ogólna ocena słuchu
  getOverallHearingAssessment(hearingLevels) {
    if (!hearingLevels || Object.keys(hearingLevels).length === 0) {
      return { status: 'Brak danych', recommendation: 'Skontaktuj się z audiologiem' };
    }
    
    const levels = Object.values(hearingLevels);
    const averageLevel = levels.reduce((sum, level) => sum + level, 0) / levels.length;
    const maxLevel = Math.max(...levels);
    
    if (averageLevel <= 20) {
      return {
        status: 'Słuch w normie',
        recommendation: 'Twój słuch jest w doskonałym stanie. Kontynuuj dbanie o higienę słuchu.',
        color: '#28a745'
      };
    } else if (averageLevel <= 40) {
      return {
        status: 'Lekkie obniżenie słuchu',
        recommendation: 'Zalecana konsultacja z laryngologiem lub audiologiem.',
        color: '#ffc107'
      };
    } else if (averageLevel <= 60) {
      return {
        status: 'Umiarkowane obniżenie słuchu',
        recommendation: 'Konieczna konsultacja z audiologiem. Możliwe zastosowanie aparatów słuchowych.',
        color: '#fd7e14'
      };
    } else {
      return {
        status: 'Znaczne obniżenie słuchu',
        recommendation: 'Pilna konsultacja z audiologiem. Konieczne zastosowanie aparatów słuchowych.',
        color: '#dc3545'
      };
    }
  }
}

module.exports = new DataService();