import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Server } from 'http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { createFlowGuardMcpServer } from '../src/mcp/server.js';
import { createHttpTransportServer } from '../src/transport/httpTransport.js';
import { focusStateManager } from '../src/state/focusState.js';
import { deduplicationTracker } from '../src/safety/deduplication.js';

describe('MCP Protocol & Tools over Streamable HTTP (SSE)', () => {
  let server: Server;
  let client: Client;
  const TEST_PORT = 3199;
  const TEST_HOST = '127.0.0.1';
  const baseUrl = `http://${TEST_HOST}:${TEST_PORT}`;

  beforeAll(async () => {
    focusStateManager.resetAll();
    deduplicationTracker.clear();

    const mcpServer = createFlowGuardMcpServer();
    const { app } = createHttpTransportServer(mcpServer);

    server = app.listen(TEST_PORT, TEST_HOST);

    // Wait for server to bind
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Connect official MCP Client over SSE
    const transport = new SSEClientTransport(new URL(`${baseUrl}/sse`));
    client = new Client(
      {
        name: 'Protocol-Test-Client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );

    await client.connect(transport);
  });

  afterAll(async () => {
    try {
      await client.close();
    } catch {
      // ignore
    }
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('lists the registered FlowGuard MCP tools', async () => {
    const listResult = await client.listTools();
    const toolNames = listResult.tools.map((t) => t.name);

    expect(toolNames).toContain('set_focus_state');
    expect(toolNames).toContain('arbitrate_interruption');
    expect(toolNames).toContain('execute_deflection');
    expect(toolNames).toContain('get_focus_session_summary');
  });

  it('calls set_focus_state and establishes active focus session', async () => {
    const response = await client.callTool({
      name: 'set_focus_state',
      arguments: {
        objective: 'Writing Core Backend Microservices',
        durationMinutes: 90,
        interruptionPolicy: 'urgent_only',
        allowedResponses: ['ring_quick_reply', 'silent_queue'],
        autoDeflectDeliveries: true,
        privacyMode: true,
      },
    });

    const parsed = JSON.parse((response.content[0] as { text: string }).text);
    expect(parsed.status).toBe('SUCCESS');
    expect(parsed.session.objective).toBe('Writing Core Backend Microservices');
    expect(parsed.session.durationMinutes).toBe(90);
    expect(parsed.session.interruptionPolicy).toBe('urgent_only');
  });

  it('calls arbitrate_interruption on simulated Ring delivery event', async () => {
    const response = await client.callTool({
      name: 'arbitrate_interruption',
      arguments: {
        eventId: 'evt-test-deliv-01',
        source: 'ring_doorbell',
        category: 'delivery',
        visitorName: 'UPS Courier',
        transcription: 'Package delivery from UPS, leaving at doorstep.',
        urgencySignals: ['package_box', 'doorbell_chime'],
      },
    });

    const parsed = JSON.parse((response.content[0] as { text: string }).text);
    expect(parsed.eventId).toBe('evt-test-deliv-01');
    expect(parsed.action).toBe('DEFLECT_RING_PRESET');
    expect(parsed.targetDevice).toBe('ring_doorbell');
    expect(parsed.spokenResponseToVisitor).toBeDefined();
    expect(parsed.urgencyScore).toBeLessThanOrEqual(3);
  });

  it('calls execute_deflection and verifies simulated Ring dispatch and silent queue', async () => {
    const response = await client.callTool({
      name: 'execute_deflection',
      arguments: {
        eventId: 'evt-test-deliv-01',
        action: 'DEFLECT_RING_PRESET',
        targetDevice: 'ring_doorbell',
        spokenResponseToVisitor: 'Please leave the package by the door. Thank you!',
        internalReason: 'UPS delivery auto-deflected',
        urgencyScore: 2,
        requiresUserApproval: false,
        category: 'delivery',
      },
    });

    const parsed = JSON.parse((response.content[0] as { text: string }).text);
    expect(parsed.status).toBe('EXECUTED');
    expect(parsed.actionTaken).toBe('DEFLECT_RING_PRESET');
    expect(parsed.simulatedHardware.ringDispatched?.quickReplyText).toBe(
      'Please leave the package by the door. Thank you!'
    );
    expect(parsed.simulatedHardware.alexaSpeaker?.chimeMuted).toBe(true);
    expect(parsed.simulatedHardware.silentQueue).toBeDefined();
  });

  it('blocks duplicate execution and returns DUPLICATE_IGNORED', async () => {
    const response = await client.callTool({
      name: 'execute_deflection',
      arguments: {
        eventId: 'evt-test-deliv-01',
        action: 'DEFLECT_RING_PRESET',
        targetDevice: 'ring_doorbell',
        spokenResponseToVisitor: 'Please leave the package by the door. Thank you!',
        internalReason: 'UPS delivery auto-deflected',
        urgencyScore: 2,
        requiresUserApproval: false,
        category: 'delivery',
      },
    });

    const parsed = JSON.parse((response.content[0] as { text: string }).text);
    expect(parsed.status).toBe('DUPLICATE_IGNORED');
  });

  it('retrieves focus session summary including queued silent reminders', async () => {
    const response = await client.callTool({
      name: 'get_focus_session_summary',
      arguments: {},
    });

    const parsed = JSON.parse((response.content[0] as { text: string }).text);
    expect(parsed.activeFocusSession).not.toBeNull();
    expect(parsed.pendingPostFocusReminders.length).toBeGreaterThan(0);
    expect(parsed.recentAuditLogs.length).toBeGreaterThan(0);
    expect(parsed.hardwareState.ringChimeMuted).toBe(true);
  });
});
