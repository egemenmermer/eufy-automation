# Eufy Smart Lock Automation with WordPress Amelia Integration

Automated smart lock system that directly integrates with WordPress Amelia booking plugin to unlock doors for scheduled appointments. Designed specifically for businesses like wellness centers, co-working spaces, therapy rooms, and fitness studios.

## 🎯 Overview

This system monitors the WordPress Amelia database for upcoming appointments and automatically:
- Unlocks smart locks when appointments start
- Sends professional email confirmations with access details
- Automatically re-locks doors after session completion + buffer time
- Adjusts lock times based on service type and duration (15min, 30min, 60min, etc.)
- Logs all activities and provides health monitoring

## ✨ Key Features

### 🔒 Smart Lock Integration
- **Eufy Security Integration**: Direct control of Eufy smart locks
- **Dynamic Lock Duration**: Adjusts based on appointment service type
- **Session-Based Timing**: 15min (Ice bath), 30min (Sauna), 45-60min (Combined)
- **Buffer Time**: Configurable extra time after appointments

### 📅 WordPress Amelia Integration
- **Direct Database Access**: Connects directly to WordPress/Amelia MySQL database
- **Real-Time Monitoring**: Polls for new appointments every 30 seconds
- **Service Type Detection**: Recognizes different service types and durations
- **Appointment Tracking**: Prevents duplicate processing

### 📧 Email Notifications
- **Professional Templates**: Branded Euphorium email templates
- **Access Information**: Includes door codes and session details
- **Multi-Format**: Both HTML and text versions
- **Error Notifications**: Admin alerts for system issues

### 🔧 Robust System Design
- **Health Monitoring**: Continuous system health checks
- **Error Recovery**: Graceful error handling and recovery
- **Logging**: Comprehensive logging with Winston
- **API Endpoints**: RESTful API for monitoring and control

## 🚀 Quick Start

### 1. Prerequisites
- Node.js 18+ 
- MySQL database access (WordPress/Amelia)
- Eufy smart lock and account
- Gmail account for notifications

### 2. Installation
```bash
git clone <repository-url>
cd eufy-automation
npm install
```

### 3. Configuration
Copy the environment template:
```bash
cp env.example .env
```

Configure your `.env` file with:

#### Eufy Configuration
```env
EUFY_USERNAME=your_eufy_email@example.com
EUFY_PASSWORD=your_eufy_password
EUFY_DEVICE_SERIAL=your_device_serial_number
```

#### WordPress/Amelia Database
```env
AMELIA_DB_HOST=localhost
AMELIA_DB_PORT=3306
AMELIA_DB_USER=your_db_username
AMELIA_DB_PASSWORD=your_db_password
AMELIA_DB_NAME=your_wordpress_database_name
AMELIA_TABLE_PREFIX=wp_
```

#### Email Configuration
```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_gmail@gmail.com
EMAIL_PASSWORD=your_app_password
EMAIL_FROM=your_gmail@gmail.com
EMAIL_FROM_NAME=Euphorium Access System
```

#### System Settings
```env
TIMEZONE=Asia/Dubai
DOOR_CODE=2843
AMELIA_POLL_INTERVAL_SECONDS=30
BUFFER_TIME_MINUTES=5
```

### 4. Start the System
```bash
npm start
```

## 📊 Service Duration Mapping

The system automatically adjusts lock duration based on appointment service type:

| Service Type | Base Duration | Lock Duration* |
|-------------|---------------|----------------|
| Ice bath | 15 min | 20 min |
| Traditional Sauna | 30 min | 35 min |
| Traditional sauna and Ice bath | 45 min | 50 min |
| Chill Club: 15-Min Daily Ice Bath Access | 15 min | 20 min |
| Communal - Contrast Therapy | 30 min | 35 min |
| Private - Contrast Therapy | 60 min | 65 min |

*Lock duration = Service duration + Buffer time (5 min default)

## 🔗 API Endpoints

### System Health
- `GET /health` - Basic health check
- `GET /status` - Detailed system status

### Appointments
- `GET /appointments/upcoming?hoursAhead=24` - View upcoming appointments

### Door Control (Manual)
- `POST /door/unlock` - Manually unlock door
- `POST /door/lock` - Manually lock door

### System Control
- `POST /system/stop` - Stop automation engine
- `POST /system/start` - Start automation engine

## 🏗️ Architecture

### Core Services
- **AmeliaService**: Direct WordPress/Amelia database integration
- **EufyService**: Smart lock control and management
- **EmailService**: Professional email notifications
- **AutomationEngine**: Main orchestration and scheduling
- **WebServer**: API endpoints and health monitoring

### Database Integration
The system connects directly to the WordPress database and queries these Amelia tables:
- `wp_amelia_appointments` - Main appointment data
- `wp_amelia_services` - Service definitions and durations
- `wp_amelia_customer_bookings` - Customer booking details
- `wp_amelia_users` - Customer information

### Flow Overview
1. **Monitor**: Continuously polls Amelia database for upcoming appointments
2. **Process**: Identifies appointments starting soon (within 5 minutes)
3. **Unlock**: Schedules/executes door unlock at appointment start time
4. **Notify**: Sends email confirmation with access details
5. **Lock**: Automatically re-locks door after service duration + buffer
6. **Track**: Logs all activities and updates appointment notes

## 🛠️ Development

### Testing
```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration

# Test with coverage
npm run test:coverage
```

### Development Mode
```bash
npm run dev
```

### Mock Services
When real credentials aren't available, the system automatically uses mock services for testing:
- Mock Amelia database with sample appointments
- Mock Eufy service for door control simulation
- Mock email service for notification testing

## 🚨 Troubleshooting

### Common Issues

**Database Connection Failed**
- Verify database credentials in `.env`
- Check network connectivity to WordPress server
- Ensure database user has read permissions

**No Appointments Found**
- Check Amelia table prefix in configuration
- Verify appointments exist with status 'approved' or 'pending'
- Check timezone settings

**Email Not Sending**
- Verify Gmail app password (not regular password)
- Check SMTP settings and firewall
- Review email service logs

**Door Not Responding**
- Verify Eufy credentials and device serial
- Check device connectivity and battery
- Review Eufy service logs

### Logs
Check logs for detailed error information:
```bash
tail -f logs/automation.log
```

## 🔒 Security Considerations

- Database credentials are stored securely in environment variables
- Email passwords use app-specific passwords
- Door codes are configurable and can be rotated
- All activities are logged for audit purposes
- API endpoints should be secured in production

## 📝 License

MIT License - see LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 🆘 Support

For issues and questions:
1. Check the troubleshooting section
2. Review logs for error details
3. Open an issue with detailed information
4. Include system configuration (without sensitive data)

---

**Note**: This system is designed for Euphorium wellness center but can be adapted for any business using WordPress Amelia for bookings and Eufy smart locks for access control.