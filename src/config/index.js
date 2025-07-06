require('dotenv').config();

const config = {
  // Eufy Configuration
  eufy: {
    username: process.env.EUFY_USERNAME,
    password: process.env.EUFY_PASSWORD,
    deviceSerial: process.env.EUFY_DEVICE_SERIAL,
  },
  
  // WordPress/Amelia Database Configuration
  amelia: {
    host: process.env.AMELIA_DB_HOST || 'localhost',
    port: parseInt(process.env.AMELIA_DB_PORT) || 3306,
    user: process.env.AMELIA_DB_USER,
    password: process.env.AMELIA_DB_PASSWORD,
    database: process.env.AMELIA_DB_NAME,
    tablePrefix: process.env.AMELIA_TABLE_PREFIX || 'wp_',
    
    // Amelia Elite REST API Configuration (Recommended)
    useAPI: process.env.AMELIA_USE_API === 'true',
    apiBaseUrl: process.env.AMELIA_API_BASE_URL,
    apiKey: process.env.AMELIA_API_KEY,
    webhookSecret: process.env.AMELIA_WEBHOOK_SECRET,
  },
  
  // Server Configuration
  server: {
    port: parseInt(process.env.PORT) || 3001,
  },
  
  // Session Duration Mapping (in minutes)
  sessionDurations: {
    'Ice bath': 15,
    'Traditional Sauna': 30,
    'Traditional sauna and Ice bath': 45,
    'Chill Club: 15-Min Daily Ice Bath Access': 15,
    'Communal - Contrast Therapy - Ice Bath & Traditional Sauna': 30,
    'Private - Contrast Therapy - Ice Bath & Traditional Sauna': 60,
    // Default mapping for unknown services
    default: 30
  },
  
  // Automation Configuration
  automation: {
    pollIntervalMinutes: parseInt(process.env.POLL_INTERVAL_MINUTES) || 2,
    bufferTimeMinutes: parseInt(process.env.BUFFER_TIME_MINUTES) || 5, // Extra time after session
  },
  
  // Email Configuration
  email: {
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT) || 587,
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASSWORD,
    from: process.env.EMAIL_FROM,
    fromName: process.env.EMAIL_FROM_NAME || 'Euphorium Access System',
  },

  // Web Server Configuration
  webServer: {
    port: parseInt(process.env.WEB_SERVER_PORT) || 3000,
    baseUrl: process.env.WEB_SERVER_BASE_URL || 'http://localhost:3000',
  },
  
  // System Configuration
  system: {
    ameliaPollIntervalSeconds: parseInt(process.env.AMELIA_POLL_INTERVAL_SECONDS) || 30,
    timezone: process.env.TIMEZONE || 'Asia/Dubai', // Dubai timezone for Euphorium
    nodeEnv: process.env.NODE_ENV || 'development',
    doorCode: process.env.DOOR_CODE || '2843', // Default door code from screenshot
  },
  
  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    filePath: process.env.LOG_FILE_PATH || './logs/automation.log',
  },
};

// Validation functions
function validateEufyConfig() {
  if (config.system.nodeEnv === 'test') return;
  if (!config.eufy.username || !config.eufy.password || !config.eufy.deviceSerial) {
    throw new Error('Missing required Eufy configuration: username, password, deviceSerial');
  }
}

function validateAmeliaConfig() {
  if (config.system.nodeEnv === 'test') return;
  if (!config.amelia.host || !config.amelia.user || !config.amelia.password || !config.amelia.database) {
    throw new Error('Missing required Amelia configuration: host, user, password, database');
  }
}

function validateEmailConfig() {
  if (config.system.nodeEnv === 'test') return;
  if (!config.email.host || !config.email.user || !config.email.password) {
    throw new Error('Missing required Email configuration: host, user, password');
  }
}

function isTestMode() {
  // Check if we're in test mode based on various conditions
  if (config.system.nodeEnv === 'test') {
    return true;
  }
  
  // Check if critical credentials are missing
  const hasEufy = config.eufy.username && config.eufy.password && config.eufy.deviceSerial;
  const hasAmelia = config.amelia.host && config.amelia.user && config.amelia.password && config.amelia.database;
  const hasEmail = config.email.host && config.email.user && config.email.password;
  
  return !hasEufy || !hasAmelia || !hasEmail;
}

// Function to get lock duration for a service
function getLockDurationForService(serviceName) {
  const baseDuration = config.sessionDurations[serviceName] || config.sessionDurations.default;
  return baseDuration + config.automation.bufferTimeMinutes;
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
    'amelia.host',
    'amelia.user',
    'amelia.password',
    'amelia.database',
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
  validateAmeliaConfig,
  validateEmailConfig,
  isTestMode,
  getLockDurationForService
}; 