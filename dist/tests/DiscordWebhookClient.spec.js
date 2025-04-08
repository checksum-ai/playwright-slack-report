"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
const DiscordWebhookClient_1 = __importDefault(require("../src/DiscordWebhookClient"));
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
test_1.test.describe('DiscordWebhookClient', () => {
    (0, test_1.test)('sends message successfully', async () => {
        const mockFetch = async (url, options) => {
            (0, test_1.expect)(url).toBe('https://discord.com/api/webhooks/test');
            (0, test_1.expect)(options.method).toBe('POST');
            (0, test_1.expect)(options.headers['Content-Type']).toBe('application/json');
            const payload = JSON.parse(options.body);
            (0, test_1.expect)(payload.username).toBe('Custom Bot');
            (0, test_1.expect)(payload.embeds).toHaveLength(1);
            (0, test_1.expect)(payload.embeds[0].title).toBe('🎭 Playwright Test Results');
            (0, test_1.expect)(payload.embeds[0].fields).toHaveLength(3); // Summary, Meta, Failures
            return {
                ok: true,
                status: 200,
            };
        };
        // Replace global fetch with mock
        global.fetch = mockFetch;
        const client = new DiscordWebhookClient_1.default({
            webhookUrl: 'https://discord.com/api/webhooks/test',
            username: 'Custom Bot',
            embedColor: '#00FF00',
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
        const client = new DiscordWebhookClient_1.default({
            webhookUrl: 'https://discord.com/api/webhooks/test',
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
        const client = new DiscordWebhookClient_1.default({
            webhookUrl: 'https://discord.com/api/webhooks/test',
        });
        const result = await client.sendMessage({
            summaryResults: mockSummaryResults,
            maxNumberOfFailures: 5,
        });
        (0, test_1.expect)(result.outcome).toContain('error');
        (0, test_1.expect)(result.outcome).toContain('400');
    });
});
//# sourceMappingURL=DiscordWebhookClient.spec.js.map