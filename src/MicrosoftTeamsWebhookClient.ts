import { SummaryResults } from '.';

interface MicrosoftTeamsWebhookConfig {
  webhookUrl: string;
  title?: string;
  themeColor?: string;
}

interface MicrosoftTeamsAdaptiveCardPayload {
  type: 'message';
  attachments: Array<{
    contentType: 'application/vnd.microsoft.card.adaptive';
    content: {
      type: 'AdaptiveCard';
      version: '1.3';
      body: Array<any>;
    };
  }>;
}

export default class MicrosoftTeamsWebhookClient {
  private webhookConfig: MicrosoftTeamsWebhookConfig;
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY = 1000;

  constructor(config: MicrosoftTeamsWebhookConfig) {
    this.webhookConfig = config;
  }

  async sendMessage({
    summaryResults,
    maxNumberOfFailures,
  }: {
    summaryResults: SummaryResults;
    maxNumberOfFailures: number;
  }): Promise<{ outcome: string }> {
    try {
      const payload = this.generatePayload(summaryResults, maxNumberOfFailures);
      await this.sendWebhookRequest(payload);
      return { outcome: 'ok' };
    } catch (error) {
      // Extract meaningful error information
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      const errorDetails =
        error instanceof Error && error.stack
          ? `\nStack trace: ${error.stack}`
          : '';

      // If it's a fetch error, try to get more details
      if (error instanceof Error && 'status' in error) {
        const { status: statusCode, statusText } = error as any;
        return {
          outcome: `Microsoft Teams webhook error: ${statusCode} ${statusText} - ${errorMessage}${errorDetails}`,
        };
      }

      return {
        outcome: `Microsoft Teams webhook error: ${errorMessage}${errorDetails}`,
      };
    }
  }

  private async sendWebhookRequest(
    payload: MicrosoftTeamsAdaptiveCardPayload,
    retryCount = 0,
  ): Promise<Response> {
    try {
      const response = await fetch(this.webhookConfig.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        if (
          response.status === 429 &&
          retryCount < MicrosoftTeamsWebhookClient.MAX_RETRIES
        ) {
          // Handle rate limiting
          const retryAfter =
            parseInt(response.headers.get('Retry-After') || '1', 10) * 1000;
          await new Promise((resolve) => setTimeout(resolve, retryAfter));
          return this.sendWebhookRequest(payload, retryCount + 1);
        }
        throw new Error(
          `Microsoft Teams webhook request failed: ${response.status} ${response.statusText}`,
        );
      }

      return response;
    } catch (error) {
      if (retryCount < MicrosoftTeamsWebhookClient.MAX_RETRIES) {
        await new Promise((resolve) =>
          setTimeout(resolve, MicrosoftTeamsWebhookClient.RETRY_DELAY),
        );
        return this.sendWebhookRequest(payload, retryCount + 1);
      }
      throw error;
    }
  }

  private generatePayload(
    summaryResults: SummaryResults,
    maxNumberOfFailures: number,
  ): MicrosoftTeamsAdaptiveCardPayload {
    const { passed = 0, failed = 0, skipped = 0, flaky = 0 } = summaryResults;
    const totalTests = passed + failed + skipped + (flaky || 0);

    const statusEmoji = failed > 0 ? '❌' : '✅';
    const statusColor = failed > 0 ? 'attention' : 'good';

    const cardBody: any[] = [
      {
        type: 'TextBlock',
        text: this.webhookConfig.title || '🎭 Playwright Test Results',
        size: 'Large',
        weight: 'Bolder',
      },
      {
        type: 'TextBlock',
        text: `${statusEmoji} Test Run Complete`,
        size: 'Medium',
        color: statusColor,
        wrap: true,
      },
      {
        type: 'FactSet',
        facts: [
          {
            title: 'Total Tests:',
            value: totalTests.toString(),
          },
          {
            title: '✅ Passed:',
            value: passed.toString(),
          },
          {
            title: '❌ Failed:',
            value: failed.toString(),
          },
          {
            title: '⏩ Skipped:',
            value: skipped.toString(),
          },
          ...(flaky ? [{ title: '🔄 Flaky:', value: flaky.toString() }] : []),
        ],
      },
    ];

    // Add meta information if available
    if (summaryResults.meta && summaryResults.meta.length > 0) {
      cardBody.push({
        type: 'TextBlock',
        text: '**Meta Information**',
        weight: 'Bolder',
        wrap: true,
      });
      cardBody.push({
        type: 'FactSet',
        facts: summaryResults.meta.map((m) => ({
          title: `${m.key}:`,
          value: m.value,
        })),
      });
    }

    // Add failures if any
    if (summaryResults.failures && summaryResults.failures.length > 0) {
      cardBody.push({
        type: 'TextBlock',
        text: '**Test Failures**',
        weight: 'Bolder',
        color: 'attention',
        wrap: true,
      });

      summaryResults.failures
        .slice(0, maxNumberOfFailures)
        .forEach((failure) => {
          cardBody.push({
            type: 'TextBlock',
            text: `**${failure.suite} > ${failure.test}**`,
            weight: 'Bolder',
            wrap: true,
          });
          cardBody.push({
            type: 'TextBlock',
            text: failure.failureReason.substring(0, 1000),
            wrap: true,
          });
        });

      // Add footer for limited failures display
      if (summaryResults.failures.length > maxNumberOfFailures) {
        cardBody.push({
          type: 'TextBlock',
          text: `Showing ${maxNumberOfFailures} of ${summaryResults.failures.length} failures`,
          size: 'Small',
          wrap: true,
        });
      }
    }

    const payload: MicrosoftTeamsAdaptiveCardPayload = {
      type: 'message',
      attachments: [
        {
          contentType: 'application/vnd.microsoft.card.adaptive',
          content: {
            type: 'AdaptiveCard',
            version: '1.3',
            body: cardBody,
          },
        },
      ],
    };

    return payload;
  }
}