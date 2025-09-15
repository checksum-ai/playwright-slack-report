import { test, expect } from '@playwright/test';
import MicrosoftTeamsWebhookClient from '../src/MicrosoftTeamsWebhookClient';
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

test.describe('MicrosoftTeamsWebhookClient', () => {
  test('sends message successfully', async () => {
    const mockFetch = async (url: string, options: any) => {
      expect(url).toBe('https://outlook.office.com/webhook/test');
      expect(options.method).toBe('POST');
      expect(options.headers['Content-Type']).toBe('application/json');
      
      const payload = JSON.parse(options.body);
      expect(payload.type).toBe('message');
      expect(payload.attachments).toHaveLength(1);
      expect(payload.attachments[0].contentType).toBe('application/vnd.microsoft.card.adaptive');
      expect(payload.attachments[0].content.type).toBe('AdaptiveCard');
      expect(payload.attachments[0].content.version).toBe('1.3');
      expect(payload.attachments[0].content.body).toContainEqual(
        expect.objectContaining({
          type: 'TextBlock',
          text: 'Custom Teams Title',
          size: 'Large',
          weight: 'Bolder',
        })
      );
      
      return {
        ok: true,
        status: 200,
      };
    };

    // Replace global fetch with mock
    global.fetch = mockFetch as any;

    const client = new MicrosoftTeamsWebhookClient({
      webhookUrl: 'https://outlook.office.com/webhook/test',
      title: 'Custom Teams Title',
      themeColor: '#00FF00',
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

    const client = new MicrosoftTeamsWebhookClient({
      webhookUrl: 'https://outlook.office.com/webhook/test',
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

    const client = new MicrosoftTeamsWebhookClient({
      webhookUrl: 'https://outlook.office.com/webhook/test',
    });

    const result = await client.sendMessage({
      summaryResults: mockSummaryResults,
      maxNumberOfFailures: 5,
    });

    expect(result.outcome).toContain('error');
    expect(result.outcome).toContain('400');
  });

  test('generates correct adaptive card payload structure', async () => {
    let capturedPayload: any;
    const mockFetch = async (url: string, options: any) => {
      capturedPayload = JSON.parse(options.body);
      return { ok: true, status: 200 };
    };

    global.fetch = mockFetch as any;

    const client = new MicrosoftTeamsWebhookClient({
      webhookUrl: 'https://outlook.office.com/webhook/test',
    });

    await client.sendMessage({
      summaryResults: mockSummaryResults,
      maxNumberOfFailures: 5,
    });

    expect(capturedPayload.type).toBe('message');
    expect(capturedPayload.attachments[0].content.body).toContainEqual(
      expect.objectContaining({
        type: 'FactSet',
        facts: expect.arrayContaining([
          { title: 'Total Tests:', value: '3' },
          { title: '✅ Passed:', value: '1' },
          { title: '❌ Failed:', value: '1' },
          { title: '⏩ Skipped:', value: '1' },
        ])
      })
    );

    // Check meta information is included
    expect(capturedPayload.attachments[0].content.body).toContainEqual(
      expect.objectContaining({
        type: 'FactSet',
        facts: [{ title: 'Build:', value: '1.0.0' }]
      })
    );

    // Check failure information is included
    expect(capturedPayload.attachments[0].content.body).toContainEqual(
      expect.objectContaining({
        type: 'TextBlock',
        text: '**smoke > test**',
        weight: 'Bolder',
        wrap: true,
      })
    );
  });
}); 