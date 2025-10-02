#!/usr/bin/env node

/**
 * Checksum AI to Playwright Report Converter
 * 
 * Converts Checksum AI report format to standard Playwright JSON report format
 * while preserving test statuses: passed, failed, bug, recovered, flaky, skipped
 */

const fs = require('fs');
const path = require('path');

function convertChecksumToPlaywright(checksumReport, outputPath) {
  console.log('🔄 Converting Checksum AI report to Playwright format...\n');
  
  // Helper function to determine test status and characteristics
  function determineTestStatus(test, fileStats, checksumMetadata) {
    const { outcome, ok, tags = [], annotations = [], testId } = test;
    
    // Check for bug annotation (ONLY check annotations, not tags - matches backend)
    const hasBugAnnotation = annotations.some(annotation =>
      annotation.type && annotation.type === 'bug'
    );

    // Check for auto-recovery in annotations
    const hasAutoRecoveryAnnotation = annotations.some(annotation =>
      annotation.type && annotation.type.includes('auto-recovered')
    );
    
    // Check for auto-recovery in checksumMetadata (more comprehensive)
    let hasAutoRecoveryMetadata = false;
    if (checksumMetadata && checksumMetadata[testId]) {
      // Check all retry attempts for autoRecovered = true
      for (const retryKey in checksumMetadata[testId]) {
        const retryData = checksumMetadata[testId][retryKey];
        if (retryData.autoRecoveryMetadata?.data?.autoRecovered === true) {
          hasAutoRecoveryMetadata = true;
          break;
        }
      }
    }
    
    // Check for failed annotations
    const hasFailedAnnotation = annotations.some(annotation => 
      annotation.type && annotation.type.includes('failed')
    );
    
    const isFlaky = outcome === 'flaky';
    const isRecovered = hasAutoRecoveryAnnotation || hasAutoRecoveryMetadata;
    
    // Return primary status and all applicable characteristics
    const result = {
      primaryStatus: null,
      isFlaky: isFlaky,
      isRecovered: isRecovered,
      isBug: hasBugAnnotation  // Only use annotations, not tags
    };

    // Determine primary status based on Checksum logic
    if (hasBugAnnotation) {
      result.primaryStatus = 'bug';
    } else if (outcome === 'skipped') {
      result.primaryStatus = 'skipped';
    } else if (isFlaky) {
      // Flaky is the primary status, but test might also be recovered
      result.primaryStatus = 'flaky';
    } else if (isRecovered) {
      result.primaryStatus = 'recovered';
    } else if (outcome === 'unexpected' || !ok || hasFailedAnnotation) {
      result.primaryStatus = 'failed';
    } else if (outcome === 'expected' && ok) {
      result.primaryStatus = 'passed';
    } else {
      result.primaryStatus = 'passed';
    }
    
    return result;
  }
  
  // Helper function to convert result attachments
  function convertAttachments(checksumAttachments = []) {
    return checksumAttachments.map(attachment => ({
      name: attachment.name,
      contentType: attachment.contentType,
      path: attachment.path || '',
      body: attachment.body || undefined
    }));
  }
  
  // Helper function to extract error information from annotations
  function extractErrorFromAnnotations(annotations = []) {
    const failedAnnotation = annotations.find(annotation => 
      annotation.type && annotation.type.includes('failed')
    );
    
    if (failedAnnotation) {
      return {
        message: failedAnnotation.type,
        stack: failedAnnotation.description || failedAnnotation.type
      };
    }
    return null;
  }
  
  // Build the Playwright config structure
  const playwrightConfig = {
    config: {
      configFile: "checksum-converted.config.ts",
      rootDir: "/converted/tests",
      forbidOnly: false,
      fullyParallel: true,
      globalSetup: null,
      globalTeardown: null,
      globalTimeout: 0,
      grep: {},
      grepInvert: null,
      maxFailures: 0,
      metadata: {
        actualWorkers: checksumReport.metadata?.actualWorkers || 1
      },
      preserveOutput: "always",
      reporter: [["json", null]],
      reportSlowTests: {
        max: 5,
        threshold: 15000
      },
      quiet: false,
      projects: [
        {
          outputDir: "/converted/test-results",
          repeatEach: 1,
          retries: 1,
          id: "",
          name: "chromium",
          testDir: "/converted/tests",
          testIgnore: [],
          testMatch: ["**/*.@(spec|test).?(c|m)[jt]s?(x)"],
          timeout: 30000
        }
      ],
      shard: null,
      updateSnapshots: "missing",
      version: "1.40.1",
      workers: checksumReport.metadata?.actualWorkers || 1,
      webServer: null
    },
    suites: [],
    stats: {
      expected: 0,
      unexpected: 0,
      flaky: 0,
      skipped: 0
    },
    // Preserve checksumMetadata for accurate recovered test counting
    checksumMetadata: checksumReport.checksumMetadata || {}
  };
  
  let totalPassed = 0;
  let totalFailed = 0;
  let totalBug = 0;
  let totalRecovered = 0;
  let totalFlaky = 0;
  let totalSkipped = 0;
  
  // Convert each file to a suite
  checksumReport.files.forEach(file => {
    const suite = {
      title: path.basename(file.fileName, '.checksum.spec.ts'),
      file: file.fileName,
      column: 0,
      line: 0,
      specs: [],
      suites: []
    };
    
    // Convert each test in the file
    file.tests.forEach(test => {
      const testResult = determineTestStatus(test, file.stats, checksumReport.checksumMetadata);
      const testStatus = testResult.primaryStatus;
      
      // Count primary statuses only (no double counting)
      // Bug tests are tracked separately and NOT included in passed/failed
      // This matches website behavior
      if (testStatus === 'bug') {
        totalBug++;
        // Bug tests do NOT count toward passed/failed
      } else {
        switch (testStatus) {
          case 'passed': totalPassed++; break;
          case 'failed': totalFailed++; break;
          case 'recovered': totalRecovered++; break;
          case 'flaky': totalFlaky++; break;
          case 'skipped': totalSkipped++; break;
        }
      }
      
      const spec = {
        title: test.title,
        ok: testStatus === 'passed' || testStatus === 'recovered' || testStatus === 'flaky',
        tags: test.tags || [],
        tests: [
          {
            timeout: 30000,
            annotations: test.annotations?.map(annotation => ({
              type: annotation.type,
              description: annotation.description
            })) || [],
            expectedStatus: "passed",
            projectId: "",
            projectName: test.projectName || "chromium",
            results: test.results?.map((result, index) => {
              const error = extractErrorFromAnnotations(test.annotations);
              
              return {
                workerIndex: 0,
                status: testStatus === 'bug' ? 'passed' : testStatus, // Bug tests should show as passed in Playwright results since they're expected to fail
                duration: test.duration || 0,
                error: testStatus === 'bug' ? null : error, // Don't include error for bug tests
                errors: testStatus === 'bug' ? [] : (error ? [error] : []),
                stdout: [],
                stderr: [],
                retry: index,
                startTime: new Date().toISOString(),
                attachments: convertAttachments(result.attachments),
                ...(error && testStatus !== 'bug' && { errorLocation: test.location })
              };
            }) || [
              {
                workerIndex: 0,
                status: testStatus === 'bug' ? 'passed' : testStatus, // Bug tests should show as passed in Playwright results
                duration: test.duration || 0,
                errors: [],
                stdout: [],
                stderr: [],
                retry: 0,
                startTime: new Date().toISOString(),
                attachments: []
              }
            ]
          }
        ],
        id: test.testId,
        file: file.fileName,
        line: test.location?.line || 0,
        column: test.location?.column || 0
      };
      
      // Add annotations for all applicable statuses
      if (testResult.isBug) {
        spec.tests[0].annotations.push({
          type: 'bug',
          description: 'Test marked as bug'
        });
      }
      if (testResult.isRecovered) {
        spec.tests[0].annotations.push({
          type: 'auto-recovered',
          description: 'Test auto-recovered'
        });
      }
      if (testResult.isFlaky) {
        spec.tests[0].annotations.push({
          type: 'flaky',
          description: 'Test marked as flaky'
        });
      }
      
      suite.specs.push(spec);
    });
    
    playwrightConfig.suites.push(suite);
  });
  
  // Update stats to match backend logic
  // Bug tests are already counted in totalPassed or totalFailed based on their outcome
  playwrightConfig.stats = {
    expected: totalPassed + totalRecovered + totalFlaky, // Tests that succeeded
    unexpected: totalFailed, // Tests that failed (includes bug tests with outcome=unexpected)
    flaky: totalFlaky,
    skipped: totalSkipped
  };
  
  // Write the converted report
  fs.writeFileSync(outputPath, JSON.stringify(playwrightConfig, null, 2));
  
  // Print summary
  console.log('📊 Conversion Summary:');
  console.log(`✅ Passed: ${totalPassed}`);
  console.log(`❌ Failed: ${totalFailed}`);
  console.log(`🐞 Bug: ${totalBug}`);
  console.log(`🔄 Recovered: ${totalRecovered}`);
  console.log(`⚠️ Flaky: ${totalFlaky}`);
  console.log(`⏩ Skipped: ${totalSkipped}`);
  console.log(`\n📁 Converted report saved to: ${outputPath}`);
  console.log(`✨ Total tests converted: ${totalPassed + totalFailed + totalBug + totalRecovered + totalFlaky + totalSkipped}`);
  
  return playwrightConfig;
}

// Main execution
function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log('Usage: node checksum-to-playwright-converter.js <input-checksum-report.json> [output-playwright-report.json]');
    console.log('\nExample:');
    console.log('  node checksum-to-playwright-converter.js /Users/maysam/Downloads/application/report.json converted-report.json');
    process.exit(1);
  }
  
  const inputPath = args[0];
  const outputPath = args[1] || 'converted-playwright-report.json';
  
  // Validate input file exists
  if (!fs.existsSync(inputPath)) {
    console.error(`❌ Error: Input file not found: ${inputPath}`);
    process.exit(1);
  }
  
  try {
    // Read and parse Checksum report
    console.log(`📖 Reading Checksum report from: ${inputPath}`);
    const checksumData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    
    // Validate it's a Checksum report
    if (!checksumData.files || !Array.isArray(checksumData.files)) {
      console.error('❌ Error: Input file does not appear to be a valid Checksum AI report (missing "files" array)');
      process.exit(1);
    }
    
    // Convert the report
    const converted = convertChecksumToPlaywright(checksumData, outputPath);
    
    console.log('\n✅ Conversion completed successfully!');
    console.log('\n🧪 You can now test the converted report with:');
    console.log(`   node manual-test.js  # (after updating the path to point to ${outputPath})`);
    
  } catch (error) {
    console.error('❌ Error during conversion:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { convertChecksumToPlaywright };
