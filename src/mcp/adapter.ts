import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createFlowGuardMcpServer } from './server.js';
import {
  SetFocusStateInput,
  InterruptionEvent,
  ArbitrationProposal,
  DeflectionExecutionResult,
  FocusState,
  SilentReminder,
  AuditLogEntry,
} from '../types.js';
import { Logger } from '../logger.js';

const log = new Logger('McpClientAdapter');

export interface SessionSummaryResult {
  activeFocusSession: FocusState | null;
  pendingPostFocusReminders: SilentReminder[];
  recentAuditLogs: AuditLogEntry[];
  hardwareState: {
    ringChimeMuted: boolean;
    simulatedRingActive: boolean;
    simulatedAlexaActive: boolean;
  };
}

export class McpClientAdapter {
  private client: Client | null = null;
  private isInitializing: boolean = false;
  private initPromise: Promise<Client> | null = null;

  async getClient(): Promise<Client> {
    if (this.client) {
      return this.client;
    }
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      this.isInitializing = true;
      log.info('Initializing in-memory MCP Client Adapter');

      const server = createFlowGuardMcpServer();
      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

      await server.connect(serverTransport);

      const client = new Client(
        {
          name: 'FlowGuard-Web-Adapter',
          version: '1.0.0',
        },
        {
          capabilities: {},
        }
      );

      await client.connect(clientTransport);
      this.client = client;
      this.isInitializing = false;
      log.info('McpClientAdapter successfully connected to MCP Server instance');
      return client;
    })();

    return this.initPromise;
  }

  private parseContent<T>(result: unknown): T {
    const content = (result as { content?: Array<{ type: string; text?: string }> })?.content;
    if (content && content[0]?.text) {
      return JSON.parse(content[0].text) as T;
    }
    throw new Error('Invalid MCP tool response format: missing text content');
  }

  async setFocusState(input: SetFocusStateInput): Promise<{ status: string; message: string; session: FocusState }> {
    const client = await this.getClient();
    const result = await client.callTool({
      name: 'set_focus_state',
      arguments: input,
    });
    return this.parseContent(result);
  }

  async arbitrateInterruption(interruption: InterruptionEvent): Promise<ArbitrationProposal> {
    const client = await this.getClient();
    const result = await client.callTool({
      name: 'arbitrate_interruption',
      arguments: interruption,
    });
    return this.parseContent(result);
  }

  async executeDeflection(args: {
    eventId: string;
    action: string;
    targetDevice: string;
    spokenResponseToVisitor?: string;
    internalReason?: string;
    urgencyScore?: number;
    requiresUserApproval?: boolean;
    userApprovalGranted?: boolean;
    category?: string;
  }): Promise<DeflectionExecutionResult> {
    const client = await this.getClient();
    const result = await client.callTool({
      name: 'execute_deflection',
      arguments: args,
    });
    return this.parseContent(result);
  }

  async getFocusSessionSummary(): Promise<SessionSummaryResult> {
    const client = await this.getClient();
    const result = await client.callTool({
      name: 'get_focus_session_summary',
      arguments: {},
    });
    return this.parseContent(result);
  }
}

export const mcpAdapter = new McpClientAdapter();
