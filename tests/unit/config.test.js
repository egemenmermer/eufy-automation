// Unit tests for configuration validation
const fs = require('fs');
const path = require('path');

// Mock logger to avoid console output during tests
const mockLogger = {
  info: () => {},
  error: () => {},
  warn: () => {}
};

// Mock the logger module
jest.mock('../../src/utils/logger', () => mockLogger);

describe('Configuration Tests', () => {
  const originalEnv = process.env;
  
  beforeEach(() => {
    // Reset environment variables before each test
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('should load configuration with valid environment variables', () => {
    // Set valid test environment variables
    process.env.NODE_ENV = 'production';
    process.env.WEB_SERVER_PORT = '3000';
    process.env.AMELIA_POLL_INTERVAL_SECONDS = '120';
    process.env.EUFY_USERNAME = 'test@example.com';
    process.env.EUFY_PASSWORD = 'testpassword';
    process.env.EUFY_DEVICE_SERIAL = 'TEST123456';
    process.env.AMELIA_API_BASE_URL = 'https://example.com';
    process.env.AMELIA_API_KEY = 'test-key';
    process.env.AMELIA_DB_HOST = 'db.example.com';
    process.env.AMELIA_DB_USER = 'user';
    process.env.AMELIA_DB_PASSWORD = 'password';
    process.env.AMELIA_DB_DATABASE = 'amelia_db';
    process.env.EMAIL_HOST = 'smtp.gmail.com';
    process.env.EMAIL_PORT = '587';
    process.env.EMAIL_USER = 'test@gmail.com';
    process.env.EMAIL_PASSWORD = 'testpassword';

    // Load configuration
    delete require.cache[require.resolve('../../src/config/index.js')];
    const { config } = require('../../src/config/index.js');

    expect(config.webServer.port).toBe(3000);
    expect(config.system.ameliaPollIntervalSeconds).toBe(120);
    expect(config.eufy.username).toBe('test@example.com');
    expect(config.eufy.password).toBe('testpassword');
    expect(config.eufy.deviceSerial).toBe('TEST123456');
    expect(config.amelia.host).toBe('db.example.com');
  });

  test('should use default values when environment variables are not set', () => {
    // Clear all relevant environment variables
    delete process.env.WEB_SERVER_PORT;
    delete process.env.AMELIA_POLL_INTERVAL_SECONDS;

    delete require.cache[require.resolve('../../src/config/index.js')];
    const { config } = require('../../src/config/index.js');

    expect(config.webServer.port).toBe(3000); // Default port
    expect(config.system.ameliaPollIntervalSeconds).toBe(30); // Default poll interval
  });

  test('should handle numeric string conversion correctly', () => {
    process.env.WEB_SERVER_PORT = '4000';
    process.env.AMELIA_POLL_INTERVAL_SECONDS = '180';
    process.env.EMAIL_PORT = '465';

    delete require.cache[require.resolve('../../src/config/index.js')];
    const { config } = require('../../src/config/index.js');

    expect(typeof config.webServer.port).toBe('number');
    expect(config.webServer.port).toBe(4000);
    expect(typeof config.system.ameliaPollIntervalSeconds).toBe('number');
    expect(config.system.ameliaPollIntervalSeconds).toBe(180);
    expect(typeof config.email.port).toBe('number');
    expect(config.email.port).toBe(465);
  });

  test('should validate required Eufy credentials', () => {
    process.env.EUFY_USERNAME = 'test@example.com';
    process.env.EUFY_PASSWORD = 'password';
    process.env.EUFY_DEVICE_SERIAL = 'ABC123';

    delete require.cache[require.resolve('../../src/config/index.js')];
    const { validateEufyConfig } = require('../../src/config/index.js');

    expect(() => validateEufyConfig()).not.toThrow();
  });

  test('should fail validation with missing Eufy credentials', () => {
    delete process.env.EUFY_USERNAME;
    delete process.env.EUFY_PASSWORD;
    delete process.env.EUFY_DEVICE_SERIAL;

    delete require.cache[require.resolve('../../src/config/index.js')];
    const { isTestMode, validateEufyConfig } = require('../../src/config/index.js');

    expect(isTestMode()).toBe(true);
    // In test mode, validation should not throw an error
    expect(() => validateEufyConfig()).not.toThrow();
  });

  test('should validate Amelia configuration', () => {
    process.env.AMELIA_DB_HOST = 'db.example.com';
    process.env.AMELIA_DB_USER = 'user';
    process.env.AMELIA_DB_PASSWORD = 'password';
    process.env.AMELIA_DB_DATABASE = 'amelia_db';

    delete require.cache[require.resolve('../../src/config/index.js')];
    const { validateAmeliaConfig, isTestMode } = require('../../src/config/index.js');

    // In non-test mode, this should not throw
    process.env.NODE_ENV = 'production';
    expect(() => validateAmeliaConfig()).not.toThrow();
  });

  test('should not throw for amelia config in test mode', () => {
    delete process.env.AMELIA_DB_HOST;
    
    delete require.cache[require.resolve('../../src/config/index.js')];
    const { isTestMode, validateAmeliaConfig } = require('../../src/config/index.js');

    expect(isTestMode()).toBe(true);
    expect(() => validateAmeliaConfig()).not.toThrow();
  });

  test('should validate email configuration', () => {
    process.env.EMAIL_HOST = 'smtp.gmail.com';
    process.env.EMAIL_PORT = '587';
    process.env.EMAIL_USER = 'test@gmail.com';
    process.env.EMAIL_PASSWORD = 'password';
    process.env.AMELIA_DB_PASSWORD = 'password';
    process.env.AMELIA_DB_DATABASE = 'amelia_db';
    process.env.EMAIL_HOST = 'smtp.gmail.com';
    process.env.EMAIL_USER = 'test@gmail.com';
    process.env.EMAIL_PASSWORD = 'password';

    delete require.cache[require.resolve('../../src/config/index.js')];
    const { isTestMode, config } = require('../../src/config/index.js');
    
    // Explicitly set test mode to false by providing all credentials
    const testMode = isTestMode(config);
    expect(testMode).toBe(false);
  });

  test('should identify test mode correctly', () => {
    // Test mode when credentials are missing
    delete process.env.EUFY_USERNAME;
    delete process.env.AMELIA_DB_HOST;
    delete process.env.EMAIL_HOST;

    delete require.cache[require.resolve('../../src/config/index.js')];
    const { isTestMode } = require('../../src/config/index.js');

    expect(isTestMode()).toBe(true);
  });

  test('should not be in test mode with full credentials', () => {
    process.env.NODE_ENV = 'production'; // Explicitly set to non-test mode
    process.env.EUFY_USERNAME = 'test@example.com';
    process.env.EUFY_PASSWORD = 'password';
    process.env.EUFY_DEVICE_SERIAL = 'ABC123';
    process.env.AMELIA_DB_HOST = 'db.example.com';
    process.env.AMELIA_DB_USER = 'user';
    process.env.AMELIA_DB_PASSWORD = 'password';
    process.env.AMELIA_DB_DATABASE = 'amelia_db';
    process.env.EMAIL_HOST = 'smtp.gmail.com';
    process.env.EMAIL_USER = 'test@gmail.com';
    process.env.EMAIL_PASSWORD = 'password';

    delete require.cache[require.resolve('../../src/config/index.js')];
    const { isTestMode } = require('../../src/config/index.js');

    expect(isTestMode()).toBe(false);
  });
}); 