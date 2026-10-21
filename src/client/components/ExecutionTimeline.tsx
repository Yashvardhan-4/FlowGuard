import React from 'react';
import { History, BellOff, Volume2, ShieldCheck, AlertCircle, CopyCheck } from 'lucide-react';
import { AuditLogEntry, SessionSummary } from '../api.js';

interface ExecutionTimelineProps {
  logs: AuditLogEntry[];
  summary: SessionSummary | null;
}

export const ExecutionTimeline: React.FC<ExecutionTimelineProps> = ({ logs, summary }) => {
  const chimeMuted = summary?.hardwareState?.ringChimeMuted ?? false;

  const getStatusClass = (eventType: string, details: any) => {
    if (eventType === 'SECURITY_BLOCKED') return 'status-rejected';
    if (details?.executionStatus === 'DUPLICATE_IGNORED') return 'status-duplicate';
    if (details?.executionStatus === 'REJECTED_UNAUTHORIZED') return 'status-rejected';
    if (details?.executionStatus === 'QUEUED_SILENTLY') return 'status-queued';
    if (eventType === 'DEFLECTION_EXECUTED') return 'status-executed';
    return '';
  };

  return (
    <div className="surface-card">
      <div className="surface-card-header">
        <div className="card-title">
          <History size={16} color="var(--accent-ai-light)" />
          <span>Execution Timeline & Hardware</span>
        </div>
        <span className="badge badge-neutral">{logs.length} Events</span>
      </div>

      {/* Simulated Hardware Status Box */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div
          style={{
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <BellOff size={16} color={chimeMuted ? 'var(--accent-focus)' : 'var(--text-muted)'} />
          <div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Ring Indoor Chime
            </div>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: chimeMuted ? 'var(--accent-focus)' : 'var(--text-secondary)' }}>
              {chimeMuted ? 'MUTED (Flow Protected)' : 'ACTIVE (Standard)'}
            </div>
          </div>
        </div>

        <div
          style={{
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Volume2 size={16} color="var(--accent-deflect)" />
          <div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Outdoor Speaker
            </div>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Simulated Doorbell
            </div>
          </div>
        </div>
      </div>

      {/* Reverse chronological stream */}
      <div className="timeline-list">
        {logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
            No executions logged yet. Start a session or trigger a demo event.
          </div>
        ) : (
          [...logs].reverse().map((entry) => {
            const time = new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const d = entry.details as any;
            return (
              <div key={entry.id} className={`timeline-item ${getStatusClass(entry.eventType, d)}`}>
                <div className="timeline-item-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="badge badge-neutral font-mono">{entry.eventType}</span>
                    {d?.executionStatus && (
                      <span
                        className={`badge ${
                          d.executionStatus === 'EXECUTED'
                            ? 'badge-emerald'
                            : d.executionStatus === 'DUPLICATE_IGNORED'
                            ? 'badge-amber'
                            : 'badge-red'
                        }`}
                      >
                        {d.executionStatus}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {time}
                  </span>
                </div>

                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                  {d?.policyExplanation || d?.proposalAction || d?.objective || JSON.stringify(d)}
                </div>

                {d?.simulatedHardware?.ringDispatched && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--accent-deflect)', fontStyle: 'italic' }}>
                    Spoke to visitor: "{d.simulatedHardware.ringDispatched.quickReplyText}"
                  </div>
                )}

                {d?.privacySanitized && (
                  <div style={{ fontSize: '0.7rem', color: 'var(--accent-privacy)', fontWeight: 600 }}>
                    🛡️ Privacy guard redacted sensitive focus context from visitor audio
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
