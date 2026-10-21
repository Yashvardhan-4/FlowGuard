import React from 'react';
import { Cpu, ShieldAlert, CheckCircle, Volume2, ShieldCheck, Check, X, AlertCircle } from 'lucide-react';
import { ArbitrationProposal, DeflectionResult } from '../api.js';

interface ArbitrationPanelProps {
  proposal: ArbitrationProposal | null;
  lastExecution: DeflectionResult | null;
  onExecute: (userApprovalGranted?: boolean) => Promise<void>;
  isExecuting: boolean;
}

export const ArbitrationPanel: React.FC<ArbitrationPanelProps> = ({
  proposal,
  lastExecution,
  onExecute,
  isExecuting,
}) => {
  if (!proposal) {
    return (
      <div className="surface-card" style={{ minHeight: '260px', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          <Cpu size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
          <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>Arbitration Engine Idle</div>
          <div style={{ fontSize: '0.75rem', maxWidth: '280px', marginTop: '4px' }}>
            Trigger a simulated interruption from the center above to see Bedrock AI reasoning and deterministic policy evaluation in real time.
          </div>
        </div>
      </div>
    );
  }

  const getUrgencyBadge = (score: number) => {
    if (score >= 8) return <span className="badge badge-red">CRITICAL ({score}/10)</span>;
    if (score >= 5) return <span className="badge badge-amber">ELEVATED ({score}/10)</span>;
    return <span className="badge badge-emerald">LOW ({score}/10)</span>;
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'DEFLECT_RING_PRESET':
        return <span className="badge badge-emerald">RING PRESET DEFLECTION</span>;
      case 'RING_SPOKEN_DEFLECTION':
        return <span className="badge badge-blue">RING SPOKEN DEFLECTION</span>;
      case 'ALLOW_BREAKTHROUGH':
        return <span className="badge badge-red">EMERGENCY BREAKTHROUGH</span>;
      case 'SILENT_QUEUE':
        return <span className="badge badge-purple">SILENT POST-FOCUS QUEUE</span>;
      default:
        return <span className="badge badge-neutral">{action}</span>;
    }
  };

  return (
    <div className="surface-card">
      <div className="surface-card-header">
        <div className="card-title">
          <Cpu size={16} color="var(--accent-ai-light)" />
          <span>AI Arbitration & Policy Boundary</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {getUrgencyBadge(proposal.urgencyScore)}
          <span className="badge badge-neutral font-mono">{proposal.modelUsed.split(':').pop()}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {/* Step 1: AI Recommendation */}
        <div
          style={{
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent-ai-light)', letterSpacing: '0.04em' }}>
            1. Bedrock AI Recommendation
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Proposed Action:</div>
            <div style={{ marginTop: '2px' }}>{getActionBadge(proposal.action)}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Target Device:</div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {proposal.targetDevice}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>AI Rationale:</div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
              {proposal.internalReason}
            </div>
          </div>
        </div>

        {/* Step 2: Deterministic Policy Boundary */}
        <div
          style={{
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent-focus)', letterSpacing: '0.04em' }}>
            2. Deterministic Policy Boundary
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Approval Constraint:</div>
            <div style={{ marginTop: '2px' }}>
              {proposal.requiresUserApproval ? (
                <span className="badge badge-amber">EXPLICIT APPROVAL REQUIRED</span>
              ) : (
                <span className="badge badge-emerald">PRE-AUTHORIZED BY POLICY</span>
              )}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Privacy Audit:</div>
            <div style={{ marginTop: '2px' }}>
              {proposal.privacyAuditPassed ? (
                <span className="badge badge-emerald">
                  <ShieldCheck size={12} /> ZERO LEAKAGE
                </span>
              ) : (
                <span className="badge badge-purple">
                  <ShieldAlert size={12} /> SANITIZED BY GUARD
                </span>
              )}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Application Guard:</div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
              App enforces allowedResponses and blocks unapproved external transmissions.
            </div>
          </div>
        </div>
      </div>

      {/* Spoken Response Preview */}
      {proposal.spokenResponseToVisitor && (
        <div
          style={{
            background: 'var(--bg-surface-subtle)',
            border: '1px solid var(--border-muted)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
          }}
        >
          <Volume2 size={16} color="var(--accent-deflect)" style={{ marginTop: '2px', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Outdoor Speaker Audio (Simulated Ring Doorbell):
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontStyle: 'italic', marginTop: '2px' }}>
              "{proposal.spokenResponseToVisitor}"
            </div>
          </div>
        </div>
      )}

      {/* Interactive Execution Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '4px' }}>
        {proposal.requiresUserApproval ? (
          <>
            <button
              type="button"
              className="btn btn-accent-emerald"
              onClick={() => onExecute(true)}
              disabled={isExecuting}
              style={{ flex: 1 }}
            >
              <Check size={15} />
              <span>Grant Approval & Execute</span>
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => onExecute(false)}
              disabled={isExecuting}
              style={{ flex: 1 }}
            >
              <X size={15} />
              <span>Deny / Hold in Silent Queue</span>
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn btn-accent-emerald"
            onClick={() => onExecute(true)}
            disabled={isExecuting}
            style={{ width: '100%' }}
          >
            <CheckCircle size={15} />
            <span>Execute Deflection via MCP Tool</span>
          </button>
        )}
      </div>

      {/* Last Execution Outcome Alert */}
      {lastExecution && lastExecution.eventId === proposal.eventId && (
        <div
          style={{
            marginTop: '4px',
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            background:
              lastExecution.status === 'EXECUTED'
                ? 'rgba(16, 185, 129, 0.1)'
                : lastExecution.status === 'DUPLICATE_IGNORED'
                ? 'rgba(245, 158, 11, 0.1)'
                : 'rgba(239, 68, 68, 0.1)',
            border: '1px solid',
            borderColor:
              lastExecution.status === 'EXECUTED'
                ? 'rgba(16, 185, 129, 0.3)'
                : lastExecution.status === 'DUPLICATE_IGNORED'
                ? 'rgba(245, 158, 11, 0.3)'
                : 'rgba(239, 68, 68, 0.3)',
            fontSize: '0.78rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>
            <strong>Result:</strong> {lastExecution.explanation}
          </span>
          <span className="badge badge-neutral font-mono">{lastExecution.status}</span>
        </div>
      )}
    </div>
  );
};
