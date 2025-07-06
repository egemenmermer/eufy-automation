// Mock Email Service for testing without real credentials
const moment = require('moment');
const logger = require('../../src/utils/logger');

class MockEmailService {
  constructor() {
    this.transporter = {
      sendMail: jest.fn().mockResolvedValue({ messageId: 'mock-message-id' })
    };
    this.sentEmails = [];
  }

  async initialize() {
    return Promise.resolve();
  }

  async sendDoorCodeEmail(user, code, appointment) {
    const email = {
      to: user.email,
      subject: `Your Door Code for ${appointment.service.name}`,
      html: `Hello, your code is ${code}`
    };
    this.sentEmails.push(email);
    return this.transporter.sendMail(email);
  }

  async sendErrorNotification(error, context) {
    const email = {
      to: 'admin@example.com',
      subject: 'Automation Engine Error',
      html: `Error: ${error.message}`
    };
    this.sentEmails.push(email);
    return this.transporter.sendMail(email);
  }
  
  getSentEmails() {
    return this.sentEmails;
  }

  clearSentEmails() {
    this.sentEmails = [];
  }
  
  async testConnection() {
    return Promise.resolve(true);
  }
}

module.exports = MockEmailService; 