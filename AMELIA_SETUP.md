# 🚀 Amelia Elite API Integration Guide

This guide walks you through integrating your smart lock automation system with **Amelia Elite API**.

## ✅ Prerequisites Checklist

- [ ] **Amelia Elite License** (API endpoints are only available in Elite)
- [ ] **WordPress site** with Amelia plugin installed and activated
- [ ] **API Key generated** in Amelia Settings (you have: `61Hmy76O+ARqMPIK3ft7O4+r2xdZ+pEy0wXjl+Ygtu/I`)
- [ ] **Your WordPress site URL** (needed for configuration)

## 🔧 Quick Setup Steps

### Step 1: Configure Environment Variables

1. **Create your .env file** (if not already created):
   ```bash
   cp env.example .env
   ```

2. **Edit your .env file** and update these lines:
   ```env
   # Enable Amelia API mode
   AMELIA_USE_API=true
   
   # Your WordPress site URL (REPLACE WITH YOUR ACTUAL URL)
   AMELIA_API_BASE_URL=https://yoursite.com
   
   # Your Amelia API key (already provided)
   AMELIA_API_KEY=61Hmy76O+ARqMPIK3ft7O4+r2xdZ+pEy0wXjl+Ygtu/I
   ```

   **⚠️ Important**: Replace `https://yoursite.com` with your actual WordPress site URL.

### Step 2: Test the API Connection

```bash
# Test the Amelia API connection
npm run test:amelia
```

This will:
- ✅ Verify your API key works
- ✅ Test connection to your WordPress site
- ✅ Show your available services
- ✅ Display upcoming appointments

### Step 3: Complete Other Configuration

Update these additional settings in your `.env` file:

```env
# Eufy Smart Lock (your specific device)
EUFY_USERNAME=your_eufy_email@example.com
EUFY_PASSWORD=your_eufy_password
EUFY_DEVICE_SERIAL=your_device_serial

# Email notifications (Gmail recommended)
EMAIL_FROM=your_gmail@gmail.com
EMAIL_PASSWORD=your_gmail_app_password
EMAIL_FROM_NAME=Automated Access System

# System settings
TIMEZONE=Asia/Dubai
DOOR_CODE=2843
```

### Step 4: Test the Complete System

```bash
# Start the automation system
npm run dev
```

You should see:
```
✅ Connected to Amelia database successfully
✅ Eufy device initialized: [your device]
✅ Email service initialized
✅ Automation Engine started successfully with Amelia integration
```

## 🎯 How It Works

### Automatic Booking Processing

The system automatically:

1. **Polls Amelia API** every 30 seconds for upcoming appointments
2. **Detects bookings** starting within 5 minutes
3. **Sends confirmation email** with door code to customer
4. **Customer manually unlocks** using the door code when they arrive
5. **Auto-locks door** after session end time + buffer time for security

### Supported Appointment Types

The system works with any Amelia service, with smart duration mapping:

| Service Type | Lock Duration |
|-------------|---------------|
| Ice bath | 15 + 5 min buffer |
| Traditional Sauna | 30 + 5 min buffer |
| Contrast Therapy | 45-60 + 5 min buffer |
| Custom services | Service duration + 5 min buffer |

## 🔍 API Endpoints Used

Your system uses these Amelia Elite API endpoints:

### Get Appointments
```http
GET /wp-admin/admin-ajax.php?action=wpamelia_api&call=/api/v1/appointments
Authorization: Amelia: YOUR_API_KEY
```

### Get Specific Appointment
```http
GET /wp-admin/admin-ajax.php?action=wpamelia_api&call=/api/v1/appointments/{id}
Authorization: Amelia: YOUR_API_KEY
```

### Get Services
```http
GET /wp-admin/admin-ajax.php?action=wpamelia_api&call=/api/v1/services
Authorization: Amelia: YOUR_API_KEY
```

## 🚨 Troubleshooting

### Common Issues

**"API Key not found"**
```bash
# Check your .env file
grep AMELIA_API_KEY .env
```

**"Invalid API response" (401 error)**
- ✅ Verify your API key is correct
- ✅ Ensure Amelia Elite license is active
- ✅ Check API is enabled in Amelia Settings

**"WordPress site not found" (404 error)**
- ✅ Verify your `AMELIA_API_BASE_URL` is correct
- ✅ Ensure WordPress site is accessible
- ✅ Test: `curl https://yoursite.com`

**"No appointments found"**
- ✅ Create a test booking in Amelia
- ✅ Check booking status is "Approved"
- ✅ Verify booking time is in the future

### Debug Commands

```bash
# Test API connection
npm run test:amelia

# Check system status
curl http://localhost:3000/status

# View logs
tail -f logs/automation.log

# Test door control
curl -X POST http://localhost:3000/door/unlock
```

## 📊 Real-Time Monitoring

### Web Dashboard

Access your system dashboard at: `http://localhost:3000`

Features:
- 📅 Upcoming appointments view
- 🚪 Manual door control
- 📧 Test email notifications
- 📈 System health status

### API Endpoints for Monitoring

```bash
# System health
GET http://localhost:3000/health

# Upcoming appointments
GET http://localhost:3000/appointments/upcoming

# Door status
GET http://localhost:3000/door/status

# Manual controls
POST http://localhost:3000/door/unlock
POST http://localhost:3000/door/lock
```

## 🔐 Security Best Practices

### API Key Security
- ✅ Never commit `.env` file to version control
- ✅ Use environment-specific API keys
- ✅ Rotate API keys regularly
- ✅ Monitor API usage in Amelia

### WordPress Security
- ✅ Keep WordPress and Amelia updated
- ✅ Use HTTPS for your WordPress site
- ✅ Implement firewall rules
- ✅ Regular security audits

## 🎯 Testing Your Setup

### Create a Test Booking

1. **Go to your Amelia booking page**
2. **Create a booking** for 2-3 minutes in the future
3. **Watch the automation logs**:
   ```bash
   tail -f logs/automation.log
   ```
4. **Verify the sequence**:
   - ✅ Appointment detected
   - ✅ Unique 4-digit code generated
   - ✅ Email sent to customer with their unique door code
   - ✅ Auto-lock scheduled for after session ends
   - ✅ Customer manually unlocks with their unique code (when they arrive)
   - ✅ Door automatically locks after session + buffer time

### Expected Log Output

```
[INFO] Found 1 upcoming appointments via API
[INFO] Processing booking appointment for Euphorium
[INFO] Door code generated successfully (appointmentId: 123, attempts: 1)
[INFO] Booking confirmation sent with unique door code (doorCode: 7834)
[INFO] Generated door code: 7834 (valid for this appointment only)
[INFO] Scheduled automatic lock for [end time + buffer]
[INFO] Door unlocked via Amelia door code (appointmentId: 123, doorCode: 7834)
[INFO] Door automatically locked after appointment
```

## 🚀 Production Deployment

### Environment Configuration

For production, update these settings:

```env
NODE_ENV=production
LOG_LEVEL=warn
WEB_SERVER_BASE_URL=https://yourdomain.com
```

### Webhook Integration (Optional)

For real-time notifications, set up Amelia webhooks:

1. **In Amelia Settings** → Integrations → Webhooks
2. **Set webhook URL**: `https://yourdomain.com/webhook/amelia`
3. **Configure events**: Appointment Created, Updated, Cancelled
4. **Add webhook secret** to your `.env`:
   ```env
   AMELIA_WEBHOOK_SECRET=your_webhook_secret
   ```

## 📞 Support

If you encounter issues:

1. **Run diagnostics**: `npm run test:amelia`
2. **Check logs**: `tail -f logs/automation.log`
3. **Test API manually**: Use the endpoints above
4. **Verify Amelia setup**: Check booking system works normally

## 🎉 Next Steps

Once everything is working:

1. **Schedule real bookings** to test end-to-end flow
2. **Monitor system performance** via dashboard
3. **Set up monitoring alerts** for production
4. **Consider scaling** for multiple locations/devices
5. **Implement additional features** (SMS, multiple locks, etc.)

---

**🚀 Your smart lock automation with Amelia is now ready!**

The system will automatically handle all future bookings, unlocking doors for customers and ensuring security through automatic re-locking. 🔐✨ 