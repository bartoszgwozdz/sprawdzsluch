const puppeteer = require('puppeteer');
const handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');
const config = require('../config/config');
const logger = require('../utils/logger');
const dataService = require('./dataService');
const audiogramChart = require('../utils/audiogramChart');

// Equality helper used by the report template (e.g. highlight patient's severity band)
handlebars.registerHelper('eq', (a, b) => a === b);

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

      // Branded footer with page numbers + report id on every page
      const reportId = (testData.testId || '').toString();
      const footerTemplate = `
        <div style="width:100%; font-family:'Montserrat', Arial, sans-serif; font-size:8px; color:#94A3B8;
                    padding:0 14mm; display:flex; justify-content:space-between; align-items:center;">
          <span style="color:#004AAD; font-weight:700;">Sprawdź<span style="color:#00C853;">Słuch</span></span>
          <span>Raport nr ${reportId}</span>
          <span>Strona <span class="pageNumber"></span> z <span class="totalPages"></span></span>
        </div>`;

      const pdfBuffer = await page.pdf({
        format: config.pdf.format,
        printBackground: config.pdf.printBackground,
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate,
        margin: { top: '10mm', right: '0', bottom: '16mm', left: '0' }
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
          frequencyLabel: freq >= 1000 ? `${freq / 1000} kHz` : `${freq} Hz`,
          description: dataService.getFrequencyDescription(freq),
          level: level,
          interpretation: interpretation.status,
          levelClass: this.getLevelClass(level),
          barWidth: Math.max(4, Math.min(100, level))
        });
      }

      // Sortowanie po częstotliwości
      hearingResults.sort((a, b) => a.frequency - b.frequency);
    }

    // Ogólna ocena słuchu
    const assessment = dataService.getOverallHearingAssessment(testData.hearingLevels);

    // Średni próg słyszenia (PTA) — na potrzeby podsumowania / miernika / klasyfikacji
    const hasLevels = testData.hearingLevels && Object.keys(testData.hearingLevels).length > 0;
    const averageLevel = hasLevels ? dataService.calculatePTA(testData.hearingLevels) : null;
    const summaryMeta = this.getSummaryMeta(averageLevel);

    // Generowanie wykresu audiometrycznego (oś X: 250 Hz → maks. słyszalna częstotliwość)
    const audiogram = hasLevels
      ? audiogramChart.generate(testData.hearingLevels, testData.maxAudibleFrequency)
      : null;

    // Interpretacja maksymalnej słyszalnej częstotliwości (zakres wysokich tonów)
    const frequencyRange = dataService.getFrequencyRangeInterpretation(testData.maxAudibleFrequency);

    return {
      // Podstawowe informacje
      testId: testData.testId,
      userEmail: testData.userEmail,
      maxAudibleFrequency: testData.maxAudibleFrequency
        ? this.formatFrequency(testData.maxAudibleFrequency)
        : 'Nie określono',

      // Daty
      reportDate: this.formatDate(now),
      testDate: this.formatDate(testDate),

      // Podsumowanie wyniku
      summary: {
        status: assessment.status,
        recommendation: assessment.recommendation,
        averageLevel: averageLevel,
        meterPercent: averageLevel != null ? Math.max(2, Math.min(100, averageLevel)) : 0,
        levelClass: summaryMeta.levelClass,
        meaning: summaryMeta.meaning,
        nextSteps: summaryMeta.nextSteps
      },

      // Wyniki
      hearingResults: hearingResults,
      assessment: assessment,
      audiogram: audiogram,
      frequencyRange: frequencyRange,

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
    if (level <= 70) return 'level-moderate';
    if (level <= 90) return 'level-severe';
    return 'level-profound';
  }

  // Plain-language interpretation + actionable next steps based on average threshold
  getSummaryMeta(averageLevel) {
    if (averageLevel == null) {
      return {
        levelClass: 'level-normal',
        meaning: 'Brak wystarczających danych do interpretacji wyniku.',
        nextSteps: ['Skontaktuj się z audiologiem w celu wykonania pełnego badania.']
      };
    }
    if (averageLevel <= 20) {
      return {
        levelClass: 'level-normal',
        meaning: 'Twój słuch mieści się w granicach normy we wszystkich badanych częstotliwościach. To bardzo dobry wynik.',
        nextSteps: [
          'Kontynuuj profilaktykę i unikaj długotrwałej ekspozycji na hałas',
          'Stosuj ochronniki słuchu w głośnym otoczeniu',
          'Powtórz badanie kontrolne za około 12 miesięcy'
        ]
      };
    }
    if (averageLevel <= 40) {
      return {
        levelClass: 'level-mild',
        meaning: 'Wykryto lekkie obniżenie słyszalności, najczęściej w zakresie wysokich tonów. Zwykle nie wpływa jeszcze istotnie na codzienne rozumienie mowy, warto jednak obserwować.',
        nextSteps: [
          'Umów konsultację z laryngologiem lub audiologiem',
          'Wykonaj pełne badanie audiometryczne w gabinecie',
          'Ogranicz ekspozycję na głośne dźwięki i hałas'
        ]
      };
    }
    if (averageLevel <= 70) {
      return {
        levelClass: 'level-moderate',
        meaning: 'Wykryto umiarkowane obniżenie słuchu, które może utrudniać rozumienie cichszej mowy oraz rozmów w hałaśliwym otoczeniu.',
        nextSteps: [
          'Skonsultuj wynik z audiologiem w najbliższym czasie',
          'Wykonaj audiometrię tonalną oraz badanie rozumienia mowy',
          'Rozważ dobór aparatu słuchowego po pełnej diagnostyce'
        ]
      };
    }
    if (averageLevel <= 90) {
      return {
        levelClass: 'level-severe',
        meaning: 'Wykryto znaczne obniżenie słuchu, które istotnie wpływa na rozumienie mowy w codziennych sytuacjach.',
        nextSteps: [
          'Pilnie skonsultuj się z audiologiem',
          'Wymagana pełna diagnostyka i dobór aparatów słuchowych',
          'Zapytaj specjalistę o możliwości refundacji (NFZ)'
        ]
      };
    }
    return {
      levelClass: 'level-profound',
      meaning: 'Wykryto głęboki ubytek słuchu, który bez wsparcia aparatem lub implantem praktycznie uniemożliwia rozumienie mowy.',
      nextSteps: [
        'Niezwłocznie skonsultuj się z audiologiem',
        'Konieczna pełna diagnostyka oraz rehabilitacja słuchu',
        'Zapytaj specjalistę o aparaty słuchowe / implant i refundację (NFZ)'
      ]
    };
  }

  formatFrequency(hz) {
    const n = parseInt(hz, 10);
    if (Number.isNaN(n)) return `${hz}`;
    return `${n.toLocaleString('pl-PL').replace(/,/g, ' ')} Hz`;
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