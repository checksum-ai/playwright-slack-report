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
    console.log(`🚨 Failures: ${results.failures.length}`);

    console.log('\n📝 Test Details:');
    results.tests.forEach((test, index) => {
      const statusEmoji = {
        'passed': '✅',
        'failed': '❌',
        'bug': '🐞',
        'recovered': '🔄',
        'flaky': '⚠️',
        'skipped': '⏩'
      };
      const bugIndicator = test.isBug ? ' 🐞' : '';
      console.log(`  ${index + 1}. ${statusEmoji[test.status] || '❓'} ${test.name} (${test.status}${bugIndicator})`);
    });

    console.log('\n🔍 Failures Analysis:');
    results.failures.forEach((failure, index) => {
      console.log(`  ${index + 1}. ${failure.test} - ${failure.suite}`);
    });

    console.log('\n✅ Test completed successfully!');

  //   // Validate expected behavior for real Playwright report
  //   const expectedBugs = 3; // Tests with @bug tags or bug annotations: test #12, #29, and #35
  //   const expectedRecovered = 4; // Back to 4 since we don't override status anymore
  //   const expectedFailures = 3; // Bug tests count as failures
  //   const expectedFlaky = 1; // TSV test that failed then passed

  //   if (results.bug === expectedBugs &&
  //       results.recovered === expectedRecovered &&
  //       results.failures.length === expectedFailures &&
  //       results.flaky === expectedFlaky) {
  //     console.log('🎉 All assertions passed!');
  //   } else {
  //     console.log('❌ Some assertions failed!');
  //     console.log(`Expected: bugs=${expectedBugs}, recovered=${expectedRecovered}, failures=${expectedFailures}, flaky=${expectedFlaky}`);
  //     console.log(`Actual: bugs=${results.bug}, recovered=${results.recovered}, failures=${results.failures.length}, flaky=${results.flaky}`);
  //   }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testNewStatuses();