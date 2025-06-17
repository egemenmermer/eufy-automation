# 🧪 Testing Guide - Eufy Automation System

This guide provides comprehensive testing instructions to verify all components of the Eufy automation system work correctly.

## 📋 Testing Prerequisites

Before testing, ensure you have:

- [ ] Node.js v16+ installed
- [ ] All dependencies installed (`npm install`)
- [ ] Environment file configured (`.env`)
- [ ] Google Service Account JSON file in place
- [ ] Valid Eufy account credentials
- [ ] Gmail account with App Password

## 🚀 Quick Test Setup

### 1. Initial Setup
```bash
# Clone and setup
git clone <repository-url>
cd eufy-automation
npm install

# Create directories
mkdir -p credentials logs data

# Copy environment template
cp env.example .env

# Edit with your credentials
nano .env
```

### 2. Minimal Configuration for Testing
```env
# Minimum required for testing
EUFY_USERNAME=your_eufy_email@example.com
EUFY_PASSWORD=your_eufy_password
EUFY_DEVICE_SERIAL=your_device_serial

GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./credentials/google-service-account.json
GOOGLE_CALENDAR_ID=your_calendar_id@gmail.com

EMAIL_FROM=your_email@gmail.com
EMAIL_PASSWORD=your_app_password
EMAIL_FROM_NAME=Test System

NODE_ENV=development
ENABLE_API=true
LOG_LEVEL=debug
```

## 🔧 Testing Levels

### Level 1: Configuration & Dependencies Testing

#### Test 1.1: Configuration Validation
```bash
# Test configuration loading
node -e "
try {
  const { validateConfig } = require('./src/config');
  validateConfig();
  console.log('✅ Configuration is valid');
} catch (error) {
  console.log('❌ Configuration error:', error.message);
}
"
```

#### Test 1.2: Dependencies Check
```bash
# Check if all dependencies are installed
npm ls --depth=0

# Test key imports
node -e "
const dependencies = [
  'eufy-security-client',
  'googleapis', 
  'nodemailer',
  'node-cron',
  'winston'
];

dependencies.forEach(dep => {
  try {
    require(dep);
    console.log('✅', dep);
  } catch (e) {
    console.log('❌', dep, e.message);
  }
});
"
```

### Level 2: Individual Service Testing

#### Test 2.1: Logger Service
```bash
# Test logging functionality
node -e "
const logger = require('./src/utils/logger');
logger.info('✅ Logger test - Info level');
logger.warn('⚠️ Logger test - Warning level');
logger.error('❌ Logger test - Error level');
logger.calendar('📅 Logger test - Calendar context');
logger.eufy('🔐 Logger test - Eufy context');
logger.email('📧 Logger test - Email context');
console.log('Check logs/ directory for output files');
"
```

#### Test 2.2: Google Calendar Service
```bash
# Test Google Calendar connection
node -e "
(async () => {
  try {
    const GoogleCalendarService = require('./src/services/googleCalendar');
    const service = new GoogleCalendarService();
    
    console.log('🔄 Testing Google Calendar connection...');
    await service.initialize();
    console.log('✅ Google Calendar service initialized');
    
    console.log('🔄 Testing event fetching...');
    const events = await service.getUpcomingEvents(60);
    console.log(\`✅ Found \${events.length} upcoming events\`);
    
    events.forEach(event => {
      console.log(\`  📅 \${event.title} - \${event.startTime}\`);
    });
    
  } catch (error) {
    console.log('❌ Google Calendar test failed:', error.message);
  }
})();
"
```

#### Test 2.3: Email Service
```bash
# Test email service (sends actual test email)
node -e "
(async () => {
  try {
    const EmailService = require('./src/services/emailService');
    const service = new EmailService();
    
    console.log('🔄 Testing email service initialization...');
    await service.initialize();
    console.log('✅ Email service initialized');
    
    console.log('🔄 Sending test email...');
    const testEvent = {
      title: 'Test Booking',
      startTime: new Date(),
      endTime: new Date(Date.now() + 60*60*1000),
      attendeeEmail: process.env.EMAIL_FROM, // Send to yourself
      location: 'Test Location',
      description: 'This is a test booking'
    };
    
    await service.sendAccessConfirmation(testEvent);
    console.log('✅ Test email sent successfully');
    console.log('📧 Check your inbox for the test email');
    
  } catch (error) {
    console.log('❌ Email test failed:', error.message);
  }
})();
"
```

#### Test 2.4: Eufy Service
```bash
# Test Eufy service connection
node -e "
(async () => {
  try {
    const EufyService = require('./src/services/eufyService');
    const service = new EufyService();
    
    console.log('🔄 Testing Eufy connection...');
    await service.initialize();
    console.log('✅ Eufy service initialized');
    
    console.log('🔄 Getting door status...');
    const status = await service.getDoorStatus();
    console.log('✅ Door status:', JSON.stringify(status, null, 2));
    
    // Uncomment the following lines to test actual door control
    // WARNING: This will actually unlock/lock your door!
    /*
    console.log('🔄 Testing door unlock...');
    await service.unlockDoor();
    console.log('✅ Door unlocked');
    
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
    
    console.log('🔄 Testing door lock...');
    await service.lockDoor();
    console.log('✅ Door locked');
    */
    
  } catch (error) {
    console.log('❌ Eufy test failed:', error.message);
  }
})();
"
```

### Level 3: Integration Testing

#### Test 3.1: Start Full System
```bash
# Start the system in development mode
npm run dev
```

**Expected Output:**
```
🚀 Starting Eufy Automation System...
Configuration validated successfully
[CALENDAR] Google Calendar service initialized successfully
[EUFY] Eufy service initialized successfully
[EMAIL] Email service initialized successfully
✅ Automation Engine started successfully
🌐 API Server started on port 3000
🎉 Eufy Automation System is running!
```

#### Test 3.2: API Endpoints Testing
Open a new terminal and test the API endpoints:

```bash
# Health check
curl http://localhost:3000/health

# Expected: {"status":"ok","timestamp":"...","automation":{...}}

# Detailed status
curl http://localhost:3000/status | jq

# View upcoming calendar events
curl "http://localhost:3000/events/upcoming?timeWindow=120" | jq

# Test manual door control (CAUTION: Actually controls door!)
# curl -X POST http://localhost:3000/door/unlock
# curl -X POST http://localhost:3000/door/lock

# System control
curl -X POST http://localhost:3000/system/stop
curl -X POST http://localhost:3000/system/start
```

### Level 4: End-to-End Testing

#### Test 4.1: Create Test Booking
1. **Create a test calendar event:**
   - Open Google Calendar
   - Create event 2-3 minutes in the future
   - Add title: "Test Booking Appointment"
   - Add attendee: your email address
   - Save the event

2. **Monitor system logs:**
   ```bash
   # In another terminal, watch logs
   tail -f logs/automation.log
   ```

3. **Expected behavior:**
   - System detects the event
   - Door unlocks at scheduled time
   - Confirmation email is sent
   - Auto-lock timer is set

#### Test 4.2: Test WordPress + Amelia Flow
If you have Amelia set up:

1. **Create booking via WordPress:**
   - Visit your booking page
   - Create appointment 2-3 minutes in future
   - Complete booking process

2. **Verify calendar sync:**
   - Check Google Calendar for new event
   - Ensure attendee email is included

3. **Monitor automation:**
   - Watch system logs
   - Verify door unlock occurs
   - Check email delivery

## 🐛 Debugging & Troubleshooting

### Enable Debug Mode
```bash
# Set debug logging
LOG_LEVEL=debug npm run dev

# Or with environment variable
DEBUG=* LOG_LEVEL=debug npm run dev
```

### Common Test Issues & Solutions

#### Issue: "Google Calendar API not enabled"
```bash
# Solution: Check Google Cloud Console
# 1. Go to APIs & Services > Library
# 2. Search "Google Calendar API"
# 3. Click and enable it
```

#### Issue: "Service account key file not found"
```bash
# Verify file exists and has correct permissions
ls -la ./credentials/google-service-account.json
chmod 600 ./credentials/google-service-account.json
```

#### Issue: "Eufy device not found"
```bash
# List all devices to find correct serial
node -e "
(async () => {
  const EufyService = require('./src/services/eufyService');
  const service = new EufyService();
  await service.initialize();
  // This will log all discovered devices
})();
"
```

#### Issue: "Gmail authentication failed"
```bash
# Verify App Password setup
# 1. Ensure 2FA is enabled on Gmail
# 2. Generate new App Password
# 3. Use the 16-character password (spaces removed)
```

#### Issue: "Events not being processed"
```bash
# Check event validation
node -e "
const GoogleCalendarService = require('./src/services/googleCalendar');
const service = new GoogleCalendarService();

// Mock event for testing validation
const testEvent = {
  title: 'Test Booking',
  attendeeEmail: 'test@example.com',
  isAllDay: false,
  description: 'Test booking appointment'
};

console.log('Is valid booking:', service.isValidBookingEvent(testEvent));
"
```

## 🚦 Test Checklist

Before deploying to production, ensure all tests pass:

### Configuration Tests
- [ ] Environment variables loaded correctly
- [ ] Google Service Account file accessible
- [ ] All required dependencies installed

### Service Tests
- [ ] Google Calendar connection successful
- [ ] Eufy device discovered and accessible
- [ ] Email service can send messages
- [ ] Logger creates log files properly

### Integration Tests
- [ ] System starts without errors
- [ ] API endpoints respond correctly
- [ ] Health checks pass
- [ ] Manual door control works

### End-to-End Tests
- [ ] Calendar events detected
- [ ] Door unlocks at correct time
- [ ] Emails sent successfully
- [ ] Auto-lock functions properly

## 📊 Performance Testing

### Load Testing Calendar Polling
```bash
# Test rapid calendar polling
node -e "
(async () => {
  const GoogleCalendarService = require('./src/services/googleCalendar');
  const service = new GoogleCalendarService();
  await service.initialize();
  
  console.log('🔄 Testing calendar polling performance...');
  const start = Date.now();
  
  for (let i = 0; i < 10; i++) {
    await service.getUpcomingEvents(60);
    console.log(\`Poll \${i + 1} completed\`);
  }
  
  const duration = Date.now() - start;
  console.log(\`✅ 10 polls completed in \${duration}ms\`);
  console.log(\`📊 Average: \${duration/10}ms per poll\`);
})();
"
```

### Memory Usage Monitoring
```bash
# Monitor memory usage during operation
node --inspect src/index.js

# Or use process monitoring
top -p $(pgrep -f "node.*src/index.js")
```

## 🔧 Test Automation

### Create Test Script
```bash
# Create automated test runner
cat > test-runner.sh << 'EOF'
#!/bin/bash
echo "🧪 Running Eufy Automation Tests..."

# Configuration test
echo "1. Testing configuration..."
node -e "require('./src/config').validateConfig(); console.log('✅ Config OK')" || exit 1

# Service tests
echo "2. Testing Google Calendar..."
timeout 30 node -e "
(async () => {
  const service = new (require('./src/services/googleCalendar'))();
  await service.initialize();
  console.log('✅ Calendar OK');
})();
" || echo "⚠️ Calendar test timeout"

echo "3. Testing email service..."
timeout 15 node -e "
(async () => {
  const service = new (require('./src/services/emailService'))();
  await service.initialize();
  console.log('✅ Email OK');
})();
" || echo "⚠️ Email test timeout"

echo "🎉 All tests completed!"
EOF

chmod +x test-runner.sh
./test-runner.sh
```

## 📋 Production Testing Checklist

Before going live:

- [ ] All services initialize without errors
- [ ] Calendar events are processed correctly
- [ ] Door control works reliably
- [ ] Email notifications are delivered
- [ ] Error handling works properly
- [ ] Logs are being written correctly
- [ ] Health checks are functional
- [ ] Auto-lock timers work accurately
- [ ] System recovers from network interruptions
- [ ] Memory usage is stable over time

---

**🎯 Remember: Start with configuration tests, then individual services, then integration, and finally end-to-end testing. This approach helps isolate issues quickly!** 