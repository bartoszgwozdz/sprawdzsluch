require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const logger = require('./utils/logger');
const kafkaService = require('./services/kafkaService');
const pdfService = require('./services/pdfService');
const emailService = require('./services/emailService');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl} - ${req.ip}`);
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
    // Inicjalizacja Kafka consumer
    await kafkaService.initializeConsumer();
    logger.info('Kafka consumer zainicjalizowany');
    
    // Start HTTP server
    app.listen(PORT, () => {
      logger.info(`Serwis PDF uruchomiony na porcie ${PORT}`);
      logger.info('Nasłuchiwanie eventów z Kafka topic: sprawdzsluch-payment-completed');
    });
    
  } catch (error) {
    logger.error('Błąd podczas uruchamiania serwera:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Otrzymano SIGTERM, zamykanie serwisu...');
  await kafkaService.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Otrzymano SIGINT, zamykanie serwisu...');
  await kafkaService.disconnect();
  process.exit(0);
});

startServer();