require('dotenv').config();

const config = {
  // Eufy Configuration
  eufy: {
    username: process.env.EUFY_USERNAME,
    password: process.env.EUFY_PASSWORD,
    deviceSerial: process.env.EUFY_DEVICE_SERIAL,
  },
  
  // Google Calendar Configuration
  google: {
    serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
    calendarId: process.env.GOOGLE_CALENDAR_ID,
  },
  
  // Server Configuration
  server: {
    port: parseInt(process.env.PORT) || 3001,
  },
  
  // Automation Configuration
  automation: {
    pollIntervalMinutes: parseInt(process.env.POLL_INTERVAL_MINUTES) || 5,
    unlockDurationMinutes: parseInt(process.env.UNLOCK_DURATION_MINUTES) || 60,
  },
  
  // Email Configuration
  email: {
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT) || 587,
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASSWORD,
    from: process.env.EMAIL_FROM,
    fromName: process.env.EMAIL_FROM_NAME || 'Automated Access System',
  },
  
  // System Configuration
  system: {
    lockDurationMinutes: parseInt(process.env.LOCK_DURATION_MINUTES) || 5,
    calendarPollIntervalSeconds: parseInt(process.env.CALENDAR_POLL_INTERVAL_SECONDS) || 60,
    timezone: process.env.TIMEZONE || 'America/New_York',
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  
  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    filePath: process.env.LOG_FILE_PATH || './logs/automation.log',
  },
};

// Validation functions
function validateEufyConfig() {
  if (!config.eufy.username || !config.eufy.password || !config.eufy.deviceSerial) {
    throw new Error('Missing required Eufy configuration: username, password, deviceSerial');
  }
}

function validateGoogleConfig() {
  if (!config.google.serviceAccountKeyPath || !config.google.calendarId) {
    throw new Error('Missing required Google configuration: serviceAccountKeyPath, calendarId');
  }
}

function validateEmailConfig() {
  if (!config.email.host || !config.email.user || !config.email.password) {
    throw new Error('Missing required email configuration: host, user, password');
  }
}

function isTestMode() {
  // Check if we're in test mode based on various conditions
  if (config.system.nodeEnv === 'test') {
    return true;
  }
  
  // Check if critical credentials are missing
  const hasEufy = config.eufy.username && config.eufy.password && config.eufy.deviceSerial;
  const hasGoogle = config.google.serviceAccountKeyPath && config.google.calendarId;
  const hasEmail = config.email.host && config.email.user && config.email.password;
  
  return !hasEufy || !hasGoogle || !hasEmail;
}

// General validation function
function validateConfig() {
  const required = [
    'eufy.username',
    'eufy.password',
    'eufy.deviceSerial',
  ];
  
  // Optional for testing - warn if missing
  const optional = [
    'google.serviceAccountKeyPath',
    'google.calendarId',
    'email.host',
    'email.user',
    'email.password',
  ];
  
  const missing = [];
  
  required.forEach(path => {
    const keys = path.split('.');
    let current = config;
    
    for (const key of keys) {
      if (!current[key]) {
        missing.push(path);
        break;
      }
      current = current[key];
    }
  });
  
  if (missing.length > 0) {
    throw new Error(`Missing required configuration: ${missing.join(', ')}`);
  }
  
  // Check optional configurations and warn
  const missingOptional = [];
  optional.forEach(path => {
    const keys = path.split('.');
    let current = config;
    
    for (const key of keys) {
      if (!current[key]) {
        missingOptional.push(path);
        break;
      }
      current = current[key];
    }
  });
  
  if (missingOptional.length > 0) {
    console.warn(`⚠️  Optional configuration missing (will use mock services): ${missingOptional.join(', ')}`);
  }
}

module.exports = { 
  config, 
  validateConfig,
  validateEufyConfig,
  validateGoogleConfig,
  validateEmailConfig,
  isTestMode
}; 