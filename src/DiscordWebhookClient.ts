import { SummaryResults } from '.';

interface DiscordWebhookConfig {
  webhookUrl: string;
  username?: string;
  avatarUrl?: string;
  embedColor?: string;
}

interface DiscordWebhookPayload {
  username?: string;
  avatar_url?: string;
  embeds: Array<{
    title: string;
    description: string;
    color?: number;
    fields: Array<{
      name: string;
      value: string;
      inline: boolean;
    }>;
    footer?: {
      text: string;
    };
    timestamp?: string;
  }>;
}

export default class DiscordWebhookClient {
  private webhookConfig: DiscordWebhookConfig;
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY = 1000;

  constructor(config: DiscordWebhookConfig) {
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
          outcome: `Discord webhook error: ${statusCode} ${statusText} - ${errorMessage}${errorDetails}`,
        };
      }

      return {
        outcome: `Discord webhook error: ${errorMessage}${errorDetails}`,
      };
    }
  }

  private async sendWebhookRequest(
    payload: DiscordWebhookPayload,
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
          retryCount < DiscordWebhookClient.MAX_RETRIES
        ) {
          // Handle rate limiting
          const retryAfter =
            parseInt(response.headers.get('Retry-After') || '1', 10) * 1000;
          await new Promise((resolve) => setTimeout(resolve, retryAfter));
          return this.sendWebhookRequest(payload, retryCount + 1);
        }
        throw new Error(
          `Discord webhook request failed: ${response.status} ${response.statusText}`,
        );
      }

      return response;
    } catch (error) {
      if (retryCount < DiscordWebhookClient.MAX_RETRIES) {
        await new Promise((resolve) =>
          setTimeout(resolve, DiscordWebhookClient.RETRY_DELAY),
        );
        return this.sendWebhookRequest(payload, retryCount + 1);
      }
      throw error;
    }
  }

  private generatePayload(
    summaryResults: SummaryResults,
    maxNumberOfFailures: number,
  ): DiscordWebhookPayload {
    const { passed = 0, failed = 0, skipped = 0, flaky = 0 } = summaryResults;
    const totalTests = passed + failed + skipped + (flaky || 0);

    const statusEmoji = failed > 0 ? '❌' : '✅';
    const statusColor = failed > 0 ? 0xff0000 : 0x00ff00; // Red for failures, Green for success

    const payload: DiscordWebhookPayload = {
      username: this.webhookConfig.username || 'Playwright Tests',
      avatar_url: this.webhookConfig.avatarUrl,
      embeds: [
        {
          title: '🎭 Playwright Test Results',
          description: `${statusEmoji} Test Run Complete\n\nTotal Tests: ${totalTests}`,
          color: this.webhookConfig.embedColor
            ? parseInt(this.webhookConfig.embedColor.replace('#', ''), 16)
            : statusColor,
          fields: [
            {
              name: 'Results Summary',
              value: [
                `✅ Passed: ${passed}`,
                `❌ Failed: ${failed}`,
                `⏩ Skipped: ${skipped}`,
                flaky ? `🔄 Flaky: ${flaky}` : null,
              ]
                .filter(Boolean)
                .join('\n'),
              inline: true,
            },
          ],
          timestamp: new Date().toISOString(),
        },
      ],
    };

    // Add meta information if available
    if (summaryResults.meta && summaryResults.meta.length > 0) {
      payload.embeds[0].fields.push({
        name: 'Meta Information',
        value: summaryResults.meta
          .map((m) => `**${m.key}**: ${m.value}`)
          .join('\n'),
        inline: false,
      });
    }

    // Add failures if any
    if (summaryResults.failures && summaryResults.failures.length > 0) {
      const failuresField = {
        name: 'Test Failures',
        value: summaryResults.failures
          .slice(0, maxNumberOfFailures)
          .map(
            (failure) =>
              `**${failure.suite} > ${failure.test}**\n${failure.failureReason}`,
          )
          .join('\n\n'),
        inline: false,
      };

      if (failuresField.value.length > 1024) {
        // Discord has a 1024 character limit for field values
        failuresField.value = failuresField.value.substring(0, 1020) + '...';
      }

      payload.embeds[0].fields.push(failuresField);

      if (summaryResults.failures.length > maxNumberOfFailures) {
        payload.embeds[0].footer = {
          text: `Showing ${maxNumberOfFailures} of ${summaryResults.failures.length} failures`,
        };
      }
    }

    return payload;
  }
}
