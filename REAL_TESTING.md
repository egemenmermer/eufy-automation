# Real Testing Setup Guide

This guide shows you how to test the Eufy automation system with **real Google Calendar and Gmail credentials** while keeping the Eufy lock as a mock (since you don't have actual hardware).

## 🎯 **What You'll Test**

✅ **Real Google Calendar** - Actual calendar events  
✅ **Real Gmail SMTP** - Actual email sending  
🧪 **Mock Eufy Lock** - Simulated smart lock (no hardware needed)

This gives you ~80% real functionality testing without needing expensive hardware!

## 🔑 **Step 1: Google Calendar API Setup**

### Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **"New Project"** 
3. Enter project name: `eufy-automation-test`
4. Click **"Create"**

### Enable Calendar API
1. In your project, go to **"APIs & Services"** → **"Library"**
2. Search **"Google Calendar API"**
3. Click on it and click **"Enable"**

### Create Service Account
1. Go to **"APIs & Services"** → **"Credentials"**
2. Click **"Create Credentials"** → **"Service Account"**
3. Fill in:
   - **Service account name**: `eufy-automation`
   - **Description**: `Service account for Eufy automation testing`
4. Click **"Create and Continue"**
5. Skip role assignment (click **"Continue"**)
6. Click **"Done"**

### Download Credentials
1. Click on your new service account
2. Go to **"Keys"** tab
3. Click **"Add Key"** → **"Create New Key"**
4. Choose **"JSON"** → Click **"Create"**
5. Save the downloaded file as `./credentials/google-service-account.json`

### Create Test Calendar
1. Open [Google Calendar](https://calendar.google.com/)
2. Create a new calendar:
   - Click **"+"** next to "Other calendars"
   - **"Create new calendar"**
   - Name: `Eufy Test Bookings`
   - Click **"Create calendar"**

### Share Calendar with Service Account
1. Find your new calendar in the left sidebar
2. Click the **3 dots** → **"Settings and sharing"**
3. Scroll to **"Share with specific people"**
4. Click **"Add people"**
5. Enter the service account email (from the JSON file you downloaded)
6. Set permission to **"Make changes to events"**
7. Click **"Send"**

### Get Calendar ID
1. In calendar settings, scroll to **"Calendar ID"**
2. Copy the calendar ID (looks like: `abc123@group.calendar.google.com`)
3. Save this for your `.env` file

## 📧 **Step 2: Gmail SMTP Setup**

### Enable 2-Factor Authentication
1. Go to [Google Account](https://myaccount.google.com/)
2. Click **"Security"**
3. Find **"2-Step Verification"** → **"Turn on"**
4. Follow the setup process

### Generate App Password
1. In Google Account Security settings
2. Click **"2-Step Verification"**
3. Scroll down to **"App passwords"**
4. Click **"App passwords"**
5. Select:
   - **App**: Mail
   - **Device**: Other (enter "Eufy Automation")
6. Click **"Generate"**
7. **Copy the 16-character password** (looks like: `abcd efgh ijkl mnop`)

## ⚙️ **Step 3: Configure Environment**

### Copy Configuration Template
```bash
cp env.real-test .env
```

### Edit .env File
```env
# Update these with your real credentials:

# Google Calendar (from Step 1)
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./credentials/google-service-account.json
GOOGLE_CALENDAR_ID=your-calendar-id@group.calendar.google.com

# Gmail SMTP (from Step 2)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-16-char-app-password  # The generated app password
EMAIL_FROM=your-email@gmail.com
EMAIL_FROM_NAME=Eufy Automation Test

# Keep these as mock (no real hardware needed)
EUFY_USERNAME=test@example.com
EUFY_PASSWORD=test-password
EUFY_DEVICE_SERIAL=TEST123456
```

## 🧪 **Step 4: Test the System**

### Start the Application
```bash
npm start
```

You should see:
```
✅ Mock Eufy service initialized successfully
✅ Google Calendar service initialized successfully  
✅ Email service initialized successfully
🌐 API server running on port 3001
```

### Create Test Events
1. Go to your **Eufy Test Bookings** calendar
2. Create an event:
   - **Title**: `Test Booking Appointment`
   - **Time**: Starting 3 minutes from now
   - **Duration**: 1 hour
   - **Add guest**: Your email address
   - **Description**: `Test booking for access`

### Watch the Automation
The system will:
1. 🔍 **Detect the event** (within 2 minutes of start time)
2. 🔓 **"Unlock" the door** (mock - check logs)
3. 📧 **Send real email** to the attendee
4. 🔒 **Schedule re-lock** (after 5 minutes)

### Check Results
- **Logs**: Check `./logs/automation.log`
- **Email**: Check your inbox for confirmation email
- **API**: Visit `http://localhost:3001/api/status`

## 🔍 **Step 5: Monitor and Test**

### API Endpoints for Testing
```bash
# System status
curl http://localhost:3001/api/status

# Upcoming events  
curl http://localhost:3001/api/events

# Manual door control (mock)
curl -X POST http://localhost:3001/api/unlock
curl -X POST http://localhost:3001/api/lock

# Door status
curl http://localhost:3001/api/door-status

# Email stats (if using mock email)
curl http://localhost:3001/api/email-stats
```

### Real Event Testing
1. **Create booking events** 2-3 minutes in the future
2. **Include attendee emails** to trigger automation
3. **Use keywords** like "booking", "appointment", "access" in title/description
4. **Watch logs** for real-time processing

### Log Monitoring
```bash
# Follow logs in real-time
tail -f logs/automation.log

# Or with colors
tail -f logs/automation.log | grep --color=always -E "(ERROR|WARN|INFO)"
```

## 🎯 **What You're Testing**

### ✅ **Real Functionality**
- **Google Calendar integration** - Real API calls
- **Event detection and validation** - Actual calendar events
- **Email notifications** - Real emails sent via Gmail
- **Scheduling and timing** - Real cron jobs
- **API endpoints** - Full REST API
- **Error handling** - Real error scenarios

### 🧪 **Mock Functionality**  
- **Smart lock operations** - Simulated hardware
- **Door status** - Mock device state
- **Lock/unlock timing** - Simulated delays

## 🚨 **Troubleshooting**

### Google Calendar Issues
```bash
# Check service account permissions
curl -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  "https://www.googleapis.com/calendar/v3/calendars/primary"

# Verify calendar sharing
# - Service account email should appear in calendar sharing settings
# - Permission should be "Make changes to events"
```

### Gmail Issues
```bash
# Test SMTP connection
npm install -g smtp-tester
smtp-test smtp.gmail.com:587 your-email@gmail.com your-app-password
```

### Common Errors
1. **"Calendar not found"** → Check calendar ID and sharing
2. **"Authentication failed"** → Verify app password (not regular password)
3. **"Service account access"** → Ensure calendar is shared with service account
4. **"No events detected"** → Ensure events have attendees and proper keywords

## 🎉 **Success Indicators**

You'll know it's working when:
1. ✅ **Application starts** without credential errors
2. ✅ **Events are detected** (check logs)
3. ✅ **Emails are sent** (check inbox)
4. ✅ **API responds** with real data
5. ✅ **Mock lock operates** (check status endpoint)

This setup gives you a **production-like testing environment** without needing actual smart lock hardware!

## 💡 **Next Steps**

Once this works:
1. **Test edge cases** - invalid events, network issues
2. **Performance testing** - multiple simultaneous events
3. **Integration testing** - with actual booking systems
4. **Deploy to staging** - cloud environment testing
5. **Add real Eufy hardware** - when you're ready to purchase

## 💰 **Cost**

- **Google Calendar API**: Free (up to 1,000,000 requests/day)
- **Gmail SMTP**: Free (500 emails/day limit)
- **Total cost**: $0 for testing! 🎉 