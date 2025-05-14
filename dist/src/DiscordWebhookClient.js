"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class DiscordWebhookClient {
    webhookConfig;
    static MAX_RETRIES = 3;
    static RETRY_DELAY = 1000;
    constructor(config) {
        this.webhookConfig = config;
    }
    async sendMessage({ summaryResults, maxNumberOfFailures, }) {
        try {
            const payload = this.generatePayload(summaryResults, maxNumberOfFailures);
            await this.sendWebhookRequest(payload);
            return { outcome: 'ok' };
        }
        catch (error) {
            // Extract meaningful error information
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            const errorDetails = error instanceof Error && error.stack
                ? `\nStack trace: ${error.stack}`
                : '';
            // If it's a fetch error, try to get more details
            if (error instanceof Error && 'status' in error) {
                const { status: statusCode, statusText } = error;
                return {
                    outcome: `Discord webhook error: ${statusCode} ${statusText} - ${errorMessage}${errorDetails}`,
                };
            }
            return {
                outcome: `Discord webhook error: ${errorMessage}${errorDetails}`,
            };
        }
    }
    async sendWebhookRequest(payload, retryCount = 0) {
        try {
            const response = await fetch(this.webhookConfig.webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });
            if (!response.ok) {
                if (response.status === 429 &&
                    retryCount < DiscordWebhookClient.MAX_RETRIES) {
                    // Handle rate limiting
                    const retryAfter = parseInt(response.headers.get('Retry-After') || '1', 10) * 1000;
                    await new Promise((resolve) => setTimeout(resolve, retryAfter));
                    return this.sendWebhookRequest(payload, retryCount + 1);
                }
                throw new Error(`Discord webhook request failed: ${response.status} ${response.statusText}`);
            }
            return response;
        }
        catch (error) {
            if (retryCount < DiscordWebhookClient.MAX_RETRIES) {
                await new Promise((resolve) => setTimeout(resolve, DiscordWebhookClient.RETRY_DELAY));
                return this.sendWebhookRequest(payload, retryCount + 1);
            }
            throw error;
        }
    }
    generatePayload(summaryResults, maxNumberOfFailures) {
        const { passed = 0, failed = 0, skipped = 0, flaky = 0 } = summaryResults;
        const totalTests = passed + failed + skipped + (flaky || 0);
        const statusEmoji = failed > 0 ? '❌' : '✅';
        const statusColor = failed > 0 ? 0xff0000 : 0x00ff00; // Red for failures, Green for success
        const payload = {
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
                    .map((failure) => `**${failure.suite} > ${failure.test}**\n${failure.failureReason}`)
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
exports.default = DiscordWebhookClient;
//# sourceMappingURL=DiscordWebhookClient.js.map