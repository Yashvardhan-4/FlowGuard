import { createFlowGuardMcpServer } from './mcp/server.js';
import { createHttpTransportServer } from './transport/httpTransport.js';
import { config } from './config.js';
import { bedrockClientFactory } from './bedrock/client.js';
import { logger } from './logger.js';

async function bootstrap(): Promise<void> {
  const mcpServer = createFlowGuardMcpServer();
  const { app } = createHttpTransportServer(mcpServer);

  const server = app.listen(config.port, config.host, () => {
    logger.info('===========================================================');
    logger.info(` FlowGuard Alexa+ Arbitration Server v1.0.0 Started`);
    logger.info(` Spec: MCP 2025-11-25 over Streamable HTTP (SSE)`);
    logger.info(` Local URL: http://${config.host}:${config.port}`);
    logger.info(` MCP SSE Endpoint: http://${config.host}:${config.port}/sse`);
    logger.info(` Health Check:     http://${config.host}:${config.port}/health`);
    logger.info(` State Snapshot:   http://${config.host}:${config.port}/state`);
    logger.info(
      ` Bedrock Mode:     ${
        bedrockClientFactory.isLiveAvailable() ? 'LIVE AWS BEDROCK (' + config.bedrockModelId + ')' : 'DETERMINISTIC FALLBACK MOCK'
      }`
    );
    logger.info('===========================================================');
  });

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down FlowGuard gracefully...`);
    server.close(() => {
      logger.info('HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  logger.error('Fatal error starting FlowGuard server', {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  process.exit(1);
});
