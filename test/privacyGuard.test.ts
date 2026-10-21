import { describe, it, expect } from 'vitest';
import { PrivacyGuard } from '../src/safety/privacyGuard.js';

describe('PrivacyGuard - Sensitive Focus Context Leakage Prevention', () => {
  const privacyGuard = new PrivacyGuard();
  const sensitiveObjective = 'Writing Confidential Q3 Merger Agreement';

  it('allows safe, neutral delivery drop-off response', () => {
    const input = 'Please leave the package by the door. Thank you!';
    const result = privacyGuard.auditVisitorResponse(input, sensitiveObjective, 'delivery', true);

    expect(result.isSafe).toBe(true);
    expect(result.sanitizedResponse).toBe(input);
    expect(result.violationsDetected).toHaveLength(0);
  });

  it('detects and sanitizes response that leaks specific objective keyword (e.g. merger)', () => {
    const input = 'The resident is in a meeting discussing the merger agreement right now.';
    const result = privacyGuard.auditVisitorResponse(input, sensitiveObjective, 'visitor', true);

    expect(result.isSafe).toBe(false);
    expect(result.sanitizedResponse).toContain('The resident is currently unavailable');
    expect(result.violationsDetected.some((v) => v.includes('merger'))).toBe(true);
  });

  it('detects and sanitizes forbidden phrases like "working on" or "confidential"', () => {
    const input = 'User is busy working on confidential documents.';
    const result = privacyGuard.auditVisitorResponse(input, 'General Work', 'visitor', true);

    expect(result.isSafe).toBe(false);
    expect(result.violationsDetected.length).toBeGreaterThan(0);
    expect(result.sanitizedResponse).toBeDefined();
  });

  it('returns safe when input is empty or undefined', () => {
    const result = privacyGuard.auditVisitorResponse(undefined, sensitiveObjective, 'visitor', true);
    expect(result.isSafe).toBe(true);
  });

  it('substitutes appropriate category fallback for delivery', () => {
    const input = 'Can you leave the merger document?';
    const result = privacyGuard.auditVisitorResponse(input, sensitiveObjective, 'delivery', true);

    expect(result.isSafe).toBe(false);
    expect(result.sanitizedResponse).toBe('Please leave the package by the door. Thank you!');
  });
});
