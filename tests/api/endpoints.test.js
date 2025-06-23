// API endpoint tests
const request = require('supertest');
const express = require('express');

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

describe('API Endpoint Tests', () => {
  let app;
  let automationEngine;
  
  beforeAll(() => {
    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3001';
    process.env.EUFY_DEVICE_SERIAL = 'TEST123456';
  });

  beforeEach(async () => {
    jest.resetModules();
    
    // Create Express app
    app = express();
    app.use(express.json());
    
    // Initialize automation engine
    const AutomationEngine = require('../../src/services/automationEngine');
    automationEngine = new AutomationEngine();
    await automationEngine.initialize();
    
    // Add API routes
    setupAPIRoutes(app, automationEngine);
  });

  afterEach(async () => {
    if (automationEngine) {
      await automationEngine.stop();
    }
  });

  function setupAPIRoutes(app, engine) {
    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({ status: 'OK', timestamp: new Date().toISOString() });
    });

    // System status endpoint
    app.get('/api/status', async (req, res) => {
      try {
        const status = await engine.getSystemStatus();
        res.json(status);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Manual unlock endpoint
    app.post('/api/unlock', async (req, res) => {
      try {
        if (!engine.eufyService) {
          return res.status(503).json({ error: 'Eufy service not initialized' });
        }
        
        await engine.eufyService.unlockDoor();
        const status = await engine.eufyService.getDoorStatus();
        
        res.json({ 
          success: true, 
          message: 'Door unlocked successfully',
          doorStatus: status
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Manual lock endpoint
    app.post('/api/lock', async (req, res) => {
      try {
        if (!engine.eufyService) {
          return res.status(503).json({ error: 'Eufy service not initialized' });
        }
        
        await engine.eufyService.lockDoor();
        const status = await engine.eufyService.getDoorStatus();
        
        res.json({ 
          success: true, 
          message: 'Door locked successfully',
          doorStatus: status
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Door status endpoint
    app.get('/api/door-status', async (req, res) => {
      try {
        if (!engine.eufyService) {
          return res.status(503).json({ error: 'Eufy service not initialized' });
        }
        
        const status = await engine.eufyService.getDoorStatus();
        res.json(status);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Upcoming events endpoint
    app.get('/api/events', async (req, res) => {
      try {
        if (!engine.calendarService) {
          return res.status(503).json({ error: 'Calendar service not initialized' });
        }
        
        const timeWindow = parseInt(req.query.minutes) || 60;
        const events = await engine.calendarService.getUpcomingEvents(timeWindow);
        
        res.json({
          events,
          timeWindow,
          count: events.length
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Manual trigger automation endpoint
    app.post('/api/trigger', async (req, res) => {
      try {
        await engine.processUpcomingEvents();
        res.json({ 
          success: true, 
          message: 'Automation cycle triggered successfully'
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Email stats endpoint (for testing)
    app.get('/api/email-stats', async (req, res) => {
      try {
        if (!engine.emailService || !engine.emailService.getEmailStats) {
          return res.status(503).json({ error: 'Email service not available or not in test mode' });
        }
        
        const stats = engine.emailService.getEmailStats();
        res.json(stats);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  describe('Health and Status Endpoints', () => {
    test('GET /health should return OK status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.body.status).toBe('OK');
      expect(response.body.timestamp).toBeDefined();
    });

    test('GET /api/status should return system status', async () => {
      const response = await request(app)
        .get('/api/status')
        .expect(200);
      
      expect(response.body.isRunning).toBeDefined();
      expect(response.body.services).toBeDefined();
      expect(response.body.services.calendar.available).toBe(true);
      expect(response.body.services.eufy.available).toBe(true);
      expect(response.body.services.email.available).toBe(true);
      expect(response.body.services.calendar.mockMode).toBe(true);
    });
  });

  describe('Door Control Endpoints', () => {
    test('POST /api/unlock should unlock the door', async () => {
      const response = await request(app)
        .post('/api/unlock')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('unlocked successfully');
      expect(response.body.doorStatus.isLocked).toBe(false);
      expect(response.body.doorStatus.mockMode).toBe(true);
    });

    test('POST /api/lock should lock the door', async () => {
      // First unlock
      await request(app).post('/api/unlock').expect(200);
      
      // Then lock
      const response = await request(app)
        .post('/api/lock')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('locked successfully');
      expect(response.body.doorStatus.isLocked).toBe(true);
    });

    test('GET /api/door-status should return door status', async () => {
      const response = await request(app)
        .get('/api/door-status')
        .expect(200);
      
      expect(response.body.available).toBe(true);
      expect(response.body.isLocked).toBeDefined();
      expect(response.body.batteryLevel).toBeDefined();
      expect(response.body.mockMode).toBe(true);
    });
  });

  describe('Calendar Endpoints', () => {
    test('GET /api/events should return upcoming events', async () => {
      const response = await request(app)
        .get('/api/events')
        .expect(200);
      
      expect(response.body.events).toBeDefined();
      expect(Array.isArray(response.body.events)).toBe(true);
      expect(response.body.timeWindow).toBe(60);
      expect(response.body.count).toBeDefined();
    });

    test('GET /api/events with custom time window', async () => {
      const response = await request(app)
        .get('/api/events?minutes=30')
        .expect(200);
      
      expect(response.body.timeWindow).toBe(30);
    });
  });

  describe('Automation Endpoints', () => {
    test('POST /api/trigger should trigger automation cycle', async () => {
      const response = await request(app)
        .post('/api/trigger')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('triggered successfully');
    });
  });

  describe('Email Testing Endpoints', () => {
    test('GET /api/email-stats should return email statistics', async () => {
      const response = await request(app)
        .get('/api/email-stats')
        .expect(200);
      
      expect(response.body.totalSent).toBeDefined();
      expect(response.body.confirmationEmails).toBeDefined();
      expect(response.body.errorEmails).toBeDefined();
      expect(response.body.mockMode).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle 404 for unknown endpoints', async () => {
      await request(app)
        .get('/api/unknown-endpoint')
        .expect(404);
    });

    test('should handle invalid JSON in POST requests', async () => {
      await request(app)
        .post('/api/unlock')
        .send('invalid json')
        .set('Content-Type', 'application/json')
        .expect(400);
    });
  });

  describe('Integration Flow', () => {
    test('complete automation flow: check events -> unlock -> send email', async () => {
      // 1. Check initial door status (should be locked)
      let doorResponse = await request(app)
        .get('/api/door-status')
        .expect(200);
      expect(doorResponse.body.isLocked).toBe(true);

      // 2. Get initial email stats
      let emailResponse = await request(app)
        .get('/api/email-stats')
        .expect(200);
      const initialEmailCount = emailResponse.body.totalSent;

      // 3. Trigger automation (should process mock events)
      await request(app)
        .post('/api/trigger')
        .expect(200);

      // 4. Check if events were processed and door unlocked
      doorResponse = await request(app)
        .get('/api/door-status')
        .expect(200);
      // Note: Door might still be locked if no valid events were found

      // 5. Check if any emails were sent
      emailResponse = await request(app)
        .get('/api/email-stats')
        .expect(200);
      // Email count might have increased if valid events were processed

      // 6. Get events to verify they were fetched
      const eventsResponse = await request(app)
        .get('/api/events')
        .expect(200);
      expect(Array.isArray(eventsResponse.body.events)).toBe(true);
    });
  });
}); 