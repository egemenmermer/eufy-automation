# Test Suite Documentation

This directory contains the complete test suite for the Eufy Smart Lock Automation System. The tests are organized in a hierarchical structure to provide comprehensive coverage from unit tests to full integration testing.

## Test Structure

```
tests/
├── mocks/                    # Mock services for testing without credentials
│   ├── eufyService.js       # Mock Eufy hardware simulation
│   ├── googleCalendar.js    # Mock Google Calendar with test events
│   └── emailService.js      # Mock email service with verification
├── unit/                    # Unit tests for individual components
│   └── config.test.js       # Configuration validation tests
├── integration/             # Integration tests with mock services
│   └── automationEngine.test.js  # Full automation flow tests
├── api/                     # API endpoint tests
│   └── endpoints.test.js    # Express API route testing
└── README.md               # This file
```

## Test Categories

### 1. Mock Services (`/mocks`)
Mock implementations that simulate external services without requiring real credentials:
- **Mock Eufy Service**: Simulates smart lock hardware with realistic delays and state management
- **Mock Google Calendar**: Provides test events and calendar simulation
- **Mock Email Service**: Tracks sent emails for verification in tests

### 2. Unit Tests (`/unit`)
Test individual components in isolation:
- **Configuration Tests**: Validate environment variable handling and config validation
- **Logger Tests**: (Future) Test logging functionality
- **Utility Tests**: (Future) Test helper functions

### 3. Integration Tests (`/integration`)
Test complete workflows with mock services:
- **Automation Engine**: End-to-end automation flow testing
- **Service Integration**: Cross-service communication testing
- **Error Handling**: Graceful failure and recovery testing

### 4. API Tests (`/api`)
Test HTTP endpoints and API functionality:
- **Endpoint Testing**: All REST API routes
- **Authentication**: (Future) API security testing
- **Load Testing**: (Future) Performance under load

## Prerequisites

### Install Test Dependencies

```bash
# Install Jest and testing utilities
npm install --save-dev jest supertest

# For API testing
npm install --save-dev request
```

### Test Environment Setup

The tests automatically detect when credentials are missing and switch to mock mode. No real Eufy, Google, or email credentials are required.

Set these minimal environment variables for testing:
```bash
export NODE_ENV=test
export PORT=3001
export EUFY_DEVICE_SERIAL=TEST123456
export POLL_INTERVAL_MINUTES=1
export UNLOCK_DURATION_MINUTES=30
```

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Specific Test Categories
```bash
# Unit tests only
npm test -- tests/unit

# Integration tests only  
npm test -- tests/integration

# API tests only
npm test -- tests/api

# Mock service tests
npm test -- tests/mocks
```

### Run Individual Test Files
```bash
# Configuration tests
npm test -- tests/unit/config.test.js

# Automation engine tests
npm test -- tests/integration/automationEngine.test.js

# API endpoint tests
npm test -- tests/api/endpoints.test.js
```

### Run Tests with Coverage
```bash
npm test -- --coverage
```

### Run Tests in Watch Mode
```bash
npm test -- --watch
```

## Test Configuration

### Jest Configuration
Add this to your `package.json`:

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  },
  "jest": {
    "testEnvironment": "node",
    "testMatch": ["**/tests/**/*.test.js"],
    "collectCoverageFrom": [
      "src/**/*.js",
      "!src/index.js"
    ],
    "coverageReporters": ["text", "lcov", "html"]
  }
}
```

## Test Patterns

### Mock Service Usage
```javascript
const MockEufyService = require('../mocks/eufyService');
const mockEufy = new MockEufyService();
await mockEufy.initialize();
await mockEufy.unlockDoor();
```

### Environment Mocking
```javascript
beforeEach(() => {
  process.env.NODE_ENV = 'test';
  process.env.EUFY_DEVICE_SERIAL = 'TEST123';
});
```

### Async Testing
```javascript
test('should process automation flow', async () => {
  await automationEngine.initialize();
  await automationEngine.processUpcomingEvents();
  // Assertions...
});
```

## What Gets Tested

### ✅ Unit Tests
- [x] Configuration validation and defaults
- [x] Environment variable parsing
- [x] Service validation functions
- [x] Test mode detection

### ✅ Integration Tests  
- [x] Automation engine initialization
- [x] Event processing workflow
- [x] Door unlock/lock automation
- [x] Email notification sending
- [x] Error handling and recovery
- [x] Service coordination

### ✅ API Tests
- [x] Health check endpoints
- [x] System status reporting
- [x] Manual door controls
- [x] Event retrieval
- [x] Automation triggering
- [x] Error response handling

### ✅ Mock Service Tests
- [x] Eufy service simulation
- [x] Calendar event generation
- [x] Email tracking and verification
- [x] Realistic timing and delays

## Benefits of This Test Structure

1. **No Real Credentials Required**: All tests use mocks
2. **Fast Execution**: No external API calls
3. **Reliable**: Tests don't depend on external services
4. **Comprehensive**: Covers all major functionality
5. **Maintainable**: Clear separation of concerns
6. **Debuggable**: Easy to isolate and fix issues

## Continuous Integration

These tests are designed to run in CI/CD environments without any external dependencies:

```yaml
# Example GitHub Actions
- name: Run Tests
  run: |
    npm install
    npm test
  env:
    NODE_ENV: test
```

## Future Test Enhancements

- [ ] Performance/load testing
- [ ] Security testing for API endpoints
- [ ] Real hardware integration tests (optional)
- [ ] Stress testing with many concurrent events
- [ ] Browser-based UI testing (if web interface added)

## Troubleshooting

### Common Issues

1. **Tests failing due to timing**: Increase timeout values in Jest config
2. **Mock services not found**: Ensure relative paths are correct
3. **Environment variables**: Clear between tests with `jest.resetModules()`

### Debug Mode
Run tests with verbose output:
```bash
npm test -- --verbose
```

For more detailed debugging:
```bash
DEBUG=* npm test
``` 