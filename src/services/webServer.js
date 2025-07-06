const express = require('express');
const moment = require('moment');
const logger = require('../utils/logger');
const accessTokenManager = require('../utils/accessTokens');
const doorCodeGenerator = require('../utils/doorCodeGenerator');
const config = require('../config');

class WebServer {
  constructor(automationEngine) {
    this.app = express();
    this.server = null;
    this.engine = automationEngine;
    this.eufyService = automationEngine.eufyService;
    this.emailService = automationEngine.emailService;
    this.ameliaService = automationEngine.ameliaService;
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    // Parse JSON bodies
    this.app.use(express.json());
    
    // Parse URL-encoded bodies
    this.app.use(express.urlencoded({ extended: true }));
    
    // Basic logging middleware
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });

    // Security headers
    this.app.use((req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      next();
    });
  }

  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        services: {
          eufy: 'connected',
          email: 'connected',
          amelia: this.ameliaService.isConnected ? 'connected' : 'disconnected'
        }
      });
    });

    // System status endpoint
    this.app.get('/status', async (req, res) => {
      try {
        const status = await this.engine.getSystemStatus();
        res.json(status);
      } catch (error) {
        logger.error('Error getting system status', { error: error.message });
        res.status(500).json({ error: 'Failed to get system status' });
      }
    });

    // Amelia webhook endpoint for real-time booking notifications
    this.app.post('/webhook/amelia/booking', express.json(), async (req, res) => {
      try {
        logger.info('Received Amelia webhook', { 
          headers: req.headers,
          body: req.body 
        });

        // Verify webhook if secret is configured
        if (config.amelia.webhookSecret) {
          const signature = req.headers['x-amelia-signature'] || req.headers['signature'];
          if (!this.verifyWebhookSignature(req.body, signature)) {
            logger.warn('Invalid webhook signature');
            return res.status(401).json({ error: 'Invalid signature' });
          }
        }

        // Process the booking webhook
        const result = this.ameliaService.processWebhookNotification(req.body);
        
        if (result.success && result.appointment) {
          // Check if this appointment is starting soon
          if (result.appointment.isStartingSoon(5)) {
            logger.info('Processing webhook appointment for immediate door access', {
              appointmentId: result.appointment.id,
              customer: result.appointment.customer.email,
              startTime: result.appointment.startTimeFormatted
            });

            // Handle the booking appointment through automation engine
            // This will unlock the door and send confirmation email
            if (this.engine) {
              await this.engine.handleBookingAppointment(result.appointment);
            }
          } else {
            logger.info('Webhook appointment scheduled for future processing', {
              appointmentId: result.appointment.id,
              startTime: result.appointment.startTimeFormatted,
              minutesUntilStart: result.appointment.startTime.diff(moment(), 'minutes')
            });
          }

          res.json({ 
            success: true, 
            message: 'Webhook processed successfully',
            appointmentId: result.appointment.id 
          });
        } else {
          logger.warn('Failed to process webhook', { error: result.error });
          res.status(400).json({ error: result.error || 'Failed to process webhook' });
        }

      } catch (error) {
        logger.error('Error processing Amelia webhook', { error: error.message });
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Door control endpoints
    this.app.post('/door/unlock', async (req, res) => {
      try {
        const result = await this.eufyService.unlockDoor();
        logger.info('Manual door unlock via API', { success: result.success });
        res.json(result);
      } catch (error) {
        logger.error('Error unlocking door via API', { error: error.message });
        res.status(500).json({ error: 'Failed to unlock door' });
      }
    });

    this.app.post('/door/lock', async (req, res) => {
      try {
        const result = await this.eufyService.lockDoor();
        logger.info('Manual door lock via API', { success: result.success });
        res.json(result);
      } catch (error) {
        logger.error('Error locking door via API', { error: error.message });
        res.status(500).json({ error: 'Failed to lock door' });
      }
    });

    // Email test endpoint
    this.app.post('/email/test', async (req, res) => {
      try {
        const { to } = req.body;
        if (!to) {
          return res.status(400).json({ error: 'Email address required' });
        }

        const result = await this.emailService.sendTestEmail(to);
        logger.info('Test email sent via API', { to, success: result.success });
        res.json(result);
      } catch (error) {
        logger.error('Error sending test email via API', { error: error.message });
        res.status(500).json({ error: 'Failed to send test email' });
      }
    });

    // Magic access link endpoint
    this.app.get('/access/unlock', async (req, res) => {
      try {
        const { token, booking } = req.query;
        
        if (!token) {
          return res.status(400).send(this.generateErrorPage('Missing access token', 'Please check your email for the correct access link.'));
        }

        const validation = accessTokenManager.validateAccessToken(token);
        
        if (!validation.valid) {
          logger.warn('Invalid access attempt via link', {
            token: token.substring(0, 8) + '...',
            reason: validation.reason,
            ip: req.ip
          });
          
          return res.status(403).send(this.generateErrorPage('Access Denied', validation.reason));
        }

        // Token is valid, unlock the door
        const unlockResult = await this.eufyService.unlockDoor(validation.eventData.title);
        
        if (unlockResult.success) {
          logger.info('Door unlocked via magic link', {
            eventId: validation.eventData.eventId,
            attendeeEmail: validation.eventData.attendeeEmail,
            ip: req.ip
          });
          
          res.send(this.generateSuccessPage(validation.eventData, unlockResult.lockDurationMinutes));
        } else {
          logger.error('Failed to unlock door via magic link', {
            eventId: validation.eventData.eventId,
            error: unlockResult.error
          });
          
          res.status(500).send(this.generateErrorPage('Access System Error', 'Unable to unlock door. Please contact support.'));
        }
        
      } catch (error) {
        logger.error('Error processing magic link access', {
          error: error.message,
          token: req.query.token ? req.query.token.substring(0, 8) + '...' : 'none',
          ip: req.ip
        });
        
        res.status(500).send(this.generateErrorPage('System Error', 'An unexpected error occurred. Please contact support.'));
      }
    });

    // Amelia door code endpoint
    this.app.post('/access/code', async (req, res) => {
      try {
        const { code } = req.body;
        
        if (!code || code.length !== 4) {
          return res.status(400).json({
            success: false,
            message: 'Please enter a valid 4-digit door code'
          });
        }

        // Get currently active appointments
        let activeAppointments = [];
        if (this.ameliaService) {
          try {
            activeAppointments = await this.ameliaService.getCurrentlyActiveAppointments();
          } catch (error) {
            logger.error('Failed to get active appointments', { error: error.message });
          }
        }

        // Validate door code against active appointments
        let validAppointment = null;
        for (const appointment of activeAppointments) {
          if (doorCodeGenerator.validateCode(code, appointment.id.toString())) {
            validAppointment = appointment;
            break;
          }
        }

        if (!validAppointment) {
          logger.warn('Invalid door code attempt', {
            code: code.substring(0, 2) + '**',
            ip: req.ip,
            activeAppointments: activeAppointments.length
          });
          
          return res.status(403).json({
            success: false,
            message: 'Invalid door code or no active appointment found'
          });
        }

        // Code is valid, unlock the door
        await this.eufyService.unlockDoor();
        
        logger.info('Door unlocked via Amelia door code', {
          appointmentId: validAppointment.id,
          service: validAppointment.service,
          customerEmail: validAppointment.customer.email,
          ip: req.ip,
          doorCode: code
        });
        
        res.json({
          success: true,
          message: 'Access granted! Door has been unlocked.',
          appointment: {
            service: validAppointment.service,
            startTime: validAppointment.startTimeFormatted,
            endTime: validAppointment.endTimeFormatted
          }
        });
        
      } catch (error) {
        logger.error('Error processing Amelia door code', {
          error: error.message,
          code: req.body.code ? req.body.code.substring(0, 2) + '**' : 'none',
          ip: req.ip
        });
        
        res.status(500).json({
          success: false,
          message: 'An unexpected error occurred. Please contact support.'
        });
      }
    });

    // Access code entry page
    this.app.get('/access/code', (req, res) => {
      res.send(this.generateCodeEntryPage());
    });

    // Admin endpoints for debugging
    this.app.get('/admin/tokens', (req, res) => {
      // In production, add authentication here
      res.json({
        activeTokens: accessTokenManager.getActiveTokens(),
        activeCodes: accessTokenManager.getActiveCodes()
      });
    });

    // Door code statistics endpoint
    this.app.get('/admin/door-codes/stats', (req, res) => {
      try {
        const stats = doorCodeGenerator.getStats();
        res.json({
          success: true,
          stats: stats,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error('Error getting door code stats', { error: error.message });
        res.status(500).json({ error: 'Failed to get door code statistics' });
      }
    });

    // Temporary codes management endpoints
    this.app.get('/codes/list', async (req, res) => {
      try {
        const codes = await this.eufyService.listTemporaryCodes();
        res.json({ 
          success: true, 
          codes: codes,
          count: codes.length 
        });
      } catch (error) {
        logger.error('Failed to list temporary codes', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.post('/codes/add', async (req, res) => {
      try {
        const { code, name, startTime, endTime } = req.body;
        
        if (!code || !name || !startTime || !endTime) {
          return res.status(400).json({ 
            success: false, 
            error: 'Missing required fields: code, name, startTime, endTime' 
          });
        }

        await this.eufyService.addTemporaryCode(code, name, startTime, endTime);
        res.json({ 
          success: true, 
          message: 'Temporary code added successfully',
          code: code.substring(0, 2) + '****',
          name: name
        });
      } catch (error) {
        logger.error('Failed to add temporary code', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.delete('/codes/remove', async (req, res) => {
      try {
        const { code, name } = req.body;
        
        if (!code || !name) {
          return res.status(400).json({ 
            success: false, 
            error: 'Missing required fields: code, name' 
          });
        }

        await this.eufyService.removeTemporaryCode(code, name);
        res.json({ 
          success: true, 
          message: 'Temporary code removed successfully',
          code: code.substring(0, 2) + '****',
          name: name
        });
      } catch (error) {
        logger.error('Failed to remove temporary code', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).send(this.generateErrorPage('Page Not Found', 'The requested page could not be found.'));
    });

    // Error handler
    this.app.use((error, req, res, next) => {
      logger.error('Express error handler', {
        error: error.message,
        stack: error.stack,
        path: req.path
      });
      
      res.status(500).send(this.generateErrorPage('Server Error', 'An unexpected server error occurred.'));
    });
  }

  generateSuccessPage(eventData, lockDurationMinutes) {
    const startTime = moment(eventData.startTime).format('MMMM Do YYYY, h:mm A');
    
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Access Granted</title>
        <style>
            body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                margin: 0; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh; display: flex; align-items: center; justify-content: center;
            }
            .container { 
                background: white; border-radius: 15px; padding: 40px; max-width: 500px; width: 100%;
                box-shadow: 0 20px 40px rgba(0,0,0,0.1); text-align: center;
            }
            .success-icon { font-size: 80px; color: #4CAF50; margin-bottom: 20px; }
            h1 { color: #333; margin-bottom: 10px; font-size: 2em; }
            .subtitle { color: #666; margin-bottom: 30px; font-size: 1.1em; }
            .event-info { 
                background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;
                border-left: 4px solid #4CAF50;
            }
            .warning { 
                background: #fff3cd; padding: 15px; border-radius: 8px; margin-top: 20px;
                border: 1px solid #ffeaa7; color: #856404;
            }
            .countdown { 
                font-size: 1.2em; font-weight: bold; color: #4CAF50; margin: 15px 0;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="success-icon">🔓</div>
            <h1>Access Granted!</h1>
            <p class="subtitle">The door has been successfully unlocked</p>
            
            <div class="event-info">
                <h3>${eventData.title}</h3>
                <p><strong>Date & Time:</strong> ${startTime}</p>
                <p><strong>Attendee:</strong> ${eventData.attendeeEmail}</p>
            </div>
            
            <div class="countdown">
                Door will lock automatically in ${lockDurationMinutes} minutes
            </div>
            
            <div class="warning">
                <strong>Important:</strong>
                <ul style="text-align: left; margin: 10px 0;">
                    <li>Please ensure the door is properly closed when you leave</li>
                    <li>This access link can only be used once</li>
                    <li>Report any issues to support immediately</li>
                </ul>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  generateErrorPage(title, message) {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Access Error</title>
        <style>
            body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                margin: 0; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh; display: flex; align-items: center; justify-content: center;
            }
            .container { 
                background: white; border-radius: 15px; padding: 40px; max-width: 500px; width: 100%;
                box-shadow: 0 20px 40px rgba(0,0,0,0.1); text-align: center;
            }
            .error-icon { font-size: 80px; color: #f44336; margin-bottom: 20px; }
            h1 { color: #333; margin-bottom: 10px; font-size: 2em; }
            .message { color: #666; margin-bottom: 30px; font-size: 1.1em; line-height: 1.5; }
            .support { 
                background: #f8f9fa; padding: 20px; border-radius: 10px; margin-top: 20px;
                border-left: 4px solid #007bff;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="error-icon">🚫</div>
            <h1>${title}</h1>
            <p class="message">${message}</p>
            
            <div class="support">
                <h3>Need Help?</h3>
                <p>If you believe this is an error, please contact support with your booking details.</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  generateCodeEntryPage() {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Enter Door Code - Euphorium</title>
        <style>
            body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                margin: 0; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh; display: flex; align-items: center; justify-content: center;
            }
            .container { 
                background: white; border-radius: 15px; padding: 40px; max-width: 400px; width: 100%;
                box-shadow: 0 20px 40px rgba(0,0,0,0.1); text-align: center;
            }
            .lock-icon { font-size: 80px; color: #666; margin-bottom: 20px; }
            h1 { color: #333; margin-bottom: 10px; font-size: 2em; }
            .subtitle { color: #666; margin-bottom: 30px; }
            .code-input { 
                width: 100%; padding: 15px; font-size: 1.8em; text-align: center; 
                border: 2px solid #ddd; border-radius: 8px; margin-bottom: 20px;
                letter-spacing: 0.5em;
            }
            .code-input:focus { border-color: #4CAF50; outline: none; }
            .unlock-btn { 
                width: 100%; padding: 15px; font-size: 1.1em; font-weight: bold;
                background: #4CAF50; color: white; border: none; border-radius: 8px;
                cursor: pointer; transition: background 0.3s;
            }
            .unlock-btn:hover { background: #45a049; }
            .unlock-btn:disabled { background: #ccc; cursor: not-allowed; }
            .message { margin-top: 20px; padding: 15px; border-radius: 8px; display: none; }
            .message.success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
            .message.error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
            .euphorium { color: #007bff; font-weight: bold; margin-bottom: 5px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="lock-icon">❄️</div>
            <div class="euphorium">Euphorium</div>
            <h1>Door Code</h1>
            <p class="subtitle">Enter your 4-digit door code from your booking email</p>
            
            <form id="codeForm">
                <input type="text" id="codeInput" class="code-input" 
                       placeholder="0000" maxlength="4" pattern="[0-9]{4}" required>
                <button type="submit" id="unlockBtn" class="unlock-btn">Unlock Door</button>
            </form>
            
            <div id="message" class="message"></div>
            
            <div style="margin-top: 30px; font-size: 0.9em; color: #666;">
                <p>Need help? WhatsApp: <a href="https://wa.me/971559021829" style="color: #25D366;">+971-559021829</a></p>
            </div>
        </div>
        
        <script>
            const form = document.getElementById('codeForm');
            const input = document.getElementById('codeInput');
            const button = document.getElementById('unlockBtn');
            const message = document.getElementById('message');
            
            // Auto-format input to only allow numbers
            input.addEventListener('input', function(e) {
                e.target.value = e.target.value.replace(/[^0-9]/g, '');
            });
            
            // Auto-submit when 4 digits are entered
            input.addEventListener('input', function(e) {
                if (e.target.value.length === 4) {
                    form.dispatchEvent(new Event('submit'));
                }
            });
            
            form.addEventListener('submit', async function(e) {
                e.preventDefault();
                
                const code = input.value.trim();
                if (code.length !== 4) {
                    showMessage('Please enter a valid 4-digit code', 'error');
                    return;
                }
                
                button.disabled = true;
                button.textContent = 'Unlocking...';
                
                try {
                    const response = await fetch('/access/code', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ code: code })
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        showMessage(result.message, 'success');
                        input.value = '';
                        if (result.appointment) {
                            setTimeout(() => {
                                showMessage('Welcome to ' + result.appointment.service + '! ' +
                                          'Door will lock automatically after your session.', 'success');
                            }, 2000);
                        }
                    } else {
                        showMessage(result.message, 'error');
                    }
                } catch (error) {
                    showMessage('Network error. Please try again.', 'error');
                }
                
                button.disabled = false;
                button.textContent = 'Unlock Door';
            });
            
            function showMessage(text, type) {
                message.textContent = text;
                message.className = 'message ' + type;
                message.style.display = 'block';
                
                if (type === 'error') {
                    setTimeout(() => {
                        message.style.display = 'none';
                    }, 5000);
                }
            }
        </script>
    </body>
    </html>
    `;
  }

  async start(port = config.webServer?.port || 3000) {
    try {
      this.server = this.app.listen(port, () => {
        logger.info('Web server started', { 
          port: port,
          endpoints: [
            `http://localhost:${port}/access/unlock`,
            `http://localhost:${port}/access/code`,
            `http://localhost:${port}/health`
          ]
        });
      });
      
      return { success: true, port: port };
    } catch (error) {
      logger.error('Failed to start web server', { error: error.message, port: port });
      throw error;
    }
  }

  async stop() {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          logger.info('Web server stopped');
          resolve();
        });
      });
    }
  }

  /**
   * Verify webhook signature for security
   * @param {Object} payload - Webhook payload
   * @param {string} signature - Signature from headers
   * @returns {boolean} Is signature valid
   */
  verifyWebhookSignature(payload, signature) {
    if (!signature || !config.amelia.webhookSecret) {
      return false;
    }

    try {
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', config.amelia.webhookSecret)
        .update(JSON.stringify(payload))
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      logger.error('Error verifying webhook signature', { error: error.message });
      return false;
    }
  }
}

module.exports = WebServer; 