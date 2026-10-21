import { describe, it, expect, beforeEach } from 'vitest';
import { PolicyEngine } from '../src/safety/policyEngine.js';
import { FocusState } from '../src/types.js';

describe('PolicyEngine - Deterministic Authorization Rules', () => {
  let policyEngine: PolicyEngine;
  let sampleFocusState: FocusState;

  beforeEach(() => {
    policyEngine = new PolicyEngine();
    sampleFocusState = {
      sessionId: 'focus-test-1',
      objective: 'Writing Research Paper',
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
  });

  it('permits delivery deflection when autoDeflectDeliveries is true and ring_quick_reply is allowed', () => {
    const result = policyEngine.validateAction(
      'DEFLECT_RING_PRESET',
      'ring_doorbell',
      2,
      false,
      undefined,
      sampleFocusState,
      'delivery'
    );

    expect(result.isAuthorized).toBe(true);
    expect(result.finalAction).toBe('DEFLECT_RING_PRESET');
    expect(result.targetDevice).toBe('ring_doorbell');
    expect(result.downgraded).toBe(false);
  });

  it('downgrades ring spoken deflection to silent queue if ring_quick_reply is not allowed', () => {
    sampleFocusState.allowedResponses = ['silent_queue'];

    const result = policyEngine.validateAction(
      'RING_SPOKEN_DEFLECTION',
      'ring_doorbell',
      3,
      false,
      undefined,
      sampleFocusState,
      'visitor'
    );

    expect(result.isAuthorized).toBe(false);
    expect(result.finalAction).toBe('SILENT_QUEUE');
    expect(result.targetDevice).toBe('none');
    expect(result.downgraded).toBe(true);
  });

  it('downgrades action requiring user approval when approval is not granted', () => {
    const result = policyEngine.validateAction(
      'RING_SPOKEN_DEFLECTION',
      'ring_doorbell',
      6,
      true, // requiresUserApproval
      false, // userApprovalGranted = false
      sampleFocusState,
      'visitor'
    );

    expect(result.isAuthorized).toBe(false);
    expect(result.finalAction).toBe('SILENT_QUEUE');
    expect(result.downgraded).toBe(true);
  });

  it('authorizes emergency breakthrough when urgencyScore is 10 and emergency_breakthrough is enabled', () => {
    sampleFocusState.allowedResponses = ['ring_quick_reply', 'silent_queue', 'emergency_breakthrough'];

    const result = policyEngine.validateAction(
      'ALLOW_BREAKTHROUGH',
      'alexa_speaker',
      10,
      false,
      undefined,
      sampleFocusState,
      'emergency'
    );

    expect(result.isAuthorized).toBe(true);
    expect(result.finalAction).toBe('ALLOW_BREAKTHROUGH');
    expect(result.targetDevice).toBe('alexa_speaker');
  });

  it('downgrades emergency breakthrough if not authorized in allowed responses and urgency is moderate', () => {
    sampleFocusState.allowedResponses = ['silent_queue'];

    const result = policyEngine.validateAction(
      'ALLOW_BREAKTHROUGH',
      'alexa_speaker',
      7,
      false,
      undefined,
      sampleFocusState,
      'visitor'
    );

    expect(result.isAuthorized).toBe(false);
    expect(result.finalAction).toBe('SILENT_QUEUE');
    expect(result.downgraded).toBe(true);
  });
});
