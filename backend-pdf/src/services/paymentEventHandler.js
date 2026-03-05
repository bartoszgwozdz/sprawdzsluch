/**
 * Payment Event Handler - obsługuje eventy z backend-payments via HTTP
 * (zamiennik Kafka consumera)
 */
const logger = require('../utils/logger');
const pdfService = require('./pdfService');
const emailService = require('./emailService');
const dataService = require('./dataService');

class PaymentEventHandler {
  
  /**
   * Obsługuje event payment-completed otrzymany przez HTTP POST
   * Zastępuje Kafka consumer na topic sprawdzsluch-payment-completed
   */
  async handlePaymentCompleted(eventData) {
    try {
      logger.info('Otrzymano event payment-completed:', {
        testId: eventData.testId,
        userEmail: eventData.userEmail,
        paymentMethod: eventData.paymentMethod
      });
      
      // Pobierz dane testu z MongoDB
      const testData = await dataService.getTestResultById(eventData.testId);
      
      if (!testData) {
        logger.error(`Nie znaleziono danych testu dla ID: ${eventData.testId}`);
        throw new Error(`Test data not found for ID: ${eventData.testId}`);
      }
      
      // Wzbogać dane o informacje o płatności
      const enrichedData = {
        ...testData,
        payment: {
          method: eventData.paymentMethod,
          completedAt: eventData.completedAt,
          paymentId: eventData.paymentId
        }
      };
      
      // Generuj PDF
      logger.info(`Generowanie PDF dla testu: ${eventData.testId}`);
      const pdfBuffer = await pdfService.generateHearingTestReport(enrichedData);
      
      // Wyślij email
      logger.info(`Wysyłanie emaila do: ${eventData.userEmail}`);
      const emailResult = await emailService.sendReportEmail(
        eventData.userEmail, 
        pdfBuffer, 
        enrichedData
      );
      
      logger.info('Raport PDF wygenerowany i wysłany pomyślnie:', {
        testId: eventData.testId,
        userEmail: eventData.userEmail,
        emailResult: emailResult.messageId
      });
      
      return {
        success: true,
        testId: eventData.testId,
        emailMessageId: emailResult.messageId
      };
      
    } catch (error) {
      logger.error('Błąd podczas przetwarzania payment completed event:', error);
      throw error;
    }
  }
}

module.exports = new PaymentEventHandler();