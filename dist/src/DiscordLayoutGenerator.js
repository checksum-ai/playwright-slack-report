"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateDiscordEmbeds = generateDiscordEmbeds;
const DEFAULT_COLOR = 0x5865F2; // Discord Blurple
const SUCCESS_COLOR = 0x57F287; // Discord Green
const ERROR_COLOR = 0xED4245; // Discord Red
function getStatusEmoji(status) {
    switch (status) {
        case 'passed':
            return '✅';
        case 'failed':
            return '❌';
        case 'skipped':
            return '⏩';
        case 'timedOut':
            return '⏰';
        default:
            return '❓';
    }
}
function truncateString(str, maxLength) {
    if (str.length <= maxLength)
        return str;
    return str.substring(0, maxLength - 3) + '...';
}
async function generateDiscordEmbeds(summaryResults, maxNumberOfFailures, customColor) {
    const embeds = [];
    const color = customColor ? parseInt(customColor.replace('#', ''), 16) :
        summaryResults.failed > 0 ? ERROR_COLOR : SUCCESS_COLOR;
    // Summary embed
    embeds.push({
        title: '🎭 Playwright Results',
        description: [
            `${getStatusEmoji('passed')} **${summaryResults.passed}** Passed`,
            `${getStatusEmoji('failed')} **${summaryResults.failed}** Failed`,
            summaryResults.flaky !== undefined ? `🟡 **${summaryResults.flaky}** Flaky` : null,
            `${getStatusEmoji('skipped')} **${summaryResults.skipped}** Skipped`,
        ].filter(Boolean).join(' | '),
        color,
    });
    // Meta information embed
    if (summaryResults.meta && summaryResults.meta.length > 0) {
        const metaFields = summaryResults.meta.map(({ key, value }) => ({
            name: key,
            value: value,
            inline: true,
        }));
        embeds.push({
            title: 'Test Information',
            fields: metaFields,
            color,
        });
    }
    // Failures embeds
    if (summaryResults.failures.length > 0) {
        const numberOfFailuresToShow = Math.min(summaryResults.failures.length, maxNumberOfFailures);
        for (let i = 0; i < numberOfFailuresToShow; i++) {
            const { failureReason, test, suite } = summaryResults.failures[i];
            embeds.push({
                title: `❌ Failure #${i + 1}`,
                description: `**Suite:** ${suite}\n**Test:** ${test}`,
                fields: [{
                        name: 'Error',
                        value: truncateString(failureReason.replace(/\n/g, '\n> '), 1024),
                        inline: false,
                    }],
                color: ERROR_COLOR,
            });
        }
        if (summaryResults.failures.length > maxNumberOfFailures) {
            embeds.push({
                description: `⚠️ Showing ${numberOfFailuresToShow} out of ${summaryResults.failures.length} failures`,
                color: ERROR_COLOR,
            });
        }
    }
    return embeds;
}
//# sourceMappingURL=DiscordLayoutGenerator.js.map