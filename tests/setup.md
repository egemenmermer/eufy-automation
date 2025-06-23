# Test Environment Setup Guide

This guide helps you set up and run the complete test suite for the Eufy Smart Lock Automation System without requiring any real credentials or hardware.

## Quick Start

### 1. Install Dependencies
```bash
npm install
npm install --save-dev jest supertest
```

### 2. Set Test Environment Variables
```bash
export NODE_ENV=test
export PORT=3001
export EUFY_DEVICE_SERIAL=TEST123456
export POLL_INTERVAL_MINUTES=1
export UNLOCK_DURATION_MINUTES=30
```

### 3. Run Tests
```bash
npm test
```

That's it! The system will automatically detect missing credentials and use mock services.

## Test Mode Detection

The system automatically enters test mode when any of these conditions are met:
- `NODE_ENV=test`
- Missing Google Calendar credentials
- Missing Eufy credentials
- Missing email credentials

In test mode, the system uses:
- **Mock Eufy Service**: Simulates smart lock hardware
- **Mock Google Calendar**: Provides test events
- **Mock Email Service**: Tracks sent emails for verification

## Test Environment Variables

### Required for Testing
```bash
# Basic test environment
NODE_ENV=test
PORT=3001
EUFY_DEVICE_SERIAL=TEST123456

# Automation timing (for faster testing)
POLL_INTERVAL_MINUTES=1
UNLOCK_DURATION_MINUTES=30
```

### Optional (will use mocks if missing)
```bash
# Google Calendar (optional in test mode)
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./credentials/service-account.json
GOOGLE_CALENDAR_ID=your-calendar@gmail.com

# Eufy Smart Lock (optional in test mode)
EUFY_USERNAME=your-email@example.com
EUFY_PASSWORD=your-password

# Email (optional in test mode)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
```

## Running Different Test Types

### All Tests
```bash
npm test
```

### Unit Tests Only
```bash
npm test -- tests/unit
```

### Integration Tests Only
```bash
npm test -- tests/integration
```

### API Tests Only
```bash
npm test -- tests/api
```

### Specific Test File
```bash
npm test -- tests/unit/config.test.js
```

### With Coverage Report
```bash
npm test -- --coverage
```

### In Watch Mode
```bash
npm test -- --watch
```

## Mock Service Features

### Mock Eufy Service
- ✅ Simulates door lock/unlock with realistic delays
- ✅ Tracks battery level and device status
- ✅ Provides door status monitoring
- ✅ Logs all operations for verification

### Mock Google Calendar
- ✅ Generates test events automatically
- ✅ Simulates valid booking appointments
- ✅ Includes both valid and invalid events for testing
- ✅ Prevents duplicate event processing

### Mock Email Service
- ✅ Tracks all sent emails for verification
- ✅ Generates realistic email templates
- ✅ Provides email statistics for testing
- ✅ No external SMTP dependencies

## Test Scenarios Covered

### ✅ Configuration Testing
- Environment variable validation
- Default value handling
- Error conditions
- Test mode detection

### ✅ Service Integration
- Mock service initialization
- Cross-service communication
- Error handling and recovery
- Service coordination

### ✅ Automation Flow
- Calendar event processing
- Door automation triggers
- Email notification sending
- Auto-lock scheduling

### ✅ API Endpoints
- Health checks
- System status reporting
- Manual door controls
- Event retrieval
- Error responses

## Verification and Debugging

### Check Test Output
```bash
# Verbose test output
npm test -- --verbose

# Debug mode with detailed logs
DEBUG=* npm test
```

### Verify Mock Services
The tests verify that:
1. Services initialize correctly in test mode
2. Mock mode flags are set properly
3. Operations complete without external dependencies
4. Email tracking works correctly

### Common Test Patterns

#### Service Initialization
```javascript
const automationEngine = new AutomationEngine();
await automationEngine.initialize();

// Verify mock services are used
expect(automationEngine.eufyService).toBeInstanceOf(MockEufyService);
```

#### Event Processing
```javascript
await automationEngine.processUpcomingEvents();
const doorStatus = await eufyService.getDoorStatus();
expect(doorStatus.isLocked).toBe(false);
```

#### Email Verification
```javascript
const sentEmails = emailService.getSentEmails();
expect(sentEmails.length).toBeGreaterThan(0);
expect(sentEmails[0].subject).toContain('Access Confirmed');
```

## Continuous Integration

These tests are designed for CI/CD environments:

```yaml
# GitHub Actions example
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '16'
      - run: npm install
      - run: npm test
        env:
          NODE_ENV: test
```

## Troubleshooting

### Tests Not Running
1. **Check Node version**: Requires Node.js 14+
2. **Install dependencies**: `npm install`
3. **Environment variables**: Ensure `NODE_ENV=test`

### Mock Services Not Loading
1. **Check import paths**: Ensure relative paths are correct
2. **Clear module cache**: Tests use `jest.resetModules()`
3. **Verify file permissions**: Ensure test files are readable

### Timing Issues
1. **Increase timeouts**: Modify Jest configuration
2. **Add delays**: Use `await new Promise(resolve => setTimeout(resolve, 1000))`
3. **Check async/await**: Ensure all promises are properly awaited

### Memory Issues
1. **Clean up services**: Always call `await automationEngine.stop()`
2. **Clear timers**: Mock services handle cleanup automatically
3. **Reset between tests**: Use `beforeEach` and `afterEach` properly

## Next Steps

After successful testing:
1. **Deploy to staging**: Use the same test setup
2. **Add real credentials**: For production deployment
3. **Monitor logs**: Test mode clearly indicates mock usage
4. **Gradual rollout**: Start with test mode, then enable real services

## Support

If you encounter issues:
1. **Check logs**: All operations are logged
2. **Verify environment**: Use `npm test -- --verbose`
3. **Review documentation**: See tests/README.md
4. **Run individual tests**: Isolate specific failures

The test suite is designed to be completely self-contained and should work in any environment without external dependencies. 