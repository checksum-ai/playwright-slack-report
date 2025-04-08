import { SummaryResults } from '.';
interface DiscordWebhookConfig {
    webhookUrl: string;
    username?: string;
    avatarUrl?: string;
    embedColor?: string;
}
export default class DiscordWebhookClient {
    private webhookConfig;
    private static readonly MAX_RETRIES;
    private static readonly RETRY_DELAY;
    constructor(config: DiscordWebhookConfig);
    sendMessage({ summaryResults, maxNumberOfFailures, }: {
        summaryResults: SummaryResults;
        maxNumberOfFailures: number;
    }): Promise<{
        outcome: string;
    }>;
    private sendWebhookRequest;
    private generatePayload;
}
export {};
