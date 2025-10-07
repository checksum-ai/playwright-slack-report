const ResultsParser = require('../dist/src/ResultsParser').default;

async function testNewStatuses() {
  console.log('🧪 Testing bug and recovered statuses...\n');

  const parser = new ResultsParser();

  // Test parseFromJsonFile with new statuses
  try {
    const results = await parser.parseFromJsonFile(process.argv[2]);
    console.log('📊 Test Results Summary:');
    console.log(`✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`🐞 Bug: ${results.bug}`);
    console.log(`🔄 Recovered: ${results.recovered}`);
    console.log(`⚠️ Flaky: ${results.flaky}`);
    console.log(`⏩ Skipped: ${results.skipped}`);
    console.log(`\n📋 Total Tests: ${results.tests.length}`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testNewStatuses();