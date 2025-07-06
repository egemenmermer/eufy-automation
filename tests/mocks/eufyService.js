// Mock Eufy Service for testing without real hardware
const logger = require('../../src/utils/logger');
const { config } = require('../../src/config');

class MockEufyService {
  constructor() {
    this.isLocked = true;
    this.isConnected = false;
    this.codes = [];
    
    // Replace methods with spies
    this.initialize = jest.fn().mockImplementation(() => {
      this.isConnected = true;
      return Promise.resolve(true);
    });
    this.connect = jest.fn().mockImplementation(() => {
      this.isConnected = true;
      return Promise.resolve(true);
    });
    this.unlockDoor = jest.fn().mockImplementation(() => {
      this.isLocked = false;
      return Promise.resolve({ success: true, message: 'Mock door unlocked successfully' });
    });
    this.lockDoor = jest.fn().mockImplementation(() => {
      this.isLocked = true;
      return Promise.resolve({ success: true, message: 'Mock door locked successfully' });
    });
    this.addTemporaryCode = jest.fn().mockImplementation((code, name) => {
      this.codes.push({ code, name });
      return Promise.resolve(true);
    });
    this.removeTemporaryCode = jest.fn().mockImplementation((code, name) => {
      this.codes = this.codes.filter(c => c.code !== code || c.name !== name);
      return Promise.resolve(true);
    });
    this.listTemporaryCodes = jest.fn().mockResolvedValue(this.codes);
    this.cleanup = jest.fn().mockResolvedValue(true);
  }

  getDoorStatus() {
    return Promise.resolve({
      available: true,
      isLocked: this.isLocked,
      batteryLevel: 95,
      mockMode: true
    });
  }

  getStatus() {
    return this.getDoorStatus();
  }
}

module.exports = MockEufyService; 