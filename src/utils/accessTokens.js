const crypto = require('crypto');
const moment = require('moment');
const logger = require('./logger');

class AccessTokenManager {
  constructor() {
    // In-memory store for active tokens (in production, use Redis/database)
    this.activeTokens = new Map();
    this.activeCodes = new Map();
  }

  /**
   * Generate a secure access token for door unlock
   */
  generateAccessToken(event) {
    const tokenData = {
      eventId: event.id,
      attendeeEmail: event.attendeeEmail,
      startTime: event.startTime,
      endTime: event.endTime,
      title: event.title,
      generated: new Date(),
      used: false
    };

    // Generate random token
    const token = crypto.randomBytes(32).toString('hex');
    
    // Store token with expiration
    this.activeTokens.set(token, tokenData);
    
    // Auto-cleanup expired tokens
    setTimeout(() => {
      this.cleanupExpiredToken(token);
    }, this.getTokenLifetime(event));

    logger.info('Access token generated', {
      token: token.substring(0, 8) + '...',
      eventId: event.id,
      attendeeEmail: event.attendeeEmail,
      expiresAt: moment(event.endTime).add(30, 'minutes').toISOString()
    });

    return token;
  }

  /**
   * Generate a 6-digit access code
   */
  generateAccessCode(event) {
    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    const codeData = {
      eventId: event.id,
      attendeeEmail: event.attendeeEmail,
      startTime: event.startTime,
      endTime: event.endTime,
      title: event.title,
      generated: new Date(),
      used: false
    };

    this.activeCodes.set(code, codeData);
    
    // Auto-cleanup expired codes
    setTimeout(() => {
      this.cleanupExpiredCode(code);
    }, this.getTokenLifetime(event));

    logger.info('Access code generated', {
      code: code.substring(0, 2) + '****',
      eventId: event.id,
      attendeeEmail: event.attendeeEmail
    });

    return code;
  }

  /**
   * Validate and use an access token
   */
  validateAccessToken(token) {
    const tokenData = this.activeTokens.get(token);
    
    if (!tokenData) {
      logger.warn('Invalid access token attempted', { token: token.substring(0, 8) + '...' });
      return { valid: false, reason: 'Token not found' };
    }

    if (tokenData.used) {
      logger.warn('Already used access token attempted', { 
        token: token.substring(0, 8) + '...',
        eventId: tokenData.eventId 
      });
      return { valid: false, reason: 'Token already used' };
    }

    const now = new Date();
    const startTime = new Date(tokenData.startTime);
    const endTime = new Date(tokenData.endTime);
    
    // Allow access 15 minutes before booking and 30 minutes after
    const accessStart = moment(startTime).subtract(15, 'minutes').toDate();
    const accessEnd = moment(endTime).add(30, 'minutes').toDate();

    if (now < accessStart) {
      logger.warn('Access token used too early', {
        token: token.substring(0, 8) + '...',
        currentTime: now.toISOString(),
        allowedFrom: accessStart.toISOString()
      });
      return { valid: false, reason: 'Too early - access starts at ' + moment(accessStart).format('HH:mm') };
    }

    if (now > accessEnd) {
      logger.warn('Access token expired', {
        token: token.substring(0, 8) + '...',
        currentTime: now.toISOString(),
        expiredAt: accessEnd.toISOString()
      });
      return { valid: false, reason: 'Token expired' };
    }

    // Mark as used
    tokenData.used = true;
    tokenData.usedAt = now;
    this.activeTokens.set(token, tokenData);

    logger.info('Access token validated and used', {
      token: token.substring(0, 8) + '...',
      eventId: tokenData.eventId,
      attendeeEmail: tokenData.attendeeEmail,
      title: tokenData.title
    });

    return { 
      valid: true, 
      eventData: tokenData,
      reason: 'Access granted'
    };
  }

  /**
   * Validate and use an access code
   */
  validateAccessCode(code) {
    const codeData = this.activeCodes.get(code);
    
    if (!codeData) {
      logger.warn('Invalid access code attempted', { code: code.substring(0, 2) + '****' });
      return { valid: false, reason: 'Invalid code' };
    }

    if (codeData.used) {
      logger.warn('Already used access code attempted', { 
        code: code.substring(0, 2) + '****',
        eventId: codeData.eventId 
      });
      return { valid: false, reason: 'Code already used' };
    }

    const now = new Date();
    const startTime = new Date(codeData.startTime);
    const endTime = new Date(codeData.endTime);
    
    // Allow access 15 minutes before booking and 30 minutes after
    const accessStart = moment(startTime).subtract(15, 'minutes').toDate();
    const accessEnd = moment(endTime).add(30, 'minutes').toDate();

    if (now < accessStart || now > accessEnd) {
      logger.warn('Access code used outside valid time window', {
        code: code.substring(0, 2) + '****',
        currentTime: now.toISOString(),
        validFrom: accessStart.toISOString(),
        validUntil: accessEnd.toISOString()
      });
      return { valid: false, reason: 'Code not valid at this time' };
    }

    // Mark as used
    codeData.used = true;
    codeData.usedAt = now;
    this.activeCodes.set(code, codeData);

    logger.info('Access code validated and used', {
      code: code.substring(0, 2) + '****',
      eventId: codeData.eventId,
      attendeeEmail: codeData.attendeeEmail,
      title: codeData.title
    });

    return { 
      valid: true, 
      eventData: codeData,
      reason: 'Access granted'
    };
  }

  /**
   * Get the lifetime of a token in milliseconds
   */
  getTokenLifetime(event) {
    const endTime = moment(event.endTime);
    const expiry = endTime.add(30, 'minutes'); // Valid until 30 min after booking ends
    return expiry.diff(moment());
  }

  /**
   * Cleanup expired token
   */
  cleanupExpiredToken(token) {
    if (this.activeTokens.has(token)) {
      const tokenData = this.activeTokens.get(token);
      this.activeTokens.delete(token);
      logger.info('Expired access token cleaned up', {
        token: token.substring(0, 8) + '...',
        eventId: tokenData.eventId
      });
    }
  }

  /**
   * Cleanup expired code
   */
  cleanupExpiredCode(code) {
    if (this.activeCodes.has(code)) {
      const codeData = this.activeCodes.get(code);
      this.activeCodes.delete(code);
      logger.info('Expired access code cleaned up', {
        code: code.substring(0, 2) + '****',
        eventId: codeData.eventId
      });
    }
  }

  /**
   * Get all active tokens (for admin/debugging)
   */
  getActiveTokens() {
    const tokens = [];
    for (const [token, data] of this.activeTokens.entries()) {
      tokens.push({
        token: token.substring(0, 8) + '...',
        eventId: data.eventId,
        attendeeEmail: data.attendeeEmail,
        title: data.title,
        startTime: data.startTime,
        endTime: data.endTime,
        used: data.used,
        generated: data.generated,
        usedAt: data.usedAt
      });
    }
    return tokens;
  }

  /**
   * Get all active codes (for admin/debugging)
   */
  getActiveCodes() {
    const codes = [];
    for (const [code, data] of this.activeCodes.entries()) {
      codes.push({
        code: code.substring(0, 2) + '****',
        eventId: data.eventId,
        attendeeEmail: data.attendeeEmail,
        title: data.title,
        startTime: data.startTime,
        endTime: data.endTime,
        used: data.used,
        generated: data.generated,
        usedAt: data.usedAt
      });
    }
    return codes;
  }
}

// Singleton instance
const accessTokenManager = new AccessTokenManager();

module.exports = accessTokenManager; 