import { existsSync, PathLike, readFileSync } from 'fs';
import path from 'path';
import { ICliConfig, ZodCliSchema } from './cli_schema';

function fileExists(filePath: PathLike): boolean {
  return existsSync(filePath);
}

function getConfig(configFile: string): ICliConfig {
  return JSON.parse(readFileSync(configFile, 'utf-8'));
}

export const doPreChecks = async (
  jsonResultsPath: string,
  configFile: string,
): Promise<{
  status: 'error' | 'ok';
  message?: string;
  jsonPath?: string;
  configPath?: string;
  config?: ICliConfig;
}> => {
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
  let config: ICliConfig;
  try {
    config = getConfig(configFile);
    parseResult.data = ZodCliSchema.parse(config);
    parseResult.success = true;
  } catch (error) {
    parseResult.success = false;
    parseResult.error = error;
  }

  if (!parseResult.success) {
    return {
      status: 'error',
      message: `Config file is not valid: ${
        parseResult.error.message ?? JSON.stringify(parseResult.error, null, 2)
      }`,
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
    config.sendUsingDiscordWebhook
  ].filter(Boolean).length;

  if (sendingMethodsCount === 0) {
    return {
      status: 'error',
      message:
        'You must specify one of: sendUsingWebhook, sendUsingBot, or sendUsingDiscordWebhook in the config file',
    };
  }

  if (sendingMethodsCount > 1) {
    return {
      status: 'error',
      message:
        'Only one sending method can be used at a time. Choose either sendUsingWebhook, sendUsingBot, or sendUsingDiscordWebhook',
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
      message:
        'The showInThread feature is only supported when using sendUsingBot',
    };
  }

  return {
    status: 'ok',
    jsonPath: path.resolve(jsonResultsPath),
    configPath: path.resolve(configFile),
    config: parseResult.data,
  };
};

export default doPreChecks;
