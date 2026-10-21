import { describe, it, expect } from 'vitest';
import { BedrockArbitrator } from '../src/bedrock/arbitrator.js';
import { FocusState, InterruptionEvent } from '../src/types.js';

describe('BedrockArbitrator - Arbitration & Safe Fallback', () => {
  const arbitrator = new BedrockArbitrator();

  const focusState: FocusState = {
    sessionId: 'focus-test',
    objective: 'Architectural Blueprint Design',
    startTime: new Date().toISOString(),
    endTime: new Date(Date.now() + 3600000).toISOString(),
    durationMinutes: 60,
    interruptionPolicy: 'urgent_only',
    allowedResponses: ['ring_quick_reply', 'silent_queue'],
    autoDeflectDeliveries: true,
    vipContacts: [],
    privacyMode: true,
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  it('arbitrates package deliveries with drop-off deflection', async () => {
    const deliveryEvent: InterruptionEvent = {
      eventId: 'evt-del-1',
      source: 'ring_doorbell',
      category: 'delivery',
      visitorName: 'FedEx Courier',
      transcription: 'Package delivery for apartment 4B',
      urgencySignals: ['holding_box', 'doorbell_ring'],
      timestamp: new Date().toISOString(),
    };

    const proposal = await arbitrator.arbitrate(deliveryEvent, focusState);

    expect(proposal.eventId).toBe('evt-del-1');
    expect(proposal.action).toBe('DEFLECT_RING_PRESET');
    expect(proposal.targetDevice).toBe('ring_doorbell');
    expect(proposal.urgencyScore).toBeLessThanOrEqual(3);
    expect(proposal.spokenResponseToVisitor).toContain('door');
    expect(proposal.privacyAuditPassed).toBe(true);
  });

  it('arbitrates emergency signals with breakthrough authorization', async () => {
    const emergencyEvent: InterruptionEvent = {
      eventId: 'evt-emg-1',
      source: 'alexa_speaker',
      category: 'emergency',
      transcription: 'Smoke alarm sounding in kitchen',
      urgencySignals: ['smoke_detected', 'high_decibel_alarm'],
      timestamp: new Date().toISOString(),
    };

    const proposal = await arbitrator.arbitrate(emergencyEvent, focusState);

    expect(proposal.eventId).toBe('evt-emg-1');
    expect(proposal.action).toBe('ALLOW_BREAKTHROUGH');
    expect(proposal.urgencyScore).toBe(10);
  });

  it('arbitrates sales solicitations with deflection or silent queue', async () => {
    const salesEvent: InterruptionEvent = {
      eventId: 'evt-sales-1',
      source: 'ring_doorbell',
      category: 'sales',
      visitorName: 'Solar Panel Salesperson',
      transcription: 'Hi neighbor, we are in the area talking about solar tax credits',
      urgencySignals: ['clipboard'],
      timestamp: new Date().toISOString(),
    };

    const proposal = await arbitrator.arbitrate(salesEvent, focusState);

    expect(proposal.eventId).toBe('evt-sales-1');
    expect(proposal.urgencyScore).toBeLessThanOrEqual(2);
    expect(['DEFLECT_RING_PRESET', 'SILENT_QUEUE']).toContain(proposal.action);
  });
});
