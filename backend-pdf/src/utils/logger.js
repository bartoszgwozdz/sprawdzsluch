const winston = require('winston');

const isProduction = process.env.NODE_ENV === 'production';

// Format JSON produkcyjny — Fluent Bit parsuje to bez konfiguracji regexów
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Format dev — czytelny, kolorowy
const devFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss.SSS' }),
  winston.format.printf(({ timestamp, level, message, testId, correlationId, ...meta }) => {
    const ctx = [correlationId, testId].filter(Boolean).join(' | ');
    let msg = `${timestamp} ${level}${ctx ? ` [${ctx}]` : ''} ${message}`;
    const extra = Object.keys(meta).filter(k => !['service', 'stack'].includes(k));
    if (extra.length > 0) {
      msg += ` ${JSON.stringify(Object.fromEntries(extra.map(k => [k, meta[k]])))}`;
    }
    return msg;
  })
);

const transports = isProduction
  ? [new winston.transports.Console({ format: jsonFormat })]
  : [new winston.transports.Console({ format: devFormat })];

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  defaultMeta: { service: 'backend-pdf' },
  transports,
  exitOnError: false
});

/**
 * Tworzy child logger z kontekstem (testId, correlationId) — pola trafiają do każdego logu.
 * Użyj w handlerach requesta zamiast globalnego `logger`.
 *
 * @param {object} ctx - { testId, correlationId, userEmail }
 */
logger.withContext = (ctx) => logger.child(ctx);

module.exports = logger;
