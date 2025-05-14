import { SummaryResults } from '.';
interface GoogleChatWebhookConfig {
    webhookUrl: string;
    threadKey?: string;
    avatarUrl?: string;
}
export default class GoogleChatWebhookClient {
    private webhookConfig;
    private static readonly MAX_RETRIES;
    private static readonly RETRY_DELAY;
    constructor(config: GoogleChatWebhookConfig);
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
