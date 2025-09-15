import { test, expect } from '@playwright/test';
import DiscordWebhookClient from '../src/DiscordWebhookClient';
import { SummaryResults } from '../src';

const mockSummaryResults: SummaryResults = {
  failed: 1,
  passed: 1,
  flaky: undefined,
  skipped: 1,
  bug: 0,
  recovered: 0,
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

test.describe('DiscordWebhookClient', () => {
  test('sends message successfully', async () => {
    const mockFetch = async (url: string, options: any) => {
      expect(url).toBe('https://discord.com/api/webhooks/test');
      expect(options.method).toBe('POST');
      expect(options.headers['Content-Type']).toBe('application/json');
      
      const payload = JSON.parse(options.body);
      expect(payload.username).toBe('Custom Bot');
      expect(payload.embeds).toHaveLength(1);
      expect(payload.embeds[0].title).toBe('🎭 Playwright Test Results');
      expect(payload.embeds[0].fields).toHaveLength(3); // Summary, Meta, Failures
      
      return {
        ok: true,
        status: 200,
      };
    };

    // Replace global fetch with mock
    global.fetch = mockFetch as any;

    const client = new DiscordWebhookClient({
      webhookUrl: 'https://discord.com/api/webhooks/test',
      username: 'Custom Bot',
      embedColor: '#00FF00',
    });

    const result = await client.sendMessage({
      summaryResults: mockSummaryResults,
      maxNumberOfFailures: 5,
    });

    expect(result.outcome).toBe('ok');
  });

  test('handles rate limiting', async () => {
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

    global.fetch = mockFetch as any;

    const client = new DiscordWebhookClient({
      webhookUrl: 'https://discord.com/api/webhooks/test',
    });

    const result = await client.sendMessage({
      summaryResults: mockSummaryResults,
      maxNumberOfFailures: 5,
    });

    expect(result.outcome).toBe('ok');
    expect(attempts).toBe(2);
  });

  test('handles webhook failure', async () => {
    const mockFetch = async () => ({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
    });

    global.fetch = mockFetch as any;

    const client = new DiscordWebhookClient({
      webhookUrl: 'https://discord.com/api/webhooks/test',
    });

    const result = await client.sendMessage({
      summaryResults: mockSummaryResults,
      maxNumberOfFailures: 5,
    });

    expect(result.outcome).toContain('error');
    expect(result.outcome).toContain('400');
  });
}); 