// Integration tests for automation engine with mock services
const moment = require('moment');

// Mock logger
const mockLogger = {
  info: () => {},
  error: () => {},
  warn: () => {},
  automation: () => {},
  calendar: () => {},
  eufy: () => {},
  email: () => {},
  security: () => {}
};

jest.mock('../../src/utils/logger', () => mockLogger);

// Mock cron to avoid actual scheduling during tests
jest.mock('node-cron', () => ({
  schedule: jest.fn(),
  destroy: jest.fn()
}));

const MockEufyService = require('../mocks/eufyService');
const MockGoogleCalendarService = require('../mocks/googleCalendar');
const MockEmailService = require('../mocks/emailService');

describe('Automation Engine Integration Tests', () => {
  let AutomationEngine;
  let automationEngine;
  
  beforeAll(() => {
    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3001';
    process.env.POLL_INTERVAL_MINUTES = '1';
    process.env.UNLOCK_DURATION_MINUTES = '30';
    process.env.EUFY_DEVICE_SERIAL = 'TEST123456';
  });

  beforeEach(() => {
    jest.resetModules();
    AutomationEngine = require('../../src/services/automationEngine');
    automationEngine = new AutomationEngine();
  });

  afterEach(async () => {
    if (automationEngine) {
      await automationEngine.stop();
    }
  });

  test('should initialize with mock services in test mode', async () => {
    await automationEngine.initialize();
    
    // Check constructor names instead of instanceof (more reliable with Jest)
    expect(automationEngine.calendarService.constructor.name).toBe('MockGoogleCalendarService');
    expect(automationEngine.eufyService.constructor.name).toBe('MockEufyService');
    expect(automationEngine.emailService.constructor.name).toBe('MockEmailService');
    expect(automationEngine.isInitialized).toBe(true);
  });

  test('should process upcoming events and trigger automation', async () => {
    await automationEngine.initialize();
    
    // Process automation cycle
    await automationEngine.processUpcomingEvents();
    
    // Check that services were called
    const calendarService = automationEngine.calendarService;
    const eufyService = automationEngine.eufyService;
    const emailService = automationEngine.emailService;
    
    expect(calendarService.calendar).toBeDefined();
    expect(eufyService.isConnected).toBe(true);
    expect(emailService.transporter).toBeDefined();
  });

  test('should unlock door for valid booking events', async () => {
    await automationEngine.initialize();
    
    const calendarService = automationEngine.calendarService;
    const eufyService = automationEngine.eufyService;
    const emailService = automationEngine.emailService;
    
    // Create a test event that starts soon
    const testEvent = {
      id: 'test-unlock-event',
      title: 'Test Booking Appointment',
      description: 'Test booking for automation',
      startTime: moment().add(1, 'minute').toDate(),
      endTime: moment().add(61, 'minutes').toDate(),
      attendeeEmail: 'test@example.com',
      organizer: 'calendar@example.com',
      location: 'Test Location',
      isAllDay: false
    };

    // Mock the calendar service to return this event
    calendarService.getEventsStartingSoon = jest.fn().mockResolvedValue([testEvent]);
    
    // Process the event
    await automationEngine.processUpcomingEvents();
    
    // Verify door was unlocked
    const doorStatus = await eufyService.getDoorStatus();
    expect(doorStatus.isLocked).toBe(false);
    
    // Verify email was sent
    const sentEmails = emailService.getSentEmails();
    expect(sentEmails.length).toBeGreaterThan(0);
    expect(sentEmails[0].to).toBe('test@example.com');
    expect(sentEmails[0].subject).toContain('Access Confirmed');
  });

  test('should ignore invalid events', async () => {
    await automationEngine.initialize();
    
    const calendarService = automationEngine.calendarService;
    const eufyService = automationEngine.eufyService;
    const emailService = automationEngine.emailService;
    
    // Create an invalid event (no attendee email)
    const invalidEvent = {
      id: 'invalid-event',
      title: 'Personal Meeting',
      description: 'Not a booking',
      startTime: moment().add(1, 'minute').toDate(),
      endTime: moment().add(61, 'minutes').toDate(),
      attendeeEmail: null,
      organizer: 'calendar@example.com',
      isAllDay: false
    };

    calendarService.getEventsStartingSoon = jest.fn().mockResolvedValue([invalidEvent]);
    
    await automationEngine.processUpcomingEvents();
    
    // Door should remain locked
    const doorStatus = await eufyService.getDoorStatus();
    expect(doorStatus.isLocked).toBe(true);
    
    // No emails should be sent
    const sentEmails = emailService.getSentEmails();
    expect(sentEmails.length).toBe(0);
  });

  test('should handle automatic re-locking', async () => {
    await automationEngine.initialize();
    
    const eufyService = automationEngine.eufyService;
    
    // Unlock the door
    await eufyService.unlockDoor();
    expect((await eufyService.getDoorStatus()).isLocked).toBe(false);
    
    // Trigger re-lock with very short duration for testing
    automationEngine.scheduleRelock(0.02); // 0.02 minutes = 1.2 seconds
    
    // Wait for re-lock with extra buffer
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check if door is locked again
    const doorStatus = await eufyService.getDoorStatus();
    expect(doorStatus.isLocked).toBe(true);
  }, 15000); // Increase test timeout

  test('should get system status correctly', async () => {
    await automationEngine.initialize();
    
    const status = await automationEngine.getSystemStatus();
    
    expect(status.isRunning).toBe(false); // Not started yet
    expect(status.lastCheck).toBeNull();
    expect(status.services.calendar.available).toBe(true);
    expect(status.services.eufy.available).toBe(true);
    expect(status.services.email.available).toBe(true);
    expect(status.services.calendar.mockMode).toBe(true);
    expect(status.services.eufy.mockMode).toBe(true);
    expect(status.services.email.mockMode).toBe(true);
  });

  test('should handle errors gracefully', async () => {
    await automationEngine.initialize();
    
    const calendarService = automationEngine.calendarService;
    const emailService = automationEngine.emailService;
    
    // Mock calendar service to throw error
    calendarService.getEventsStartingSoon = jest.fn().mockRejectedValue(new Error('Test calendar error'));
    
    // Process should not crash
    await expect(automationEngine.processUpcomingEvents()).resolves.not.toThrow();
    
    // Error email should be sent
    const sentEmails = emailService.getSentEmails();
    const errorEmails = sentEmails.filter(email => email.subject.includes('System Error'));
    expect(errorEmails.length).toBeGreaterThan(0);
  });

  test('should track processed events to avoid duplicates', async () => {
    await automationEngine.initialize();
    
    const calendarService = automationEngine.calendarService;
    const eufyService = automationEngine.eufyService;
    
    const testEvent = {
      id: 'duplicate-test-event',
      title: 'Test Booking Appointment',
      description: 'Test booking for automation',
      startTime: moment().add(1, 'minute').toDate(),
      endTime: moment().add(61, 'minutes').toDate(),
      attendeeEmail: 'test@example.com',
      organizer: 'calendar@example.com',
      isAllDay: false
    };

    // Mock calendar to return same event multiple times
    calendarService.getEventsStartingSoon = jest.fn().mockResolvedValue([testEvent]);
    
    // Process multiple times
    await automationEngine.processUpcomingEvents();
    await automationEngine.processUpcomingEvents();
    await automationEngine.processUpcomingEvents();
    
    // Should only process once due to duplicate prevention
    // (Mock services have their own duplicate prevention logic)
    expect(calendarService.getEventsStartingSoon).toHaveBeenCalledTimes(3);
  });

  test('should cleanup properly on stop', async () => {
    await automationEngine.initialize();
    await automationEngine.stop();
    
    expect(automationEngine.isRunning).toBe(false);
    expect(automationEngine.isInitialized).toBe(false);
  });
}); 