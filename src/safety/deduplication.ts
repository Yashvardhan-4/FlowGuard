import { DeflectionExecutionResult } from '../types.js';
import { Logger } from '../logger.js';

const log = new Logger('DeduplicationTracker');

interface CachedExecution {
  result: DeflectionExecutionResult;
  processedAt: number;
}

export class DeduplicationTracker {
  private cache: Map<string, CachedExecution> = new Map();
  private ttlMs: number;

  constructor(ttlMinutes: number = 15) {
    this.ttlMs = ttlMinutes * 60 * 1000;
  }

  isDuplicate(eventId: string): boolean {
    this.pruneExpired();
    return this.cache.has(eventId);
  }

  getCachedResult(eventId: string): DeflectionExecutionResult | null {
    this.pruneExpired();
    const entry = this.cache.get(eventId);
    if (entry) {
      log.info('Duplicate event detected and deduplicated', { eventId });
      return entry.result;
    }
    return null;
  }

  recordExecution(eventId: string, result: DeflectionExecutionResult): void {
    this.pruneExpired();
    this.cache.set(eventId, {
      result,
      processedAt: Date.now(),
    });
  }

  private pruneExpired(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.processedAt > this.ttlMs) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

export const deduplicationTracker = new DeduplicationTracker();
