const crypto = require('crypto');
const logger = require('./logger');

/**
 * Door Code Generator Utility
 * Generates unique, secure door codes for each appointment
 */

class DoorCodeGenerator {
  constructor() {
    this.usedCodes = new Set(); // Track recent codes to avoid duplicates
    this.codeLength = 4; // 4-digit codes by default
    this.codeHistory = new Map(); // appointmentId -> code mapping
  }

  /**
   * Generate a random door code for an appointment
   * @param {string} appointmentId - Unique appointment identifier
   * @param {Object} options - Generation options
   * @returns {string} Generated door code
   */
  generateCode(appointmentId, options = {}) {
    const {
      length = this.codeLength,
      excludePatterns = ['0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999'],
      maxAttempts = 100
    } = options;

    let attempts = 0;
    let code = null;

    while (attempts < maxAttempts) {
      // Generate random numeric code
      code = this.generateRandomNumericCode(length);
      
      // Check if code meets security criteria
      if (this.isCodeSecure(code, excludePatterns)) {
        // Store the code mapping
        this.codeHistory.set(appointmentId, {
          code: code,
          generatedAt: new Date(),
          appointmentId: appointmentId
        });
        
        // Add to used codes (with cleanup)
        this.usedCodes.add(code);
        this.cleanupOldCodes();
        
        logger.info('Door code generated successfully', {
          appointmentId: appointmentId,
          codeLength: length,
          attempts: attempts + 1
        });
        
        return code;
      }
      
      attempts++;
    }

    // Fallback: generate time-based code if random generation fails
    logger.warn('Failed to generate secure random code, using time-based fallback', {
      appointmentId: appointmentId,
      attempts: attempts
    });
    
    return this.generateTimeBased(appointmentId);
  }

  /**
   * Generate a random numeric code
   * @param {number} length - Code length
   * @returns {string} Random numeric code
   */
  generateRandomNumericCode(length) {
    const randomBytes = crypto.randomBytes(Math.ceil(length / 2));
    let code = '';
    
    for (let i = 0; i < length; i++) {
      const randomDigit = randomBytes[i % randomBytes.length] % 10;
      code += randomDigit.toString();
    }
    
    return code;
  }

  /**
   * Check if a code meets security criteria
   * @param {string} code - Code to check
   * @param {Array} excludePatterns - Patterns to exclude
   * @returns {boolean} Whether code is secure
   */
  isCodeSecure(code, excludePatterns) {
    // Check against exclude patterns
    if (excludePatterns.includes(code)) {
      return false;
    }
    
    // Check if recently used
    if (this.usedCodes.has(code)) {
      return false;
    }
    
    // Check for simple patterns (e.g., 1234, 4321)
    if (this.hasSimplePattern(code)) {
      return false;
    }
    
    return true;
  }

  /**
   * Check for simple numeric patterns
   * @param {string} code - Code to check
   * @returns {boolean} Whether code has simple patterns
   */
  hasSimplePattern(code) {
    // Sequential ascending (1234, 2345, etc.)
    let isAscending = true;
    for (let i = 1; i < code.length; i++) {
      if (parseInt(code[i]) !== parseInt(code[i-1]) + 1) {
        isAscending = false;
        break;
      }
    }
    if (isAscending) return true;
    
    // Sequential descending (4321, 5432, etc.)
    let isDescending = true;
    for (let i = 1; i < code.length; i++) {
      if (parseInt(code[i]) !== parseInt(code[i-1]) - 1) {
        isDescending = false;
        break;
      }
    }
    if (isDescending) return true;
    
    return false;
  }

  /**
   * Generate time-based code as fallback
   * @param {string} appointmentId - Appointment identifier
   * @returns {string} Time-based code
   */
  generateTimeBased(appointmentId) {
    const now = new Date();
    const timestamp = now.getTime();
    
    // Use last 4 digits of timestamp + appointment ID hash
    const hash = crypto.createHash('md5').update(`${appointmentId}-${timestamp}`).digest('hex');
    const code = (parseInt(hash.substring(0, 8), 16) % 9000 + 1000).toString();
    
    return code;
  }

  /**
   * Get code for a specific appointment
   * @param {string} appointmentId - Appointment identifier
   * @returns {Object|null} Code data or null if not found
   */
  getCodeForAppointment(appointmentId) {
    return this.codeHistory.get(appointmentId) || null;
  }

  /**
   * Validate if a code belongs to an appointment
   * @param {string} code - Code to validate
   * @param {string} appointmentId - Appointment identifier
   * @returns {boolean} Whether code is valid for appointment
   */
  validateCode(code, appointmentId) {
    const codeData = this.codeHistory.get(appointmentId);
    return codeData && codeData.code === code;
  }

  /**
   * Clean up old codes to prevent memory issues
   */
  cleanupOldCodes() {
    if (this.usedCodes.size > 1000) {
      // Clear half of the used codes when limit is reached
      const codesArray = Array.from(this.usedCodes);
      const keepCount = Math.floor(codesArray.length / 2);
      
      this.usedCodes.clear();
      codesArray.slice(-keepCount).forEach(code => this.usedCodes.add(code));
    }

    // Clean up old code history (older than 24 hours)
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    for (const [appointmentId, codeData] of this.codeHistory.entries()) {
      if (codeData.generatedAt < cutoffTime) {
        this.codeHistory.delete(appointmentId);
      }
    }
  }

  /**
   * Get statistics about code generation
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      totalCodesGenerated: this.codeHistory.size,
      recentCodesTracked: this.usedCodes.size,
      codeLength: this.codeLength,
      oldestCode: Array.from(this.codeHistory.values())
        .reduce((oldest, current) => 
          !oldest || current.generatedAt < oldest.generatedAt ? current : oldest, null)?.generatedAt
    };
  }
}

// Create singleton instance
const doorCodeGenerator = new DoorCodeGenerator();

module.exports = doorCodeGenerator; 