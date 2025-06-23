// Mock Google Calendar Service for testing without real credentials
const moment = require('moment');
const logger = require('../../src/utils/logger');

class MockGoogleCalendarService {
  constructor() {
    this.calendar = null;
    this.processedEvents = new Set();
  }

  async initialize() {
    try {
      logger.calendar('🧪 Initializing Mock Google Calendar Service (TEST MODE)...');
      
      // Simulate initialization delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      this.calendar = { mock: true };
      
      logger.calendar('✅ Mock Google Calendar service initialized successfully');
      return true;
    } catch (error) {
      logger.error('❌ Failed to initialize Mock Google Calendar service', { error: error.message });
      throw error;
    }
  }

  async getUpcomingEvents(timeWindowMinutes = 10) {
    try {
      // Create some mock events for testing
      const mockEvents = [
        {
          id: 'mock-event-1',
          title: 'Test Booking Appointment',
          description: 'Mock booking for testing automation',
          startTime: moment().add(2, 'minutes').toDate(),
          endTime: moment().add(62, 'minutes').toDate(),
          attendeeEmail: 'test@example.com',
          organizer: 'calendar@example.com',
          location: 'Test Location',
          isAllDay: false,
          raw: { mock: true }
        },
        {
          id: 'mock-event-2', 
          title: 'Personal Meeting',
          description: 'Not a booking',
          startTime: moment().add(5, 'minutes').toDate(),
          endTime: moment().add(65, 'minutes').toDate(),
          attendeeEmail: null, // No attendee - should be ignored
          organizer: 'calendar@example.com',
          location: 'Personal Location',
          isAllDay: false,
          raw: { mock: true }
        }
      ];

      logger.calendar(`🧪 Mock: Found ${mockEvents.length} mock events in next ${timeWindowMinutes} minutes`);
      return mockEvents;
    } catch (error) {
      logger.error('❌ Mock: Error fetching upcoming events', { error: error.message });
      throw error;
    }
  }

  async getEventsStartingSoon(minutesFromNow = 2) {
    try {
      const now = moment();
      const events = await this.getUpcomingEvents(minutesFromNow + 3);
      
      // Filter for events starting soon
      const soonEvents = events.filter(event => {
        const eventStart = moment(event.startTime);
        const diffMinutes = eventStart.diff(now, 'minutes', true);
        return diffMinutes >= 0 && diffMinutes <= 3;
      });

      // Filter out already processed events
      const newEvents = soonEvents.filter(event => {
        const eventKey = `${event.id}-${moment(event.startTime).format('YYYY-MM-DD-HH-mm')}`;
        if (this.processedEvents.has(eventKey)) {
          return false;
        }
        this.processedEvents.add(eventKey);
        return true;
      });

      if (newEvents.length > 0) {
        logger.calendar(`🧪 Mock: Found ${newEvents.length} events starting soon`, {
          events: newEvents.map(e => ({ title: e.title, startTime: e.startTime }))
        });
      }

      return newEvents;
    } catch (error) {
      logger.error('❌ Mock: Error getting events starting soon', { error: error.message });
      return [];
    }
  }

  cleanupProcessedEvents() {
    const initialSize = this.processedEvents.size;
    if (initialSize > 100) {
      this.processedEvents.clear();
      logger.calendar('🧪 Mock: Cleared processed events cache');
    }
  }

  isValidBookingEvent(event) {
    // Same validation logic as real service
    return (
      event.attendeeEmail && 
      event.attendeeEmail.includes('@') &&
      !event.isAllDay &&
      (event.title.toLowerCase().includes('booking') || 
       event.title.toLowerCase().includes('appointment') ||
       event.description.toLowerCase().includes('access'))
    );
  }

  // Method to manually trigger test events
  createTestEvent(minutesFromNow = 1) {
    const testEvent = {
      id: `test-${Date.now()}`,
      title: 'Test Booking Appointment',
      description: 'Test booking for automation',
      startTime: moment().add(minutesFromNow, 'minutes').toDate(),
      endTime: moment().add(minutesFromNow + 60, 'minutes').toDate(),
      attendeeEmail: 'test@example.com',
      organizer: 'calendar@example.com',
      location: 'Test Location',
      isAllDay: false,
      raw: { mock: true, manual: true }
    };

    logger.calendar('🧪 Mock: Created manual test event', {
      title: testEvent.title,
      startTime: testEvent.startTime
    });

    return testEvent;
  }
}

module.exports = MockGoogleCalendarService; 