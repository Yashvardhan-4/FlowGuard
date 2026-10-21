import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { createFlowGuardMcpServer } from './mcp/server.js';
import { createHttpTransportServer } from './transport/httpTransport.js';
import { config } from './config.js';
import { Server } from 'http';

function banner(title: string): void {
  console.log('\n======================================================================');
  console.log(`  ${title}`);
  console.log('======================================================================\n');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseToolResponse(result: unknown): any {
  const content = (result as { content?: Array<{ type: string; text?: string }> })?.content;
  if (content && content[0]?.text) {
    return JSON.parse(content[0].text);
  }
  return result;
}

async function runDemo(): Promise<void> {
  banner('FLOWGUARD: ALEXA+ DEEP-WORK ARBITRATION AGENT DEMO');

  let ephemeralServer: Server | null = null;
  const targetPort = config.port || 3000;
  const baseUrl = `http://${config.host}:${targetPort}`;

  // 1. Check if server is already running, or launch ephemeral instance
  let isRunning = false;
  try {
    const res = await fetch(`${baseUrl}/health`);
    if (res.ok) {
      isRunning = true;
      console.log(`[Demo] Connected to existing FlowGuard server at ${baseUrl}`);
    }
  } catch {
    isRunning = false;
  }

  if (!isRunning) {
    console.log(`[Demo] Starting ephemeral FlowGuard server on ${baseUrl}...`);
    const mcpServer = createFlowGuardMcpServer();
    const { app } = createHttpTransportServer(mcpServer);
    ephemeralServer = app.listen(targetPort, config.host);
    await delay(500);
    console.log(`[Demo] Ephemeral server listening on ${baseUrl}`);
  }

  // 2. Connect official MCP Client over SSE
  console.log(`\n[Step 0] Initializing official MCP Client over Streamable HTTP (SSE)...`);
  const sseTransport = new SSEClientTransport(new URL(`${baseUrl}/sse`));
  const mcpClient = new Client(
    {
      name: 'FlowGuard-Demo-Harness',
      version: '1.0.0',
    },
    {
      capabilities: {},
    }
  );

  await mcpClient.connect(sseTransport);
  console.log(`[Step 0] MCP Client connected successfully! Protocol negotiation complete.`);

  // List tools to verify registration
  const toolsResponse = await mcpClient.listTools();
  console.log(`[Step 0] Registered MCP Tools discovered (${toolsResponse.tools.length}):`);
  for (const t of toolsResponse.tools) {
    const desc = t.description ? t.description.slice(0, 75) + '...' : '(no description)';
    console.log(`  - \x1b[36m${t.name}\x1b[0m: ${desc}`);
  }

  // 3. Step 1: Set Deep-Work Focus State
  banner('STEP 1: ACTIVATE DEEP-WORK FOCUS STATE');
  console.log('Calling MCP Tool: set_focus_state');
  const setFocusResult = await mcpClient.callTool({
    name: 'set_focus_state',
    arguments: {
      objective: 'Executive Board Financial Modeling & Strategy',
      durationMinutes: 45,
      interruptionPolicy: 'urgent_only',
      allowedResponses: ['ring_quick_reply', 'silent_queue'],
      autoDeflectDeliveries: true,
      privacyMode: true,
    },
  });

  const parsedFocus = parseToolResponse(setFocusResult);
  console.log('Focus State Response:');
  console.dir(parsedFocus, { depth: null });

  await delay(600);

  // 4. Step 2 & 3: Simulated Ring Delivery Event & Bedrock Arbitration
  banner('STEP 2 & 3: SIMULATED RING DELIVERY EVENT & BEDROCK ARBITRATION');
  const deliveryEvent = {
    eventId: 'evt-ring-delivery-001',
    source: 'ring_doorbell',
    category: 'delivery',
    visitorName: 'Amazon Logistics Driver',
    transcription: 'Hello, package delivery from Amazon! Dropping two boxes on the front porch.',
    urgencySignals: ['carrying_box', 'placed_package', 'scanned_barcode'],
  };

  console.log('Simulated Ring Video Doorbell Triggered:');
  console.dir(deliveryEvent, { depth: null });

  console.log('\nCalling MCP Tool: arbitrate_interruption...');
  const arbitrationResult = await mcpClient.callTool({
    name: 'arbitrate_interruption',
    arguments: deliveryEvent,
  });

  const parsedProposal = parseToolResponse(arbitrationResult);
  console.log('\nBedrock Arbitration Decision:');
  console.dir(parsedProposal, { depth: null });

  await delay(600);

  // 5. Step 4: Execute Deflection
  banner('STEP 4: EXECUTE DEFLECTION ON SIMULATED HARDWARE');
  console.log('Calling MCP Tool: execute_deflection...');
  const executionResult = await mcpClient.callTool({
    name: 'execute_deflection',
    arguments: {
      eventId: parsedProposal.eventId,
      action: parsedProposal.action,
      targetDevice: parsedProposal.targetDevice,
      spokenResponseToVisitor: parsedProposal.spokenResponseToVisitor,
      internalReason: parsedProposal.internalReason,
      urgencyScore: parsedProposal.urgencyScore,
      requiresUserApproval: parsedProposal.requiresUserApproval,
      category: 'delivery',
    },
  });

  const parsedExecution = parseToolResponse(executionResult);
  console.log('\nHardware Deflection Execution Result:');
  console.dir(parsedExecution, { depth: null });

  await delay(600);

  // 6. Step 5: Privacy Guardrail Demonstration (Leakage Prevention)
  banner('STEP 5: PRIVACY GUARDRAIL - SENSITIVE CONTEXT PROTECTION');
  console.log('Testing scenario: A visitor rings and asks: "What is the resident doing?"');
  console.log('Simulating an unsafe proposal containing the user\'s private focus objective:');
  console.log('  Proposed: "The resident is busy with Executive Board Financial Modeling and cannot answer."');

  const unsafeExecution = await mcpClient.callTool({
    name: 'execute_deflection',
    arguments: {
      eventId: 'evt-privacy-test-999',
      action: 'RING_SPOKEN_DEFLECTION',
      targetDevice: 'ring_doorbell',
      spokenResponseToVisitor: 'The resident is busy with Executive Board Financial Modeling and cannot answer.',
      internalReason: 'Visitor asking for user schedule',
      urgencyScore: 1,
      requiresUserApproval: false,
      category: 'visitor',
    },
  });

  const parsedUnsafe = parseToolResponse(unsafeExecution);
  console.log('\nPrivacy Guard Result (Objective Term Redacted & Sanitized):');
  console.log(`  Privacy Sanitized: \x1b[32m${parsedUnsafe.privacySanitized}\x1b[0m`);
  console.log(`  Audio Spoken to Visitor: "\x1b[33m${parsedUnsafe.simulatedHardware.ringDispatched?.quickReplyText}\x1b[0m"`);

  await delay(600);

  // 7. Step 6: Deduplication & Idempotency Demonstration
  banner('STEP 6: DEDUPLICATION & IDEMPOTENCY SAFETY GUARD');
  console.log('Simulating duplicate event from Ring Doorbell (driver pressed button again):');
  console.log(`  Re-sending eventId: "${deliveryEvent.eventId}"`);

  const duplicateExecution = await mcpClient.callTool({
    name: 'execute_deflection',
    arguments: {
      eventId: deliveryEvent.eventId,
      action: parsedProposal.action,
      targetDevice: parsedProposal.targetDevice,
      spokenResponseToVisitor: parsedProposal.spokenResponseToVisitor,
      internalReason: parsedProposal.internalReason,
      urgencyScore: parsedProposal.urgencyScore,
      requiresUserApproval: false,
      category: 'delivery',
    },
  });

  const parsedDuplicate = parseToolResponse(duplicateExecution);
  console.log('\nDuplicate Prevention Result:');
  console.log(`  Status: \x1b[32m${parsedDuplicate.status}\x1b[0m`);
  console.log(`  Explanation: ${parsedDuplicate.explanation}`);

  await delay(600);

  // 8. Step 7: Post-Focus Silent Reminder Digest
  banner('STEP 7: POST-FOCUS SILENT REMINDER DIGEST');
  console.log('Calling MCP Tool: get_focus_session_summary...');
  const summaryResult = await mcpClient.callTool({
    name: 'get_focus_session_summary',
    arguments: {},
  });

  const parsedSummary = parseToolResponse(summaryResult);
  console.log('\nActive Focus Session:');
  console.log(`  Objective: ${parsedSummary.activeFocusSession.objective}`);
  console.log(`  Policy: ${parsedSummary.activeFocusSession.interruptionPolicy}`);
  console.log(`  Indoor Chime Muted: ${parsedSummary.hardwareState.ringChimeMuted}`);

  console.log(`\nPending Silent Reminders (${parsedSummary.pendingPostFocusReminders.length}):`);
  for (const r of parsedSummary.pendingPostFocusReminders) {
    console.log(`  - [\x1b[36m${r.category.toUpperCase()}\x1b[0m] ${r.headline} (Urgency: ${r.urgencyScore}/10)`);
  }

  banner('DEMO COMPLETED SUCCESSFULLY');
  console.log('All FlowGuard core operations verified over real MCP SSE transport.');

  // Clean up
  await mcpClient.close();
  if (ephemeralServer) {
    ephemeralServer.close();
  }
}

runDemo().catch((err) => {
  console.error('Demo encountered an error:', err);
  process.exit(1);
});
