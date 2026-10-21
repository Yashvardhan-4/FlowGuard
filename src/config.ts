import dotenv from 'dotenv';

dotenv.config();

export interface FlowGuardConfig {
  port: number;
  host: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  awsRegion: string;
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
  awsSessionToken?: string;
  bedrockModelId: string;
  bedrockMock: boolean;
  simulateRingDevice: boolean;
  simulateAlexaSpeaker: boolean;
}

export const config: FlowGuardConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '127.0.0.1',
  logLevel: (process.env.LOG_LEVEL as FlowGuardConfig['logLevel']) || 'info',
  awsRegion: process.env.AWS_REGION || 'us-east-1',
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID || undefined,
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || undefined,
  awsSessionToken: process.env.AWS_SESSION_TOKEN || undefined,
  bedrockModelId: process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-haiku-20240307-v1:0',
  bedrockMock:
    process.env.BEDROCK_MOCK === 'true' ||
    !process.env.AWS_ACCESS_KEY_ID ||
    !process.env.AWS_SECRET_ACCESS_KEY,
  simulateRingDevice: process.env.SIMULATE_RING_DEVICE !== 'false',
  simulateAlexaSpeaker: process.env.SIMULATE_ALEXA_SPEAKER !== 'false',
};
