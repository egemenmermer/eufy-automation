const { EufySecurityApi, Device } = require('eufy-security-client');
const logger = require('../utils/logger');
const { config } = require('../config');

class EufyService {
  constructor() {
    this.api = null;
    this.smartLock = null;
    this.isConnected = false;
    this.connectionAttempts = 0;
    this.maxConnectionAttempts = 3;
  }

  async initialize() {
    try {
      logger.eufy('Initializing Eufy Security API...');
      
      this.api = new EufySecurityApi({
        username: config.eufy.username,
        password: config.eufy.password,
        country: 'US', // Adjust based on your region
        language: 'en',
        trustedDeviceName: 'eufy-automation-server',
        persistentDir: './data/eufy-persistent',
        p2pConnectionSetup: 2, // Quickest connection mode
        pollingIntervalMinutes: 10,
        eventDurationSeconds: 10,
      });

      // Set up event listeners
      this.setupEventListeners();

      // Connect to Eufy cloud
      await this.connect();
      
      // Find and initialize the smart lock
      await this.findSmartLock();
      
      logger.eufy('Eufy service initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize Eufy service', { error: error.message });
      throw error;
    }
  }

  async connect() {
    try {
      this.connectionAttempts++;
      logger.eufy(`Connecting to Eufy cloud (attempt ${this.connectionAttempts}/${this.maxConnectionAttempts})...`);
      
      await this.api.connect();
      this.isConnected = true;
      this.connectionAttempts = 0;
      
      logger.eufy('Successfully connected to Eufy cloud');
    } catch (error) {
      this.isConnected = false;
      logger.error(`Failed to connect to Eufy cloud (attempt ${this.connectionAttempts})`, { error: error.message });
      
      if (this.connectionAttempts < this.maxConnectionAttempts) {
        logger.eufy(`Retrying connection in 10 seconds...`);
        setTimeout(() => this.connect(), 10000);
      } else {
        throw error;
      }
    }
  }

  setupEventListeners() {
    this.api.on('device added', (device) => {
      logger.eufy('Device added', { 
        name: device.getName(), 
        serial: device.getSerial(),
        type: device.getDeviceType()
      });
    });

    this.api.on('device removed', (device) => {
      logger.eufy('Device removed', { 
        name: device.getName(), 
        serial: device.getSerial()
      });
    });

    this.api.on('connect', () => {
      logger.eufy('Connected to Eufy cloud');
      this.isConnected = true;
    });

    this.api.on('close', () => {
      logger.eufy('Disconnected from Eufy cloud');
      this.isConnected = false;
    });
  }

  async findSmartLock() {
    try {
      // Get all devices
      const stations = this.api.getStations();
      let foundLock = null;

      for (const station of Object.values(stations)) {
        const devices = station.getDevices();
        
        for (const device of Object.values(devices)) {
          logger.eufy('Found device', {
            name: device.getName(),
            serial: device.getSerial(),
            type: device.getDeviceType(),
            isLock: device.isLock?.() || false
          });

          // Check if this is our target lock
          if (device.getSerial() === config.eufy.deviceSerial) {
            foundLock = device;
            break;
          }
        }
        
        if (foundLock) break;
      }

      if (!foundLock) {
        throw new Error(`Smart lock with serial ${config.eufy.deviceSerial} not found`);
      }

      this.smartLock = foundLock;
      logger.eufy('Smart lock found and configured', {
        name: foundLock.getName(),
        serial: foundLock.getSerial(),
        isLocked: await this.isLocked()
      });

      return foundLock;
    } catch (error) {
      logger.error('Error finding smart lock', { error: error.message });
      throw error;
    }
  }

  async unlockDoor() {
    try {
      if (!this.smartLock) {
        throw new Error('Smart lock not initialized');
      }

      if (!this.isConnected) {
        logger.eufy('Not connected, attempting to reconnect...');
        await this.connect();
      }

      logger.eufy('Unlocking door...', { device: this.smartLock.getName() });
      
      await this.smartLock.unlock();
      
      logger.eufy('Door unlocked successfully');
      logger.security('Door unlock command executed', {
        device: this.smartLock.getName(),
        serial: this.smartLock.getSerial(),
        timestamp: new Date().toISOString()
      });

      return true;
    } catch (error) {
      logger.error('Failed to unlock door', { error: error.message });
      throw error;
    }
  }

  async lockDoor() {
    try {
      if (!this.smartLock) {
        throw new Error('Smart lock not initialized');
      }

      if (!this.isConnected) {
        logger.eufy('Not connected, attempting to reconnect...');
        await this.connect();
      }

      logger.eufy('Locking door...', { device: this.smartLock.getName() });
      
      await this.smartLock.lock();
      
      logger.eufy('Door locked successfully');
      logger.security('Door lock command executed', {
        device: this.smartLock.getName(),
        serial: this.smartLock.getSerial(),
        timestamp: new Date().toISOString()
      });

      return true;
    } catch (error) {
      logger.error('Failed to lock door', { error: error.message });
      throw error;
    }
  }

  async isLocked() {
    try {
      if (!this.smartLock) {
        return null;
      }

      // This depends on the specific Eufy device API
      // Some devices may have different property names
      const lockStatus = this.smartLock.getPropertyValue('lockStatus') || 
                        this.smartLock.getPropertyValue('state') ||
                        this.smartLock.isLocked?.();
      
      return lockStatus;
    } catch (error) {
      logger.error('Error checking lock status', { error: error.message });
      return null;
    }
  }

  async getDoorStatus() {
    try {
      if (!this.smartLock) {
        return { available: false };
      }

      const isLocked = await this.isLocked();
      const batteryLevel = this.smartLock.getPropertyValue('batteryLevel');
      
      return {
        available: true,
        isLocked,
        batteryLevel,
        name: this.smartLock.getName(),
        serial: this.smartLock.getSerial(),
        lastUpdate: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error getting door status', { error: error.message });
      return { available: false, error: error.message };
    }
  }

  async cleanup() {
    try {
      if (this.api && this.isConnected) {
        await this.api.close();
        logger.eufy('Eufy service cleaned up');
      }
    } catch (error) {
      logger.error('Error during Eufy service cleanup', { error: error.message });
    }
  }
}

module.exports = EufyService; 