# Amelia Booking Plugin Setup for Eufy Automation

This guide walks you through setting up the Amelia booking plugin to work with your Eufy door automation system.

## Prerequisites

- WordPress running (use `./setup-wordpress.sh`)
- Eufy automation system running (`npm start`)
- Google Calendar integration configured
- Amelia plugin installed

## Quick Start

1. **Start WordPress Environment**
   ```bash
   ./setup-wordpress.sh
   ```

2. **Access WordPress**
   - Open http://localhost:8080
   - Complete WordPress installation
   - Install Amelia plugin

3. **Configure Amelia → Google Calendar Integration**

## Amelia Configuration Steps

### 1. Install Amelia Plugin

1. Download Amelia from [official website](https://wpamelia.com/) or use trial
2. Upload plugin via WordPress Admin → Plugins → Add New → Upload
3. Activate the plugin

### 2. Basic Amelia Setup

**Services Configuration:**
- Go to **Amelia → Services**
- Create a service (e.g., "Room Access", "Meeting Room Booking")
- Set duration (recommended: 30-60 minutes)
- Set capacity as needed

**Employees Configuration:**
- Go to **Amelia → Employees** 
- Add an employee/provider
- Assign the service to the employee

### 3. Google Calendar Integration

**Enable Google Calendar Sync:**
1. Go to **Amelia → Settings → Integrations → Google Calendar**
2. Enable Google Calendar integration
3. Use the same service account we created:
   - **Service Account Key**: Upload `./credentials/google-service-account.json`
   - **Calendar ID**: `78e1b756fee7ffe5a143b52c6d2e808368346bedcee54d6b769699c49296dcd1@group.calendar.google.com`

**Calendar Sync Settings:**
- ✅ Enable "Add Amelia appointments to Google Calendar"
- ✅ Enable "Remove cancelled Amelia appointments from Google Calendar" 
- ✅ Set event title format to include "booking" (required for automation)

### 4. Event Title Configuration

**CRITICAL**: The automation looks for events with "booking" in the title.

Configure Amelia event titles to include "booking":
- Go to **Amelia → Settings → Integrations → Google Calendar**
- Set **Event Title** to: `%service_name% booking - %customer_full_name%`
- Or: `Booking: %service_name% (%customer_email%)`

### 5. Booking Form Setup

**Customer Information:**
- Ensure customer email is collected (required for automation)
- Configure booking form to collect:
  - Customer name
  - Customer email ✅ (required)
  - Phone number (optional)

**Notifications:**
- Configure email notifications
- The automation will also send confirmation emails

### 6. Test Event Format

When someone makes a booking, Amelia should create a calendar event like:
```
Title: "Room Access booking - John Doe"
Start: 2025-06-23 15:30:00 +04:00 (Dubai time)
End: 2025-06-23 16:30:00 +04:00
Attendees: customer@example.com
Description: Booking details...
```

## Testing the Integration

### 1. Make a Test Booking

1. Go to your WordPress frontend
2. Find the Amelia booking form
3. Make a booking for **2-3 minutes from now**
4. Use a real email address
5. Complete the booking

### 2. Verify Calendar Event

1. Check your Google Calendar - should see the new event
2. Verify it has "booking" in the title
3. Verify it has the customer email as attendee

### 3. Watch Automation Logs

Monitor your automation logs:
```bash
# In another terminal, watch the logs
tail -f logs/automation.log
```

You should see:
- Event detected
- Door unlock command
- Email confirmation sent

### 4. Expected Log Output

```
[CALENDAR] Found 1 events starting soon
[info]: Processing booking event {"title":"Room Access booking - John Doe","attendeeEmail":"customer@example.com"}
[EUFY] 🔓 Unlocking door for booking: Room Access booking - John Doe
[EMAIL] 📧 [MOCK] Email would be sent {"to":"customer@example.com","subject":"Access Confirmed - Room Access booking - John Doe"}
```

## Troubleshooting

### Event Not Detected
- Check if event title contains "booking"
- Verify attendee email is present
- Check timezone settings match (Asia/Dubai)
- Ensure event starts within next 2-3 minutes

### Calendar Not Syncing
- Verify service account has access to calendar
- Check Google Calendar permissions
- Restart WordPress if needed

### Automation Not Triggering
- Check automation logs for errors
- Verify Google Calendar ID matches
- Ensure automation is running (`npm start`)

## Calendar Permissions

Make sure your service account has access:
1. Go to Google Calendar settings for your test calendar
2. Share with: `eufy-automation@charming-storm-463808-i0.iam.gserviceaccount.com`
3. Permission: "Make changes to events"

## Production Considerations

### Security
- Use environment-specific calendars
- Implement proper authentication
- Set up monitoring and alerting

### Reliability
- Add error handling for failed unlocks
- Implement retry mechanisms
- Set up backup notification methods

### Scaling
- Consider rate limiting
- Monitor API quotas
- Implement queuing for high volume

---

## Quick Test Checklist

- [ ] WordPress running on http://localhost:8080
- [ ] Amelia plugin installed and configured
- [ ] Google Calendar integration enabled
- [ ] Service account configured with correct calendar ID
- [ ] Event title format includes "booking"
- [ ] Eufy automation running (`npm start`)
- [ ] Test booking created 2-3 minutes in future
- [ ] Event appears in Google Calendar
- [ ] Automation detects and processes event
- [ ] Door unlock command executed
- [ ] Confirmation email sent (mock mode)

Ready to test! 🚀 