/* eslint-disable no-shadow */
/* eslint-disable no-underscore-dangle */
/* eslint-disable import/extensions */
/* eslint-disable no-control-regex */
/* eslint-disable class-methods-use-this */
/* eslint-disable no-param-reassign */

import * as fs from 'fs';
import { TestCase } from '@playwright/test/reporter';
import {
  failure, JSONResult, Spec, SummaryResults,
} from '.';

/* eslint-disable no-restricted-syntax */
export type testResult = {
  suiteName: string;
  name: string;
  browser?: string;
  projectName: string;
  endedAt: string;
  reason: string;
  retry: number;
  retries: number;
  startedAt: string;
  status: 'passed' | 'failed' | 'timedOut' | 'skipped' | 'bug' | 'recovered' | 'flaky';
  isBug?: boolean; // Flag to indicate test has @bug tag
  isFlaky?: boolean; // Flag to indicate test is flaky (has retries)
  isRecovered?: boolean; // Flag to indicate test has recovery
  expectedStatus?: 'passed' | 'failed' | 'skipped';
  attachments?: {
    body: string | undefined | Buffer;
    contentType: string;
    name: string;
    path: string;
  }[];
};

export type testSuite = {
  testSuite: {
    title: string;
    tests: testResult[];
    testRunId?: number;
  };
};

export default class ResultsParser {
  private result: testSuite[];

  constructor() {
    this.result = [];
  }

  async parseFromJsonFile(filePath: string) {
    let data: string;
    let parsedData: JSONResult;
    try {
      data = fs.readFileSync(filePath, 'utf-8');
      parsedData = JSON.parse(data);
    } catch (error) {
      throw new Error(
        `Error reading or parsing JSON file [${filePath}]: \n\t${error}`,
      );
    }

    const retries = parsedData.config.projects[0]?.retries || 0;
    for (const suite of parsedData.suites) {
      // eslint-disable-next-line no-await-in-loop
      await this.parseTestSuite(suite, retries);
    }

    const failures = await this.getFailures();

    // Collect all tests to count custom statuses
    let allTests: testResult[] = [];
    for (const suite of this.result) {
      allTests = allTests.concat(suite.testSuite.tests);
    }

    // Count our custom statuses from processed tests (with dual counting support)
    const bugCount = allTests.filter(test => test.isBug === true).length;
    const flakyCount = allTests.filter(test => (test as any).isFlaky || test.status === 'flaky').length;

    // Count recovered tests from both checksumMetadata AND processed test flags
    let recoveredCount = 0;

    // First check checksumMetadata (preferred method for ChecksumAI reports)
    if (parsedData.checksumMetadata) {
      for (const [testId, retries] of Object.entries(parsedData.checksumMetadata)) {
        // Check if any retry has autoRecovered: true
        const wasRecovered = Object.values(retries as any).some((retry: any) =>
          retry.autoRecoveryMetadata?.data?.autoRecovered === true
        );
        if (wasRecovered) {
          recoveredCount++;
        }
      }
    } else {
      // Fallback: count from processed tests (for reports with annotations but no metadata)
      recoveredCount = allTests.filter(test =>
        (test as any).isRecovered || test.status === 'recovered'
      ).length;
    }

    const summary: SummaryResults = {
      passed: parsedData.stats.expected,
      failed: parsedData.stats.unexpected,
      flaky: flakyCount,
      skipped: parsedData.stats.skipped,
      bug: bugCount,
      recovered: recoveredCount,
      failures,
      tests: allTests,
    };

    return summary;
  }

  async parseTestSuite(suites: any, retries: number) {
    let testResults = [];

    // if it has direct specs
    if (suites.specs?.length > 0) {
      testResults = await this.parseTests(suites.title, suites.specs, retries, suites);
      this.updateResults({
        testSuite: {
          title: suites.title ?? suites.file,
          tests: testResults,
        },
      });
    }

    if (suites.suites?.length > 0) {
      for (const suite of suites.suites) {
        // eslint-disable-next-line no-await-in-loop
        await this.parseTestSuite(suite, retries);
      }
    }
  }

  async parseTests(suiteName: any, specs: any, retries: number, suite?: any) {
    const testResults: testResult[] = [];

    for (const spec of specs) {
      for (const test of spec.tests) {
        const { expectedStatus } = test;
        const results = test.results;

        // Analyze all results to determine final test status
        let finalStatus: 'passed' | 'failed' | 'timedOut' | 'skipped' | 'bug' | 'recovered' | 'flaky' = 'passed';
        let isRecovered = false;
        let reason = '';
        let lastResult = results[results.length - 1]; // Get the last (final) result

        // Check if this is a recovered test
        // Check for auto-recovery in annotations (supports both exact match and contains)
        isRecovered = test.annotations?.some((annotation: any) =>
          annotation.type && (
            annotation.type === 'auto-recovered' ||
            annotation.type.includes('auto-recovered')
          )
        );

        // Check if this test is marked as a bug
        // Only check test-level annotations to match backend logic
        const isBugTest = test.annotations?.some((annotation: any) =>
          annotation.type === 'bug'
        );

        // Determine if test is flaky (has retries or marked as flaky)
        let isFlaky = false;
        if (results.length > 1) {
          const firstFailed = results[0].status === 'failed' || results[0].status === 'timedOut';
          const finalPassed = lastResult.status === 'passed';
          const hasFlaky = results.some((result: any) => result.status === 'flaky');
          isFlaky = hasFlaky || (firstFailed && finalPassed);
        }
        
        // Also check if any result is explicitly marked as flaky in the original report
        const hasExplicitFlaky = results.some((result: any) => result.status === 'flaky');
        if (hasExplicitFlaky) {
          isFlaky = true;
        }
        

        // Determine primary status - flaky and recovered can coexist
        if (isRecovered && isFlaky) {
          // Both flaky and recovered - use recovered as primary but mark as flaky too
          finalStatus = 'recovered';
          reason = lastResult.error ? this.getFailure(lastResult.error.snippet, lastResult.error.stack) : '';
        } else if (isRecovered) {
          finalStatus = 'recovered';
          reason = lastResult.error ? this.getFailure(lastResult.error.snippet, lastResult.error.stack) : '';
        } else if (isFlaky) {
          finalStatus = 'flaky';
          reason = results[0].error ? this.getFailure(results[0].error.snippet, results[0].error.stack) : '';
        } else if (results.length > 1) {
          finalStatus = lastResult.status === 'unexpected' ? 'failed' : lastResult.status;
          reason = lastResult.error ? this.getFailure(lastResult.error.snippet, lastResult.error.stack) : '';
        } else {
          // Single result
          finalStatus = lastResult.status === 'unexpected' ? 'failed' : lastResult.status;
          reason = lastResult.error ? this.getFailure(lastResult.error.snippet, lastResult.error.stack) : '';
        }

        const testObj = {
          suiteName,
          name: spec.title,
          status: finalStatus,
          isBug: isBugTest,
          isFlaky: isFlaky, // Track flaky status separately
          isRecovered: isRecovered, // Track recovered status separately
          browser: test.projectName,
          projectName: test.projectName,
          retry: lastResult.retry,
          retries,
          startedAt: lastResult.startTime,
          endedAt: new Date(
            new Date(lastResult.startTime).getTime() + lastResult.duration,
          ).toISOString(),
          reason,
          attachments: lastResult.attachments,
          expectedStatus,
        };
        
        
        testResults.push(testObj);
      }
    }
    return testResults;
  }

  getFailure(snippet: string, stack: string) {
    const fullError = `${snippet}\r\n${stack || ''}`;
    return this.cleanseReason(fullError);
  }

  getExpectedFailure(test: any) {
    const failureReason = test.annotations?.find((f) => f.type === 'fail');
    if (failureReason) {
      return failureReason.description;
    }
    return '';
  }

  async getParsedResults(allTests: Array<TestCase>): Promise<SummaryResults> {
    const failures = await this.getFailures();
    // use Playwright recommended way of extracting test stats:
    // https://github.com/microsoft/playwright/issues/27498#issuecomment-1766766335
    const stats = {
      expected: 0,
      skipped: 0,
      unexpected: 0,
      flaky: 0,
    };
    // eslint-disable-next-line no-plusplus
    for (const test of allTests) ++stats[test.outcome()];

    // Count bug, recovered, and flaky statuses from our internal test results
    let bugCount = 0;
    let recoveredCount = 0;
    let flakyCount = 0;
    let recoveredFromPassedCount = 0;
    let flakyFromExpectedCount = 0;
    
    for (const suite of this.result) {
      for (const test of suite.testSuite.tests) {
        if (test.status === 'bug') {
          bugCount += 1;
        }
        
        // Count recovered tests (can overlap with flaky)
        if ((test as any).isRecovered || test.status === 'recovered') {
          recoveredCount += 1;
          if (test.expectedStatus === 'passed') {
            recoveredFromPassedCount += 1;
          }
        }
        
        // Count flaky tests (can overlap with recovered)
        if ((test as any).isFlaky || test.status === 'flaky') {
          flakyCount += 1;
          // If flaky test was originally expected to pass, adjust counts
          if (test.expectedStatus === 'passed') {
            flakyFromExpectedCount += 1;
          }
        }
      }
    }

    const summary: SummaryResults = {
      passed: stats.expected, // Use Playwright's expected count directly (matches backend)
      failed: stats.unexpected,
      flaky: flakyCount, // Use our custom flaky count (can overlap with recovered)
      skipped: stats.skipped,
      bug: bugCount,
      recovered: recoveredCount, // Use our custom recovered count (can overlap with flaky)
      failures,
      tests: [],
    };
    for (const suite of this.result) {
      summary.tests = summary.tests.concat(suite.testSuite.tests);
    }
    return summary;
  }

  async getFailures(): Promise<Array<failure>> {
    const failures: Array<failure> = [];
    for (const suite of this.result) {
      for (const test of suite.testSuite.tests) {
        if (
          test.status === 'failed'
          || test.status === 'timedOut'
          || test.isBug === true
          || test.expectedStatus === 'failed'
        ) {
          // Bug tests always count as failures
          // For other statuses, only flag as failed if the last attempt has failed
          if (test.isBug === true || test.retries === test.retry) {
            failures.push({
              suite: test.suiteName,
              test: ResultsParser.getTestName(test),
              failureReason: test.reason,
            });
          }
        }
      }
    }
    return failures;
  }

  static getTestName(failedTest: any) {
    const testName = failedTest.name;
    if (failedTest.browser && failedTest.projectName) {
      if (failedTest.browser === failedTest.projectName) {
        return `${testName} [${failedTest.browser}]`;
      }
      return `${testName} [Project Name: ${failedTest.projectName}] using ${failedTest.browser}`;
    }

    return testName;
  }

  updateResults(data: { testSuite: any }) {
    if (data.testSuite.tests.length > 0) {
      const resIndex = this.result.findIndex(
        (res) => res.testSuite.title === data.testSuite.title,
      );
      if (resIndex > -1) {
        for (const test of data.testSuite.tests) {
          const testIndex = this.result[resIndex].testSuite.tests.findIndex(
            (tes) => `${tes.projectName}${tes.name}`
              === `${test.projectName}${test.name}`,
          );
          if (testIndex > -1) {
            this.result[resIndex].testSuite.tests[testIndex] = test;
          } else {
            this.result[resIndex].testSuite.tests.push(test);
          }
        }
      } else {
        this.result.push(data);
      }
    }
  }

  addTestResultFromJson({
    suiteName,
    spec,
    testCase,
    projectBrowserMapping,
    retries,
  }: {
    suiteName: any;
    spec: Spec;
    testCase: any;
    projectBrowserMapping: any;
    retries: number;
  }) {
    const testResults: testResult[] = [];
    const projectSettings = this.determineBrowser(
      projectBrowserMapping[0].projectName,
      projectBrowserMapping,
    );
    for (const result of testCase.results) {
      testResults.push({
        suiteName,
        name: spec.title,
        status: result.status,
        browser: projectSettings.browser,
        projectName: projectSettings.projectName,
        retry: result.retry,
        retries,
        startedAt: new Date(result.startTime).toISOString(),
        endedAt: new Date(
          new Date(result.startTime).getTime() + result.duration,
        ).toISOString(),
        reason: this.safelyDetermineFailure(result),
        attachments: result.attachments,
      });
    }
    this.updateResults({
      testSuite: {
        title: suiteName,
        tests: testResults,
      },
    });
  }

  addTestResult(suiteName: any, testCase: any, projectBrowserMapping: any) {
    const testResults: testResult[] = [];
    const projectSettings = this.determineBrowser(
      testCase._projectId,
      projectBrowserMapping,
    );
    for (const result of testCase.results) {
      testResults.push({
        suiteName,
        name: testCase.title,
        status: result.status,
        browser: projectSettings.browser,
        projectName: projectSettings.projectName,
        retry: result.retry,
        retries: testCase.retries,
        startedAt: new Date(result.startTime).toISOString(),
        endedAt: new Date(
          new Date(result.startTime).getTime() + result.duration,
        ).toISOString(),
        reason:
          testCase.expectedStatus === 'failed'
            ? this.getExpectedFailure(testCase)
            : this.safelyDetermineFailure(result),
        attachments: result.attachments,
        expectedStatus: testCase.expectedStatus,
      });
    }
    this.updateResults({
      testSuite: {
        title: suiteName,
        tests: testResults,
      },
    });
  }

  safelyDetermineFailure(result: {
    errors: any[];
    error: { message: string; stack: string };
  }): string {
    if (result.errors.length > 0) {
      const fullError = result.errors
        .map((e) => `${e.message}\r\n${e.stack ? e.stack : ''}\r\n`)
        .join();
      return this.cleanseReason(fullError);
    }
    return `${this.cleanseReason(
      result.error?.message,
    )} \n ${this.cleanseReason(result.error?.stack)}`;
  }

  cleanseReason(rawReaseon: string): string {
    // eslint-disable-next-line prefer-regex-literals
    const ansiRegex = new RegExp(
      '([\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)|(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~])))',
      'g',
    );

    const ansiCleansed = rawReaseon ? rawReaseon.replace(ansiRegex, '') : '';
    const logsStripped = ansiCleansed
      .replace(
        /============================================================\n/g,
        '',
      )
      .replace(
        /============================================================\r\n/g,
        '',
      )
      .replace(
        /=========================== logs ===========================\n/g,
        '',
      );
    return logsStripped;
  }

  determineBrowser(
    projectName: string,
    browserMappings: { projectName: string; browser: string }[],
  ): {
    projectName: string;
    browser: string;
  } {
    const browserMapping = browserMappings.find(
      (mapping) => mapping.projectName === projectName,
    );
    if (browserMapping) {
      return {
        projectName: browserMapping.projectName,
        browser: browserMapping.browser,
      };
    }
    return {
      projectName: '',
      browser: '',
    };
  }
}
