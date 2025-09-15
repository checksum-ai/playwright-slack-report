"use strict";
/* eslint-disable no-shadow */
/* eslint-disable no-underscore-dangle */
/* eslint-disable import/extensions */
/* eslint-disable no-control-regex */
/* eslint-disable class-methods-use-this */
/* eslint-disable no-param-reassign */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
class ResultsParser {
    result;
    constructor() {
        this.result = [];
    }
    async parseFromJsonFile(filePath) {
        let data;
        let parsedData;
        try {
            data = fs.readFileSync(filePath, 'utf-8');
            parsedData = JSON.parse(data);
        }
        catch (error) {
            throw new Error(`Error reading or parsing JSON file [${filePath}]: \n\t${error}`);
        }
        const retries = parsedData.config.projects[0]?.retries || 0;
        for (const suite of parsedData.suites) {
            // eslint-disable-next-line no-await-in-loop
            await this.parseTestSuite(suite, retries);
        }
        const failures = await this.getFailures();
        // Collect all tests to count custom statuses
        let allTests = [];
        for (const suite of this.result) {
            allTests = allTests.concat(suite.testSuite.tests);
        }
        // Count our custom statuses from processed tests
        const bugCount = allTests.filter(test => test.isBug === true).length;
        const recoveredCount = allTests.filter(test => test.status === 'recovered').length;
        const flakyCount = allTests.filter(test => test.status === 'flaky').length;
        const summary = {
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
    async parseTestSuite(suites, retries) {
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
    async parseTests(suiteName, specs, retries, suite) {
        const testResults = [];
        for (const spec of specs) {
            for (const test of spec.tests) {
                const { expectedStatus } = test;
                const results = test.results;
                // Analyze all results to determine final test status
                let finalStatus = 'passed';
                let isRecovered = false;
                let reason = '';
                let lastResult = results[results.length - 1]; // Get the last (final) result
                // Check if this is a recovered test
                isRecovered = suite?.recovered === true ||
                    results.some((result) => result.annotations?.some((annotation) => annotation.type?.includes('auto-recovered')));
                // Check if this test is marked as a bug
                const hasBugInTitle = spec.title.includes('@bug');
                const hasTestLevelBugAnnotation = test.annotations?.some((annotation) => annotation.type === 'bug');
                const hasResultLevelBugAnnotation = results.some((result) => result.annotations?.some((annotation) => annotation.type === 'bug'));
                const isBugTest = hasBugInTitle || hasTestLevelBugAnnotation || hasResultLevelBugAnnotation;
                if (isRecovered) {
                    finalStatus = 'recovered';
                    reason = lastResult.error ? this.getFailure(lastResult.error.snippet, lastResult.error.stack) : '';
                }
                else if (results.length > 1) {
                    // Multiple results means there were retries
                    const firstFailed = results[0].status === 'failed' || results[0].status === 'timedOut';
                    const finalPassed = lastResult.status === 'passed';
                    if (firstFailed && finalPassed) {
                        finalStatus = 'flaky';
                        reason = results[0].error ? this.getFailure(results[0].error.snippet, results[0].error.stack) : '';
                    }
                    else {
                        finalStatus = lastResult.status === 'unexpected' ? 'failed' : lastResult.status;
                        reason = lastResult.error ? this.getFailure(lastResult.error.snippet, lastResult.error.stack) : '';
                    }
                }
                else {
                    // Single result
                    finalStatus = lastResult.status === 'unexpected' ? 'failed' : lastResult.status;
                    reason = lastResult.error ? this.getFailure(lastResult.error.snippet, lastResult.error.stack) : '';
                }
                testResults.push({
                    suiteName,
                    name: spec.title,
                    status: finalStatus,
                    isBug: isBugTest,
                    browser: test.projectName,
                    projectName: test.projectName,
                    retry: lastResult.retry,
                    retries,
                    startedAt: lastResult.startTime,
                    endedAt: new Date(new Date(lastResult.startTime).getTime() + lastResult.duration).toISOString(),
                    reason,
                    attachments: lastResult.attachments,
                    expectedStatus,
                });
            }
        }
        return testResults;
    }
    getFailure(snippet, stack) {
        const fullError = `${snippet}\r\n${stack || ''}`;
        return this.cleanseReason(fullError);
    }
    getExpectedFailure(test) {
        const failureReason = test.annotations?.find((f) => f.type === 'fail');
        if (failureReason) {
            return failureReason.description;
        }
        return '';
    }
    async getParsedResults(allTests) {
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
        for (const test of allTests)
            ++stats[test.outcome()];
        // Count bug and recovered statuses from our internal test results
        let bugCount = 0;
        let recoveredCount = 0;
        for (const suite of this.result) {
            for (const test of suite.testSuite.tests) {
                if (test.status === 'bug') {
                    bugCount += 1;
                }
                else if (test.status === 'recovered') {
                    recoveredCount += 1;
                }
            }
        }
        const summary = {
            passed: stats.expected,
            failed: stats.unexpected,
            flaky: stats.flaky,
            skipped: stats.skipped,
            bug: bugCount,
            recovered: recoveredCount,
            failures,
            tests: [],
        };
        for (const suite of this.result) {
            summary.tests = summary.tests.concat(suite.testSuite.tests);
        }
        return summary;
    }
    async getFailures() {
        const failures = [];
        for (const suite of this.result) {
            for (const test of suite.testSuite.tests) {
                if (test.status === 'failed'
                    || test.status === 'timedOut'
                    || test.isBug === true
                    || test.expectedStatus === 'failed') {
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
    static getTestName(failedTest) {
        const testName = failedTest.name;
        if (failedTest.browser && failedTest.projectName) {
            if (failedTest.browser === failedTest.projectName) {
                return `${testName} [${failedTest.browser}]`;
            }
            return `${testName} [Project Name: ${failedTest.projectName}] using ${failedTest.browser}`;
        }
        return testName;
    }
    updateResults(data) {
        if (data.testSuite.tests.length > 0) {
            const resIndex = this.result.findIndex((res) => res.testSuite.title === data.testSuite.title);
            if (resIndex > -1) {
                for (const test of data.testSuite.tests) {
                    const testIndex = this.result[resIndex].testSuite.tests.findIndex((tes) => `${tes.projectName}${tes.name}`
                        === `${test.projectName}${test.name}`);
                    if (testIndex > -1) {
                        this.result[resIndex].testSuite.tests[testIndex] = test;
                    }
                    else {
                        this.result[resIndex].testSuite.tests.push(test);
                    }
                }
            }
            else {
                this.result.push(data);
            }
        }
    }
    addTestResultFromJson({ suiteName, spec, testCase, projectBrowserMapping, retries, }) {
        const testResults = [];
        const projectSettings = this.determineBrowser(projectBrowserMapping[0].projectName, projectBrowserMapping);
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
                endedAt: new Date(new Date(result.startTime).getTime() + result.duration).toISOString(),
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
    addTestResult(suiteName, testCase, projectBrowserMapping) {
        const testResults = [];
        const projectSettings = this.determineBrowser(testCase._projectId, projectBrowserMapping);
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
                endedAt: new Date(new Date(result.startTime).getTime() + result.duration).toISOString(),
                reason: testCase.expectedStatus === 'failed'
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
    safelyDetermineFailure(result) {
        if (result.errors.length > 0) {
            const fullError = result.errors
                .map((e) => `${e.message}\r\n${e.stack ? e.stack : ''}\r\n`)
                .join();
            return this.cleanseReason(fullError);
        }
        return `${this.cleanseReason(result.error?.message)} \n ${this.cleanseReason(result.error?.stack)}`;
    }
    cleanseReason(rawReaseon) {
        // eslint-disable-next-line prefer-regex-literals
        const ansiRegex = new RegExp('([\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)|(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~])))', 'g');
        const ansiCleansed = rawReaseon ? rawReaseon.replace(ansiRegex, '') : '';
        const logsStripped = ansiCleansed
            .replace(/============================================================\n/g, '')
            .replace(/============================================================\r\n/g, '')
            .replace(/=========================== logs ===========================\n/g, '');
        return logsStripped;
    }
    determineBrowser(projectName, browserMappings) {
        const browserMapping = browserMappings.find((mapping) => mapping.projectName === projectName);
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
exports.default = ResultsParser;
//# sourceMappingURL=ResultsParser.js.map