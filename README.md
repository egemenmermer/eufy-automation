# 🔐 Smart Lock Automation with Google Calendar + Eufy Integration

A fully automated, real-time door access control system that connects WordPress booking systems (like Amelia) with Google Calendar and Eufy smart locks using Node.js.

## 🌟 Overview

This system allows users to book appointments through a website, which syncs to Google Calendar. A background service monitors these bookings and at the appropriate time, automatically unlocks a designated Eufy smart lock, sends access confirmation emails, and optionally re-locks the door after a specified duration.

Perfect for service-based businesses such as:
- 🏢 Co-working spaces
- 🏥 Therapy and massage rooms  
- 🏋️ Fitness studios
- 🏠 Private offices and consultation rooms
- 🏘️ Airbnb and short-term rentals

## ✨ Features

### 📅 Google Calendar Integration
- Polls Google Calendar every 60 seconds (configurable)
- Secure Service Account authentication
- Extracts event details: title, attendee email, timing
- Intelligent event filtering for booking validation

### 🔐 Eufy Smart Lock Control
- Full integration with `eufy-security-client` library
- Automatic device discovery and connection
- Real-time lock/unlock commands
- Battery level monitoring and status reporting
- Robust error handling and reconnection logic

### 📬 Automated Email Notifications
- Beautiful HTML email templates
- Branded confirmation emails with booking details
- Access instructions and facility guidelines
- Error notifications for administrators
- Powered by Nodemailer + Gmail SMTP

### 🕒 Advanced Scheduling & Logic
- Continuous background monitoring with node-cron
- Memory-safe event processing to prevent duplicates
- Configurable auto-lock timers
- Comprehensive logging and audit trails
- Health monitoring and system status reporting

### 🛡️ Security & Reliability
- Environment-based configuration management
- Google Service Account with least-privilege permissions
- Secure credential storage
- Graceful error handling and recovery
- Production-ready logging with Winston

## 🛠️ Tech Stack

| Component | Technology |
|-----------|------------|
| **Backend** | Node.js with Express |
| **Calendar** | Google Calendar API v3 |
| **Smart Lock** | eufy-security-client |
| **Scheduling** | node-cron |
| **Email** | Nodemailer + Gmail SMTP |
| **Logging** | Winston |
| **Config** | dotenv |

## 🚀 Quick Start

### Prerequisites

1. **Node.js** (v16 or higher)
2. **Eufy Security Account** with registered smart lock
3. **Google Cloud Project** with Calendar API enabled
4. **Gmail Account** with App Password enabled

### Installation

1. **Clone and Install**
   ```bash
   git clone <repository-url>
   cd eufy-automation
   npm install
   ```

2. **Environment Configuration**
   ```bash
   # Copy the example environment file
   cp .env.example .env
   
   # Edit .env with your credentials
   nano .env
   ```

3. **Google Service Account Setup**
   - Create a new Google Cloud Project
   - Enable Google Calendar API
   - Create a Service Account
   - Download the JSON key file
   - Save it as `./credentials/google-service-account.json`
   - Share your calendar with the service account email

4. **Gmail Configuration**
   - Enable 2-Factor Authentication on your Gmail account
   - Generate an App Password for the application
   - Use this App Password in your `.env` file

### Configuration

Edit your `.env` file with the following required settings:

```env
# Eufy Security Credentials
EUFY_USERNAME=your_eufy_email@example.com
EUFY_PASSWORD=your_eufy_password
EUFY_DEVICE_SERIAL=your_lock_serial_number

# Google Calendar API
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./credentials/google-service-account.json
GOOGLE_CALENDAR_ID=your_calendar_id@group.calendar.google.com

# Email Configuration (Gmail SMTP)
EMAIL_FROM=your_email@gmail.com
EMAIL_PASSWORD=your_app_specific_password
EMAIL_FROM_NAME=Automated Access System

# System Configuration
LOCK_DURATION_MINUTES=5
CALENDAR_POLL_INTERVAL_SECONDS=60
TIMEZONE=America/New_York

# Optional: API Server
ENABLE_API=true
PORT=3000
```

### Running the System

**Development Mode:**
```bash
npm run dev
```

**Production Mode:**
```bash
npm start
```

The system will:
1. ✅ Validate configuration
2. 🔌 Connect to Eufy and Google services
3. 📧 Initialize email service
4. ⏰ Start monitoring calendar events
5. 🌐 Launch API server (if enabled)

## 📚 API Endpoints

When the API server is enabled, you can monitor and control the system:

### System Status
```bash
# Health check
curl http://localhost:3000/health

# Detailed status
curl http://localhost:3000/status
```

### Door Control
```bash
# Manual unlock (emergency/testing)
curl -X POST http://localhost:3000/door/unlock

# Manual lock
curl -X POST http://localhost:3000/door/lock
```

### Calendar Events
```bash
# View upcoming events
curl http://localhost:3000/events/upcoming?timeWindow=60
```

### System Control
```bash
# Stop automation
curl -X POST http://localhost:3000/system/stop

# Start automation
curl -X POST http://localhost:3000/system/start
```

## 🔧 How It Works

### Workflow Overview

1. **📝 Booking Creation**
   - Customer books appointment via WordPress + Amelia
   - Booking automatically syncs to Google Calendar
   - Event includes customer email and appointment details

2. **📡 Event Detection**
   - System polls Google Calendar every 60 seconds
   - Identifies events starting within 2-3 minutes
   - Validates events as legitimate bookings

3. **🔓 Automatic Access**
   - Unlocks Eufy smart lock at scheduled time
   - Sends confirmation email to customer
   - Schedules automatic re-lock after configurable duration

4. **📊 Monitoring & Logging**
   - Comprehensive logging of all actions
   - Health checks every 5 minutes
   - Error notifications to administrators

### Event Validation Logic

The system considers an event a valid booking if it:
- Has an attendee email address
- Contains booking/appointment keywords
- Is not an all-day event
- Attendee hasn't declined the invitation

## 🏗️ Project Structure

```
eufy-automation/
├── src/
│   ├── config/           # Configuration management
│   ├── services/         # Core business logic
│   │   ├── googleCalendar.js    # Google Calendar integration
│   │   ├── eufyService.js       # Eufy smart lock control
│   │   ├── emailService.js      # Email notifications
│   │   └── automationEngine.js  # Main orchestration logic
│   ├── utils/            # Utilities and helpers
│   │   └── logger.js     # Winston logging configuration
│   └── index.js          # Application entry point
├── credentials/          # Service account keys (gitignored)
├── logs/                 # Application logs (gitignored)
├── data/                 # Persistent data (gitignored)
├── package.json          # Dependencies and scripts
└── README.md            # This file
```

## 🔒 Security Considerations

- **Environment Variables**: All sensitive data stored in `.env`
- **Service Account**: Google access uses least-privilege service account
- **Audit Logging**: All door access attempts logged with timestamps
- **Error Handling**: Graceful failure modes prevent security breaches
- **Access Control**: Optional API authentication can be added

## 🚀 Deployment Options

### Option 1: Railway
```bash
# Deploy to Railway (recommended)
npm install -g @railway/cli
railway login
railway init
railway up
```

### Option 2: VPS/Server
```bash
# Using PM2 for process management
npm install -g pm2
pm2 start src/index.js --name eufy-automation
pm2 startup
pm2 save
```

### Option 3: Docker
```dockerfile
# Dockerfile (create if needed)
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 🧪 Testing

This project includes a comprehensive test suite that works without requiring real credentials or hardware. Perfect for development, CI/CD, and validation.

### Quick Test Commands
```bash
npm test                    # Run all tests
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only  
npm run test:api           # API tests only
npm run test:coverage      # Run with coverage report
npm run test:watch         # Watch mode for development
```

### Test Documentation
- **[Test Setup Guide](tests/setup.md)** - Quick start guide for running tests
- **[Test Documentation](tests/README.md)** - Complete test suite documentation

### What Gets Tested
✅ **Unit Tests** - Configuration validation, environment handling  
✅ **Integration Tests** - Full automation workflow with mock services  
✅ **API Tests** - All HTTP endpoints and error handling  
✅ **Mock Services** - Simulated Eufy hardware, Google Calendar, email

### Test Features
- 🧪 **Mock Services** - No real credentials required
- ⚡ **Fast Execution** - No external API calls
- 🔒 **Secure** - Tests never access real hardware
- 📊 **Coverage Reports** - Detailed test coverage analysis
- 🏃 **CI/CD Ready** - Designed for automated testing

The test suite automatically detects missing credentials and switches to mock mode, allowing complete system validation without any external dependencies.

### 🔧 **Real Testing Setup**
Want to test with **real Google Calendar and Gmail** (without Eufy hardware)?

```bash
# Quick setup guide
cat REAL_TESTING.md

# Test your real credentials
npm run test:real

# Copy real test template
cp env.real-test .env
# Then edit .env with your credentials
```

See **[REAL_TESTING.md](REAL_TESTING.md)** for complete setup instructions with real Google Calendar API and Gmail SMTP (free setup, ~20 minutes).

## 🔧 Troubleshooting

### Common Issues

**1. Google Calendar Connection Failed**
- Verify service account JSON file exists
- Check calendar sharing permissions
- Ensure Calendar API is enabled

**2. Eufy Device Not Found**
- Confirm device serial number in `.env`
- Check Eufy account credentials
- Verify device is online in Eufy app

**3. Email Delivery Issues**
- Use Gmail App Password, not regular password
- Enable 2-Factor Authentication
- Check spam/junk folders

**4. Events Not Processing**
- Verify calendar poll interval settings
- Check event validation logic
- Review application logs

### Debug Mode

Enable detailed logging:
```bash
LOG_LEVEL=debug npm start
```

View logs in real-time:
```bash
tail -f logs/automation.log
```

## 🛣️ Roadmap

### Planned Features
- 📱 **Admin Dashboard** - Web interface for real-time monitoring
- 📲 **SMS Notifications** - Twilio integration for SMS alerts  
- 🏢 **Multi-Location Support** - Manage multiple smart locks
- 🔐 **Enhanced Security** - QR codes, OTP access, and encrypted links
- 📊 **Analytics** - Usage reports and booking analytics
- 🔧 **Plugin System** - Extensible architecture for custom integrations

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines for details.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support, please:
1. Check the troubleshooting section above
2. Review the application logs
3. Open an issue on GitHub
4. Contact the development team

---

**Built with ❤️ for seamless, secure, automated access control.**