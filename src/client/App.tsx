import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header.js';
import { FocusWorkspace } from './components/FocusWorkspace.js';
import { InterruptionCenter } from './components/InterruptionCenter.js';
import { ArbitrationPanel } from './components/ArbitrationPanel.js';
import { ExecutionTimeline } from './components/ExecutionTimeline.js';
import { PostFocusQueue } from './components/PostFocusQueue.js';
import {
  api,
  SystemHealth,
  SessionSummary,
  ArbitrationProposal,
  DeflectionResult,
  InterruptionEvent,
} from './api.js';

export const App: React.FC = () => {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [currentProposal, setCurrentProposal] = useState<ArbitrationProposal | null>(null);
  const [lastExecution, setLastExecution] = useState<DeflectionResult | null>(null);
  const [lastEventId, setLastEventId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingInterruption, setIsProcessingInterruption] = useState(false);
  const [isRunningScenario, setIsRunningScenario] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 5000);
  };

  const refreshState = useCallback(async () => {
    try {
      const [h, s] = await Promise.all([api.getHealth(), api.getSummary()]);
      setHealth(h);
      setSummary(s);
    } catch (err) {
      console.error('Failed to refresh state:', err);
    }
  }, []);

  useEffect(() => {
    refreshState();
    const interval = setInterval(refreshState, 4000);
    return () => clearInterval(interval);
  }, [refreshState]);

  // Focus actions
  const handleSetFocus = async (data: {
    objective: string;
    durationMinutes: number;
    interruptionPolicy: string;
    allowedResponses: string[];
    autoDeflectDeliveries: boolean;
    privacyMode: boolean;
  }) => {
    setIsLoading(true);
    try {
      const res = await api.setFocus(data);
      showToast(`Deep work session activated: "${res.session.objective}" (${res.session.durationMinutes}m)`);
      await refreshState();
    } catch (err) {
      showToast(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEndFocus = async () => {
    setIsLoading(true);
    try {
      await api.clearFocus();
      showToast('Focus session concluded. Summary ready in Post-Focus Queue.');
      await refreshState();
    } catch (err) {
      showToast(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Interruption trigger & arbitration
  const handleTriggerEvent = async (event: InterruptionEvent) => {
    setIsProcessingInterruption(true);
    setLastEventId(event.eventId);
    try {
      showToast(`Simulated ${event.source} event dispatched (${event.category})`);
      const proposal = await api.arbitrate(event);
      setCurrentProposal(proposal);
      await refreshState();
    } catch (err) {
      showToast(`Arbitration error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsProcessingInterruption(false);
    }
  };

  // Deflection execution
  const handleExecute = async (userApprovalGranted?: boolean) => {
    if (!currentProposal) return;
    setIsLoading(true);
    try {
      const result = await api.executeDeflection({
        eventId: currentProposal.eventId,
        proposedAction: {
          action: currentProposal.action,
          targetDevice: currentProposal.targetDevice,
          spokenResponseToVisitor: currentProposal.spokenResponseToVisitor,
          internalReason: currentProposal.internalReason,
          urgencyScore: currentProposal.urgencyScore,
          requiresUserApproval: currentProposal.requiresUserApproval,
        },
        userApprovalGranted,
        category: 'delivery',
      });

      setLastExecution(result);
      showToast(`Deflection executed: ${result.status} (${result.actionTaken})`);
      await refreshState();
    } catch (err) {
      showToast(`Execution error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Acknowledge reminder
  const handleAcknowledgeReminder = async (id: string) => {
    try {
      await api.acknowledgeReminder(id);
      await refreshState();
    } catch (err) {
      showToast(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Pre-packaged scenarios
  const handleRunScenario = async (scenario: 'delivery_happy_path' | 'approval_denied_flow' | 'privacy_attack_mitigated') => {
    setIsRunningScenario(true);
    showToast(`Executing scenario: ${scenario}...`);
    try {
      const result = await api.runScenario(scenario);
      setCurrentProposal(result.proposal);
      setLastExecution(result.execution);
      setLastEventId(result.interruption?.eventId || null);
      await refreshState();
      showToast(`Scenario "${scenario}" completed successfully!`);
    } catch (err) {
      showToast(`Scenario error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsRunningScenario(false);
    }
  };

  // Reset
  const handleReset = async () => {
    setIsLoading(true);
    try {
      await api.resetSystem();
      setCurrentProposal(null);
      setLastExecution(null);
      setLastEventId(null);
      showToast('System state, silent queue, and deduplication cache cleared.');
      await refreshState();
    } catch (err) {
      showToast(`Reset error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-container">
      <Header
        health={health}
        onRunScenario={handleRunScenario}
        onReset={handleReset}
        isRunningScenario={isRunningScenario}
      />

      {toastMessage && (
        <div className="toast-bar" style={{ marginTop: '12px' }}>
          <span>{toastMessage}</span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setToastMessage(null)}
            style={{ padding: '2px 8px' }}
          >
            ✕
          </button>
        </div>
      )}

      <main className="dashboard-grid">
        {/* Left Column: Focus Workspace */}
        <section aria-label="Focus Workspace">
          <FocusWorkspace
            activeSession={summary?.activeFocusSession || null}
            onSetFocus={handleSetFocus}
            onEndFocus={handleEndFocus}
            isLoading={isLoading}
          />
        </section>

        {/* Center Column: Live Interruption Center & AI Arbitration Panel */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} aria-label="Interruption & AI Arbitration Center">
          <InterruptionCenter
            onTriggerEvent={handleTriggerEvent}
            isProcessing={isProcessingInterruption}
            lastEventId={lastEventId}
          />

          <ArbitrationPanel
            proposal={currentProposal}
            lastExecution={lastExecution}
            onExecute={handleExecute}
            isExecuting={isLoading}
          />
        </section>

        {/* Right Column: Execution Timeline, Hardware State & Post-Focus Queue */}
        <section className="right-col" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} aria-label="Hardware & Execution Timeline">
          <ExecutionTimeline
            logs={summary?.recentAuditLogs || []}
            summary={summary}
          />

          <PostFocusQueue
            reminders={summary?.pendingPostFocusReminders || []}
            onAcknowledge={handleAcknowledgeReminder}
          />
        </section>
      </main>
    </div>
  );
};
