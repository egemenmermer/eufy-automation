const cron = require('node-cron');
const moment = require('moment');
const logger = require('../utils/logger');
const { config } = require('../config');
const GoogleCalendarService = require('./googleCalendar');
const EufyService = require('./eufyService');
const EmailService = require('./emailService');

class AutomationEngine {
  constructor() {
    this.calendarService = new GoogleCalendarService();
    this.eufyService = new EufyService();
    this.emailService = new EmailService();
    
    this.isRunning = false;
    this.cronJobs = [];
    this.activeLockTimers = new Map(); // Track active auto-lock timers
    this.lastHealthCheck = null;
  }

  async initialize() {
    try {
      logger.info('Initializing Automation Engine...');
      
      // Initialize all services
      await this.calendarService.initialize();
      await this.eufyService.initialize();
      await this.emailService.initialize();
      
      // Set up scheduled tasks
      this.setupScheduledTasks();
      
      this.isRunning = true;
      logger.info('Automation Engine initialized successfully');
      
      return true;
    } catch (error) {
      logger.error('Failed to initialize Automation Engine', { error: error.message });
      
      // Send error notification
      try {
        await this.emailService.sendErrorNotification(error, { 
          context: 'Automation Engine Initialization' 
        });
      } catch (emailError) {
        logger.error('Failed to send error notification', { error: emailError.message });
      }
      
      throw error;
    }
  }

  setupScheduledTasks() {
    // Main calendar polling task - runs every minute
    const calendarCronPattern = `*/${config.system.calendarPollIntervalSeconds} * * * * *`;
    const calendarJob = cron.schedule(calendarCronPattern, () => {
      this.processUpcomingEvents();
    }, {
      scheduled: false
    });

    // Cleanup task - runs every hour
    const cleanupJob = cron.schedule('0 * * * *', () => {
      this.performCleanupTasks();
    }, {
      scheduled: false
    });

    // Health check task - runs every 5 minutes
    const healthCheckJob = cron.schedule('*/5 * * * *', () => {
      this.performHealthCheck();
    }, {
      scheduled: false
    });

    this.cronJobs = [calendarJob, cleanupJob, healthCheckJob];
    
    logger.info('Scheduled tasks configured', {
      calendarPollInterval: `${config.system.calendarPollIntervalSeconds} seconds`,
      tasksCount: this.cronJobs.length
    });
  }

  start() {
    if (this.isRunning) {
      logger.warn('Automation Engine is already running');
      return;
    }

    // Start all scheduled tasks
    this.cronJobs.forEach(job => job.start());
    this.isRunning = true;
    
    logger.info('Automation Engine started successfully');
  }

  stop() {
    if (!this.isRunning) {
      logger.warn('Automation Engine is not running');
      return;
    }

    // Stop all scheduled tasks
    this.cronJobs.forEach(job => job.stop());
    
    // Clear any active lock timers
    this.activeLockTimers.forEach((timer, eventId) => {
      clearTimeout(timer);
      logger.info(`Cleared auto-lock timer for event ${eventId}`);
    });
    this.activeLockTimers.clear();
    
    this.isRunning = false;
    logger.info('Automation Engine stopped');
  }

  async processUpcomingEvents() {
    try {
      // Get events starting soon (within 2 minutes)
      const upcomingEvents = await this.calendarService.getEventsStartingSoon(2);
      
      for (const event of upcomingEvents) {
        if (this.calendarService.isValidBookingEvent(event)) {
          await this.handleBookingEvent(event);
        } else {
          logger.calendar('Skipping non-booking event', {
            title: event.title,
            startTime: event.startTime,
            reason: 'Not a valid booking event'
          });
        }
      }
    } catch (error) {
      logger.error('Error processing upcoming events', { error: error.message });
      
      // Send error notification for critical failures
      try {
        await this.emailService.sendErrorNotification(error, {
          context: 'Processing Upcoming Events',
          timestamp: new Date().toISOString()
        });
      } catch (emailError) {
        logger.error('Failed to send error notification', { error: emailError.message });
      }
    }
  }

  async handleBookingEvent(event) {
    try {
      logger.info('Processing booking event', {
        title: event.title,
        attendeeEmail: event.attendeeEmail,
        startTime: event.startTime,
        endTime: event.endTime
      });

      // Step 1: Unlock the door
      await this.unlockDoor(event);
      
      // Step 2: Send confirmation email
      await this.sendAccessConfirmation(event);
      
      // Step 3: Schedule auto-lock (if configured)
      this.scheduleAutoLock(event);
      
      logger.info('Booking event processed successfully', {
        eventId: event.id,
        title: event.title,
        attendeeEmail: event.attendeeEmail
      });

    } catch (error) {
      logger.error('Error handling booking event', { 
        error: error.message,
        eventId: event.id,
        title: event.title,
        attendeeEmail: event.attendeeEmail
      });
      
      // Send error notification with event context
      try {
        await this.emailService.sendErrorNotification(error, {
          context: 'Handling Booking Event',
          event: {
            id: event.id,
            title: event.title,
            attendeeEmail: event.attendeeEmail,
            startTime: event.startTime
          }
        });
      } catch (emailError) {
        logger.error('Failed to send error notification', { error: emailError.message });
      }
    }
  }

  async unlockDoor(event) {
    try {
      logger.info('Unlocking door for event', { eventId: event.id, title: event.title });
      
      await this.eufyService.unlockDoor();
      
      logger.info('Door unlocked successfully for event', { 
        eventId: event.id,
        title: event.title,
        attendeeEmail: event.attendeeEmail
      });

    } catch (error) {
      logger.error('Failed to unlock door', { 
        error: error.message,
        eventId: event.id,
        title: event.title
      });
      throw error;
    }
  }

  async sendAccessConfirmation(event) {
    try {
      logger.email('Sending access confirmation', { 
        eventId: event.id,
        attendeeEmail: event.attendeeEmail 
      });
      
      await this.emailService.sendAccessConfirmation(event);
      
      logger.email('Access confirmation sent successfully', { 
        eventId: event.id,
        attendeeEmail: event.attendeeEmail
      });

    } catch (error) {
      logger.error('Failed to send access confirmation', { 
        error: error.message,
        eventId: event.id,
        attendeeEmail: event.attendeeEmail
      });
      
      // Don't throw here - email failure shouldn't prevent door access
      // but we should log it as a warning
      logger.warn('Continuing despite email failure - door access granted');
    }
  }

  scheduleAutoLock(event) {
    if (config.system.lockDurationMinutes <= 0) {
      logger.info('Auto-lock disabled (duration = 0)');
      return;
    }

    const lockDelayMs = config.system.lockDurationMinutes * 60 * 1000;
    const lockTime = moment().add(config.system.lockDurationMinutes, 'minutes');
    
    logger.info('Scheduling auto-lock', {
      eventId: event.id,
      lockInMinutes: config.system.lockDurationMinutes,
      lockTime: lockTime.format('YYYY-MM-DD HH:mm:ss')
    });

    // Clear any existing timer for this event
    if (this.activeLockTimers.has(event.id)) {
      clearTimeout(this.activeLockTimers.get(event.id));
    }

    // Set new timer
    const timer = setTimeout(async () => {
      try {
        logger.info('Executing scheduled auto-lock', { eventId: event.id });
        await this.eufyService.lockDoor();
        
        logger.info('Auto-lock completed successfully', { 
          eventId: event.id,
          title: event.title
        });
        
        // Remove timer from active timers
        this.activeLockTimers.delete(event.id);
        
      } catch (error) {
        logger.error('Auto-lock failed', { 
          error: error.message,
          eventId: event.id,
          title: event.title
        });
        
        // Send error notification for auto-lock failure
        try {
          await this.emailService.sendErrorNotification(error, {
            context: 'Auto-lock Execution',
            event: {
              id: event.id,
              title: event.title,
              scheduledLockTime: lockTime.toISOString()
            }
          });
        } catch (emailError) {
          logger.error('Failed to send auto-lock error notification', { error: emailError.message });
        }
      }
    }, lockDelayMs);

    this.activeLockTimers.set(event.id, timer);
  }

  performCleanupTasks() {
    try {
      logger.info('Performing cleanup tasks...');
      
      // Clean up old processed events
      this.calendarService.cleanupProcessedEvents();
      
      // Clean up expired lock timers (shouldn't happen, but just in case)
      const now = moment();
      this.activeLockTimers.forEach((timer, eventId) => {
        // If timer is older than 2 hours, clear it
        // This is a safety mechanism - normally timers should self-clean
      });
      
      logger.info('Cleanup tasks completed', {
        activeLockTimers: this.activeLockTimers.size
      });
      
    } catch (error) {
      logger.error('Error during cleanup tasks', { error: error.message });
    }
  }

  async performHealthCheck() {
    try {
      const healthStatus = {
        timestamp: new Date().toISOString(),
        isRunning: this.isRunning,
        activeLockTimers: this.activeLockTimers.size,
        services: {}
      };

      // Check Eufy service health
      try {
        const doorStatus = await this.eufyService.getDoorStatus();
        healthStatus.services.eufy = {
          status: doorStatus.available ? 'healthy' : 'unhealthy',
          details: doorStatus
        };
      } catch (error) {
        healthStatus.services.eufy = {
          status: 'error',
          error: error.message
        };
      }

      // Check calendar service (basic check)
      healthStatus.services.calendar = {
        status: this.calendarService.calendar ? 'healthy' : 'unhealthy'
      };

      // Check email service (basic check)
      healthStatus.services.email = {
        status: this.emailService.transporter ? 'healthy' : 'unhealthy'
      };

      this.lastHealthCheck = healthStatus;
      
      logger.info('Health check completed', {
        overallStatus: Object.values(healthStatus.services).every(s => s.status === 'healthy') ? 'healthy' : 'degraded',
        details: healthStatus
      });

    } catch (error) {
      logger.error('Error during health check', { error: error.message });
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      activeLockTimers: this.activeLockTimers.size,
      lastHealthCheck: this.lastHealthCheck,
      uptime: this.isRunning ? moment().diff(moment(), 'seconds') : 0
    };
  }

  async cleanup() {
    try {
      logger.info('Cleaning up Automation Engine...');
      
      this.stop();
      
      // Cleanup services
      await this.eufyService.cleanup();
      
      logger.info('Automation Engine cleanup completed');
    } catch (error) {
      logger.error('Error during Automation Engine cleanup', { error: error.message });
    }
  }
}

module.exports = AutomationEngine; 