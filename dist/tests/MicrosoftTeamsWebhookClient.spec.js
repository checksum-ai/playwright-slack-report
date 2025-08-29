"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
const MicrosoftTeamsWebhookClient_1 = __importDefault(require("../src/MicrosoftTeamsWebhookClient"));
const mockSummaryResults = {
    failed: 1,
    passed: 1,
    flaky: undefined,
    skipped: 1,
    failures: [
        {
            suite: 'smoke',
            test: 'test',
            failureReason: 'Unexpected error',
        },
    ],
    meta: [
        {
            key: 'Build',
            value: '1.0.0',
        },
    ],
    tests: [
        {
            suiteName: 'checkout',
            name: 'add to cart',
            browser: 'chromium',
            projectName: 'playwright-slack-report',
            endedAt: '2021-08-04T14:00:00.000Z',
            reason: 'Unexpected error',
            retry: 0,
            startedAt: '2021-08-04T14:00:00.000Z',
            status: 'failed',
        },
    ],
};
test_1.test.describe('MicrosoftTeamsWebhookClient', () => {
    (0, test_1.test)('sends message successfully', async () => {
        const mockFetch = async (url, options) => {
            (0, test_1.expect)(url).toBe('https://outlook.office.com/webhook/test');
            (0, test_1.expect)(options.method).toBe('POST');
            (0, test_1.expect)(options.headers['Content-Type']).toBe('application/json');
            const payload = JSON.parse(options.body);
            (0, test_1.expect)(payload.type).toBe('message');
            (0, test_1.expect)(payload.attachments).toHaveLength(1);
            (0, test_1.expect)(payload.attachments[0].contentType).toBe('application/vnd.microsoft.card.adaptive');
            (0, test_1.expect)(payload.attachments[0].content.type).toBe('AdaptiveCard');
            (0, test_1.expect)(payload.attachments[0].content.version).toBe('1.3');
            (0, test_1.expect)(payload.attachments[0].content.body).toContainEqual(test_1.expect.objectContaining({
                type: 'TextBlock',
                text: 'Custom Teams Title',
                size: 'Large',
                weight: 'Bolder',
            }));
            return {
                ok: true,
                status: 200,
            };
        };
        // Replace global fetch with mock
        global.fetch = mockFetch;
        const client = new MicrosoftTeamsWebhookClient_1.default({
            webhookUrl: 'https://outlook.office.com/webhook/test',
            title: 'Custom Teams Title',
            themeColor: '#00FF00',
        });
        const result = await client.sendMessage({
            summaryResults: mockSummaryResults,
            maxNumberOfFailures: 5,
        });
        (0, test_1.expect)(result.outcome).toBe('ok');
    });
    (0, test_1.test)('handles rate limiting', async () => {
        let attempts = 0;
        const mockFetch = async () => {
            attempts++;
            if (attempts === 1) {
                return {
                    ok: false,
                    status: 429,
                    headers: new Map([['Retry-After', '1']]),
                };
            }
            return {
                ok: true,
                status: 200,
            };
        };
        global.fetch = mockFetch;
        const client = new MicrosoftTeamsWebhookClient_1.default({
            webhookUrl: 'https://outlook.office.com/webhook/test',
        });
        const result = await client.sendMessage({
            summaryResults: mockSummaryResults,
            maxNumberOfFailures: 5,
        });
        (0, test_1.expect)(result.outcome).toBe('ok');
        (0, test_1.expect)(attempts).toBe(2);
    });
    (0, test_1.test)('handles webhook failure', async () => {
        const mockFetch = async () => ({
            ok: false,
            status: 400,
            statusText: 'Bad Request',
        });
        global.fetch = mockFetch;
        const client = new MicrosoftTeamsWebhookClient_1.default({
            webhookUrl: 'https://outlook.office.com/webhook/test',
        });
        const result = await client.sendMessage({
            summaryResults: mockSummaryResults,
            maxNumberOfFailures: 5,
        });
        (0, test_1.expect)(result.outcome).toContain('error');
        (0, test_1.expect)(result.outcome).toContain('400');
    });
    (0, test_1.test)('generates correct adaptive card payload structure', async () => {
        let capturedPayload;
        const mockFetch = async (url, options) => {
            capturedPayload = JSON.parse(options.body);
            return { ok: true, status: 200 };
        };
        global.fetch = mockFetch;
        const client = new MicrosoftTeamsWebhookClient_1.default({
            webhookUrl: 'https://outlook.office.com/webhook/test',
        });
        await client.sendMessage({
            summaryResults: mockSummaryResults,
            maxNumberOfFailures: 5,
        });
        (0, test_1.expect)(capturedPayload.type).toBe('message');
        (0, test_1.expect)(capturedPayload.attachments[0].content.body).toContainEqual(test_1.expect.objectContaining({
            type: 'FactSet',
            facts: test_1.expect.arrayContaining([
                { title: 'Total Tests:', value: '3' },
                { title: '✅ Passed:', value: '1' },
                { title: '❌ Failed:', value: '1' },
                { title: '⏩ Skipped:', value: '1' },
            ])
        }));
        // Check meta information is included
        (0, test_1.expect)(capturedPayload.attachments[0].content.body).toContainEqual(test_1.expect.objectContaining({
            type: 'FactSet',
            facts: [{ title: 'Build:', value: '1.0.0' }]
        }));
        // Check failure information is included
        (0, test_1.expect)(capturedPayload.attachments[0].content.body).toContainEqual(test_1.expect.objectContaining({
            type: 'TextBlock',
            text: '**smoke > test**',
            weight: 'Bolder',
            wrap: true,
        }));
    });
});
//# sourceMappingURL=MicrosoftTeamsWebhookClient.spec.js.map