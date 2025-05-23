import { z } from 'zod';
import { LogLevel } from '@slack/web-api';
export declare const ZodCliSchema: z.ZodObject<{
    sendResults: z.ZodEnum<["always", "on-failure"]>;
    sendUsingBot: z.ZodOptional<z.ZodObject<{
        channels: z.ZodArray<z.ZodString, "atleastone">;
    }, "strip", z.ZodTypeAny, {
        channels?: [string, ...string[]];
    }, {
        channels?: [string, ...string[]];
    }>>;
    sendUsingWebhook: z.ZodOptional<z.ZodObject<{
        webhookUrl: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        webhookUrl?: string;
    }, {
        webhookUrl?: string;
    }>>;
    sendUsingDiscordWebhook: z.ZodOptional<z.ZodObject<{
        webhookUrl: z.ZodString;
        username: z.ZodOptional<z.ZodString>;
        avatarUrl: z.ZodOptional<z.ZodString>;
        embedColor: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        username?: string;
        webhookUrl?: string;
        avatarUrl?: string;
        embedColor?: string;
    }, {
        username?: string;
        webhookUrl?: string;
        avatarUrl?: string;
        embedColor?: string;
    }>>;
    sendUsingGoogleChatWebhook: z.ZodOptional<z.ZodObject<{
        webhookUrl: z.ZodString;
        threadKey: z.ZodOptional<z.ZodString>;
        avatarUrl: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        webhookUrl?: string;
        avatarUrl?: string;
        threadKey?: string;
    }, {
        webhookUrl?: string;
        avatarUrl?: string;
        threadKey?: string;
    }>>;
    customLayout: z.ZodOptional<z.ZodObject<{
        functionName: z.ZodString;
        source: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        source?: string;
        functionName?: string;
    }, {
        source?: string;
        functionName?: string;
    }>>;
    customLayoutAsync: z.ZodOptional<z.ZodObject<{
        functionName: z.ZodString;
        source: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        source?: string;
        functionName?: string;
    }, {
        source?: string;
        functionName?: string;
    }>>;
    slackLogLevel: z.ZodNativeEnum<typeof LogLevel>;
    maxNumberOfFailures: z.ZodDefault<z.ZodNumber>;
    disableUnfurl: z.ZodDefault<z.ZodBoolean>;
    showInThread: z.ZodDefault<z.ZodBoolean>;
    proxy: z.ZodOptional<z.ZodString>;
    meta: z.ZodOptional<z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        value: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        key?: string;
        value?: string;
    }, {
        key?: string;
        value?: string;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    meta?: {
        key?: string;
        value?: string;
    }[];
    proxy?: string;
    maxNumberOfFailures?: number;
    disableUnfurl?: boolean;
    sendResults?: "always" | "on-failure";
    sendUsingBot?: {
        channels?: [string, ...string[]];
    };
    sendUsingWebhook?: {
        webhookUrl?: string;
    };
    sendUsingDiscordWebhook?: {
        username?: string;
        webhookUrl?: string;
        avatarUrl?: string;
        embedColor?: string;
    };
    sendUsingGoogleChatWebhook?: {
        webhookUrl?: string;
        avatarUrl?: string;
        threadKey?: string;
    };
    customLayout?: {
        source?: string;
        functionName?: string;
    };
    customLayoutAsync?: {
        source?: string;
        functionName?: string;
    };
    slackLogLevel?: LogLevel;
    showInThread?: boolean;
}, {
    meta?: {
        key?: string;
        value?: string;
    }[];
    proxy?: string;
    maxNumberOfFailures?: number;
    disableUnfurl?: boolean;
    sendResults?: "always" | "on-failure";
    sendUsingBot?: {
        channels?: [string, ...string[]];
    };
    sendUsingWebhook?: {
        webhookUrl?: string;
    };
    sendUsingDiscordWebhook?: {
        username?: string;
        webhookUrl?: string;
        avatarUrl?: string;
        embedColor?: string;
    };
    sendUsingGoogleChatWebhook?: {
        webhookUrl?: string;
        avatarUrl?: string;
        threadKey?: string;
    };
    customLayout?: {
        source?: string;
        functionName?: string;
    };
    customLayoutAsync?: {
        source?: string;
        functionName?: string;
    };
    slackLogLevel?: LogLevel;
    showInThread?: boolean;
}>;
export interface ICliConfig {
    sendResults: 'always' | 'on-failure';
    sendUsingBot?: {
        channels: string[];
    };
    sendUsingWebhook?: {
        webhookUrl: string;
    };
    sendUsingDiscordWebhook?: {
        webhookUrl: string;
        username?: string;
        avatarUrl?: string;
        embedColor?: string;
    };
    sendUsingGoogleChatWebhook?: {
        webhookUrl: string;
        threadKey?: string;
        avatarUrl?: string;
    };
    slackLogLevel: LogLevel;
    customLayout?: {
        functionName: string;
        source: string;
    };
    customLayoutAsync?: {
        functionName: string;
        source: string;
    };
    maxNumberOfFailures: number;
    disableUnfurl: boolean;
    showInThread: boolean;
    proxy?: string;
    meta?: Array<{
        key: string;
        value: string;
    }>;
}
