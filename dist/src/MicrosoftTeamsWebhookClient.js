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
            const response = await fetch(this.webhookConfig.webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });
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
        const { passed = 0, failed = 0, skipped = 0, flaky = 0, bug = 0, recovered = 0 } = summaryResults;
        const totalTests = passed + failed + skipped + (flaky || 0) + bug + recovered;
        const statusEmoji = (failed > 0 || bug > 0) ? '❌' : '✅';
        const title = this.webhookConfig.title || '🎭 Playwright Test Results';
        const hasFailures = failed > 0 || bug > 0;
        // Build the Adaptive Card body
        const body = [];
        // Add title
        body.push({
            type: 'TextBlock',
            text: title,
            size: 'Large',
            weight: 'Bolder',
            color: hasFailures ? 'Attention' : 'Good',
        });
        // Add subtitle
        body.push({
            type: 'TextBlock',
            text: `${statusEmoji} Test Run Complete`,
            size: 'Medium',
            spacing: 'Small',
        });
        // Build the main facts array
        const facts = [
            { title: 'Total Tests:', value: totalTests.toString() },
            { title: '✅ Passed:', value: passed.toString() },
            { title: '❌ Failed:', value: failed.toString() },
            ...(bug > 0 ? [{ title: '🐞 Bugs:', value: bug.toString() }] : []),
            ...(recovered > 0 ? [{ title: '🔄 Recovered:', value: recovered.toString() }] : []),
            { title: '⏩ Skipped:', value: skipped.toString() },
            ...(flaky && flaky > 0 ? [{ title: '⚠️ Flaky:', value: flaky.toString() }] : []),
        ];
        // Add main facts
        body.push({
            type: 'FactSet',
            facts,
        });
        // Add meta information as a separate FactSet
        if (summaryResults.meta && summaryResults.meta.length > 0) {
            const metaFacts = summaryResults.meta.map((m) => ({
                title: `${m.key}:`,
                value: m.value,
            }));
            body.push({
                type: 'FactSet',
                facts: metaFacts,
                spacing: 'Medium',
            });
        }
        // Add failures section if any
        if (summaryResults.failures && summaryResults.failures.length > 0) {
            body.push({
                type: 'TextBlock',
                text: '🚨 Test Failures',
                size: 'Medium',
                weight: 'Bolder',
                spacing: 'Medium',
            });
            if (summaryResults.failures.length > maxNumberOfFailures) {
                body.push({
                    type: 'TextBlock',
                    text: `Showing ${maxNumberOfFailures} of ${summaryResults.failures.length} failures`,
                    size: 'Small',
                    isSubtle: true,
                    spacing: 'Small',
                });
            }
            // Add each failure as separate TextBlocks
            summaryResults.failures
                .slice(0, maxNumberOfFailures)
                .forEach((failure) => {
                body.push({
                    type: 'TextBlock',
                    text: `**${failure.suite} > ${failure.test}**`,
                    weight: 'Bolder',
                    wrap: true,
                    spacing: 'Small',
                });
                body.push({
                    type: 'TextBlock',
                    text: failure.failureReason.substring(0, 500),
                    wrap: true,
                    spacing: 'None',
                });
            });
        }
        const payload = {
            type: 'message',
            attachments: [
                {
                    contentType: 'application/vnd.microsoft.card.adaptive',
                    content: {
                        $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
                        type: 'AdaptiveCard',
                        version: '1.3',
                        body,
                    },
                },
            ],
        };
        return payload;
    }
}
exports.default = MicrosoftTeamsWebhookClient;
//# sourceMappingURL=MicrosoftTeamsWebhookClient.js.map