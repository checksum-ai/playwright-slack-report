import { SummaryResults } from '.';
interface DiscordEmbed {
    title?: string;
    description?: string;
    color?: number;
    fields?: Array<{
        name: string;
        value: string;
        inline?: boolean;
    }>;
    footer?: {
        text: string;
        icon_url?: string;
    };
}
export declare function generateDiscordEmbeds(summaryResults: SummaryResults, maxNumberOfFailures: number, customColor?: string): Promise<DiscordEmbed[]>;
export {};
