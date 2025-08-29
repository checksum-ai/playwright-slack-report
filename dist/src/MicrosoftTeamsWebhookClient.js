"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class MicrosoftTeamsWebhookClient {
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
                    outcome: `Microsoft Teams webhook error: ${statusCode} ${statusText} - ${errorMessage}${errorDetails}`,
                };
            }
            return {
                outcome: `Microsoft Teams webhook error: ${errorMessage}${errorDetails}`,
            };
        }
    }
    async sendWebhookRequest(payload, retryCount = 0) {
        try {
            console.log('Sending Microsoft Teams payload:', JSON.stringify(payload, null, 2));
            const response = await fetch(this.webhookConfig.webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });
            console.log('Microsoft Teams response status:', response.status);
            const responseText = await response.text();
            console.log('Microsoft Teams response body:', responseText);
            if (!response.ok) {
                if (response.status === 429 &&
                    retryCount < MicrosoftTeamsWebhookClient.MAX_RETRIES) {
                    // Handle rate limiting
                    const retryAfter = parseInt(response.headers.get('Retry-After') || '1', 10) * 1000;
                    await new Promise((resolve) => setTimeout(resolve, retryAfter));
                    return this.sendWebhookRequest(payload, retryCount + 1);
                }
                throw new Error(`Microsoft Teams webhook request failed: ${response.status} ${response.statusText}`);
            }
            return response;
        }
        catch (error) {
            if (retryCount < MicrosoftTeamsWebhookClient.MAX_RETRIES) {
                await new Promise((resolve) => setTimeout(resolve, MicrosoftTeamsWebhookClient.RETRY_DELAY));
                return this.sendWebhookRequest(payload, retryCount + 1);
            }
            throw error;
        }
    }
    generatePayload(summaryResults, maxNumberOfFailures) {
        const { passed = 0, failed = 0, skipped = 0, flaky = 0 } = summaryResults;
        const totalTests = passed + failed + skipped + (flaky || 0);
        const statusEmoji = failed > 0 ? '❌' : '✅';
        const title = this.webhookConfig.title || '🎭 Playwright Test Results';
        // Build the main facts array
        const facts = [
            { name: 'Total Tests', value: totalTests.toString() },
            { name: '✅ Passed', value: passed.toString() },
            { name: '❌ Failed', value: failed.toString() },
            { name: '⏩ Skipped', value: skipped.toString() },
            ...(flaky ? [{ name: '🔄 Flaky', value: flaky.toString() }] : []),
        ];
        // Add meta information
        if (summaryResults.meta && summaryResults.meta.length > 0) {
            summaryResults.meta.forEach((m) => {
                facts.push({ name: m.key, value: m.value });
            });
        }
        const sections = [
            {
                activityTitle: title,
                activitySubtitle: `${statusEmoji} Test Run Complete`,
                facts,
                markdown: true,
            },
        ];
        // Add failures section if any
        if (summaryResults.failures && summaryResults.failures.length > 0) {
            const failuresText = summaryResults.failures
                .slice(0, maxNumberOfFailures)
                .map((failure) => `**${failure.suite} > ${failure.test}**\n${failure.failureReason.substring(0, 500)}`)
                .join('\n\n');
            sections.push({
                activityTitle: '🚨 Test Failures',
                activitySubtitle: summaryResults.failures.length > maxNumberOfFailures
                    ? `Showing ${maxNumberOfFailures} of ${summaryResults.failures.length} failures`
                    : undefined,
                facts: [{ name: 'Details', value: failuresText }],
                markdown: true,
            });
        }
        const payload = {
            text: `${title}: ${statusEmoji} ${passed} passed, ${failed} failed, ${skipped} skipped`,
            themeColor: this.webhookConfig.themeColor || (failed > 0 ? '#ff0000' : '#00ff00'),
            sections,
        };
        return payload;
    }
}
exports.default = MicrosoftTeamsWebhookClient;
//# sourceMappingURL=MicrosoftTeamsWebhookClient.js.map