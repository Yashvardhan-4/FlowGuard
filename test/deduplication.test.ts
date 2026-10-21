import { describe, it, expect, beforeEach } from 'vitest';
import { DeduplicationTracker } from '../src/safety/deduplication.js';
import { DeflectionExecutionResult } from '../src/types.js';

describe('DeduplicationTracker - Idempotency & Repeat Event Prevention', () => {
  let tracker: DeduplicationTracker;

  beforeEach(() => {
    tracker = new DeduplicationTracker(15);
  });

  it('correctly tracks and detects duplicate events', () => {
    const eventId = 'ring-evt-123';
    expect(tracker.isDuplicate(eventId)).toBe(false);

    const mockResult: DeflectionExecutionResult = {
      eventId,
      status: 'EXECUTED',
      actionTaken: 'DEFLECT_RING_PRESET',
      simulatedHardware: {
        ringDispatched: {
          quickReplyText: 'Please leave the package by the door. Thank you!',
          deliveredAt: new Date().toISOString(),
          simulated: true,
        },
      },
      auditLogId: 'audit-1',
      timestamp: new Date().toISOString(),
      explanation: 'Preauthorized deflection',
      privacySanitized: false,
    };

    tracker.recordExecution(eventId, mockResult);
    expect(tracker.isDuplicate(eventId)).toBe(true);

    const cached = tracker.getCachedResult(eventId);
    expect(cached).not.toBeNull();
    expect(cached?.actionTaken).toBe('DEFLECT_RING_PRESET');
    expect(cached?.simulatedHardware.ringDispatched?.quickReplyText).toBe(
      'Please leave the package by the door. Thank you!'
    );
  });

  it('distinguishes between different event IDs', () => {
    tracker.recordExecution('evt-a', {
      eventId: 'evt-a',
      status: 'EXECUTED',
      actionTaken: 'SILENT_QUEUE',
      simulatedHardware: {},
      auditLogId: 'audit-a',
      timestamp: new Date().toISOString(),
      explanation: 'test',
      privacySanitized: false,
    });

    expect(tracker.isDuplicate('evt-a')).toBe(true);
    expect(tracker.isDuplicate('evt-b')).toBe(false);
  });
});
