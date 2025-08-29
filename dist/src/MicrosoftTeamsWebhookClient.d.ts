import { SummaryResults } from '.';
interface MicrosoftTeamsWebhookConfig {
    webhookUrl: string;
    title?: string;
    themeColor?: string;
}
export default class MicrosoftTeamsWebhookClient {
    private webhookConfig;
    private static readonly MAX_RETRIES;
    private static readonly RETRY_DELAY;
    constructor(config: MicrosoftTeamsWebhookConfig);
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
