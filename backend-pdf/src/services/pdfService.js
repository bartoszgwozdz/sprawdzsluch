const puppeteer = require('puppeteer');
const handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');
const config = require('../config/config');
const logger = require('../utils/logger');
const dataService = require('./dataService');

class PDFService {
  constructor() {
    this.browser = null;
    this.template = null;
    this.templatePath = path.join(__dirname, '../templates/hearing-report.hbs');
  }
  
  async initializeBrowser() {
    if (!this.browser) {
      try {
        logger.info('Inicjalizacja przeglądarki Puppeteer...');
        this.browser = await puppeteer.launch({
          headless: 'new',
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
          ]
        });
        logger.info('Przeglądarka Puppeteer zainicjalizowana');
      } catch (error) {
        logger.error('Błąd podczas inicjalizacji przeglądarki:', error);
        throw error;
      }
    }
    return this.browser;
  }
  
  async loadTemplate() {
    if (!this.template) {
      try {
        const templateContent = await fs.readFile(this.templatePath, 'utf8');
        this.template = handlebars.compile(templateContent);
        logger.info('Szablon HTML załadowany');
      } catch (error) {
        logger.error('Błąd podczas ładowania szablonu:', error);
        throw error;
      }
    }
    return this.template;
  }
  
  async generateHearingTestReport(testData) {
    try {
      logger.info(`Generowanie raportu PDF dla testu: ${testData.testId}`);
      
      // Inicjalizacja przeglądarki i szablonu
      await this.initializeBrowser();
      const template = await this.loadTemplate();
      
      // Przygotowanie danych do szablonu
      const templateData = this.prepareTemplateData(testData);
      
      // Generowanie HTML
      const html = template(templateData);
      
      // Tworzenie PDF
      const page = await this.browser.newPage();
      
      await page.setContent(html, { 
        waitUntil: 'networkidle0',
        timeout: 30000
      });
      
      const pdfBuffer = await page.pdf({
        format: config.pdf.format,
        margin: config.pdf.margin,
        printBackground: config.pdf.printBackground,
        preferCSSPageSize: config.pdf.preferCSSPageSize
      });
      
      await page.close();
      
      logger.info(`PDF wygenerowany pomyślnie dla testu: ${testData.testId}, rozmiar: ${pdfBuffer.length} bajtów`);
      
      return pdfBuffer;
      
    } catch (error) {
      logger.error('Błąd podczas generowania PDF:', error);
      throw error;
    }
  }
  
  prepareTemplateData(testData) {
    const now = new Date();
    const testDate = testData.createdAt ? new Date(testData.createdAt) : now;
    
    // Przygotowanie wyników słuchu
    const hearingResults = [];
    if (testData.hearingLevels) {
      for (const [frequency, level] of Object.entries(testData.hearingLevels)) {
        const freq = parseInt(frequency);
        const interpretation = dataService.getHearingLevelInterpretation(level);
        
        hearingResults.push({
          frequency: freq,
          description: dataService.getFrequencyDescription(freq),
          level: level,
          interpretation: interpretation.status,
          levelClass: this.getLevelClass(level)
        });
      }
      
      // Sortowanie po częstotliwości
      hearingResults.sort((a, b) => a.frequency - b.frequency);
    }
    
    // Ogólna ocena słuchu
    const assessment = dataService.getOverallHearingAssessment(testData.hearingLevels);
    
    return {
      // Podstawowe informacje
      testId: testData.testId,
      userEmail: testData.userEmail,
      maxAudibleFrequency: testData.maxAudibleFrequency || 'Nie określono',
      
      // Daty
      reportDate: this.formatDate(now),
      testDate: this.formatDate(testDate),
      
      // Wyniki
      hearingResults: hearingResults,
      assessment: assessment,
      
      // Informacje o płatności
      payment: testData.payment ? {
        method: testData.payment.method === 'VOUCHER' ? 'Voucher' : 'PayNow',
        completedAt: this.formatDate(new Date(testData.payment.completedAt)),
        paymentId: testData.payment.paymentId
      } : null
    };
  }
  
  getLevelClass(level) {
    if (level <= 20) return 'level-normal';
    if (level <= 40) return 'level-mild';
    if (level <= 60) return 'level-moderate';
    if (level <= 80) return 'level-severe';
    return 'level-profound';
  }
  
  formatDate(date) {
    return date.toLocaleDateString('pl-PL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  
  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      logger.info('Przeglądarka Puppeteer zamknięta');
    }
  }
  
  // Metoda do testowania generowania PDF bez Kafka
  async generateTestReport() {
    const testData = {
      testId: 'TEST-' + Date.now(),
      userEmail: 'test@example.com',
      maxAudibleFrequency: 16000,
      hearingLevels: {
        250: 15,
        500: 20,
        1000: 25,
        2000: 30,
        4000: 45,
        8000: 60
      },
      createdAt: new Date().toISOString(),
      payment: {
        method: 'VOUCHER',
        completedAt: new Date().toISOString(),
        paymentId: 'PAY-TEST-123'
      }
    };
    
    return await this.generateHearingTestReport(testData);
  }
}

module.exports = new PDFService();