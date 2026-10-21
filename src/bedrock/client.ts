import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { config } from '../config.js';
import { Logger } from '../logger.js';

const log = new Logger('BedrockClient');

export class BedrockClientFactory {
  private client: BedrockRuntimeClient | null = null;
  private isConfigured: boolean = false;

  constructor() {
    this.initClient();
  }

  private initClient(): void {
    if (config.bedrockMock) {
      log.info('Bedrock mock mode enabled or AWS credentials not provided; using deterministic local arbitrator');
      this.isConfigured = false;
      return;
    }

    if (!config.awsAccessKeyId || !config.awsSecretAccessKey) {
      log.warn('AWS credentials missing; falling back to deterministic local arbitrator');
      this.isConfigured = false;
      return;
    }

    try {
      this.client = new BedrockRuntimeClient({
        region: config.awsRegion,
        credentials: {
          accessKeyId: config.awsAccessKeyId,
          secretAccessKey: config.awsSecretAccessKey,
          sessionToken: config.awsSessionToken,
        },
      });
      this.isConfigured = true;
      log.info('BedrockRuntimeClient successfully configured for AWS region', {
        region: config.awsRegion,
        modelId: config.bedrockModelId,
      });
    } catch (err) {
      log.error('Failed to initialize BedrockRuntimeClient; falling back to deterministic local arbitrator', {
        error: err instanceof Error ? err.message : String(err),
      });
      this.isConfigured = false;
    }
  }

  getClient(): BedrockRuntimeClient | null {
    return this.client;
  }

  isLiveAvailable(): boolean {
    return this.isConfigured && this.client !== null;
  }
}

export const bedrockClientFactory = new BedrockClientFactory();
