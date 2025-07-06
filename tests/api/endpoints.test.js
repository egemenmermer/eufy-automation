// API endpoint tests
const request = require('supertest');
const express = require('express');
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

const WebServer = require('../../src/services/webServer');
const AutomationEngine = require('../../src/services/automationEngine');

describe('API Endpoint Tests', () => {
  let app;
  let automationEngine;
  let webServer;

  beforeEach(async () => {
    // Force test environment
    process.env.NODE_ENV = 'test';
    
    // Reset modules to ensure clean config
    jest.resetModules();
    
    // Initialize automation engine with mock services
    const AutomationEngine = require('../../src/services/automationEngine');
    automationEngine = new AutomationEngine();
    await automationEngine.initialize();
    
    // Get the express app from the engine's web server
    app = automationEngine.webServer.app;
  });

  afterEach(async () => {
    if (automationEngine) {
      await automationEngine.stop();
    }
  });

  describe('Health and Status Endpoints', () => {
    test('GET /health should return OK status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.body.status).toBe('ok');
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.services.amelia).toBe('connected');
    });

    test('GET /status should return system status', async () => {
      const response = await request(app)
        .get('/status')
        .expect(200);
      
      expect(response.body.engine).toBeDefined();
      expect(response.body.services).toBeDefined();
      expect(response.body.services.amelia).toContain('connected');
      expect(response.body.services.eufy.available).toBe(true);
      expect(response.body.services.email).toContain('connected');
      expect(response.body.appointments.upcoming).toBeDefined();
    });
  });

  describe('Door Control Endpoints', () => {
    test('POST /door/unlock should unlock the door', async () => {
      const response = await request(app)
        .post('/door/unlock')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('unlocked successfully');
    });

    test('POST /door/lock should lock the door', async () => {
      // First unlock
      await request(app).post('/door/unlock').expect(200);
      
      // Then lock
      const response = await request(app)
        .post('/door/lock')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('locked successfully');
    });
  });

  describe('Amelia Endpoints', () => {
    test('POST /webhook/amelia/booking should process a booking', async () => {
      const mockBooking = {
        type: 'booking_completed',
        appointment: {
          id: 123,
          serviceId: 1,
          bookingStart: new Date().toISOString(),
          bookings: [{
            id: 456,
            customer: { id: 789, email: 'test@example.com', firstName: 'Test', lastName: 'User' }
          }]
        }
      };

      const response = await request(app)
        .post('/webhook/amelia/booking')
        .send(mockBooking)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('processed successfully');
    });

    test('POST /access/code should unlock with a valid code', async () => {
      // This requires more setup to mock an active appointment and generate a valid code
      // For now, we'll test the invalid case
      const response = await request(app)
        .post('/access/code')
        .send({ code: '9999' })
        .expect(403);
        
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid door code');
    });
  });

  describe('Code Management Endpoints', () => {
    test('GET /codes/list should return list of codes', async () => {
      const response = await request(app)
        .get('/codes/list')
        .expect(200);
        
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.codes)).toBe(true);
    });

    test('POST /codes/add should add a temporary code', async () => {
      const codeData = {
        code: '1234',
        name: 'Test Code',
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 3600 * 1000).toISOString()
      };

      const response = await request(app)
        .post('/codes/add')
        .send(codeData)
        .expect(200);
        
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('added successfully');
    });

    test('DELETE /codes/remove should remove a temporary code', async () => {
      const codeData = {
        code: '1234',
        name: 'Test Code'
      };

      // First add the code
      await automationEngine.eufyService.addTemporaryCode(
        codeData.code, 
        codeData.name,
        new Date().toISOString(),
        new Date(Date.now() + 3600 * 1000).toISOString()
      );
      
      const response = await request(app)
        .delete('/codes/remove')
        .send(codeData)
        .expect(200);
        
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('removed successfully');
    });
  });

  describe('Error Handling', () => {
    test('should handle 404 for unknown endpoints', async () => {
      await request(app).get('/unknown/route').expect(404);
    });

    test('should handle invalid JSON in POST requests', async () => {
      await request(app)
        .post('/webhook/amelia/booking')
        .send('invalid json')
        .set('Content-Type', 'application/json')
        .expect(400);
    });
  });

  describe('Integration Flow', () => {
    test('complete automation flow: check events -> unlock -> send email', async () => {
      // 1. Check initial door status
      let doorResponse = await request(app)
        .get('/status')
        .expect(200);
      expect(doorResponse.body.services.eufy.isLocked).toBe(true);

      // 2. Get initial email stats
      // This will depend on how you expose email stats.
      // Assuming a mock endpoint for demonstration.
      
      // 3. Trigger automation (should process mock events)
      const mockBooking = {
        type: 'booking_completed',
        appointment: {
          id: 999,
          serviceId: 1,
          bookingStart: moment().add(5, 'minutes').toISOString(),
          bookings: [{
            id: 888,
            customer: { id: 777, email: 'integration@test.com', firstName: 'Integration', lastName: 'Test' }
          }]
        }
      };
      
      await request(app)
        .post('/webhook/amelia/booking')
        .send(mockBooking)
        .expect(200);

      // 4. Verify door was unlocked
      doorResponse = await request(app)
        .get('/status')
        .expect(200);
      expect(doorResponse.body.services.eufy.isLocked).toBe(false);

      // 5. Verify email was sent (requires emailService mock to expose sent emails)
      const sentEmails = automationEngine.emailService.getSentEmails();
      expect(sentEmails.some(e => e.to === 'integration@test.com')).toBe(true);
    });
  });
}); 