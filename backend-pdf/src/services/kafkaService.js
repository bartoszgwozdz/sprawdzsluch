const { Kafka } = require('kafkajs');
const config = require('../config/config');
const logger = require('../utils/logger');
const pdfService = require('./pdfService');
const emailService = require('./emailService');
const dataService = require('./dataService');

class KafkaService {
  constructor() {
    this.kafka = new Kafka({
      clientId: config.kafka.clientId,
      brokers: config.kafka.brokers,
      retry: {
        initialRetryTime: 100,
        retries: 8
      }
    });
    
    this.consumer = this.kafka.consumer({ 
      groupId: config.kafka.groupId,
      sessionTimeout: 30000,
      heartbeatInterval: 3000
    });
    
    this.isConnected = false;
  }
  
  async initializeConsumer() {
    try {
      logger.info('Łączenie z Kafka...');
      
      await this.consumer.connect();
      this.isConnected = true;
      
      await this.consumer.subscribe({
        topic: config.kafka.topics.paymentCompleted,
        fromBeginning: false
      });
      
      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          await this.handlePaymentCompletedMessage(message);
        }
      });
      
      logger.info(`Kafka consumer podłączony do topic: ${config.kafka.topics.paymentCompleted}`);
      
    } catch (error) {
      logger.error('Błąd podczas inicjalizacji Kafka consumer:', error);
      throw error;
    }
  }
  
  async handlePaymentCompletedMessage(message) {
    try {
      const eventData = JSON.parse(message.value.toString());
      logger.info('Otrzymano event sprawdzsluch-payment-completed:', {
        testId: eventData.testId,
        userEmail: eventData.userEmail,
        paymentMethod: eventData.paymentMethod
      });
      
      // Pobierz dane testu z MongoDB
      const testData = await dataService.getTestResultById(eventData.testId);
      
      if (!testData) {
        logger.error(`Nie znaleziono danych testu dla ID: ${eventData.testId}`);
        return;
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
      
    } catch (error) {
      logger.error('Błąd podczas przetwarzania payment completed event:', error);
      
      // W przypadku błędu krytycznego możemy wysłać do DLQ
      // lub po prostu zalogować i kontynuować
    }
  }
  
  async disconnect() {
    if (this.isConnected) {
      try {
        await this.consumer.disconnect();
        this.isConnected = false;
        logger.info('Kafka consumer rozłączony');
      } catch (error) {
        logger.error('Błąd podczas rozłączania Kafka consumer:', error);
      }
    }
  }
  
  getConnectionStatus() {
    return this.isConnected;
  }
}

module.exports = new KafkaService();