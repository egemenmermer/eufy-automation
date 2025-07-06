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

// Use fake timers to control setTimeout
jest.useFakeTimers();

const MockEufyService = require('../mocks/eufyService');
const MockAmeliaService = require('../mocks/ameliaService');
const MockEmailService = require('../mocks/emailService');

describe('Automation Engine Integration Tests', () => {
  let automationEngine;
  
  beforeEach(async () => {
    // Force test environment
    process.env.NODE_ENV = 'test';
    
    // Reset modules to ensure clean config
    jest.resetModules();
    
    const AutomationEngine = require('../../src/services/automationEngine');
    automationEngine = new AutomationEngine();
    await automationEngine.initialize();
  });

  afterEach(async () => {
    if (automationEngine) {
      await automationEngine.stop();
    }
  });

  test('should initialize with mock services in test mode', async () => {
    expect(automationEngine.ameliaService.constructor.name).toBe('MockAmeliaService');
    expect(automationEngine.eufyService.constructor.name).toBe('MockEufyService');
    expect(automationEngine.emailService.constructor.name).toBe('MockEmailService');
    expect(automationEngine.isInitialized).toBe(true);
  });

  test('should process upcoming appointments and trigger automation', async () => {
    await automationEngine.initialize();
    
    // Process automation cycle
    await automationEngine.processUpcomingAppointments();
    
    // Check that services were called
    const ameliaService = automationEngine.ameliaService;
    const eufyService = automationEngine.eufyService;
    const emailService = automationEngine.emailService;
    
    expect(ameliaService.isConnected).toBe(true);
    expect(eufyService.isConnected).toBe(true);
    expect(emailService.transporter).toBeDefined();
    
    // Verify door was unlocked
    const doorStatus = await eufyService.getDoorStatus();
    expect(doorStatus.isLocked).toBe(false);
    
    // Verify email was sent
    const sentEmails = emailService.getSentEmails();
    expect(sentEmails.length).toBeGreaterThan(0);
    expect(sentEmails[0].to).toBe('test@example.com');
    expect(sentEmails[0].subject).toContain('Your Door Code for');
  });

  test('should unlock door for valid booking appointments', async () => {
    await automationEngine.initialize();
    
    const ameliaService = automationEngine.ameliaService;
    const eufyService = automationEngine.eufyService;
    const emailService = automationEngine.emailService;
    
    // Create a test appointment that starts soon
    const testAppointment = {
      id: 'test-unlock-appointment',
      service: { name: 'Test Service' },
      bookingStart: moment().add(1, 'minute').toISOString(),
      bookingEnd: moment().add(61, 'minutes').toISOString(),
      customer: { email: 'test@example.com' },
      status: 'approved'
    };

    // Mock the amelia service to return this appointment
    ameliaService.getAppointmentsStartingSoon = jest.fn().mockResolvedValue([testAppointment]);
    
    // Process the appointment
    await automationEngine.processUpcomingAppointments();
    
    // Verify door was unlocked
    const doorStatus = await eufyService.getDoorStatus();
    expect(doorStatus.isLocked).toBe(false);
    
    // Verify email was sent
    const sentEmails = emailService.getSentEmails();
    expect(sentEmails.length).toBeGreaterThan(0);
    expect(sentEmails[0].to).toBe('test@example.com');
    expect(sentEmails[0].subject).toContain('Your Door Code for');
  });

  test('should ignore invalid appointments', async () => {
    await automationEngine.initialize();
    
    const ameliaService = automationEngine.ameliaService;
    const eufyService = automationEngine.eufyService;
    const emailService = automationEngine.emailService;
    
    // Create an invalid appointment (e.g., status is 'cancelled')
    const invalidAppointment = {
      id: 'invalid-appointment',
      service: { name: 'Cancelled Service' },
      bookingStart: moment().add(1, 'minute').toISOString(),
      bookingEnd: moment().add(61, 'minutes').toISOString(),
      customer: { email: 'test@example.com' },
      status: 'canceled'
    };

    ameliaService.getAppointmentsStartingSoon = jest.fn().mockResolvedValue([invalidAppointment]);
    
    await automationEngine.processUpcomingAppointments();
    
    // Door should remain locked
    const doorStatus = await eufyService.getDoorStatus();
    expect(doorStatus.isLocked).toBe(true);
    
    // No emails should be sent
    const sentEmails = emailService.getSentEmails();
    expect(sentEmails.length).toBe(0);
  });

  test('should handle automatic re-locking', async () => {
    const eufyService = automationEngine.eufyService;
    
    // Unlock the door
    await eufyService.unlockDoor();
    expect((await eufyService.getDoorStatus()).isLocked).toBe(false);
    
    // Trigger re-lock based on an appointment
    const appointment = { 
      id: 'relock-test', 
      service: { name: 'Test', duration: 60 },
      bookingEnd: moment().add(1, 'minute').toISOString()
    };
    automationEngine.scheduleAutoLock(appointment);
    
    // Fast-forward time past the appointment end and buffer
    jest.advanceTimersByTime(10 * 60 * 1000); // 10 minutes
    
    // Check if door is locked again
    const doorStatus = await eufyService.getDoorStatus();
    expect(doorStatus.isLocked).toBe(true);
  });

  test('should get system status correctly', async () => {
    await automationEngine.initialize();
    
    const status = await automationEngine.getSystemStatus();
    
    expect(status.engine.isRunning).toBe(true);
    expect(status.services.amelia).toContain('connected');
    expect(status.services.eufy.available).toBe(true);
    expect(status.services.email).toContain('connected');
    
    // But unlock should only have been called once due to internal tracking
    const eufyService = automationEngine.eufyService;
    expect(eufyService.unlockDoor).toHaveBeenCalledTimes(1);
  });

  test('should handle errors gracefully', async () => {
    await automationEngine.initialize();
    
    const ameliaService = automationEngine.ameliaService;
    const emailService = automationEngine.emailService;
    
    // Mock amelia service to throw error
    ameliaService.getAppointmentsStartingSoon = jest.fn().mockRejectedValue(new Error('Test amelia error'));
    
    // Process should not crash
    await expect(automationEngine.processUpcomingAppointments()).resolves.not.toThrow();
    
    // Error email should be sent
    const sentEmails = emailService.getSentEmails();
    const errorEmails = sentEmails.filter(email => email.subject.includes('Automation Engine Error'));
    expect(errorEmails.length).toBeGreaterThan(0);
  });

  test('should track processed appointments to avoid duplicates', async () => {
    await automationEngine.initialize();
    
    const ameliaService = automationEngine.ameliaService;
    
    const testAppointment = {
      id: 'duplicate-test-appointment',
      service: { name: 'Test Service' },
      bookingStart: moment().add(1, 'minute').toISOString(),
      bookingEnd: moment().add(61, 'minutes').toISOString(),
      customer: { email: 'test@example.com' },
      status: 'approved'
    };

    // Mock amelia to return same appointment multiple times
    ameliaService.getAppointmentsStartingSoon = jest.fn().mockResolvedValue([testAppointment]);
    
    // Process multiple times
    await automationEngine.processUpcomingAppointments();
    await automationEngine.processUpcomingAppointments();
    await automationEngine.processUpcomingAppointments();
    
    // Check that the mock was called multiple times
    expect(ameliaService.getAppointmentsStartingSoon).toHaveBeenCalledTimes(3);
    
    // But unlock should only have been called once due to internal tracking
    const eufyService = automationEngine.eufyService;
    // This relies on the mock implementation having call tracking.
    // Let's assume the mock's `unlockDoor` is a jest.fn()
    expect(eufyService.unlockDoor).toHaveBeenCalledTimes(1);
  });

  test('should cleanup properly on stop', async () => {
    await automationEngine.initialize();
    await automationEngine.stop();
    
    expect(automationEngine.isRunning).toBe(false);
    expect(automationEngine.isInitialized).toBe(false);
  });
}); 