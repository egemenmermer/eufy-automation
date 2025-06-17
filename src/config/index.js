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
  
  // Email Configuration
  email: {
    from: process.env.EMAIL_FROM,
    password: process.env.EMAIL_PASSWORD,
    fromName: process.env.EMAIL_FROM_NAME || 'Automated Access System',
  },
  
  // System Configuration
  system: {
    lockDurationMinutes: parseInt(process.env.LOCK_DURATION_MINUTES) || 5,
    calendarPollIntervalSeconds: parseInt(process.env.CALENDAR_POLL_INTERVAL_SECONDS) || 60,
    timezone: process.env.TIMEZONE || 'America/New_York',
    port: parseInt(process.env.PORT) || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  
  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    filePath: process.env.LOG_FILE_PATH || './logs/automation.log',
  },
};

// Validation function
function validateConfig() {
  const required = [
    'eufy.username',
    'eufy.password',
    'eufy.deviceSerial',
    'google.serviceAccountKeyPath',
    'google.calendarId',
    'email.from',
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
}

module.exports = { config, validateConfig }; 