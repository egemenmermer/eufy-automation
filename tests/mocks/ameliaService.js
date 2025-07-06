const moment = require('moment-timezone');
const logger = require('../../src/utils/logger');
const { config } = require('../../src/config');

class MockAmeliaService {
  constructor() {
    this.isConnected = false;
    this.mockAppointments = this.generateMockAppointments();
    logger.info('Mock Amelia Service initialized');
  }

  async connect() {
    this.isConnected = true;
    logger.info('Mock Amelia database connected successfully');
    return true;
  }

  async disconnect() {
    this.isConnected = false;
    logger.info('Mock Amelia database disconnected');
  }

  async ensureConnection() {
    return this.isConnected;
  }

  /**
   * Generate mock appointments for testing
   */
  generateMockAppointments() {
    const now = moment().tz(config.system.timezone);
    const appointments = [];

    // Create appointments for the next 24 hours
    const services = [
      { name: 'Ice bath', duration: 15 },
      { name: 'Traditional Sauna', duration: 30 },
      { name: 'Traditional sauna and Ice bath', duration: 45 },
      { name: 'Chill Club: 15-Min Daily Ice Bath Access', duration: 15 },
      { name: 'Communal - Contrast Therapy - Ice Bath & Traditional Sauna', duration: 30 },
      { name: 'Private - Contrast Therapy - Ice Bath & Traditional Sauna', duration: 60 }
    ];

    // Generate 5-8 appointments over next 24 hours
    for (let i = 0; i < 6; i++) {
      const service = services[i % services.length];
      const startTime = now.clone().add(30 + (i * 180), 'minutes'); // Spread throughout the day
      const endTime = startTime.clone().add(service.duration, 'minutes');
      
      appointments.push({
        id: 1000 + i,
        service: service.name,
        serviceDuration: service.duration,
        actualDuration: service.duration,
        description: `${service.name} session at Euphorium`,
        startTime: startTime,
        endTime: endTime,
        status: 'approved',
        customer: {
          firstName: ['John', 'Sarah', 'Mike', 'Emma', 'David', 'Lisa'][i],
          lastName: ['Smith', 'Johnson', 'Brown', 'Wilson', 'Davis', 'Miller'][i],
          fullName: `${['John', 'Sarah', 'Mike', 'Emma', 'David', 'Lisa'][i]} ${['Smith', 'Johnson', 'Brown', 'Wilson', 'Davis', 'Miller'][i]}`,
          email: `${['john', 'sarah', 'mike', 'emma', 'david', 'lisa'][i]}@example.com`,
          phone: `+971-50-${1000000 + i}`
        },
        bookingInfo: `Mock booking for ${service.name}`,
        customFields: {},
        info: 'Mock appointment created for testing',
        startTimeFormatted: startTime.format('h:mm A'),
        endTimeFormatted: endTime.format('h:mm A'),
        dateFormatted: startTime.format('MMMM Do, YYYY'),
        isStartingSoon: function(minutes = 5) {
          const now = moment().tz(config.system.timezone);
          const diffMinutes = this.startTime.diff(now, 'minutes');
          return diffMinutes >= -1 && diffMinutes <= minutes;
        },
        isActive: function() {
          const now = moment().tz(config.system.timezone);
          return now.isBetween(this.startTime, this.endTime);
        },
        isUpcoming: function() {
          const now = moment().tz(config.system.timezone);
          return this.startTime.isAfter(now);
        }
      });
    }

    return appointments;
  }

  async getUpcomingAppointments(hoursAhead = 24) {
    const now = moment().tz(config.system.timezone);
    const endTime = now.clone().add(hoursAhead, 'hours');
    
    const upcoming = this.mockAppointments.filter(appointment => {
      return appointment.startTime.isBetween(now, endTime) && 
             appointment.status === 'approved';
    });

    logger.info(`Mock: Found ${upcoming.length} upcoming appointments`);
    return upcoming;
  }

  async getAppointmentsStartingSoon(minutesAhead = 5) {
    const now = moment().tz(config.system.timezone);
    const startTime = now.clone().subtract(1, 'minute');
    const endTime = now.clone().add(minutesAhead, 'minutes');
    
    const startingSoon = this.mockAppointments.filter(appointment => {
      return appointment.startTime.isBetween(startTime, endTime) && 
             appointment.status === 'approved';
    });

    if (startingSoon.length > 0) {
      logger.info(`Mock: Found ${startingSoon.length} appointments starting soon`);
    }
    
    return startingSoon;
  }

  async getCurrentlyActiveAppointments() {
    const now = moment().tz(config.system.timezone);
    
    const active = this.mockAppointments.filter(appointment => {
      return now.isBetween(appointment.startTime, appointment.endTime) && 
             appointment.status === 'approved';
    });

    if (active.length > 0) {
      logger.info(`Mock: Found ${active.length} currently active appointments`);
    }
    
    return active;
  }

  async updateAppointmentStatus(appointmentId, status) {
    const appointment = this.mockAppointments.find(apt => apt.id === appointmentId);
    if (appointment) {
      appointment.status = status;
      logger.info(`Mock: Updated appointment ${appointmentId} status to ${status}`);
      return true;
    }
    return false;
  }

  async addAppointmentNote(appointmentId, note) {
    const appointment = this.mockAppointments.find(apt => apt.id === appointmentId);
    if (appointment) {
      const timestamp = moment().tz(config.system.timezone).format('YYYY-MM-DD HH:mm:ss');
      appointment.info += `\n[${timestamp}] ${note}`;
      logger.info(`Mock: Added note to appointment ${appointmentId}: ${note}`);
      return true;
    }
    return false;
  }

  async handleWebhook(payload) {
    // In the mock, we just validate the payload and return the appointment
    if (payload && payload.appointment) {
      return Promise.resolve({
        success: true,
        event: payload.type || 'booking_completed',
        appointment: payload.appointment
      });
    }
    return Promise.resolve({ success: false, error: 'Invalid payload' });
  }

  async getStatus() {
    return {
      connected: this.isConnected,
      appointments: this.mockAppointments.length,
      mock: true
    };
  }

  async getServices() {
    return [
      {
        id: 1,
        name: 'Ice bath',
        description: 'Cold therapy session',
        duration: 15,
        price: 50,
        maxCapacity: 1,
        minCapacity: 1,
        settings: {}
      },
      {
        id: 2,
        name: 'Traditional Sauna',
        description: 'Heat therapy session',
        duration: 30,
        price: 100,
        maxCapacity: 4,
        minCapacity: 1,
        settings: {}
      },
      {
        id: 3,
        name: 'Traditional sauna and Ice bath',
        description: 'Contrast therapy session',
        duration: 45,
        price: 120,
        maxCapacity: 1,
        minCapacity: 1,
        settings: {}
      },
      {
        id: 4,
        name: 'Chill Club: 15-Min Daily Ice Bath Access',
        description: 'Monthly membership for daily ice bath access',
        duration: 15,
        price: 421.50,
        maxCapacity: 1,
        minCapacity: 1,
        settings: {}
      },
      {
        id: 5,
        name: 'Communal - Contrast Therapy - Ice Bath & Traditional Sauna',
        description: 'Communal contrast therapy session',
        duration: 30,
        price: 422.28,
        maxCapacity: 6,
        minCapacity: 1,
        settings: {}
      },
      {
        id: 6,
        name: 'Private - Contrast Therapy - Ice Bath & Traditional Sauna',
        description: 'Private contrast therapy session',
        duration: 60,
        price: 735.12,
        maxCapacity: 2,
        minCapacity: 1,
        settings: {}
      }
    ];
  }
}

module.exports = MockAmeliaService; 