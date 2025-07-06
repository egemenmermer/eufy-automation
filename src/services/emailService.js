const nodemailer = require('nodemailer');
const moment = require('moment');
const logger = require('../utils/logger');
const { config } = require('../config');
const accessTokenManager = require('../utils/accessTokens');

class EmailService {
  constructor() {
    this.transporter = null;
  }

  async initialize() {
    try {
      // Create transporter using explicit SMTP configuration
      this.transporter = nodemailer.createTransport({
        host: config.email.host,
        port: config.email.port,
        secure: config.email.port === 465, // true for 465, false for other ports
        connectionTimeout: 10000, // 10 second timeout
        auth: {
          user: config.email.user,
          pass: config.email.password, // Use App Password, not regular password
        },
      });

      // Verify transporter configuration with timeout
      await Promise.race([
        this.transporter.verify(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('SMTP verification timeout')), 10000)
        )
      ]);
      
      logger.email('Email service initialized successfully');
      return true;
    } catch (error) {
      logger.warn('Failed to initialize real email service, falling back to mock mode', { error: error.message });
      
      // Fallback to mock behavior
      this.transporter = null;
      this.isMockMode = true;
      
      logger.email('Email service initialized in mock mode');
      return true;
    }
  }

  async sendAccessConfirmation(event) {
    try {
      if (!event.attendeeEmail) {
        throw new Error('No attendee email found for event');
      }

      const emailData = {
        to: event.attendeeEmail,
        subject: `Access Confirmed - ${event.title}`,
        html: this.generateAccessConfirmationHTML(event),
        text: this.generateAccessConfirmationText(event),
      };

      await this.sendEmail(emailData);
      
      logger.email('Access confirmation sent', {
        to: event.attendeeEmail,
        eventTitle: event.title,
        eventTime: event.startTime
      });

      return true;
    } catch (error) {
      logger.error('Failed to send access confirmation', { 
        error: error.message,
        eventId: event.id,
        attendeeEmail: event.attendeeEmail
      });
      throw error;
    }
  }

  async sendBookingConfirmation(confirmationData) {
    try {
      if (!confirmationData.customerEmail) {
        throw new Error('No customer email found for appointment');
      }

      const emailData = {
        to: confirmationData.customerEmail,
        subject: `Welcome to Euphorium! ❄️ - ${confirmationData.service}`,
        html: this.generateEuphoriumConfirmationHTML(confirmationData),
        text: this.generateEuphoriumConfirmationText(confirmationData),
      };

      await this.sendEmail(emailData);
      
      logger.email('Euphorium booking confirmation sent', {
        to: confirmationData.customerEmail,
        service: confirmationData.service,
        appointmentDate: confirmationData.appointmentDate,
        startTime: confirmationData.startTime
      });

      return true;
    } catch (error) {
      logger.error('Failed to send booking confirmation', { 
        error: error.message,
        appointmentId: confirmationData.appointmentId,
        customerEmail: confirmationData.customerEmail
      });
      throw error;
    }
  }

  generateAccessConfirmationHTML(event) {
    const startTime = moment(event.startTime).format('MMMM Do YYYY, h:mm A');
    const endTime = moment(event.endTime).format('h:mm A');
    
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Access Confirmation</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 5px; }
            .content { background-color: #f9f9f9; padding: 20px; margin: 20px 0; border-radius: 5px; }
            .details { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #4CAF50; }
            .footer { text-align: center; font-size: 12px; color: #666; margin-top: 30px; }
            .button { display: inline-block; background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🔓 Access Confirmed</h1>
            <p>Your scheduled access has been automatically granted</p>
        </div>
        
        <div class="content">
            <h2>Booking Details</h2>
            <div class="details">
                <p><strong>Event:</strong> ${event.title}</p>
                <p><strong>Date & Time:</strong> ${startTime} - ${endTime}</p>
                ${event.location ? `<p><strong>Location:</strong> ${event.location}</p>` : ''}
                ${event.description ? `<p><strong>Notes:</strong> ${event.description}</p>` : ''}
            </div>
            
            <h3>🚪 Access Information</h3>
            <p>The door has been automatically unlocked for your arrival. Please note:</p>
            <ul>
                <li>The door will remain unlocked for ${config.system.lockDurationMinutes} minutes</li>
                <li>Please ensure the door is securely closed when you leave</li>
                <li>If you encounter any issues, please contact support immediately</li>
            </ul>
            
            <h3>📋 Important Reminders</h3>
            <ul>
                <li>Please arrive on time for your scheduled appointment</li>
                <li>Follow all facility guidelines and safety protocols</li>
                <li>Be respectful of shared spaces and other users</li>
            </ul>
        </div>
        
        <div class="footer">
            <p>This is an automated message from the Access Management System</p>
            <p>If you need assistance, please contact support</p>
            <p><em>Generated at ${moment().format('YYYY-MM-DD HH:mm:ss')}</em></p>
        </div>
    </body>
    </html>
    `;
  }

  generateAccessConfirmationText(event) {
    const startTime = moment(event.startTime).format('MMMM Do YYYY, h:mm A');
    const endTime = moment(event.endTime).format('h:mm A');
    
    return `
ACCESS CONFIRMED - ${event.title}

Your scheduled access has been automatically granted.

BOOKING DETAILS:
- Event: ${event.title}
- Date & Time: ${startTime} - ${endTime}
${event.location ? `- Location: ${event.location}` : ''}
${event.description ? `- Notes: ${event.description}` : ''}

ACCESS INFORMATION:
The door has been automatically unlocked for your arrival.

Important Notes:
• The door will remain unlocked for ${config.system.lockDurationMinutes} minutes
• Please ensure the door is securely closed when you leave
• If you encounter any issues, please contact support immediately

REMINDERS:
• Please arrive on time for your scheduled appointment
• Follow all facility guidelines and safety protocols
• Be respectful of shared spaces and other users

---
This is an automated message from the Access Management System.
Generated at ${moment().format('YYYY-MM-DD HH:mm:ss')}
    `.trim();
  }

  generateEuphoriumConfirmationHTML(confirmationData) {
    const moment = require('moment');
    
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Welcome to Euphorium!</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .section { margin: 20px 0; }
            .code-box { background-color: #f0f8ff; border: 2px solid #007bff; padding: 15px; text-align: center; font-size: 18px; font-weight: bold; color: #007bff; border-radius: 5px; margin: 15px 0; }
            .important { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 10px 0; }
            .contact { background-color: #d4edda; border-left: 4px solid #28a745; padding: 10px; margin: 10px 0; }
            ul { padding-left: 20px; }
            .footer { text-align: center; font-size: 12px; color: #666; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 15px; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Welcome to Euphorium! ❄️</h1>
        </div>
        
        <div class="section">
            <h2>📱 Before Your Visit</h2>
            <p><strong>Send a "Hi" on WhatsApp:</strong> <a href="https://wa.me/971559021829">+971-559021829</a> → so we can assist you if needed (No staff on-site).</p>
            <p><strong>Must-Read 2 min Guide:</strong> (Late policies, facility use, tub temps, and ice bath/sauna instructions)</p>
        </div>

        <div class="section">
            <h2>🚪 Door Code</h2>
            <div class="code-box">
                ${confirmationData.doorCode}
            </div>
            <p><strong>Use it to unlock the door at ${confirmationData.startTime}.</strong></p>
            <p>The door stays locked until then and remains closed during your session.</p>
            <p>Use the same code to lock (pull the door toward you).</p>
        </div>

        <div class="section">
            <h2>⏰ Your Session</h2>
            <ul>
                <li><strong>Service:</strong> ${confirmationData.service}</li>
                <li><strong>Date:</strong> ${confirmationData.appointmentDate}</li>
                <li><strong>Start:</strong> ${confirmationData.startTime}</li>
                <li><strong>End:</strong> ${confirmationData.endTime}</li>
                <li><strong>Duration:</strong> ${confirmationData.duration} min</li>
            </ul>
            <p><strong>Late arrivals = lost time. No extensions unless you rebook.</strong></p>
        </div>

        <div class="important">
            <h3>📋 Important Policies</h3>
            <p><strong>Late Arrivals:</strong> Late arrivals cannot be extended unless an additional session is booked, subject to availability.</p>
        </div>

        <div class="section">
            <h3>⏱️ Session Times</h3>
            <ul>
                <li>Ice Bath: 15</li>
                <li>Sauna: 30</li>
                <li>Combined: 45</li>
            </ul>
        </div>

        <div class="section">
            <h2>🚗 Getting Here & Access Information</h2>
            
            <h3>If You're Driving:</h3>
            <p><strong>Park at:</strong></p>
            <ul>
                <li>Visitor Parking (by the Al Sufouh Suites building) – Security can guide you</li>
                <li>P2 Basement Parking #25 (call security for gate access: Night: +971 55 764 9059 | Day: +971 56 648 4972)</li>
                <li>Nearby Street Parking <a href="#">Google Maps Pin 1</a>, <a href="#">Google Maps Pin 2</a></li>
            </ul>

            <h3>If You're Not Driving:</h3>
            <p>Enter through the main building entrance and take the lift to P2.</p>
            <p>Follow the same path: Exit the double doors → Turn Right → Find the <strong>BRIGHT BLUE DOOR</strong> near parking spot #25.</p>
        </div>

        <div class="contact">
            <h3>🗺️ Need Directions?</h3>
            <p>Watch our drive-through videos: <a href="#">Gate 1</a> | <a href="#">Gate 2</a></p>
            <p><strong>Bathrooms:</strong> Press 'A' in the elevator</p>
        </div>

        <div class="footer">
            <p><strong>100% Self-Service | No Staff On-Site</strong></p>
            <p>Euphorium</p>
            <p><em>Automated booking confirmation generated at ${moment().format('YYYY-MM-DD HH:mm:ss')}</em></p>
        </div>
    </body>
    </html>
    `;
  }

  generateEuphoriumConfirmationText(confirmationData) {
    const moment = require('moment');
    
    return `
Welcome to Euphorium! ❄️

📱 Before Your Visit
Send a "Hi" on WhatsApp: +971-559021829 → so we can assist you if needed (No staff on-site).
Must-Read 2 min Guide: (Late policies, facility use, tub temps, and ice bath/sauna instructions)

🚪 Door Code: ${confirmationData.doorCode}
Use it to unlock the door at ${confirmationData.startTime}.
The door stays locked until then and remains closed during your session.
Use the same code to lock (pull the door toward you).

⏰ Your Session
• Service: ${confirmationData.service}
• Date: ${confirmationData.appointmentDate}
• Start: ${confirmationData.startTime}
• End: ${confirmationData.endTime}
• Duration: ${confirmationData.duration} min
Late arrivals = lost time. No extensions unless you rebook.

📋 Important Policies

Late Arrivals: Late arrivals cannot be extended unless an additional session is booked, subject to availability.

⏱️ Session Times
Ice Bath: 15
Sauna: 30
Combined: 45

🚗 Getting Here & Access Information

If You're Driving:
Park at:
Visitor Parking (by the Al Sufouh Suites building) – Security can guide you
P2 Basement Parking #25 (call security for gate access: Night: +971 55 764 9059 | Day: +971 56 648 4972)
Nearby Street Parking Google Maps Pin 1, Google Maps Pin 2

If You're Not Driving:
Enter through the main building entrance and take the lift to P2.
Follow the same path: Exit the double doors → Turn Right → Find the BRIGHT BLUE DOOR near parking spot #25.

🗺️ Need Directions?
Watch our drive-through videos: Gate 1 | Gate 2
🚻 Bathrooms: Press 'A' in the elevator

100% Self-Service | No Staff On-Site
Euphorium

Automated booking confirmation generated at ${moment().format('YYYY-MM-DD HH:mm:ss')}
    `;
  }

  async sendEmail(emailData) {
    try {
      // If in mock mode, just log the email
      if (this.isMockMode || !this.transporter) {
        logger.email('📧 [MOCK] Email would be sent', {
          to: emailData.to,
          subject: emailData.subject,
          textPreview: emailData.text ? emailData.text.substring(0, 100) + '...' : 'No text content'
        });
        
        return { messageId: 'mock-' + Date.now(), accepted: [emailData.to] };
      }

      const mailOptions = {
        from: `"${config.email.fromName}" <${config.email.from}>`,
        to: emailData.to,
        subject: emailData.subject,
        text: emailData.text,
        html: emailData.html,
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      logger.email('Email sent successfully', {
        messageId: result.messageId,
        to: emailData.to,
        subject: emailData.subject
      });

      return result;
    } catch (error) {
      logger.error('Failed to send email', { 
        error: error.message,
        to: emailData.to,
        subject: emailData.subject
      });
      throw error;
    }
  }

  async sendErrorNotification(error, context = {}) {
    try {
      // Send error notifications to admin email (could be same as from email)
      const emailData = {
        to: config.email.from, // Send to admin
        subject: `🚨 Eufy Automation Error - ${moment().format('YYYY-MM-DD HH:mm')}`,
        html: this.generateErrorNotificationHTML(error, context),
        text: this.generateErrorNotificationText(error, context),
      };

      await this.sendEmail(emailData);
      
      logger.email('Error notification sent to admin', {
        error: error.message,
        context
      });

      return true;
    } catch (emailError) {
      logger.error('Failed to send error notification', { 
        originalError: error.message,
        emailError: emailError.message,
        context
      });
    }
  }

  generateErrorNotificationHTML(error, context) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>System Error Alert</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #f44336; color: white; padding: 20px; text-align: center; border-radius: 5px; }
            .content { background-color: #fff3cd; padding: 20px; margin: 20px 0; border-radius: 5px; border: 1px solid #ffeaa7; }
            .error-details { background-color: #f8f9fa; padding: 15px; margin: 15px 0; border-left: 4px solid #f44336; font-family: monospace; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🚨 System Error Alert</h1>
            <p>Eufy Automation System encountered an error</p>
        </div>
        
        <div class="content">
            <h2>Error Details</h2>
            <div class="error-details">
                <p><strong>Error:</strong> ${error.message}</p>
                <p><strong>Time:</strong> ${moment().format('YYYY-MM-DD HH:mm:ss')}</p>
                ${Object.keys(context).length > 0 ? `<p><strong>Context:</strong> ${JSON.stringify(context, null, 2)}</p>` : ''}
            </div>
            
            <p>Please check the system logs for more details and take appropriate action.</p>
        </div>
    </body>
    </html>
    `;
  }

  generateErrorNotificationText(error, context) {
    return `
SYSTEM ERROR ALERT - Eufy Automation System

Error: ${error.message}
Time: ${moment().format('YYYY-MM-DD HH:mm:ss')}
${Object.keys(context).length > 0 ? `Context: ${JSON.stringify(context, null, 2)}` : ''}

Please check the system logs for more details and take appropriate action.
    `.trim();
  }
}

module.exports = EmailService; 