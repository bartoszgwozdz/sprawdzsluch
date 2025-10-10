module.exports = {
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    clientId: 'sprawdzsluch-pdf-service',
    groupId: 'pdf-service-group',
    topics: {
      paymentCompleted: 'sprawdzsluch-payment-completed'
    }
  },
  
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/sprawdzsluch',
    database: 'sprawdzsluch',
    collections: {
      hearingResults: 'hearing_results'
    }
  },
  
  email: {
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      }
    },
    from: process.env.EMAIL_FROM || 'noreply@sprawdzsluch.pl',
    subject: 'Twój raport z testu słuchu - SprawdźSłuch'
  },
  
  pdf: {
    format: 'A4',
    margin: {
      top: '1cm',
      right: '1cm',
      bottom: '1cm',
      left: '1cm'
    },
    printBackground: true,
    preferCSSPageSize: true
  },
  
  app: {
    port: parseInt(process.env.PORT) || 3001,
    logLevel: process.env.LOG_LEVEL || 'info'
  }
};