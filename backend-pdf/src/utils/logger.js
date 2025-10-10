const winston = require('winston');
const path = require('path');
const config = require('../config/config');

// Definicja formatów logów
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}] ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += `\n${JSON.stringify(meta, null, 2)}`;
    }
    return msg;
  })
);

// Konfiguracja transportów
const transports = [
  // Konsola
  new winston.transports.Console({
    format: consoleFormat,
    level: config.app.logLevel
  }),
  
  // Plik z wszystkimi logami
  new winston.transports.File({
    filename: path.join(__dirname, '../../logs/combined.log'),
    format: logFormat,
    level: 'info',
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }),
  
  // Plik tylko z błędami
  new winston.transports.File({
    filename: path.join(__dirname, '../../logs/error.log'),
    format: logFormat,
    level: 'error',
    maxsize: 5242880, // 5MB
    maxFiles: 5
  })
];

// Utworzenie katalogu logs jeśli nie istnieje
const fs = require('fs');
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Utworzenie loggera
const logger = winston.createLogger({
  level: config.app.logLevel,
  format: logFormat,
  transports,
  exitOnError: false
});

// Obsługa uncaught exceptions
logger.exceptions.handle(
  new winston.transports.File({
    filename: path.join(__dirname, '../../logs/exceptions.log')
  })
);

// Obsługa unhandled rejections
logger.rejections.handle(
  new winston.transports.File({
    filename: path.join(__dirname, '../../logs/rejections.log')
  })
);

module.exports = logger;