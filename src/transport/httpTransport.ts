import express, { Request, Response } from 'express';
import cors from 'cors';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { focusStateManager } from '../state/focusState.js';
import { bedrockClientFactory } from '../bedrock/client.js';
import { ringSimulator } from '../hardware/simulatedDevices.js';
import { config } from '../config.js';
import { Logger } from '../logger.js';

const log = new Logger('HTTPTransport');

export interface HttpServerContext {
  app: express.Express;
  transports: Map<string, SSEServerTransport>;
  mcpServer: McpServer;
}

export function createHttpTransportServer(mcpServer: McpServer): HttpServerContext {
  const app = express();
  const transports = new Map<string, SSEServerTransport>();

  app.use(cors());
  app.use(express.json());

  // Health endpoint
  app.get('/health', (_req: Request, res: Response) => {
    const activeFocus = focusStateManager.getActiveFocus();
    res.json({
      status: 'UP',
      service: 'FlowGuard-Alexa-Arbitration',
      version: '1.0.0',
      mcpSpec: '2025-11-25',
      bedrock: {
        mode: bedrockClientFactory.isLiveAvailable() ? 'LIVE_AWS_BEDROCK' : 'DETERMINISTIC_MOCK',
        region: config.awsRegion,
        modelId: config.bedrockModelId,
      },
      hardwareSimulation: {
        ringDoorbell: config.simulateRingDevice,
        alexaSpeaker: config.simulateAlexaSpeaker,
        chimeMuted: ringSimulator.isChimeMuted(),
      },
      activeFocusSession: activeFocus
        ? {
            sessionId: activeFocus.sessionId,
            objective: activeFocus.objective,
            endTime: activeFocus.endTime,
            policy: activeFocus.interruptionPolicy,
          }
        : null,
      activeConnections: transports.size,
      timestamp: new Date().toISOString(),
    });
  });

  // State inspection endpoint
  app.get('/state', (_req: Request, res: Response) => {
    res.json({
      activeFocus: focusStateManager.getActiveFocus(),
      pendingReminders: focusStateManager.getPendingReminders(),
      auditLogs: focusStateManager.getAuditLogs().slice(-20),
    });
  });

  // MCP Streamable HTTP / Server-Sent Events (SSE) connection endpoint
  app.get('/sse', async (req: Request, res: Response) => {
    log.info('New SSE connection initiated for MCP client', {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    try {
      // Create SSEServerTransport directing client to POST to /messages
      const transport = new SSEServerTransport('/messages', res);
      const sessionId = transport.sessionId;
      transports.set(sessionId, transport);

      req.on('close', () => {
        log.info('SSE connection closed by client', { sessionId });
        transports.delete(sessionId);
      });

      await mcpServer.connect(transport);
      log.info('MCP server successfully connected to SSE transport', { sessionId });
    } catch (err) {
      log.error('Failed to establish SSE transport connection', {
        error: err instanceof Error ? err.message : String(err),
      });
      if (!res.headersSent) {
        res.status(500).end('Failed to initialize SSE transport');
      }
    }
  });

  // MCP Client POST message endpoint
  app.post('/messages', async (req: Request, res: Response) => {
    const sessionId = req.query.sessionId as string;

    if (!sessionId) {
      log.warn('POST /messages called without sessionId parameter');
      res.status(400).json({ error: 'Missing sessionId query parameter' });
      return;
    }

    const transport = transports.get(sessionId);
    if (!transport) {
      log.warn('POST /messages session not found', { sessionId });
      res.status(404).json({ error: `Session '${sessionId}' not found or already closed` });
      return;
    }

    try {
      await transport.handlePostMessage(req, res, req.body);
    } catch (err) {
      log.error('Error handling MCP client post message', {
        sessionId,
        error: err instanceof Error ? err.message : String(err),
      });
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal error processing MCP message' });
      }
    }
  });

  return { app, transports, mcpServer };
}
