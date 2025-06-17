const express = require('express');
const { validateConfig, config } = require('./config');
const logger = require('./utils/logger');
const AutomationEngine = require('./services/automationEngine');

// Graceful shutdown handling
process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
});

let automationEngine = null;
let server = null;

async function main() {
  try {
    logger.info('🚀 Starting Eufy Automation System...');
    
    // Validate configuration
    validateConfig();
    logger.info('Configuration validated successfully');
    
    // Initialize automation engine
    automationEngine = new AutomationEngine();
    await automationEngine.initialize();
    
    // Start the automation engine
    automationEngine.start();
    logger.info('✅ Automation Engine started successfully');
    
    // Optionally start API server for monitoring/control
    if (config.system.nodeEnv === 'development' || process.env.ENABLE_API === 'true') {
      await startApiServer();
    }
    
    logger.info('🎉 Eufy Automation System is running!');
    logger.info('System Details:', {
      nodeEnv: config.system.nodeEnv,
      calendarPollInterval: `${config.system.calendarPollIntervalSeconds} seconds`,
      lockDuration: `${config.system.lockDurationMinutes} minutes`,
      timezone: config.system.timezone
    });
    
  } catch (error) {
    logger.error('Failed to start Eufy Automation System', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

async function startApiServer() {
  const app = express();
  
  // Middleware
  app.use(express.json());
  
  // Health check endpoint
  app.get('/health', (req, res) => {
    const status = automationEngine ? automationEngine.getStatus() : { isRunning: false };
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      automation: status
    });
  });
  
  // Status endpoint with detailed information
  app.get('/status', async (req, res) => {
    try {
      if (!automationEngine) {
        return res.status(503).json({ error: 'Automation engine not initialized' });
      }
      
      const status = automationEngine.getStatus();
      const eufyStatus = await automationEngine.eufyService.getDoorStatus();
      
      res.json({
        system: {
          isRunning: status.isRunning,
          uptime: status.uptime,
          activeLockTimers: status.activeLockTimers,
          lastHealthCheck: status.lastHealthCheck
        },
        door: eufyStatus,
        config: {
          lockDurationMinutes: config.system.lockDurationMinutes,
          calendarPollIntervalSeconds: config.system.calendarPollIntervalSeconds,
          timezone: config.system.timezone
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error getting status', { error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Manual door control endpoints (for testing/emergency)
  app.post('/door/unlock', async (req, res) => {
    try {
      if (!automationEngine) {
        return res.status(503).json({ error: 'Automation engine not initialized' });
      }
      
      await automationEngine.eufyService.unlockDoor();
      logger.security('Manual door unlock via API', { 
        timestamp: new Date().toISOString(),
        source: 'api'
      });
      
      res.json({ success: true, message: 'Door unlocked successfully' });
    } catch (error) {
      logger.error('Manual unlock failed', { error: error.message });
      res.status(500).json({ error: 'Failed to unlock door' });
    }
  });
  
  app.post('/door/lock', async (req, res) => {
    try {
      if (!automationEngine) {
        return res.status(503).json({ error: 'Automation engine not initialized' });
      }
      
      await automationEngine.eufyService.lockDoor();
      logger.security('Manual door lock via API', { 
        timestamp: new Date().toISOString(),
        source: 'api'
      });
      
      res.json({ success: true, message: 'Door locked successfully' });
    } catch (error) {
      logger.error('Manual lock failed', { error: error.message });
      res.status(500).json({ error: 'Failed to lock door' });
    }
  });
  
  // Get upcoming events endpoint
  app.get('/events/upcoming', async (req, res) => {
    try {
      if (!automationEngine) {
        return res.status(503).json({ error: 'Automation engine not initialized' });
      }
      
      const timeWindow = parseInt(req.query.timeWindow) || 60; // Default 60 minutes
      const events = await automationEngine.calendarService.getUpcomingEvents(timeWindow);
      
      res.json({
        events: events.map(event => ({
          id: event.id,
          title: event.title,
          startTime: event.startTime,
          endTime: event.endTime,
          attendeeEmail: event.attendeeEmail,
          location: event.location,
          isValidBooking: automationEngine.calendarService.isValidBookingEvent(event)
        })),
        timeWindow: timeWindow,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error getting upcoming events', { error: error.message });
      res.status(500).json({ error: 'Failed to get upcoming events' });
    }
  });
  
  // System control endpoints
  app.post('/system/stop', (req, res) => {
    try {
      if (automationEngine && automationEngine.isRunning) {
        automationEngine.stop();
        res.json({ success: true, message: 'Automation engine stopped' });
      } else {
        res.json({ success: false, message: 'Automation engine not running' });
      }
    } catch (error) {
      logger.error('Error stopping automation engine', { error: error.message });
      res.status(500).json({ error: 'Failed to stop automation engine' });
    }
  });
  
  app.post('/system/start', (req, res) => {
    try {
      if (automationEngine && !automationEngine.isRunning) {
        automationEngine.start();
        res.json({ success: true, message: 'Automation engine started' });
      } else {
        res.json({ success: false, message: 'Automation engine already running or not initialized' });
      }
    } catch (error) {
      logger.error('Error starting automation engine', { error: error.message });
      res.status(500).json({ error: 'Failed to start automation engine' });
    }
  });
  
  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
  });
  
  // Start server
  server = app.listen(config.system.port, () => {
    logger.info(`🌐 API Server started on port ${config.system.port}`);
    logger.info('Available endpoints:');
    logger.info('  GET  /health - Health check');
    logger.info('  GET  /status - Detailed system status');
    logger.info('  GET  /events/upcoming - Get upcoming calendar events');
    logger.info('  POST /door/unlock - Manual door unlock');
    logger.info('  POST /door/lock - Manual door lock');
    logger.info('  POST /system/start - Start automation engine');
    logger.info('  POST /system/stop - Stop automation engine');
  });
}

async function handleShutdown(signal) {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  
  // Stop API server
  if (server) {
    await new Promise((resolve) => {
      server.close(resolve);
    });
    logger.info('API server stopped');
  }
  
  // Stop automation engine
  if (automationEngine) {
    await automationEngine.cleanup();
    logger.info('Automation engine stopped');
  }
  
  logger.info('🛑 Eufy Automation System shutdown complete');
  process.exit(0);
}

// Start the application
main().catch((error) => {
  logger.error('Fatal error during startup', { error: error.message, stack: error.stack });
  process.exit(1);
}); 