const cron = require('node-cron');
const moment = require('moment-timezone');
const logger = require('../utils/logger');
const { config, getLockDurationForService } = require('../config');
const AmeliaService = require('./ameliaService');
const EufyService = require('./eufyService');
const MockAmeliaService = require('../../tests/mocks/ameliaService');
const MockEufyService = require('../../tests/mocks/eufyService');
const MockEmailService = require('../../tests/mocks/emailService');
const EmailService = require('./emailService');
const WebServer = require('./webServer');
const doorCodeGenerator = require('../utils/doorCodeGenerator');

class AutomationEngine {
  constructor() {
    const isTest = config.system.nodeEnv === 'test';
    
    // Use mock services if in test mode OR if real credentials are not provided
    const useAmeliaMock = isTest || !config.amelia?.host || !config.amelia?.user || !config.amelia?.password;
    const useEufyMock = isTest || !config.eufy.username || !config.eufy.password;
    const useEmailMock = isTest || !config.email?.host || !config.email?.user;
    
    this.ameliaService = useAmeliaMock ? new MockAmeliaService() : new AmeliaService();
    this.eufyService = useEufyMock ? new MockEufyService() : new EufyService();
    this.emailService = useEmailMock ? new MockEmailService() : new EmailService();
    this.webServer = new WebServer(this);
    
    this.isRunning = false;
    this.isInitialized = false;
    this.cronJobs = [];
    this.activeLockTimers = new Map(); // Track active auto-lock timers
    this.processedAppointments = new Set(); // Track processed appointments to avoid duplicates
    this.lastHealthCheck = null;
  }

  async initialize() {
    try {
      logger.info('Initializing Automation Engine with Amelia integration...');
      
      // Initialize all services in parallel
      await Promise.all([
        this.ameliaService.connect(),
        this.eufyService.initialize(),
        this.emailService.initialize()
      ]);
      
      // Now that services are ready, start the web server
      await this.webServer.start();
      
      // Set up scheduled tasks
      this.setupScheduledTasks();
      
      this.isInitialized = true;
      logger.info('Automation Engine initialized successfully with Amelia integration');
      
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
    // Main Amelia polling task - runs every 30 seconds
    const ameliaCronPattern = `*/${config.system.ameliaPollIntervalSeconds} * * * * *`;
    const ameliaJob = cron.schedule(ameliaCronPattern, () => {
      this.processUpcomingAppointments();
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

    this.cronJobs = [ameliaJob, cleanupJob, healthCheckJob];
    
    logger.info('Scheduled tasks configured for Amelia', {
      ameliaPollInterval: `${config.system.ameliaPollIntervalSeconds} seconds`,
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
    
    logger.info('Automation Engine started successfully with Amelia integration');
  }

  async stop() {
    // Stop all scheduled tasks if they exist
    if (this.cronJobs && this.cronJobs.length > 0) {
      this.cronJobs.forEach(job => {
        if (job && job.stop) {
          job.stop();
        }
      });
    }
    
    // Clear any active lock timers
    if (this.activeLockTimers) {
      this.activeLockTimers.forEach((timer, appointmentId) => {
        clearTimeout(timer);
        logger.info(`Cleared auto-lock timer for appointment ${appointmentId}`);
      });
      this.activeLockTimers.clear();
    }
    
    // Stop web server
    if (this.webServer) {
      await this.webServer.stop();
    }
    
    // Cleanup services
    if (this.ameliaService) {
      await this.ameliaService.disconnect();
    }
    
    if (this.eufyService && this.eufyService.cleanup) {
      await this.eufyService.cleanup();
    }
    
    this.isRunning = false;
    this.isInitialized = false;
    logger.info('Automation Engine stopped');
  }

  async processUpcomingAppointments() {
    try {
      // Get appointments starting soon (within 5 minutes)
      const upcomingAppointments = await this.ameliaService.getAppointmentsStartingSoon(5);
      
      for (const appointment of upcomingAppointments) {
        // Check if we've already processed this appointment
        const appointmentKey = `${appointment.id}_${appointment.startTime.unix()}`;
        
        if (!this.processedAppointments.has(appointmentKey)) {
          await this.handleBookingAppointment(appointment);
          this.processedAppointments.add(appointmentKey);
          
          // Clean up old processed appointments (older than 24 hours)
          this.cleanupProcessedAppointments();
        }
      }
    } catch (error) {
      logger.error('Error processing upcoming appointments', { error: error.message });
      
      // Send error notification for critical failures
      try {
        await this.emailService.sendErrorNotification(error, {
          context: 'Processing Upcoming Appointments',
          timestamp: new Date().toISOString()
        });
      } catch (emailError) {
        logger.error('Failed to send error notification', { error: emailError.message });
      }
    }
  }

  async handleBookingAppointment(appointment) {
    try {
      logger.info('Processing booking appointment for Euphorium', {
        appointmentId: appointment.id,
        service: appointment.service,
        customerName: appointment.customer.fullName,
        customerEmail: appointment.customer.email,
        startTime: appointment.startTimeFormatted,
        endTime: appointment.endTimeFormatted,
        duration: appointment.actualDuration
      });

      // Determine lock duration based on service type and actual appointment duration
      const lockDurationMinutes = this.calculateLockDuration(appointment);
      
      // Step 1: Send Euphorium booking confirmation email with door code
      // Customer will manually use the door code to unlock when they arrive
      await this.sendBookingConfirmation(appointment);
      
      // Step 2: Schedule automatic re-lock after session ends + buffer time
      // This ensures the door locks automatically after the session for security
      this.scheduleAutoLock(appointment);
      
      // Step 3: Add note to appointment in Amelia
      await this.ameliaService.addAppointmentNote(
        appointment.id, 
        `Unique door code generated and sent to customer. Auto-lock scheduled after ${lockDurationMinutes} minutes from session start.`
      );
      
      logger.info('Booking appointment processed successfully', {
        appointmentId: appointment.id,
        service: appointment.service,
        customerEmail: appointment.customer.email,
        lockDuration: lockDurationMinutes,
        workflow: 'Manual unlock with door code, automatic lock'
      });

    } catch (error) {
      logger.error('Error handling booking appointment', {
        appointmentId: appointment?.id,
        error: error.message
      });
      
      // Send error notification
      try {
        await this.emailService.sendErrorNotification(error, {
          context: 'Handling Booking Appointment',
          appointmentId: appointment?.id,
          customerEmail: appointment?.customer?.email
        });
      } catch (emailError) {
        logger.error('Failed to send error notification', { error: emailError.message });
      }
      
      throw error;
    }
  }

  /**
   * Calculate lock duration based on service type and appointment duration
   */
  calculateLockDuration(appointment) {
    // Get base duration from service configuration
    const baseDuration = getLockDurationForService(appointment.service);
    
    // Use actual appointment duration if it's longer than the configured service duration
    const actualDuration = appointment.actualDuration + config.automation.bufferTimeMinutes;
    
    // Use the longer of the two durations
    const lockDuration = Math.max(baseDuration, actualDuration);
    
    logger.info('Calculated lock duration', {
      service: appointment.service,
      baseDuration,
      actualDuration: appointment.actualDuration,
      bufferTime: config.automation.bufferTimeMinutes,
      finalLockDuration: lockDuration
    });
    
    return lockDuration;
  }

  // Note: Automatic unlock is disabled - customers use door codes manually
  // async scheduleUnlock(appointment) {
  //   // This method is no longer used as customers manually unlock with door codes
  //   // Keeping as reference for potential future use
  // }

  async sendBookingConfirmation(appointment) {
    try {
      // Generate unique door code for this appointment
      const doorCode = doorCodeGenerator.generateCode(appointment.id.toString(), {
        length: 4 // 4-digit codes for simplicity
      });

      // Create confirmation data
      const confirmationData = {
        customerName: appointment.customer.fullName,
        customerEmail: appointment.customer.email,
        service: appointment.service,
        appointmentDate: appointment.dateFormatted,
        startTime: appointment.startTimeFormatted,
        endTime: appointment.endTimeFormatted,
        duration: appointment.actualDuration,
        doorCode: doorCode, // Use generated random code
        location: 'Euphorium Wellness Center',
        notes: appointment.description || '',
        appointmentId: appointment.id
      };

      await this.emailService.sendBookingConfirmation(confirmationData);
      
      // Store the door code in appointment notes for reference
      await this.ameliaService.addAppointmentNote(
        appointment.id,
        `Generated door code: ${doorCode} (valid for this appointment only)`
      );
      
      logger.info('Booking confirmation sent with unique door code', {
        appointmentId: appointment.id,
        customerEmail: appointment.customer.email,
        service: appointment.service,
        doorCode: doorCode
      });

    } catch (error) {
      logger.error('Error sending booking confirmation', {
        appointmentId: appointment.id,
        customerEmail: appointment.customer?.email,
        error: error.message
      });
      
      // Don't throw - email failure shouldn't stop the process
    }
  }

  scheduleAutoLock(appointment) {
    if (!appointment || !appointment.bookingEnd) {
      logger.warn('Auto-lock schedule skipped: missing appointment or booking end time');
      return;
    }

    // Calculate when to lock: appointment end time + buffer time
    const lockTime = moment(appointment.bookingEnd).add(getLockDurationForService(appointment.service.name), 'minutes');
    const now = moment().tz(config.system.timezone);
    const timeUntilLock = lockTime.diff(now, 'milliseconds');
    
    // Ensure we don't schedule a lock in the past
    const lockDelayMs = Math.max(timeUntilLock, 60000); // At least 1 minute from now
    
    const timer = setTimeout(async () => {
      try {
        await this.eufyService.lockDoor();
        
        logger.info('Door automatically locked after appointment', {
          appointmentId: appointment.id,
          service: appointment.service,
          lockTime: lockTime.format('YYYY-MM-DD HH:mm:ss'),
          bufferMinutes: config.automation.bufferTimeMinutes
        });
        
        // Remove timer from active timers
        this.activeLockTimers.delete(appointment.id);
        
        // Add note to appointment
        await this.ameliaService.addAppointmentNote(
          appointment.id,
          `Door automatically locked at ${lockTime.format('HH:mm')} (${config.automation.bufferTimeMinutes} min after session end).`
        );
        
      } catch (error) {
        logger.error('Error during automatic lock', {
          appointmentId: appointment.id,
          error: error.message
        });
      }
    }, lockDelayMs);
    
    this.activeLockTimers.set(appointment.id, timer);
    
    logger.info('Scheduled automatic lock', {
      appointmentId: appointment.id,
      lockTime: lockTime.format('YYYY-MM-DD HH:mm:ss'),
      appointmentEndTime: appointment.bookingEnd.format('YYYY-MM-DD HH:mm:ss'),
      bufferMinutes: config.automation.bufferTimeMinutes,
      minutesFromNow: Math.round(lockDelayMs / 60000)
    });
  }

  cleanupProcessedAppointments() {
    const cutoffTime = moment().subtract(24, 'hours').unix();
    const toRemove = [];
    
    for (const appointmentKey of this.processedAppointments) {
      // Extract timestamp from appointment key
      const timestamp = parseInt(appointmentKey.split('_')[1]);
      if (timestamp < cutoffTime) {
        toRemove.push(appointmentKey);
      }
    }
    
    toRemove.forEach(key => this.processedAppointments.delete(key));
    
    if (toRemove.length > 0) {
      logger.info(`Cleaned up ${toRemove.length} old processed appointments`);
    }
  }

  performCleanupTasks() {
    try {
      logger.info('Performing cleanup tasks...');
      
      // Clean up old processed appointments
      this.cleanupProcessedAppointments();
      
      // Clear any expired lock timers
      const now = Date.now();
      const expiredTimers = [];
      
      for (const [appointmentId, timer] of this.activeLockTimers) {
        // If timer is very old (more than 24 hours), consider it expired
        if (timer._idleStart && (now - timer._idleStart > 24 * 60 * 60 * 1000)) {
          expiredTimers.push(appointmentId);
        }
      }
      
      expiredTimers.forEach(appointmentId => {
        clearTimeout(this.activeLockTimers.get(appointmentId));
        this.activeLockTimers.delete(appointmentId);
        logger.info(`Cleared expired lock timer for appointment ${appointmentId}`);
      });
      
      logger.info('Cleanup tasks completed', {
        activeTimers: this.activeLockTimers.size,
        processedAppointments: this.processedAppointments.size
      });
      
    } catch (error) {
      logger.error('Error during cleanup tasks', { error: error.message });
    }
  }

  async performHealthCheck() {
    try {
      const healthStatus = {
        timestamp: new Date().toISOString(),
        engine: {
          isRunning: this.isRunning,
          isInitialized: this.isInitialized,
          activeTimers: this.activeLockTimers.size,
          processedAppointments: this.processedAppointments.size
        },
        services: {},
        database: {}
      };

      // Check Amelia database connection
      try {
        const testAppointments = await this.ameliaService.getUpcomingAppointments(1);
        healthStatus.database.amelia = {
          status: 'connected',
          upcomingAppointments: testAppointments.length
        };
      } catch (error) {
        healthStatus.database.amelia = {
          status: 'error',
          error: error.message
        };
      }

      // Check Eufy service
      try {
        const deviceStatus = await this.eufyService.getStatus();
        healthStatus.services.eufy = {
          status: 'connected',
          deviceStatus: deviceStatus
        };
      } catch (error) {
        healthStatus.services.eufy = {
          status: 'error',
          error: error.message
        };
      }

      // Check Email service
      try {
        await this.emailService.testConnection();
        healthStatus.services.email = { status: 'connected' };
      } catch (error) {
        healthStatus.services.email = {
          status: 'error',
          error: error.message
        };
      }

      this.lastHealthCheck = healthStatus;
      
      // Log health status
      const overallHealth = Object.values(healthStatus.services).every(service => service.status === 'connected') &&
                           healthStatus.database.amelia?.status === 'connected';
      
      if (overallHealth) {
        logger.info('Health check passed', healthStatus);
      } else {
        logger.warn('Health check failed', healthStatus);
      }

    } catch (error) {
      logger.error('Error during health check', { error: error.message });
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      isInitialized: this.isInitialized,
      activeTimers: this.activeLockTimers.size,
      lastHealthCheck: this.lastHealthCheck
    };
  }

  async getSystemStatus() {
    try {
      const status = {
        engine: this.getStatus(),
        services: {
          amelia: await this.ameliaService.getUpcomingAppointments(2).then(() => 'connected').catch(e => `error: ${e.message}`),
          eufy: await this.eufyService.getStatus().then(s => s).catch(e => `error: ${e.message}`),
          email: await this.emailService.testConnection().then(() => 'connected').catch(e => `error: ${e.message}`)
        },
        appointments: {
          upcoming: await this.ameliaService.getUpcomingAppointments(24).catch(() => []),
          active: await this.ameliaService.getCurrentlyActiveAppointments().catch(() => [])
        },
        configuration: {
          timezone: config.system.timezone,
          doorCode: config.system.doorCode,
          pollInterval: config.system.ameliaPollIntervalSeconds,
          bufferTime: config.automation.bufferTimeMinutes
        }
      };

      return status;
    } catch (error) {
      logger.error('Error getting system status', { error: error.message });
      return {
        error: error.message,
        engine: this.getStatus()
      };
    }
  }

  async cleanup() {
    await this.stop();
  }
}

module.exports = AutomationEngine; 