import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerFlowGuardTools } from './tools.js';
import { Logger } from '../logger.js';

const log = new Logger('FlowGuardMCPServer');

export function createFlowGuardMcpServer(): McpServer {
  log.info('Initializing FlowGuard MCP Server (spec version 2025-11-25)');

  const server = new McpServer(
    {
      name: 'FlowGuard-Alexa-Arbitration',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  registerFlowGuardTools(server);
  return server;
}
