"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.doPreChecks = void 0;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const cli_schema_1 = require("./cli_schema");
function fileExists(filePath) {
    return (0, fs_1.existsSync)(filePath);
}
function getConfig(configFile) {
    return JSON.parse((0, fs_1.readFileSync)(configFile, 'utf-8'));
}
const doPreChecks = async (jsonResultsPath, configFile) => {
    if (!fileExists(jsonResultsPath)) {
        return {
            status: 'error',
            message: `JSON results file does not exist: ${jsonResultsPath}:
      Use --json-results <path> e.g. --json-results="./results.json"`,
        };
    }
    if (!fileExists(configFile)) {
        return {
            status: 'error',
            message: `Config file does not exist: ${configFile}`,
        };
    }
    const parseResult = { success: false, error: undefined, data: undefined };
    let config;
    try {
        config = getConfig(configFile);
        parseResult.data = cli_schema_1.ZodCliSchema.parse(config);
        parseResult.success = true;
    }
    catch (error) {
        parseResult.success = false;
        parseResult.error = error;
    }
    if (!parseResult.success) {
        return {
            status: 'error',
            message: `Config file is not valid: ${parseResult.error.message ?? JSON.stringify(parseResult.error, null, 2)}`,
        };
    }
    if (config.customLayout?.source && !fileExists(config.customLayout?.source)) {
        return {
            status: 'error',
            message: `Custom layout was not found in path: ${config.customLayout.source}`,
        };
    }
    // Count how many sending methods are configured
    const sendingMethodsCount = [
        config.sendUsingWebhook,
        config.sendUsingBot,
        config.sendUsingDiscordWebhook,
        config.sendUsingGoogleChatWebhook,
        config.sendUsingMicrosoftTeamsWebhook
    ].filter(Boolean).length;
    if (sendingMethodsCount === 0) {
        return {
            status: 'error',
            message: 'You must specify one of: sendUsingWebhook, sendUsingBot, sendUsingDiscordWebhook, sendUsingGoogleChatWebhook, or sendUsingMicrosoftTeamsWebhook in the config file',
        };
    }
    if (sendingMethodsCount > 1) {
        return {
            status: 'error',
            message: 'Only one sending method can be used at a time. Choose either sendUsingWebhook, sendUsingBot, sendUsingDiscordWebhook, sendUsingGoogleChatWebhook, or sendUsingMicrosoftTeamsWebhook',
        };
    }
    if (config.sendUsingBot && !process.env.SLACK_BOT_USER_OAUTH_TOKEN) {
        return {
            status: 'error',
            message: 'Missing the SLACK_BOT_USER_OAUTH_TOKEN env variable',
        };
    }
    if (config.showInThread && !config.sendUsingBot) {
        return {
            status: 'error',
            message: 'The showInThread feature is only supported when using sendUsingBot',
        };
    }
    return {
        status: 'ok',
        jsonPath: path_1.default.resolve(jsonResultsPath),
        configPath: path_1.default.resolve(configFile),
        config: parseResult.data,
    };
};
exports.doPreChecks = doPreChecks;
exports.default = exports.doPreChecks;
//# sourceMappingURL=cli_pre_checks.js.map