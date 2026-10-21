import { Logger } from '../logger.js';

const log = new Logger('PrivacyGuard');

const SAFE_DEFAULT_VISITOR_RESPONSES = {
  delivery: 'Please leave the package by the door. Thank you!',
  visitor: 'The resident is currently unavailable. Please leave a message or reach out by phone.',
  sales: 'We are not interested at this time. Thank you, have a good day.',
  general: 'The resident is currently unavailable. Please leave any items at the front door.',
};

/**
 * Stop words excluded from objective keyword matching.
 */
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'by', 'from', 'up', 'about', 'into', 'over', 'after', 'is', 'are', 'was',
  'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
  'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might', 'must',
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'my', 'your', 'his', 'her',
  'its', 'our', 'their', 'work', 'working', 'session', 'time', 'focus',
]);

export interface PrivacyAuditResult {
  isSafe: boolean;
  sanitizedResponse?: string;
  violationsDetected: string[];
  originalText?: string;
}

export class PrivacyGuard {
  /**
   * Extracts meaningful keywords and sensitive phrases from a focus objective.
   */
  private extractObjectiveTokens(objective: string): string[] {
    const rawTokens = objective
      .toLowerCase()
      .replace(/[^a-z0-9\s-_]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

    return Array.from(new Set(rawTokens));
  }

  /**
   * Audits and sanitizes a visitor-facing response to ensure zero leakage of private focus context.
   */
  auditVisitorResponse(
    proposedResponse: string | undefined,
    focusObjective: string,
    category: string,
    privacyMode: boolean = true
  ): PrivacyAuditResult {
    if (!proposedResponse || proposedResponse.trim().length === 0) {
      return { isSafe: true, violationsDetected: [] };
    }

    const violations: string[] = [];
    const normalizedResponse = proposedResponse.toLowerCase();

    // 1. Check for objective keyword leakage if privacyMode is active
    if (privacyMode && focusObjective) {
      const objectiveTokens = this.extractObjectiveTokens(focusObjective);
      for (const token of objectiveTokens) {
        // Match word boundaries so we don't trigger on substrings
        const regex = new RegExp(`\\b${token}\\b`, 'i');
        if (regex.test(normalizedResponse)) {
          violations.push(`leaked_objective_term:${token}`);
        }
      }

      // Exact substring check if objective is short
      if (objectiveTokens.length > 1) {
        const fullObjectiveClean = focusObjective.toLowerCase().trim();
        if (normalizedResponse.includes(fullObjectiveClean)) {
          violations.push('leaked_full_objective');
        }
      }
    }

    // 2. Check for generic privacy-violating phrases (e.g. "is in a deep work session working on...")
    const forbiddenPhrases = [
      'deep work session on',
      'working on',
      'focus objective is',
      'calendar shows',
      'is busy working on',
      'busy with',
      'confidential',
      'board meeting',
      'financial model',
    ];

    for (const phrase of forbiddenPhrases) {
      if (normalizedResponse.includes(phrase)) {
        violations.push(`forbidden_phrase:${phrase}`);
      }
    }

    if (violations.length > 0) {
      log.warn('Privacy breach detected in proposed visitor response! Sanitizing to neutral response.', {
        violations,
        originalSnippet: proposedResponse.slice(0, 40),
      });

      const fallback =
        SAFE_DEFAULT_VISITOR_RESPONSES[category as keyof typeof SAFE_DEFAULT_VISITOR_RESPONSES] ||
        SAFE_DEFAULT_VISITOR_RESPONSES.general;

      return {
        isSafe: false,
        sanitizedResponse: fallback,
        violationsDetected: violations,
        originalText: proposedResponse,
      };
    }

    return {
      isSafe: true,
      sanitizedResponse: proposedResponse,
      violationsDetected: [],
      originalText: proposedResponse,
    };
  }
}

export const privacyGuard = new PrivacyGuard();
