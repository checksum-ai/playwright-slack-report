import { SummaryResults } from '.';

interface GoogleChatWebhookConfig {
  webhookUrl: string;
  threadKey?: string; // Optional thread key for message threading
  avatarUrl?: string; // Optional avatar URL for the webhook
}

interface GoogleChatCardPayload {
  cards: Array<{
    header: {
      title: string;
      subtitle?: string;
      imageUrl?: string;
      imageStyle?: 'AVATAR' | 'IMAGE';
    };
    sections: Array<{
      widgets: Array<{
        textParagraph?: {
          text: string;
        };
        keyValue?: {
          topLabel?: string;
          content: string;
          contentMultiline?: boolean;
          bottomLabel?: string;
          icon?: string;
        };
        buttons?: Array<{
          textButton: {
            text: string;
            onClick: {
              openLink: {
                url: string;
              };
            };
          };
        }>;
      }>;
    }>;
  }>;
}

export default class GoogleChatWebhookClient {
  private webhookConfig: GoogleChatWebhookConfig;
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY = 1000;

  constructor(config: GoogleChatWebhookConfig) {
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
          outcome: `Google Chat webhook error: ${statusCode} ${statusText} - ${errorMessage}${errorDetails}`,
        };
      }

      return {
        outcome: `Google Chat webhook error: ${errorMessage}${errorDetails}`,
      };
    }
  }

  private async sendWebhookRequest(
    payload: GoogleChatCardPayload,
    retryCount = 0,
  ): Promise<Response> {
    try {
      // Add threadKey to URL if provided
      let webhookUrl = this.webhookConfig.webhookUrl;
      if (this.webhookConfig.threadKey) {
        const separator = webhookUrl.includes('?') ? '&' : '?';
        webhookUrl = `${webhookUrl}${separator}threadKey=${this.webhookConfig.threadKey}&messageReplyOption=REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD`;
      }

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        if (
          response.status === 429 &&
          retryCount < GoogleChatWebhookClient.MAX_RETRIES
        ) {
          // Handle rate limiting
          const retryAfter =
            parseInt(response.headers.get('Retry-After') || '1', 10) * 1000;
          await new Promise((resolve) => setTimeout(resolve, retryAfter));
          return this.sendWebhookRequest(payload, retryCount + 1);
        }
        throw new Error(
          `Google Chat webhook request failed: ${response.status} ${response.statusText}`,
        );
      }

      return response;
    } catch (error) {
      if (retryCount < GoogleChatWebhookClient.MAX_RETRIES) {
        await new Promise((resolve) =>
          setTimeout(resolve, GoogleChatWebhookClient.RETRY_DELAY),
        );
        return this.sendWebhookRequest(payload, retryCount + 1);
      }
      throw error;
    }
  }

  private generatePayload(
    summaryResults: SummaryResults,
    maxNumberOfFailures: number,
  ): GoogleChatCardPayload {
    const { passed = 0, failed = 0, skipped = 0, flaky = 0, bug = 0, recovered = 0 } = summaryResults;
    const totalTests = passed + failed + skipped + (flaky || 0) + bug + recovered;

    const statusEmoji = (failed > 0 || bug > 0) ? '❌' : '✅';
    
    // Create the main card payload
    const payload: GoogleChatCardPayload = {
      cards: [
        {
          header: {
            title: '🎭 Playwright Test Results',
            imageUrl: this.webhookConfig.avatarUrl,
            imageStyle: 'AVATAR',
          },
          sections: [
            {
              widgets: [
                {
                  textParagraph: {
                    text: `${statusEmoji} Test Run Complete\n\nTotal Tests: ${totalTests}`,
                  },
                },
                {
                  keyValue: {
                    topLabel: 'Results Summary',
                    content: [
                      `✅ Passed: ${passed}`,
                      `❌ Failed: ${failed}`,
                      bug > 0 ? `🐞 Bugs: ${bug}` : null,
                      recovered > 0 ? `🔄 Recovered: ${recovered}` : null,
                      `⏩ Skipped: ${skipped}`,
                      flaky && flaky > 0 ? `⚠️ Flaky: ${flaky}` : null,
                    ]
                      .filter(Boolean)
                      .join('\n'),
                    contentMultiline: true,
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    // Add meta information if available
    if (summaryResults.meta && summaryResults.meta.length > 0) {
      const metaSection = {
        widgets: [
          {
            keyValue: {
              topLabel: 'Meta Information',
              content: summaryResults.meta
                .map((m) => `**${m.key}**: ${m.value}`)
                .join('\n'),
              contentMultiline: true,
            },
          },
        ],
      };
      payload.cards[0].sections.push(metaSection);
    }

    // Add failures if any
    if (summaryResults.failures && summaryResults.failures.length > 0) {
      const failuresSection = {
        widgets: [
          {
            keyValue: {
              topLabel: 'Test Failures',
              content: summaryResults.failures
                .slice(0, maxNumberOfFailures)
                .map(
                  (failure) =>
                    `**${failure.suite} > ${failure.test}**\n${failure.failureReason.substring(0, 1000)}`,
                )
                .join('\n\n'),
              contentMultiline: true,
            },
          },
        ],
      };

      payload.cards[0].sections.push(failuresSection);

      // Add footer for limited failures display
      if (summaryResults.failures.length > maxNumberOfFailures) {
        payload.cards[0].sections.push({
          widgets: [
            {
              textParagraph: {
                text: `Showing ${maxNumberOfFailures} of ${summaryResults.failures.length} failures`,
              },
            },
          ],
        });
      }
    }

    return payload;
  }
}