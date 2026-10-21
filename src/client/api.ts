export interface SystemHealth {
  status: string;
  service: string;
  version: string;
  mcpSpec: string;
  bedrock: {
    mode: string;
    region: string;
    modelId: string;
  };
  hardwareSimulation: {
    ringDoorbell: boolean;
    alexaSpeaker: boolean;
    chimeMuted: boolean;
  };
  activeFocusSession: {
    sessionId: string;
    objective: string;
    endTime: string;
    policy: string;
  } | null;
  activeConnections: number;
  timestamp: string;
}

export interface FocusSession {
  sessionId: string;
  objective: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  interruptionPolicy: 'emergency_only' | 'urgent_only' | 'allow_family' | 'lenient';
  allowedResponses: Array<'ring_quick_reply' | 'silent_queue' | 'alexa_spoken_response' | 'emergency_breakthrough' | 'auto_text'>;
  autoDeflectDeliveries: boolean;
  vipContacts: string[];
  privacyMode: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface InterruptionEvent {
  eventId: string;
  source: 'ring_doorbell' | 'alexa_speaker' | 'phone_call' | 'slack';
  category: 'delivery' | 'visitor' | 'family_member' | 'emergency' | 'sales' | 'noise';
  visitorName?: string;
  transcription: string;
  urgencySignals: string[];
  timestamp?: string;
}

export interface ArbitrationProposal {
  eventId: string;
  action: 'DEFLECT_RING_PRESET' | 'RING_SPOKEN_DEFLECTION' | 'SILENT_QUEUE' | 'ALLOW_BREAKTHROUGH' | 'IGNORE';
  targetDevice: 'ring_doorbell' | 'alexa_speaker' | 'user_phone' | 'none';
  spokenResponseToVisitor?: string;
  internalReason: string;
  urgencyScore: number;
  requiresUserApproval: boolean;
  privacyAuditPassed: boolean;
  modelUsed: string;
  arbitratedAt: string;
}

export interface DeflectionResult {
  eventId: string;
  status: 'EXECUTED' | 'REJECTED_UNAUTHORIZED' | 'QUEUED_SILENTLY' | 'FALLBACK_TRIGGERED' | 'DUPLICATE_IGNORED';
  actionTaken: string;
  simulatedHardware: {
    ringDispatched?: {
      quickReplyText: string;
      deliveredAt: string;
      simulated: true;
    };
    alexaSpeaker?: {
      chimeMuted: boolean;
      announcedText?: string;
      simulated: true;
    };
    silentQueue?: {
      reminderId: string;
      headline: string;
      queuedAt: string;
    };
  };
  userSilentReminder?: string;
  auditLogId: string;
  timestamp: string;
  explanation: string;
  privacySanitized: boolean;
}

export interface SilentReminder {
  id: string;
  eventId: string;
  category: string;
  headline: string;
  detail: string;
  urgencyScore: number;
  receivedAt: string;
  reviewed: boolean;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  eventId: string;
  eventType: string;
  details: Record<string, unknown>;
}

export interface SessionSummary {
  activeFocusSession: FocusSession | null;
  pendingPostFocusReminders: SilentReminder[];
  recentAuditLogs: AuditLogEntry[];
  hardwareState: {
    ringChimeMuted: boolean;
    simulatedRingActive: boolean;
    simulatedAlexaActive: boolean;
  };
}

export const api = {
  async getHealth(): Promise<SystemHealth> {
    const res = await fetch('/health');
    if (!res.ok) throw new Error(`Health check failed: ${res.statusText}`);
    return res.json();
  },

  async getSummary(): Promise<SessionSummary> {
    const res = await fetch('/api/summary');
    if (!res.ok) throw new Error(`Failed to load summary: ${res.statusText}`);
    return res.json();
  },

  async setFocus(data: {
    objective: string;
    durationMinutes: number;
    interruptionPolicy: string;
    allowedResponses: string[];
    autoDeflectDeliveries: boolean;
    privacyMode: boolean;
    vipContacts?: string[];
  }): Promise<{ status: string; session: FocusSession }> {
    const res = await fetch('/api/focus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to set focus: ${res.statusText}`);
    }
    return res.json();
  },

  async clearFocus(): Promise<{ status: string }> {
    const res = await fetch('/api/focus/clear', { method: 'POST' });
    if (!res.ok) throw new Error('Failed to end focus session');
    return res.json();
  },

  async arbitrate(interruption: InterruptionEvent): Promise<ArbitrationProposal> {
    const res = await fetch('/api/arbitrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(interruption),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Arbitration failed: ${res.statusText}`);
    }
    return res.json();
  },

  async executeDeflection(data: {
    eventId: string;
    proposedAction: {
      action: string;
      targetDevice: string;
      spokenResponseToVisitor?: string;
      internalReason?: string;
      urgencyScore: number;
      requiresUserApproval: boolean;
    };
    userApprovalGranted?: boolean;
    category?: string;
  }): Promise<DeflectionResult> {
    const res = await fetch('/api/deflect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Execution failed: ${res.statusText}`);
    }
    return res.json();
  },

  async acknowledgeReminder(id: string): Promise<void> {
    const res = await fetch(`/api/reminders/${id}/acknowledge`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to acknowledge reminder');
  },

  async runScenario(scenario: 'delivery_happy_path' | 'approval_denied_flow' | 'privacy_attack_mitigated'): Promise<any> {
    const res = await fetch('/api/demo/scenario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Scenario failed: ${res.statusText}`);
    }
    return res.json();
  },

  async resetSystem(): Promise<void> {
    const res = await fetch('/api/reset', { method: 'POST' });
    if (!res.ok) throw new Error('Failed to reset system');
  },
};
