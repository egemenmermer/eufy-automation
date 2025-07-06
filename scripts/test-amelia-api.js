#!/usr/bin/env node

/**
 * Test script for Amelia Elite API connection
 * This script tests the API key and connection to verify everything works
 */

require('dotenv').config();
const moment = require('moment-timezone');

// Configuration
const API_KEY = process.env.AMELIA_API_KEY;
const BASE_URL = process.env.AMELIA_API_BASE_URL;

if (!API_KEY) {
  console.error('❌ AMELIA_API_KEY not found in environment variables');
  process.exit(1);
}

if (!BASE_URL) {
  console.error('❌ AMELIA_API_BASE_URL not found in environment variables');
  console.log('💡 Please set your WordPress site URL in .env file');
  process.exit(1);
}

console.log('🧪 Testing Amelia Elite API Connection...\n');
console.log(`📍 API Base URL: ${BASE_URL}`);
console.log(`🔑 API Key: ${API_KEY.substring(0, 10)}...${API_KEY.substring(API_KEY.length - 10)}\n`);

async function testAmeliaAPI() {
  try {
    // Test 1: Get appointments
    console.log('📅 Test 1: Fetching appointments...');
    
    const appointmentsResponse = await fetch(`${BASE_URL}/wp-admin/admin-ajax.php?action=wpamelia_api&call=/api/v1/appointments`, {
      method: 'GET',
      headers: {
        'Amelia': API_KEY,
        'Content-Type': 'application/json'
      }
    });

    console.log(`   Status: ${appointmentsResponse.status} ${appointmentsResponse.statusText}`);
    
    if (!appointmentsResponse.ok) {
      const errorText = await appointmentsResponse.text();
      console.error(`   ❌ API Error: ${errorText}`);
      
      if (appointmentsResponse.status === 401) {
        console.log('   💡 Check if your API key is correct');
      } else if (appointmentsResponse.status === 404) {
        console.log('   💡 Check if your WordPress URL is correct');
        console.log('   💡 Make sure Amelia plugin is installed and Elite license is active');
      }
      
      return false;
    }

    const appointmentsData = await appointmentsResponse.json();
    console.log(`   ✅ Success! Found ${appointmentsData.data?.appointments?.length || 0} appointments`);
    
    // Show upcoming appointments
    if (appointmentsData.data?.appointments?.length > 0) {
      console.log('\n📋 Upcoming appointments:');
      appointmentsData.data.appointments.slice(0, 5).forEach(apt => {
        const startTime = moment(apt.bookingStart).format('MMM DD, YYYY HH:mm');
        const customer = apt.bookings[0]?.customer;
        const customerName = customer ? `${customer.firstName} ${customer.lastName}`.trim() : 'Unknown';
        console.log(`   • ${startTime} - ${apt.service?.name || 'Unknown Service'} (${customerName})`);
      });
    }

    // Test 2: Get services
    console.log('\n🛠️  Test 2: Fetching services...');
    
    const servicesResponse = await fetch(`${BASE_URL}/wp-admin/admin-ajax.php?action=wpamelia_api&call=/api/v1/services`, {
      method: 'GET',
      headers: {
        'Amelia': API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (servicesResponse.ok) {
      const servicesData = await servicesResponse.json();
      console.log(`   ✅ Found ${servicesData.data?.services?.length || 0} services`);
      
      if (servicesData.data?.services?.length > 0) {
        console.log('\n🎯 Available services:');
        servicesData.data.services.slice(0, 5).forEach(service => {
          console.log(`   • ${service.name} (${service.duration} min) - $${service.price}`);
        });
      }
    } else {
      console.log(`   ⚠️  Services endpoint status: ${servicesResponse.status}`);
    }

    console.log('\n✅ Amelia API connection test completed successfully!');
    console.log('\n🎉 Your system is ready to automate with Amelia bookings!');
    return true;

  } catch (error) {
    console.error('\n❌ API Test Failed:', error.message);
    
    if (error.code === 'ENOTFOUND') {
      console.log('💡 Check if your AMELIA_API_BASE_URL is correct');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('💡 Check if your WordPress site is accessible');
    }
    
    return false;
  }
}

// Helper function to test specific appointment ID
async function testSpecificAppointment(appointmentId) {
  try {
    console.log(`\n🔍 Testing specific appointment ID: ${appointmentId}`);
    
    const response = await fetch(`${BASE_URL}/wp-admin/admin-ajax.php?action=wpamelia_api&call=/api/v1/appointments/${appointmentId}`, {
      method: 'GET',
      headers: {
        'Amelia': API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Appointment details:', {
        id: data.data?.appointment?.id,
        service: data.data?.appointment?.service?.name,
        start: data.data?.appointment?.bookingStart,
        status: data.data?.appointment?.status
      });
    } else {
      console.log(`❌ Appointment ${appointmentId} not found or error: ${response.status}`);
    }
  } catch (error) {
    console.error('Error testing specific appointment:', error.message);
  }
}

// Run the test
testAmeliaAPI().then(success => {
  if (success) {
    console.log('\n🚀 Next steps:');
    console.log('   1. Update your other environment variables (Eufy, Email)');
    console.log('   2. Run: npm run dev');
    console.log('   3. Create a test booking to see automation in action');
  } else {
    console.log('\n🔧 Fix the issues above and run the test again');
    process.exit(1);
  }
}).catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
}); 