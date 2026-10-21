import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Server } from 'http';
import { createFlowGuardMcpServer } from '../src/mcp/server.js';
import { createHttpTransportServer } from '../src/transport/httpTransport.js';
import { focusStateManager } from '../src/state/focusState.js';
import { deduplicationTracker } from '../src/safety/deduplication.js';

describe('Application API Adapter - Web UI REST Endpoints', () => {
  let server: Server;
  const TEST_PORT = 3299;
  const baseUrl = `http://127.0.0.1:${TEST_PORT}`;

  beforeAll(async () => {
    focusStateManager.resetAll();
    deduplicationTracker.clear();

    const mcpServer = createFlowGuardMcpServer();
    const { app } = createHttpTransportServer(mcpServer);

    server = app.listen(TEST_PORT, '127.0.0.1');
    await new Promise((resolve) => setTimeout(resolve, 300));
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('GET /health returns system health and bedrock configuration', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('UP');
    expect(data.service).toBe('FlowGuard-Alexa-Arbitration');
    expect(data.mcpSpec).toBe('2025-11-25');
    expect(data.hardwareSimulation.ringDoorbell).toBe(true);
  });

  it('POST /api/focus sets focus state through MCP tool', async () => {
    const res = await fetch(`${baseUrl}/api/focus`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        objective: 'Designing API Gateway Microservices',
        durationMinutes: 45,
        interruptionPolicy: 'urgent_only',
        allowedResponses: ['ring_quick_reply', 'silent_queue'],
        autoDeflectDeliveries: true,
        privacyMode: true,
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('SUCCESS');
    expect(data.session.objective).toBe('Designing API Gateway Microservices');
  });

  it('POST /api/arbitrate evaluates interruption using Bedrock arbitrator', async () => {
    const res = await fetch(`${baseUrl}/api/arbitrate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: 'evt-api-test-01',
        source: 'ring_doorbell',
        category: 'delivery',
        visitorName: 'Amazon Courier',
        transcription: 'Package delivery from Amazon, leaving on porch.',
        urgencySignals: ['package_box'],
      }),
    });

    expect(res.status).toBe(200);
    const proposal = await res.json();
    expect(proposal.eventId).toBe('evt-api-test-01');
    expect(proposal.action).toBe('DEFLECT_RING_PRESET');
    expect(proposal.spokenResponseToVisitor).toContain('door');
  });

  it('POST /api/deflect executes hardware deflection and records silent reminder', async () => {
    const res = await fetch(`${baseUrl}/api/deflect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: 'evt-api-test-01',
        proposedAction: {
          action: 'DEFLECT_RING_PRESET',
          targetDevice: 'ring_doorbell',
          spokenResponseToVisitor: 'Please leave the package by the door. Thank you!',
          internalReason: 'Delivery pre-authorized',
          urgencyScore: 2,
          requiresUserApproval: false,
        },
        category: 'delivery',
      }),
    });

    expect(res.status).toBe(200);
    const exec = await res.json();
    expect(exec.status).toBe('EXECUTED');
    expect(exec.simulatedHardware.ringDispatched).toBeDefined();
    expect(exec.simulatedHardware.silentQueue).toBeDefined();
  });

  it('POST /api/demo/scenario runs one-click happy path scenario end-to-end', async () => {
    const res = await fetch(`${baseUrl}/api/demo/scenario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario: 'delivery_happy_path' }),
    });

    expect(res.status).toBe(200);
    const result = await res.json();
    expect(result.scenario).toBe('delivery_happy_path');
    expect(result.execution.status).toBe('EXECUTED');
    expect(result.duplicateResult.status).toBe('DUPLICATE_IGNORED');
    expect(result.summary.hardwareState.ringChimeMuted).toBe(true);
  });

  it('POST /api/demo/scenario runs approval denied scenario', async () => {
    const res = await fetch(`${baseUrl}/api/demo/scenario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario: 'approval_denied_flow' }),
    });

    expect(res.status).toBe(200);
    const result = await res.json();
    expect(result.scenario).toBe('approval_denied_flow');
    expect(result.execution.status).toBe('REJECTED_UNAUTHORIZED');
  });

  it('POST /api/demo/scenario runs privacy attack mitigation scenario', async () => {
    const res = await fetch(`${baseUrl}/api/demo/scenario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario: 'privacy_attack_mitigated' }),
    });

    expect(res.status).toBe(200);
    const result = await res.json();
    expect(result.scenario).toBe('privacy_attack_mitigated');
    expect(result.execution.privacySanitized).toBe(true);
  });

  it('POST /api/reminders/:id/acknowledge marks reminder reviewed', async () => {
    const summaryRes = await fetch(`${baseUrl}/api/summary`);
    const summary = await summaryRes.json();
    const firstReminder = summary.pendingPostFocusReminders[0];

    if (firstReminder) {
      const ackRes = await fetch(`${baseUrl}/api/reminders/${firstReminder.id}/acknowledge`, {
        method: 'POST',
      });
      expect(ackRes.status).toBe(200);
      const ackData = await ackRes.json();
      expect(ackData.status).toBe('ACKNOWLEDGED');
    }
  });
});
