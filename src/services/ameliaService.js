const mysql = require('mysql2/promise');
const moment = require('moment-timezone');
const logger = require('../utils/logger');
const { config } = require('../config');

class AmeliaService {
  constructor() {
    this.connection = null;
    this.isConnected = false;
    this.tablePrefix = config.amelia.tablePrefix;
    
    // Add REST API configuration
    this.apiConfig = {
      baseUrl: config.amelia.apiBaseUrl,
      apiKey: config.amelia.apiKey,
      useAPI: config.amelia.useAPI || false
    };
  }

  async connect() {
    try {
      this.connection = await mysql.createConnection({
        host: config.amelia.host,
        port: config.amelia.port,
        user: config.amelia.user,
        password: config.amelia.password,
        database: config.amelia.database,
        timezone: '+00:00' // Use UTC for database operations
      });

      this.isConnected = true;
      logger.info('Connected to Amelia database successfully');
      return true;
    } catch (error) {
      logger.error('Failed to connect to Amelia database:', error);
      this.isConnected = false;
      return false;
    }
  }

  async disconnect() {
    if (this.connection) {
      await this.connection.end();
      this.isConnected = false;
      logger.info('Disconnected from Amelia database');
    }
  }

  async ensureConnection() {
    if (!this.isConnected || !this.connection) {
      return await this.connect();
    }
    
    try {
      // Test the connection
      await this.connection.execute('SELECT 1');
      return true;
    } catch (error) {
      logger.warn('Database connection lost, reconnecting...');
      return await this.connect();
    }
  }

  /**
   * REST API: Get upcoming appointments using Amelia Elite API
   * @param {number} hoursAhead - How many hours ahead to look
   * @returns {Array} Array of appointment objects
   */
  async getUpcomingAppointmentsAPI(hoursAhead = 24) {
    if (!this.apiConfig.useAPI || !this.apiConfig.apiKey) {
      throw new Error('Amelia API not configured. Use database method instead.');
    }

    try {
      const now = moment().utc();
      const endTime = moment().utc().add(hoursAhead, 'hours');

      // Make API request to Amelia
      const response = await fetch(`${this.apiConfig.baseUrl}/wp-admin/admin-ajax.php?action=wpamelia_api&call=/api/v1/appointments`, {
        method: 'GET',
        headers: {
          'Amelia': this.apiConfig.apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Amelia API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Filter appointments for the time range
      const filteredAppointments = data.data.appointments.filter(appointment => {
        const startTime = moment(appointment.bookingStart);
        return startTime.isBetween(now, endTime);
      });

      const appointments = filteredAppointments.map(appointment => this.formatAPIAppointment(appointment));
      
      logger.info(`Found ${appointments.length} upcoming appointments via API`);
      return appointments;

    } catch (error) {
      logger.error('Error fetching upcoming appointments via API:', error);
      throw error;
    }
  }

  /**
   * Format appointment from Amelia API response
   * @param {Object} apiAppointment - Appointment from API
   * @returns {Object} Formatted appointment object
   */
  formatAPIAppointment(apiAppointment) {
    const startTime = moment(apiAppointment.bookingStart).tz(config.system.timezone);
    const endTime = moment(apiAppointment.bookingEnd).tz(config.system.timezone);
    
    // Get customer info from first booking
    const firstBooking = apiAppointment.bookings[0];
    const customer = firstBooking?.customer || {};
    
    const actualDuration = moment.duration(endTime.diff(startTime)).asMinutes();
    
    return {
      id: apiAppointment.id,
      service: apiAppointment.service?.name || 'Unknown Service',
      serviceDuration: apiAppointment.service?.duration || actualDuration,
      actualDuration: actualDuration,
      description: apiAppointment.service?.description || '',
      startTime: startTime,
      endTime: endTime,
      status: apiAppointment.status,
      customer: {
        firstName: customer.firstName || '',
        lastName: customer.lastName || '',
        fullName: `${customer.firstName || ''} ${customer.lastName || ''}`.trim(),
        email: customer.email || '',
        phone: customer.phone || ''
      },
      bookingInfo: firstBooking?.info || '',
      customFields: firstBooking?.customFields ? JSON.parse(firstBooking.customFields) : {},
      info: apiAppointment.internalNotes || '',
      // Formatted times for display
      startTimeFormatted: startTime.format('h:mm A'),
      endTimeFormatted: endTime.format('h:mm A'),
      dateFormatted: startTime.format('MMMM Do, YYYY'),
      // API-specific data
      bookingToken: firstBooking?.token,
      appointmentId: apiAppointment.id,
      // Helper methods
      isStartingSoon: (minutes = 5) => {
        const now = moment().tz(config.system.timezone);
        const diffMinutes = startTime.diff(now, 'minutes');
        return diffMinutes >= -1 && diffMinutes <= minutes;
      },
      isActive: () => {
        const now = moment().tz(config.system.timezone);
        return now.isBetween(startTime, endTime);
      },
      isUpcoming: () => {
        const now = moment().tz(config.system.timezone);
        return startTime.isAfter(now);
      }
    };
  }

  /**
   * Set up webhook endpoint for real-time booking notifications
   * This method prepares the webhook handler
   */
  setupWebhookHandler() {
    // This will be called by the webServer when webhook is received
    logger.info('Amelia webhook handler ready for real-time booking notifications');
  }

  /**
   * Process webhook notification from Amelia
   * @param {Object} webhookData - Data from Amelia webhook
   * @returns {Object} Processed appointment data
   */
  processWebhookNotification(webhookData) {
    try {
      logger.info('Processing Amelia webhook notification', {
        type: webhookData.type,
        appointmentId: webhookData.appointment?.id
      });

      if (webhookData.type === 'appointment' && webhookData.appointment) {
        const appointment = this.formatAPIAppointment(webhookData.appointment);
        return {
          success: true,
          appointment: appointment,
          action: webhookData.action || 'booking_completed'
        };
      }

      return {
        success: false,
        error: 'Invalid webhook data format'
      };

    } catch (error) {
      logger.error('Error processing Amelia webhook:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get method that switches between API and database based on configuration
   */
  async getUpcomingAppointments(hoursAhead = 24) {
    if (this.apiConfig.useAPI) {
      return await this.getUpcomingAppointmentsAPI(hoursAhead);
    } else {
      // Fall back to existing database method
      return await this.getUpcomingAppointmentsDB(hoursAhead);
    }
  }

  /**
   * Rename existing method for clarity
   */
  async getUpcomingAppointmentsDB(hoursAhead = 24) {
    // This is the existing database method - just renamed
    if (!(await this.ensureConnection())) {
      throw new Error('Cannot connect to Amelia database');
    }

    try {
      const now = moment().utc();
      const endTime = moment().utc().add(hoursAhead, 'hours');

      // Query to get appointments with customer and service information
      const query = `
        SELECT 
          a.id as appointment_id,
          a.bookingStart,
          a.bookingEnd,
          a.status,
          a.info,
          s.name as service_name,
          s.duration as service_duration,
          s.description as service_description,
          c.firstName,
          c.lastName,
          c.email,
          c.phone,
          cb.info as booking_info,
          cb.customFields
        FROM ${this.tablePrefix}amelia_appointments a
        LEFT JOIN ${this.tablePrefix}amelia_services s ON a.serviceId = s.id
        LEFT JOIN ${this.tablePrefix}amelia_customer_bookings cb ON a.id = cb.appointmentId
        LEFT JOIN ${this.tablePrefix}amelia_users c ON cb.customerId = c.id
        WHERE a.bookingStart >= ? 
          AND a.bookingStart <= ?
          AND a.status IN ('approved', 'pending')
        ORDER BY a.bookingStart ASC
      `;

      const [rows] = await this.connection.execute(query, [
        now.format('YYYY-MM-DD HH:mm:ss'),
        endTime.format('YYYY-MM-DD HH:mm:ss')
      ]);

      const appointments = rows.map(row => this.formatAppointment(row));
      
      logger.info(`Found ${appointments.length} upcoming appointments`);
      return appointments;

    } catch (error) {
      logger.error('Error fetching upcoming appointments:', error);
      throw error;
    }
  }

  /**
   * Get appointments starting in the next few minutes
   * @param {number} minutesAhead - How many minutes ahead to look
   * @returns {Array} Array of appointments starting soon
   */
  async getAppointmentsStartingSoon(minutesAhead = 5) {
    if (!(await this.ensureConnection())) {
      throw new Error('Cannot connect to Amelia database');
    }

    try {
      const now = moment().utc();
      const startTime = now.clone().subtract(1, 'minute'); // Include appointments that just started
      const endTime = now.clone().add(minutesAhead, 'minutes');

      const query = `
        SELECT 
          a.id as appointment_id,
          a.bookingStart,
          a.bookingEnd,
          a.status,
          a.info,
          s.name as service_name,
          s.duration as service_duration,
          s.description as service_description,
          c.firstName,
          c.lastName,
          c.email,
          c.phone,
          cb.info as booking_info,
          cb.customFields
        FROM ${this.tablePrefix}amelia_appointments a
        LEFT JOIN ${this.tablePrefix}amelia_services s ON a.serviceId = s.id
        LEFT JOIN ${this.tablePrefix}amelia_customer_bookings cb ON a.id = cb.appointmentId
        LEFT JOIN ${this.tablePrefix}amelia_users c ON cb.customerId = c.id
        WHERE a.bookingStart >= ? 
          AND a.bookingStart <= ?
          AND a.status IN ('approved', 'pending')
        ORDER BY a.bookingStart ASC
      `;

      const [rows] = await this.connection.execute(query, [
        startTime.format('YYYY-MM-DD HH:mm:ss'),
        endTime.format('YYYY-MM-DD HH:mm:ss')
      ]);

      const appointments = rows.map(row => this.formatAppointment(row));
      
      if (appointments.length > 0) {
        logger.info(`Found ${appointments.length} appointments starting soon`);
      }
      
      return appointments;

    } catch (error) {
      logger.error('Error fetching appointments starting soon:', error);
      throw error;
    }
  }

  /**
   * Get currently active appointments
   * @returns {Array} Array of currently active appointments
   */
  async getCurrentlyActiveAppointments() {
    if (!(await this.ensureConnection())) {
      throw new Error('Cannot connect to Amelia database');
    }

    try {
      const now = moment().utc();

      const query = `
        SELECT 
          a.id as appointment_id,
          a.bookingStart,
          a.bookingEnd,
          a.status,
          a.info,
          s.name as service_name,
          s.duration as service_duration,
          s.description as service_description,
          c.firstName,
          c.lastName,
          c.email,
          c.phone,
          cb.info as booking_info,
          cb.customFields
        FROM ${this.tablePrefix}amelia_appointments a
        LEFT JOIN ${this.tablePrefix}amelia_services s ON a.serviceId = s.id
        LEFT JOIN ${this.tablePrefix}amelia_customer_bookings cb ON a.id = cb.appointmentId
        LEFT JOIN ${this.tablePrefix}amelia_users c ON cb.customerId = c.id
        WHERE a.bookingStart <= ? 
          AND a.bookingEnd >= ?
          AND a.status IN ('approved', 'pending')
        ORDER BY a.bookingStart ASC
      `;

      const [rows] = await this.connection.execute(query, [
        now.format('YYYY-MM-DD HH:mm:ss'),
        now.format('YYYY-MM-DD HH:mm:ss')
      ]);

      const appointments = rows.map(row => this.formatAppointment(row));
      
      if (appointments.length > 0) {
        logger.info(`Found ${appointments.length} currently active appointments`);
      }
      
      return appointments;

    } catch (error) {
      logger.error('Error fetching currently active appointments:', error);
      throw error;
    }
  }

  /**
   * Format raw database row into a standardized appointment object
   * @param {Object} row - Raw database row
   * @returns {Object} Formatted appointment object
   */
  formatAppointment(row) {
    const startTime = moment.utc(row.bookingStart).tz(config.system.timezone);
    const endTime = moment.utc(row.bookingEnd).tz(config.system.timezone);
    
    // Calculate actual duration from booking times
    const actualDuration = moment.duration(endTime.diff(startTime)).asMinutes();
    
    return {
      id: row.appointment_id,
      service: row.service_name,
      serviceDuration: row.service_duration, // Duration from service definition
      actualDuration: actualDuration, // Actual booked duration
      description: row.service_description,
      startTime: startTime,
      endTime: endTime,
      status: row.status,
      customer: {
        firstName: row.firstName,
        lastName: row.lastName,
        fullName: `${row.firstName || ''} ${row.lastName || ''}`.trim(),
        email: row.email,
        phone: row.phone
      },
      bookingInfo: row.booking_info,
      customFields: row.customFields ? JSON.parse(row.customFields) : {},
      info: row.info,
      // Formatted times for display
      startTimeFormatted: startTime.format('h:mm A'),
      endTimeFormatted: endTime.format('h:mm A'),
      dateFormatted: startTime.format('MMMM Do, YYYY'),
      // Helper methods
      isStartingSoon: (minutes = 5) => {
        const now = moment().tz(config.system.timezone);
        const diffMinutes = startTime.diff(now, 'minutes');
        return diffMinutes >= -1 && diffMinutes <= minutes;
      },
      isActive: () => {
        const now = moment().tz(config.system.timezone);
        return now.isBetween(startTime, endTime);
      },
      isUpcoming: () => {
        const now = moment().tz(config.system.timezone);
        return startTime.isAfter(now);
      }
    };
  }

  /**
   * Update appointment status
   * @param {number} appointmentId - Appointment ID
   * @param {string} status - New status
   * @returns {boolean} Success status
   */
  async updateAppointmentStatus(appointmentId, status) {
    if (!(await this.ensureConnection())) {
      throw new Error('Cannot connect to Amelia database');
    }

    try {
      const query = `UPDATE ${this.tablePrefix}amelia_appointments SET status = ? WHERE id = ?`;
      const [result] = await this.connection.execute(query, [status, appointmentId]);
      
      logger.info(`Updated appointment ${appointmentId} status to ${status}`);
      return result.affectedRows > 0;
    } catch (error) {
      logger.error(`Error updating appointment ${appointmentId} status:`, error);
      throw error;
    }
  }

  /**
   * Add a note to an appointment
   * @param {number} appointmentId - Appointment ID
   * @param {string} note - Note to add
   * @returns {boolean} Success status
   */
  async addAppointmentNote(appointmentId, note) {
    if (!(await this.ensureConnection())) {
      throw new Error('Cannot connect to Amelia database');
    }

    try {
      // Get current info
      const [rows] = await this.connection.execute(
        `SELECT info FROM ${this.tablePrefix}amelia_appointments WHERE id = ?`,
        [appointmentId]
      );

      if (rows.length === 0) {
        throw new Error(`Appointment ${appointmentId} not found`);
      }

      const currentInfo = rows[0].info || '';
      const timestamp = moment().tz(config.system.timezone).format('YYYY-MM-DD HH:mm:ss');
      const newInfo = currentInfo + `\n[${timestamp}] ${note}`;

      const [result] = await this.connection.execute(
        `UPDATE ${this.tablePrefix}amelia_appointments SET info = ? WHERE id = ?`,
        [newInfo, appointmentId]
      );

      logger.info(`Added note to appointment ${appointmentId}: ${note}`);
      return result.affectedRows > 0;
    } catch (error) {
      logger.error(`Error adding note to appointment ${appointmentId}:`, error);
      throw error;
    }
  }

  /**
   * Get service configuration
   * @returns {Array} Array of service configurations
   */
  async getServices() {
    if (!(await this.ensureConnection())) {
      throw new Error('Cannot connect to Amelia database');
    }

    try {
      const query = `
        SELECT 
          id,
          name,
          description,
          duration,
          price,
          maxCapacity,
          minCapacity,
          settings
        FROM ${this.tablePrefix}amelia_services
        WHERE status = 'visible'
        ORDER BY name
      `;

      const [rows] = await this.connection.execute(query);
      
      return rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        duration: row.duration,
        price: row.price,
        maxCapacity: row.maxCapacity,
        minCapacity: row.minCapacity,
        settings: row.settings ? JSON.parse(row.settings) : {}
      }));
    } catch (error) {
      logger.error('Error fetching services:', error);
      throw error;
    }
  }
}

module.exports = AmeliaService; 