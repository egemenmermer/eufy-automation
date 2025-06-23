// Mock Eufy Service for testing without real hardware
const logger = require('../../src/utils/logger');
const { config } = require('../../src/config');

class MockEufyService {
  constructor() {
    this.isConnected = false;
    this.smartLock = null;
    this.mockDeviceState = {
      isLocked: true,
      batteryLevel: 85,
      lastUpdate: new Date()
    };
  }

  async initialize() {
    try {
      logger.eufy('🧪 Initializing Mock Eufy Service (TEST MODE)...');
      
      // Simulate connection delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.isConnected = true;
      this.smartLock = {
        getName: () => 'Mock Smart Lock',
        getSerial: () => config.eufy.deviceSerial,
        getDeviceType: () => 'Smart Lock'
      };
      
      logger.eufy('✅ Mock Eufy service initialized successfully');
      return true;
    } catch (error) {
      logger.error('❌ Failed to initialize Mock Eufy service', { error: error.message });
      throw error;
    }
  }

  async unlockDoor() {
    try {
      if (!this.smartLock) {
        throw new Error('Mock smart lock not initialized');
      }

      logger.eufy('🔓 Mock: Unlocking door...', { device: this.smartLock.getName() });
      
      // Simulate unlock delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      this.mockDeviceState.isLocked = false;
      this.mockDeviceState.lastUpdate = new Date();
      
      logger.eufy('✅ Mock: Door unlocked successfully');
      logger.security('🔓 Mock door unlock command executed', {
        device: this.smartLock.getName(),
        serial: this.smartLock.getSerial(),
        timestamp: new Date().toISOString()
      });

      return true;
    } catch (error) {
      logger.error('❌ Mock: Failed to unlock door', { error: error.message });
      throw error;
    }
  }

  async lockDoor() {
    try {
      if (!this.smartLock) {
        throw new Error('Mock smart lock not initialized');
      }

      logger.eufy('🔒 Mock: Locking door...', { device: this.smartLock.getName() });
      
      // Simulate lock delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      this.mockDeviceState.isLocked = true;
      this.mockDeviceState.lastUpdate = new Date();
      
      logger.eufy('✅ Mock: Door locked successfully');
      logger.security('🔒 Mock door lock command executed', {
        device: this.smartLock.getName(),
        serial: this.smartLock.getSerial(),
        timestamp: new Date().toISOString()
      });

      return true;
    } catch (error) {
      logger.error('❌ Mock: Failed to lock door', { error: error.message });
      throw error;
    }
  }

  async isLocked() {
    return this.mockDeviceState.isLocked;
  }

  async getDoorStatus() {
    try {
      if (!this.smartLock) {
        return { available: false };
      }

      return {
        available: true,
        isLocked: this.mockDeviceState.isLocked,
        batteryLevel: this.mockDeviceState.batteryLevel,
        name: this.smartLock.getName(),
        serial: this.smartLock.getSerial(),
        lastUpdate: this.mockDeviceState.lastUpdate.toISOString(),
        mockMode: true
      };
    } catch (error) {
      logger.error('❌ Mock: Error getting door status', { error: error.message });
      return { available: false, error: error.message };
    }
  }

  async cleanup() {
    logger.eufy('🧪 Mock Eufy service cleaned up');
    this.isConnected = false;
  }
}

module.exports = MockEufyService; 