const winston = require('winston');
const fs = require('fs-extra');
const path = require('path');
const { config } = require('../config');

// Ensure logs directory exists
const logsDir = path.dirname(config.logging.filePath);
fs.ensureDirSync(logsDir);

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    return log;
  })
);

// Custom format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.json()
);

// Create logger instance
const logger = winston.createLogger({
  level: config.logging.level,
  transports: [
    // Console transport
    new winston.transports.Console({
      format: consoleFormat,
    }),
    
    // File transport
    new winston.transports.File({
      filename: config.logging.filePath,
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    
    // Error file transport
    new winston.transports.File({
      filename: config.logging.filePath.replace('.log', '-error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// Add context-specific logging methods
logger.calendar = (message, meta = {}) => {
  logger.info(`[CALENDAR] ${message}`, meta);
};

logger.eufy = (message, meta = {}) => {
  logger.info(`[EUFY] ${message}`, meta);
};

logger.email = (message, meta = {}) => {
  logger.info(`[EMAIL] ${message}`, meta);
};

logger.security = (message, meta = {}) => {
  logger.warn(`[SECURITY] ${message}`, meta);
};

module.exports = logger; 