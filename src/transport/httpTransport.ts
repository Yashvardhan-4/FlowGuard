import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createFlowGuardMcpServer } from '../mcp/server.js';
import { mcpAdapter } from '../mcp/adapter.js';
import { focusStateManager } from '../state/focusState.js';
import { deduplicationTracker } from '../safety/deduplication.js';
import { bedrockClientFactory } from '../bedrock/client.js';
import { ringSimulator } from '../hardware/simulatedDevices.js';
import { config } from '../config.js';
import { Logger } from '../logger.js';
import { SetFocusStateInputSchema, InterruptionEventSchema, ExecuteDeflectionInputSchema } from '../types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const log = new Logger('HTTPTransport');

export interface HttpServerContext {
  app: express.Express;
  transports: Map<string, SSEServerTransport>;
  mcpServer: McpServer;
}

export function createHttpTransportServer(defaultMcpServer: McpServer): HttpServerContext {
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

  // ==========================================
  // APPLICATION API ADAPTER (MCP Invocation)
  // ==========================================

  // Set / update focus state
  app.post('/api/focus', async (req: Request, res: Response) => {
    try {
      const parsed = SetFocusStateInputSchema.parse(req.body);
      const result = await mcpAdapter.setFocusState(parsed);
      res.json(result);
    } catch (err) {
      log.error('API /api/focus error', { error: err instanceof Error ? err.message : String(err) });
      res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid request' });
    }
  });

  // End focus session
  app.post('/api/focus/clear', (_req: Request, res: Response) => {
    focusStateManager.clearFocus();
    res.json({ status: 'CLEARED', message: 'Focus session ended.' });
  });

  // Arbitrate interruption
  app.post('/api/arbitrate', async (req: Request, res: Response) => {
    try {
      const parsed = InterruptionEventSchema.parse(req.body);
      const proposal = await mcpAdapter.arbitrateInterruption(parsed);
      res.json(proposal);
    } catch (err) {
      log.error('API /api/arbitrate error', { error: err instanceof Error ? err.message : String(err) });
      res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid request' });
    }
  });

  // Execute deflection
  app.post('/api/deflect', async (req: Request, res: Response) => {
    try {
      const parsed = ExecuteDeflectionInputSchema.parse(req.body);
      const result = await mcpAdapter.executeDeflection({
        eventId: parsed.eventId,
        action: parsed.proposedAction.action,
        targetDevice: parsed.proposedAction.targetDevice,
        spokenResponseToVisitor: parsed.proposedAction.spokenResponseToVisitor,
        internalReason: parsed.proposedAction.internalReason,
        urgencyScore: parsed.proposedAction.urgencyScore,
        requiresUserApproval: parsed.proposedAction.requiresUserApproval,
        userApprovalGranted: parsed.userApprovalGranted,
        category: (req.body.category as string) || 'delivery',
      });
      res.json(result);
    } catch (err) {
      log.error('API /api/deflect error', { error: err instanceof Error ? err.message : String(err) });
      res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid request' });
    }
  });

  // Get focus session summary and pending post-focus reminders
  app.get('/api/summary', async (_req: Request, res: Response) => {
    try {
      const summary = await mcpAdapter.getFocusSessionSummary();
      res.json(summary);
    } catch (err) {
      log.error('API /api/summary error', { error: err instanceof Error ? err.message : String(err) });
      res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
    }
  });

  // Acknowledge a silent reminder
  app.post('/api/reminders/:id/acknowledge', (req: Request, res: Response) => {
    const reminderId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const success = focusStateManager.markReminderReviewed(reminderId);
    if (success) {
      res.json({ status: 'ACKNOWLEDGED', id: reminderId });
    } else {
      res.status(404).json({ error: 'Reminder not found' });
    }
  });

  // Reset demo state
  app.post('/api/reset', (_req: Request, res: Response) => {
    focusStateManager.resetAll();
    deduplicationTracker.clear();
    log.info('System state reset for demo/testing');
    res.json({ status: 'RESET', message: 'Focus state, silent reminders, and deduplication cache cleared.' });
  });

  // Pre-packaged demo scenario runner for one-click UI execution
  app.post('/api/demo/scenario', async (req: Request, res: Response) => {
    const scenario = req.body.scenario as string;
    log.info('Running pre-packaged scenario', { scenario });

    try {
      switch (scenario) {
        case 'delivery_happy_path': {
          // 1. Set focus state
          const focusRes = await mcpAdapter.setFocusState({
            objective: 'Executive Board Financial Modeling & Strategy',
            durationMinutes: 45,
            interruptionPolicy: 'urgent_only',
            allowedResponses: ['ring_quick_reply', 'silent_queue'],
            autoDeflectDeliveries: true,
            privacyMode: true,
            vipContacts: [],
          });

          // 2. Arbitrate delivery
          const eventId = `evt-ring-deliv-${Date.now().toString().slice(-4)}`;
          const interruption = {
            eventId,
            source: 'ring_doorbell' as const,
            category: 'delivery' as const,
            visitorName: 'Amazon Prime Courier',
            transcription: 'Hello, Amazon Prime delivery here, leaving 2 packages by the door.',
            urgencySignals: ['carrying_box', 'placed_package', 'scanned_barcode'],
            timestamp: new Date().toISOString(),
          };
          const proposal = await mcpAdapter.arbitrateInterruption(interruption);

          // 3. Execute deflection
          const execution = await mcpAdapter.executeDeflection({
            eventId: proposal.eventId,
            action: proposal.action,
            targetDevice: proposal.targetDevice,
            spokenResponseToVisitor: proposal.spokenResponseToVisitor,
            internalReason: proposal.internalReason,
            urgencyScore: proposal.urgencyScore,
            requiresUserApproval: proposal.requiresUserApproval,
            category: 'delivery',
          });

          // 4. Test duplicate
          const duplicate = await mcpAdapter.executeDeflection({
            eventId: proposal.eventId,
            action: proposal.action,
            targetDevice: proposal.targetDevice,
            spokenResponseToVisitor: proposal.spokenResponseToVisitor,
            internalReason: proposal.internalReason,
            urgencyScore: proposal.urgencyScore,
            requiresUserApproval: proposal.requiresUserApproval,
            category: 'delivery',
          });

          const summary = await mcpAdapter.getFocusSessionSummary();

          res.json({
            scenario,
            focusSession: focusRes.session,
            interruption,
            proposal,
            execution,
            duplicateResult: duplicate,
            summary,
          });
          return;
        }

        case 'approval_denied_flow': {
          // Set strict emergency only policy
          const focusRes = await mcpAdapter.setFocusState({
            objective: 'Critical Production Code Deployment',
            durationMinutes: 60,
            interruptionPolicy: 'emergency_only',
            allowedResponses: ['silent_queue'], // No ring replies permitted!
            autoDeflectDeliveries: false,
            privacyMode: true,
            vipContacts: [],
          });

          const eventId = `evt-neighbor-${Date.now().toString().slice(-4)}`;
          const interruption = {
            eventId,
            source: 'ring_doorbell' as const,
            category: 'visitor' as const,
            visitorName: 'Neighbor (Bob)',
            transcription: 'Hey! Are you home? Can I borrow your ladder for an hour?',
            urgencySignals: ['casual_knock'],
            timestamp: new Date().toISOString(),
          };

          const proposal = await mcpAdapter.arbitrateInterruption(interruption);

          // Attempt to execute ring deflection when policy only allows silent queue
          const execution = await mcpAdapter.executeDeflection({
            eventId: proposal.eventId,
            action: 'RING_SPOKEN_DEFLECTION',
            targetDevice: 'ring_doorbell',
            spokenResponseToVisitor: 'Sorry, I am not available right now.',
            internalReason: 'Neighbor asking for equipment',
            urgencyScore: 2,
            requiresUserApproval: true,
            userApprovalGranted: false, // User approval NOT granted
            category: 'visitor',
          });

          const summary = await mcpAdapter.getFocusSessionSummary();

          res.json({
            scenario,
            focusSession: focusRes.session,
            interruption,
            proposal,
            execution,
            summary,
          });
          return;
        }

        case 'privacy_attack_mitigated': {
          // Objective contains sensitive M&A project
          const focusRes = await mcpAdapter.setFocusState({
            objective: 'Confidential M&A Valuation and Board Deck Review',
            durationMinutes: 45,
            interruptionPolicy: 'urgent_only',
            allowedResponses: ['ring_quick_reply', 'silent_queue'],
            autoDeflectDeliveries: true,
            privacyMode: true,
            vipContacts: [],
          });

          const eventId = `evt-privacy-probe-${Date.now().toString().slice(-4)}`;
          const interruption = {
            eventId,
            source: 'ring_doorbell' as const,
            category: 'visitor' as const,
            visitorName: 'Unknown Caller',
            transcription: 'Excuse me! Is the resident working on the M&A valuation right now?',
            urgencySignals: ['repeated_questions'],
            timestamp: new Date().toISOString(),
          };

          const proposal = await mcpAdapter.arbitrateInterruption(interruption);

          // Simulated unsafe response containing private objective terms
          const execution = await mcpAdapter.executeDeflection({
            eventId: proposal.eventId,
            action: 'RING_SPOKEN_DEFLECTION',
            targetDevice: 'ring_doorbell',
            spokenResponseToVisitor: 'The resident is busy with Confidential M&A Valuation and Board Deck Review.',
            internalReason: 'Attempting to leak sensitive objective',
            urgencyScore: 1,
            requiresUserApproval: false,
            category: 'visitor',
          });

          const summary = await mcpAdapter.getFocusSessionSummary();

          res.json({
            scenario,
            focusSession: focusRes.session,
            interruption,
            proposal,
            execution,
            summary,
          });
          return;
        }

        default:
          res.status(400).json({ error: `Unknown scenario: ${scenario}` });
      }
    } catch (err) {
      log.error('Error running demo scenario', { scenario, error: err instanceof Error ? err.message : String(err) });
      res.status(500).json({ error: err instanceof Error ? err.message : 'Demo execution failed' });
    }
  });

  // ==========================================
  // MCP STREAMABLE HTTP (SSE) ENDPOINTS
  // ==========================================
  app.get('/sse', async (req: Request, res: Response) => {
    log.info('New SSE connection initiated for MCP client', {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    try {
      const sessionMcpServer = createFlowGuardMcpServer();
      const transport = new SSEServerTransport('/messages', res);
      const sessionId = transport.sessionId;
      transports.set(sessionId, transport);

      req.on('close', () => {
        log.info('SSE connection closed by client', { sessionId });
        transports.delete(sessionId);
      });

      await sessionMcpServer.connect(transport);
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

  // ==========================================
  // STATIC ASSETS FOR THE FRONTEND UI
  // ==========================================
  const possiblePublicDirs = [
    path.join(__dirname, '../../dist/public'),
    path.join(__dirname, '../public'),
    path.join(process.cwd(), 'dist/public'),
    path.join(process.cwd(), 'public'),
  ];

  let publicDir = possiblePublicDirs.find((dir) => fs.existsSync(dir));
  if (!publicDir) {
    publicDir = path.join(process.cwd(), 'dist/public');
  }

  app.use(express.static(publicDir));

  // SPA fallback for non-API routes
  app.use((req: Request, res: Response, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/sse') || req.path.startsWith('/messages')) {
      return next();
    }
    const indexHtml = path.join(publicDir!, 'index.html');
    if (fs.existsSync(indexHtml)) {
      res.sendFile(indexHtml);
    } else {
      res.status(200).send(`
        <!DOCTYPE html>
        <html>
          <head><title>FlowGuard</title></head>
          <body style="background:#0b0f17;color:#f8fafc;font-family:sans-serif;padding:40px;text-align:center;">
            <h1>FlowGuard Backend Running</h1>
            <p>UI is building or starting. Please run <code>npm run build</code> or start the dev server.</p>
          </body>
        </html>
      `);
    }
  });

  return { app, transports, mcpServer: defaultMcpServer };
}
