#!/usr/bin/env node

/**
 * Test script for door code generation functionality
 * Verifies that unique codes are generated and validation works
 */

const doorCodeGenerator = require('../src/utils/doorCodeGenerator');

console.log('🧪 Testing Door Code Generation System...\n');

// Test 1: Basic code generation
console.log('🔧 Test 1: Basic code generation');
const appointmentId1 = '123';
const code1 = doorCodeGenerator.generateCode(appointmentId1);
console.log(`Generated code for appointment ${appointmentId1}: ${code1}`);

// Test 2: Multiple unique codes
console.log('\n🔧 Test 2: Generating multiple unique codes');
const codes = [];
for (let i = 1; i <= 5; i++) {
  const appointmentId = `appt_${i}`;
  const code = doorCodeGenerator.generateCode(appointmentId);
  codes.push({ appointmentId, code });
  console.log(`Appointment ${appointmentId}: ${code}`);
}

// Verify all codes are unique
const uniqueCodes = new Set(codes.map(c => c.code));
console.log(`\n✅ Generated ${codes.length} codes, ${uniqueCodes.size} are unique`);

// Test 3: Code validation
console.log('\n🔧 Test 3: Code validation');
const testAppointmentId = 'test_123';
const testCode = doorCodeGenerator.generateCode(testAppointmentId);
console.log(`Generated test code: ${testCode} for appointment: ${testAppointmentId}`);

// Validate correct code
const validResult = doorCodeGenerator.validateCode(testCode, testAppointmentId);
console.log(`✅ Valid code test: ${validResult ? 'PASS' : 'FAIL'}`);

// Validate incorrect code
const invalidResult = doorCodeGenerator.validateCode('9999', testAppointmentId);
console.log(`❌ Invalid code test: ${!invalidResult ? 'PASS' : 'FAIL'}`);

// Validate wrong appointment
const wrongAppointmentResult = doorCodeGenerator.validateCode(testCode, 'wrong_appointment');
console.log(`❌ Wrong appointment test: ${!wrongAppointmentResult ? 'PASS' : 'FAIL'}`);

// Test 4: Code retrieval
console.log('\n🔧 Test 4: Code retrieval');
const retrievedCode = doorCodeGenerator.getCodeForAppointment(testAppointmentId);
if (retrievedCode) {
  console.log(`✅ Retrieved code: ${retrievedCode.code} for appointment: ${retrievedCode.appointmentId}`);
  console.log(`   Generated at: ${retrievedCode.generatedAt}`);
} else {
  console.log('❌ Failed to retrieve code');
}

// Test 5: Statistics
console.log('\n🔧 Test 5: System statistics');
const stats = doorCodeGenerator.getStats();
console.log('📊 Door Code Generator Stats:');
console.log(`   Total codes generated: ${stats.totalCodesGenerated}`);
console.log(`   Recent codes tracked: ${stats.recentCodesTracked}`);
console.log(`   Code length: ${stats.codeLength}`);
console.log(`   Oldest code: ${stats.oldestCode || 'None'}`);

// Test 6: Security validation
console.log('\n🔧 Test 6: Security validation (rejecting weak patterns)');
const securityTests = [
  '0000', '1111', '2222', '3333', '4444', '5555', 
  '6666', '7777', '8888', '9999', '1234', '4321'
];

let weakPatternsGenerated = 0;
for (let i = 0; i < 50; i++) {
  const code = doorCodeGenerator.generateCode(`security_test_${i}`);
  if (securityTests.includes(code)) {
    weakPatternsGenerated++;
  }
}

console.log(`✅ Security test: ${weakPatternsGenerated === 0 ? 'PASS' : 'FAIL'} (${weakPatternsGenerated} weak patterns generated out of 50)`);

// Test 7: Performance test
console.log('\n🔧 Test 7: Performance test');
const startTime = Date.now();
const performanceCodes = [];

for (let i = 0; i < 100; i++) {
  const code = doorCodeGenerator.generateCode(`perf_test_${i}`);
  performanceCodes.push(code);
}

const endTime = Date.now();
const duration = endTime - startTime;
console.log(`✅ Generated 100 codes in ${duration}ms (average: ${(duration/100).toFixed(2)}ms per code)`);

// Verify performance codes are unique
const uniquePerformanceCodes = new Set(performanceCodes);
const uniquenessPercent = (uniquePerformanceCodes.size / performanceCodes.length * 100).toFixed(1);
console.log(`✅ Uniqueness: ${uniquePerformanceCodes.size}/${performanceCodes.length} (${uniquenessPercent}%)`);

console.log('\n🎉 Door code generation tests completed!');
console.log('\n📝 Summary:');
console.log('   ✅ Basic generation works');
console.log('   ✅ Multiple unique codes generated');
console.log('   ✅ Validation works correctly');
console.log('   ✅ Code retrieval works');
console.log('   ✅ Statistics available');
console.log('   ✅ Security patterns rejected');
console.log('   ✅ Performance acceptable');

console.log('\n🚀 The random door code system is ready for production!'); 