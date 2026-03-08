require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const logger = require('./utils/logger');
const paymentEventHandler = require('./services/paymentEventHandler');
const pdfService = require('./services/pdfService');
const emailService = require('./services/emailService');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Logging middleware — dołącza correlationId do każdego requesta
app.use((req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || require('crypto').randomUUID();
  // Przekazujemy correlationId dalej w odpowiedzi
  res.setHeader('X-Correlation-Id', correlationId);
  // Tworzymy child logger z kontekstem requesta — dostępny dla handlerów
  req.log = logger.withContext({ correlationId });
  req.log.info(`${req.method} ${req.originalUrl}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'sprawdzsluch-pdf-service',
    timestamp: new Date().toISOString()
  });
});

// Payment completed endpoint — wywoływany przez backend-payments via HTTP
// Zastępuje Kafka consumer na topic sprawdzsluch-payment-completed
app.post('/api/v1/payment-completed', async (req, res) => {
  try {
    const eventData = req.body;
    
    if (!eventData.testId || !eventData.userEmail) {
      return res.status(400).json({ 
        error: 'Brak wymaganych danych: testId i userEmail' 
      });
    }

    const log = req.log.child({ testId: eventData.testId, userEmail: eventData.userEmail });
    log.info('Otrzymano zdarzenie payment-completed');
    
    const result = await paymentEventHandler.handlePaymentCompleted(eventData);
    
    log.info('PDF wygenerowany i wysłany pomyślnie');
    res.json({
      success: true,
      message: 'PDF wygenerowany i wysłany',
      ...result
    });
    
  } catch (error) {
    req.log.error('Błąd podczas przetwarzania payment-completed', { error: error.message, stack: error.stack });
    res.status(500).json({ 
      error: 'Błąd podczas generowania PDF',
      details: error.message 
    });
  }
});

// Manual PDF generation endpoint (for testing)
app.post('/generate-pdf', async (req, res) => {
  try {
    const { testData, userEmail } = req.body;
    
    if (!testData || !userEmail) {
      return res.status(400).json({ 
        error: 'Brak wymaganych danych: testData i userEmail' 
      });
    }
    
    logger.info(`Generowanie PDF dla użytkownika: ${userEmail}`);
    
    // Generuj PDF
    const pdfBuffer = await pdfService.generateHearingTestReport(testData);
    
    // Wyślij email
    const emailResult = await emailService.sendReportEmail(userEmail, pdfBuffer, testData);
    
    res.json({
      success: true,
      message: 'PDF wygenerowany i wysłany',
      emailResult
    });
    
  } catch (error) {
    logger.error('Błąd podczas generowania PDF:', error);
    res.status(500).json({ 
      error: 'Błąd podczas generowania PDF',
      details: error.message 
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Nieobsłużony błąd:', error);
  res.status(500).json({ 
    error: 'Wewnętrzny błąd serwera',
    message: error.message 
  });
});

// Start server
async function startServer() {
  try {
    // Start HTTP server
    app.listen(PORT, () => {
      logger.info(`Serwis PDF uruchomiony na porcie ${PORT}`);
      logger.info('Oczekiwanie na eventy payment-completed via HTTP POST /api/v1/payment-completed');
    });
    
  } catch (error) {
    logger.error('Błąd podczas uruchamiania serwera:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Otrzymano SIGTERM, zamykanie serwisu...');
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Otrzymano SIGINT, zamykanie serwisu...');
  process.exit(0);
});

startServer();