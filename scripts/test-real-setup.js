#!/usr/bin/env node

/**
 * Test Script for Real Credentials Setup
 * 
 * This script tests your Google Calendar and Gmail setup
 * without starting the full automation system.
 */

require('dotenv').config();
const { google } = require('googleapis');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

async function testGoogleCalendar() {
  console.log('\n🔍 Testing Google Calendar Setup...');
  
  try {
    // Check if service account file exists
    const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
    if (!keyPath || !fs.existsSync(keyPath)) {
      throw new Error(`Service account file not found: ${keyPath}`);
    }
    
    // Load credentials
    const credentials = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    console.log(`✅ Service account loaded: ${credentials.client_email}`);
    
    // Create auth client
    const auth = new google.auth.GoogleAuth({
      keyFile: keyPath,
      scopes: ['https://www.googleapis.com/auth/calendar.readonly']
    });
    
    const authClient = await auth.getClient();
    const calendar = google.calendar({ version: 'v3', auth: authClient });
    
    // Test calendar access
    const calendarId = process.env.GOOGLE_CALENDAR_ID;
    if (!calendarId) {
      throw new Error('GOOGLE_CALENDAR_ID not set in environment');
    }
    
    console.log(`🔍 Testing access to calendar: ${calendarId}`);
    
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    const response = await calendar.events.list({
      calendarId: calendarId,
      timeMin: now.toISOString(),
      timeMax: tomorrow.toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: 'startTime'
    });
    
    const events = response.data.items || [];
    console.log(`✅ Calendar access successful! Found ${events.length} events in next 24h`);
    
    if (events.length > 0) {
      console.log(`📅 Next event: "${events[0].summary}" at ${events[0].start.dateTime || events[0].start.date}`);
    } else {
      console.log(`💡 No events found. Create a test event to verify automation.`);
    }
    
    return true;
    
  } catch (error) {
    console.error(`❌ Google Calendar test failed: ${error.message}`);
    return false;
  }
}

async function testGmailSMTP() {
  console.log('\n📧 Testing Gmail SMTP Setup...');
  
  try {
    const config = {
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    };
    
    if (!config.auth.user || !config.auth.pass) {
      throw new Error('EMAIL_USER or EMAIL_PASSWORD not set');
    }
    
    console.log(`🔍 Testing SMTP connection to ${config.host}:${config.port}`);
    console.log(`👤 User: ${config.auth.user}`);
    
    const transporter = nodemailer.createTransport(config);
    
    // Verify connection
    await transporter.verify();
    console.log('✅ SMTP connection successful!');
    
    // Send test email
    const testEmail = {
      from: `"${process.env.EMAIL_FROM_NAME || 'Eufy Test'}" <${config.auth.user}>`,
      to: config.auth.user, // Send to self
      subject: '🧪 Eufy Automation Test Email',
      html: `
        <h2>🎉 Email Setup Successful!</h2>
        <p>This is a test email from your Eufy automation system.</p>
        <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        <p>Your Gmail SMTP integration is working correctly!</p>
      `,
      text: `
        🎉 Email Setup Successful!
        
        This is a test email from your Eufy automation system.
        Timestamp: ${new Date().toISOString()}
        
        Your Gmail SMTP integration is working correctly!
      `
    };
    
    console.log(`📤 Sending test email to ${testEmail.to}...`);
    const result = await transporter.sendMail(testEmail);
    console.log(`✅ Test email sent successfully! Message ID: ${result.messageId}`);
    console.log(`📬 Check your inbox at ${config.auth.user}`);
    
    return true;
    
  } catch (error) {
    console.error(`❌ Gmail SMTP test failed: ${error.message}`);
    return false;
  }
}

function testEufyMock() {
  console.log('\n🔓 Testing Eufy Mock Setup...');
  
  const username = process.env.EUFY_USERNAME;
  const deviceSerial = process.env.EUFY_DEVICE_SERIAL;
  
  if (!username || !deviceSerial) {
    console.error('❌ EUFY_USERNAME or EUFY_DEVICE_SERIAL not set');
    return false;
  }
  
  console.log(`✅ Eufy mock configured:`);
  console.log(`   Username: ${username}`);
  console.log(`   Device Serial: ${deviceSerial}`);
  console.log(`🧪 Mock mode will be used (no real hardware needed)`);
  
  return true;
}

async function main() {
  console.log('🧪 Eufy Automation - Real Credentials Test');
  console.log('==========================================');
  
  const results = {
    googleCalendar: await testGoogleCalendar(),
    gmailSMTP: await testGmailSMTP(),
    eufyMock: testEufyMock()
  };
  
  console.log('\n📊 Test Results Summary:');
  console.log('========================');
  console.log(`Google Calendar: ${results.googleCalendar ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Gmail SMTP:      ${results.gmailSMTP ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Eufy Mock:       ${results.eufyMock ? '✅ PASS' : '❌ FAIL'}`);
  
  const allPassed = Object.values(results).every(result => result);
  
  if (allPassed) {
    console.log('\n🎉 All tests passed! Your setup is ready.');
    console.log('📝 Next steps:');
    console.log('   1. Run: npm start');
    console.log('   2. Create a test calendar event 3 minutes from now');
    console.log('   3. Add yourself as an attendee');
    console.log('   4. Watch the automation work!');
  } else {
    console.log('\n❌ Some tests failed. Please check the setup guide:');
    console.log('   📖 See REAL_TESTING.md for detailed instructions');
  }
  
  process.exit(allPassed ? 0 : 1);
}

if (require.main === module) {
  main().catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
} 