const { google } = require('googleapis');
const fs = require('fs-extra');
const moment = require('moment');
const logger = require('../utils/logger');
const { config } = require('../config');

class GoogleCalendarService {
  constructor() {
    this.calendar = null;
    this.processedEvents = new Set(); // Track processed events to avoid duplicates
  }

  async initialize() {
    try {
      // Load service account credentials
      const credentials = await fs.readJson(config.google.serviceAccountKeyPath);
      
      // Create JWT authentication
      const auth = new google.auth.JWT(
        credentials.client_email,
        null,
        credentials.private_key,
        ['https://www.googleapis.com/auth/calendar.readonly']
      );

      await auth.authorize();
      
      // Initialize calendar API
      this.calendar = google.calendar({ version: 'v3', auth });
      
      logger.calendar('Google Calendar service initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize Google Calendar service', { error: error.message });
      throw error;
    }
  }

  async getUpcomingEvents(timeWindowMinutes = 10) {
    try {
      const now = moment();
      const timeMin = now.toISOString();
      const timeMax = now.add(timeWindowMinutes, 'minutes').toISOString();

      const response = await this.calendar.events.list({
        calendarId: config.google.calendarId,
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 10,
      });

      const events = response.data.items || [];
      logger.calendar(`Found ${events.length} upcoming events in next ${timeWindowMinutes} minutes`);
      
      return events.map(event => this.parseEvent(event));
    } catch (error) {
      logger.error('Error fetching upcoming events', { error: error.message });
      throw error;
    }
  }

  parseEvent(event) {
    const startTime = moment(event.start.dateTime || event.start.date);
    const endTime = moment(event.end.dateTime || event.end.date);
    
    // Extract attendee email (usually the first attendee who isn't the organizer)
    const attendees = event.attendees || [];
    const attendeeEmail = attendees.find(attendee => 
      attendee.email !== event.organizer?.email && 
      attendee.responseStatus !== 'declined'
    )?.email;

    return {
      id: event.id,
      title: event.summary || 'No Title',
      description: event.description || '',
      startTime: startTime.toDate(),
      endTime: endTime.toDate(),
      attendeeEmail,
      organizer: event.organizer?.email,
      location: event.location,
      isAllDay: !event.start.dateTime,
      raw: event,
    };
  }

  async getEventsStartingSoon(minutesFromNow = 2) {
    try {
      const now = moment();
      const targetTime = now.clone().add(minutesFromNow, 'minutes');
      
      // Get events in a 5-minute window around the target time
      const events = await this.getUpcomingEvents(minutesFromNow + 3);
      
      // Filter for events starting within the target window
      const soonEvents = events.filter(event => {
        const eventStart = moment(event.startTime);
        const diffMinutes = eventStart.diff(now, 'minutes', true);
        
        // Event should start within the next 0-3 minutes
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
        logger.calendar(`Found ${newEvents.length} events starting soon`, {
          events: newEvents.map(e => ({ title: e.title, startTime: e.startTime }))
        });
      }

      return newEvents;
    } catch (error) {
      logger.error('Error getting events starting soon', { error: error.message });
      return [];
    }
  }

  // Clean up old processed events (run periodically)
  cleanupProcessedEvents() {
    const cutoffTime = moment().subtract(2, 'hours');
    const initialSize = this.processedEvents.size;
    
    // This is a simple cleanup - in production you might want a more sophisticated approach
    if (initialSize > 100) {
      this.processedEvents.clear();
      logger.calendar('Cleared processed events cache');
    }
  }

  isValidBookingEvent(event) {
    // Add your business logic here to determine if an event is a valid booking
    // For example, check if it has an attendee email, specific keywords, etc.
    return (
      event.attendeeEmail && 
      event.attendeeEmail.includes('@') &&
      !event.isAllDay &&
      event.title.toLowerCase().includes('booking') || 
      event.title.toLowerCase().includes('appointment') ||
      event.description.toLowerCase().includes('access')
    );
  }
}

module.exports = GoogleCalendarService; 