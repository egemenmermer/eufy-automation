# 🚀 Eufy Automation System - Setup Guide

This guide will walk you through setting up the complete Eufy automation system from scratch.

## 📋 Prerequisites Checklist

Before starting, ensure you have:

- [ ] **Node.js v16+** installed on your system
- [ ] **Eufy Security account** with at least one smart lock registered
- [ ] **Google account** with access to Google Cloud Console
- [ ] **Gmail account** with 2FA enabled for app passwords
- [ ] **WordPress site** with Amelia booking plugin (optional)

## 🔧 Step-by-Step Setup

### Step 1: Project Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd eufy-automation

# Install dependencies
npm install

# Create required directories
mkdir -p credentials logs data
```

### Step 2: Google Cloud Setup

1. **Create Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one
   - Enable the Google Calendar API

2. **Create Service Account**
   ```bash
   # Navigate to IAM & Admin > Service Accounts
   # Click "Create Service Account"
   # Name: eufy-automation-service
   # Description: Service account for Eufy automation system
   ```

3. **Generate Service Account Key**
   - Click on the created service account
   - Go to "Keys" tab
   - Click "Add Key" → "Create new key" → "JSON"
   - Download the JSON file
   - Save it as `./credentials/google-service-account.json`

4. **Share Calendar with Service Account**
   - Open Google Calendar
   - Go to calendar settings (gear icon)
   - Select the calendar you want to monitor
   - Under "Share with specific people", add the service account email
   - Grant "Make changes to events" permission

### Step 3: Eufy Account Setup

1. **Find Your Device Serial Number**
   - Open Eufy Security app
   - Select your smart lock device
   - Go to Device Settings
   - Note down the serial number (usually starts with T8)

2. **Test Eufy Credentials**
   - Ensure you can login to the Eufy Security app
   - Verify your smart lock is online and responsive

### Step 4: Gmail Configuration

1. **Enable 2-Factor Authentication**
   - Go to [Google Account Security](https://myaccount.google.com/security)
   - Enable 2-Step Verification

2. **Generate App Password**
   - Visit [App Passwords](https://myaccount.google.com/apppasswords)
   - Select "Mail" and "Other (custom name)"
   - Name it "Eufy Automation"
   - Copy the generated 16-character password

### Step 5: Environment Configuration

1. **Create Environment File**
   ```bash
   # Copy the example file
   cp .env.example .env
   ```

2. **Edit Configuration**
   ```bash
   # Open the .env file in your editor
   nano .env
   ```

3. **Required Configuration Values**
   ```env
   # Eufy Credentials
   EUFY_USERNAME=your_eufy_email@example.com
   EUFY_PASSWORD=your_eufy_password
   EUFY_DEVICE_SERIAL=T8xxx-xxxxx-xxxxx  # From Eufy app

   # Google Calendar
   GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./credentials/google-service-account.json
   GOOGLE_CALENDAR_ID=primary  # or specific calendar ID

   # Gmail SMTP
   EMAIL_FROM=your_email@gmail.com
   EMAIL_PASSWORD=abcd efgh ijkl mnop  # App password from Step 4
   EMAIL_FROM_NAME=Automated Access System

   # System Settings
   LOCK_DURATION_MINUTES=5
   CALENDAR_POLL_INTERVAL_SECONDS=60
   TIMEZONE=America/New_York  # Your timezone
   
   # Development
   NODE_ENV=development
   ENABLE_API=true
   PORT=3000
   ```

### Step 6: Test the System

1. **Basic Configuration Test**
   ```bash
   # Test configuration loading
   node -e "require('./src/config').validateConfig(); console.log('✅ Configuration valid')"
   ```

2. **Service Connection Tests**
   ```bash
   # Start in development mode
   npm run dev
   ```

3. **API Health Check** (if enabled)
   ```bash
   # In another terminal
   curl http://localhost:3000/health
   ```

4. **Manual Door Test** (optional)
   ```bash
   # Test manual unlock
   curl -X POST http://localhost:3000/door/unlock
   
   # Test manual lock
   curl -X POST http://localhost:3000/door/lock
   ```

### Step 7: WordPress + Amelia Integration

1. **Install Amelia Plugin**
   - Purchase and install Amelia booking plugin
   - Configure your services and time slots

2. **Google Calendar Sync**
   - In Amelia settings, enable Google Calendar integration
   - Connect your Google account (same one used for the automation)
   - Map Amelia bookings to sync with your calendar

3. **Test Booking Flow**
   - Create a test booking 2-3 minutes in the future
   - Verify it appears in Google Calendar
   - Watch the automation system logs for processing

## ✅ Verification Checklist

After setup, verify each component:

- [ ] **Configuration**: All required environment variables set
- [ ] **Google Calendar**: Service account has calendar access
- [ ] **Eufy Connection**: Device found and responsive
- [ ] **Email Service**: Test email can be sent
- [ ] **Calendar Polling**: Events are being detected
- [ ] **Door Control**: Manual lock/unlock works
- [ ] **Auto-lock**: Timer functionality works
- [ ] **Email Notifications**: Booking confirmations sent

## 🚨 Troubleshooting

### Common Issues

**"Google Calendar API not enabled"**
```bash
# Solution: Enable the API in Google Cloud Console
# Go to APIs & Services > Library > Search "Calendar" > Enable
```

**"Service account key file not found"**
```bash
# Solution: Check file path and permissions
ls -la ./credentials/google-service-account.json
```

**"Eufy device not found"**
```bash
# Solution: Verify serial number format
# Check Eufy app: Device Settings > Device Info > Serial Number
```

**"Gmail authentication failed"**
```bash
# Solution: Use App Password, not regular password
# Ensure 2FA is enabled on Gmail account
```

**"Events not being processed"**
```bash
# Solution: Check calendar sharing permissions
# Verify event has attendee email
# Check event validation logic in logs
```

### Debug Commands

```bash
# Enable detailed logging
LOG_LEVEL=debug npm run dev

# Check specific service status
curl http://localhost:3000/status

# View recent events
curl http://localhost:3000/events/upcoming

# Monitor logs in real-time
tail -f logs/automation.log
```

## 🔒 Security Best Practices

1. **Environment File Security**
   ```bash
   # Set proper permissions
   chmod 600 .env
   
   # Never commit .env to version control
   echo ".env" >> .gitignore
   ```

2. **Service Account Permissions**
   - Use least-privilege principle
   - Only grant calendar read access if possible
   - Regularly rotate service account keys

3. **Network Security**
   - Use HTTPS in production
   - Consider VPN for API access
   - Monitor access logs regularly

4. **Backup Configuration**
   ```bash
   # Backup your configuration (without sensitive data)
   cp .env .env.backup
   sed -i 's/=.*/=REDACTED/' .env.backup
   ```

## 🚀 Production Deployment

### Option 1: VPS Deployment

```bash
# Install PM2 for process management
npm install -g pm2

# Start the application
pm2 start src/index.js --name eufy-automation

# Save PM2 configuration
pm2 startup
pm2 save

# Monitor the application
pm2 monit
```

### Option 2: Railway Deployment

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and initialize
railway login
railway init

# Set environment variables in Railway dashboard
# Deploy
railway up
```

### Option 3: Docker Deployment

```dockerfile
# Create Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

```bash
# Build and run
docker build -t eufy-automation .
docker run -d --name eufy-automation -p 3000:3000 --env-file .env eufy-automation
```

## 📊 Monitoring & Maintenance

1. **Log Monitoring**
   ```bash
   # Set up log rotation
   sudo apt install logrotate
   
   # Monitor for errors
   grep ERROR logs/automation.log
   ```

2. **Health Checks**
   ```bash
   # Create monitoring script
   #!/bin/bash
   response=$(curl -s http://localhost:3000/health)
   if [[ $response == *"ok"* ]]; then
     echo "✅ System healthy"
   else
     echo "❌ System unhealthy"
     # Send alert
   fi
   ```

3. **Backup Strategy**
   - Regular configuration backups
   - Log file archival
   - Database backups (if using)

## 🎯 Next Steps

After successful setup:

1. **Test with Real Bookings**: Create actual bookings to verify end-to-end flow
2. **Monitor Performance**: Watch system performance and adjust polling intervals
3. **Scale Security**: Add authentication to API endpoints
4. **Enhance Features**: Consider SMS notifications, multiple locks, etc.
5. **Documentation**: Document your specific configuration and customizations

## 🆘 Getting Help

If you encounter issues:

1. Check this troubleshooting guide
2. Review application logs: `tail -f logs/automation.log`
3. Test individual components using the API endpoints
4. Create an issue on GitHub with logs and configuration details
5. Contact the development team

---

**Ready to automate your access control? Let's get started! 🚀** 