import { randomUUID } from 'crypto';
import {
  FocusState,
  SetFocusStateInput,
  SilentReminder,
  AuditLogEntry,
} from '../types.js';
import { Logger } from '../logger.js';

const log = new Logger('FocusStateManager');

export class FocusStateManager {
  private activeFocus: FocusState | null = null;
  private silentReminders: SilentReminder[] = [];
  private auditLogs: AuditLogEntry[] = [];

  /**
   * Sets or updates the active deep-work focus state.
   */
  setFocus(input: SetFocusStateInput): FocusState {
    const now = new Date();
    const durationMs = input.durationMinutes * 60 * 1000;
    const endTime = new Date(now.getTime() + durationMs);

    const session: FocusState = {
      sessionId: `focus-${randomUUID().slice(0, 8)}`,
      objective: input.objective,
      startTime: now.toISOString(),
      endTime: endTime.toISOString(),
      durationMinutes: input.durationMinutes,
      interruptionPolicy: input.interruptionPolicy,
      allowedResponses: input.allowedResponses,
      autoDeflectDeliveries: input.autoDeflectDeliveries,
      vipContacts: input.vipContacts,
      privacyMode: input.privacyMode,
      isActive: true,
      createdAt: now.toISOString(),
    };

    this.activeFocus = session;
    this.addAuditLog('FOCUS_SET', session.sessionId, {
      objective: session.objective,
      interruptionPolicy: session.interruptionPolicy,
      allowedResponses: session.allowedResponses,
      endTime: session.endTime,
    });

    log.info('Focus state established', {
      sessionId: session.sessionId,
      durationMinutes: session.durationMinutes,
      policy: session.interruptionPolicy,
    });

    return session;
  }

  /**
   * Returns active focus session if within active time window and marked active.
   */
  getActiveFocus(): FocusState | null {
    if (!this.activeFocus || !this.activeFocus.isActive) {
      return null;
    }

    const now = new Date();
    const endTime = new Date(this.activeFocus.endTime);

    if (now > endTime) {
      log.info('Focus session time expired', { sessionId: this.activeFocus.sessionId });
      this.activeFocus.isActive = false;
      return null;
    }

    return this.activeFocus;
  }

  clearFocus(): void {
    if (this.activeFocus) {
      log.info('Focus session cleared', { sessionId: this.activeFocus.sessionId });
      this.activeFocus.isActive = false;
      this.activeFocus = null;
    }
  }

  addSilentReminder(reminder: Omit<SilentReminder, 'id' | 'receivedAt' | 'reviewed'>): SilentReminder {
    const fullReminder: SilentReminder = {
      id: `rem-${randomUUID().slice(0, 8)}`,
      ...reminder,
      receivedAt: new Date().toISOString(),
      reviewed: false,
    };
    this.silentReminders.push(fullReminder);
    return fullReminder;
  }

  getPendingReminders(): SilentReminder[] {
    return this.silentReminders.filter((r) => !r.reviewed);
  }

  markReminderReviewed(id: string): boolean {
    const item = this.silentReminders.find((r) => r.id === id);
    if (item) {
      item.reviewed = true;
      return true;
    }
    return false;
  }

  addAuditLog(
    eventType: AuditLogEntry['eventType'],
    eventId: string,
    details: Record<string, unknown>
  ): AuditLogEntry {
    const entry: AuditLogEntry = {
      id: `audit-${randomUUID().slice(0, 8)}`,
      timestamp: new Date().toISOString(),
      eventId,
      eventType,
      details,
    };
    this.auditLogs.push(entry);
    return entry;
  }

  getAuditLogs(): AuditLogEntry[] {
    return [...this.auditLogs];
  }

  resetAll(): void {
    this.activeFocus = null;
    this.silentReminders = [];
    this.auditLogs = [];
  }
}

export const focusStateManager = new FocusStateManager();
