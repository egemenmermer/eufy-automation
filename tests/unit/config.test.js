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
    process.env.PORT = '3000';
    process.env.POLL_INTERVAL_MINUTES = '2';
    process.env.UNLOCK_DURATION_MINUTES = '60';
    process.env.EUFY_USERNAME = 'test@example.com';
    process.env.EUFY_PASSWORD = 'testpassword';
    process.env.EUFY_DEVICE_SERIAL = 'TEST123456';
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH = './credentials/service-account.json';
    process.env.GOOGLE_CALENDAR_ID = 'test@example.com';
    process.env.EMAIL_HOST = 'smtp.gmail.com';
    process.env.EMAIL_PORT = '587';
    process.env.EMAIL_USER = 'test@gmail.com';
    process.env.EMAIL_PASSWORD = 'testpassword';

    // Load configuration
    delete require.cache[require.resolve('../../src/config/index.js')];
    const { config } = require('../../src/config/index.js');

    expect(config.server.port).toBe(3000);
    expect(config.automation.pollIntervalMinutes).toBe(2);
    expect(config.automation.unlockDurationMinutes).toBe(60);
    expect(config.eufy.username).toBe('test@example.com');
    expect(config.eufy.password).toBe('testpassword');
    expect(config.eufy.deviceSerial).toBe('TEST123456');
  });

  test('should use default values when environment variables are not set', () => {
    // Clear all relevant environment variables
    delete process.env.PORT;
    delete process.env.POLL_INTERVAL_MINUTES;
    delete process.env.UNLOCK_DURATION_MINUTES;

    delete require.cache[require.resolve('../../src/config/index.js')];
    const { config } = require('../../src/config/index.js');

    expect(config.server.port).toBe(3001);
    expect(config.automation.pollIntervalMinutes).toBe(5);
    expect(config.automation.unlockDurationMinutes).toBe(60);
  });

  test('should handle numeric string conversion correctly', () => {
    process.env.PORT = '4000';
    process.env.POLL_INTERVAL_MINUTES = '3';
    process.env.EMAIL_PORT = '465';

    delete require.cache[require.resolve('../../src/config/index.js')];
    const { config } = require('../../src/config/index.js');

    expect(typeof config.server.port).toBe('number');
    expect(config.server.port).toBe(4000);
    expect(typeof config.automation.pollIntervalMinutes).toBe('number');
    expect(config.automation.pollIntervalMinutes).toBe(3);
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
    const { validateEufyConfig } = require('../../src/config/index.js');

    expect(() => validateEufyConfig()).toThrow();
  });

  test('should validate Google Calendar configuration', () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH = './credentials/service-account.json';
    process.env.GOOGLE_CALENDAR_ID = 'test@example.com';

    delete require.cache[require.resolve('../../src/config/index.js')];
    const { validateGoogleConfig } = require('../../src/config/index.js');

    expect(() => validateGoogleConfig()).not.toThrow();
  });

  test('should validate email configuration', () => {
    process.env.EMAIL_HOST = 'smtp.gmail.com';
    process.env.EMAIL_PORT = '587';
    process.env.EMAIL_USER = 'test@gmail.com';
    process.env.EMAIL_PASSWORD = 'password';

    delete require.cache[require.resolve('../../src/config/index.js')];
    const { validateEmailConfig } = require('../../src/config/index.js');

    expect(() => validateEmailConfig()).not.toThrow();
  });

  test('should identify test mode correctly', () => {
    // Test mode when credentials are missing
    delete process.env.EUFY_USERNAME;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
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
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH = './credentials/service-account.json';
    process.env.GOOGLE_CALENDAR_ID = 'test@example.com';
    process.env.EMAIL_HOST = 'smtp.gmail.com';
    process.env.EMAIL_USER = 'test@gmail.com';
    process.env.EMAIL_PASSWORD = 'password';

    delete require.cache[require.resolve('../../src/config/index.js')];
    const { isTestMode } = require('../../src/config/index.js');

    expect(isTestMode()).toBe(false);
  });
}); 