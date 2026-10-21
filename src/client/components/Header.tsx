import React from 'react';
import { Shield, Play, RotateCcw, Sparkles, AlertTriangle, EyeOff } from 'lucide-react';
import { SystemHealth } from '../api.js';

interface HeaderProps {
  health: SystemHealth | null;
  onRunScenario: (scenario: 'delivery_happy_path' | 'approval_denied_flow' | 'privacy_attack_mitigated') => void;
  onReset: () => void;
  isRunningScenario: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  health,
  onRunScenario,
  onReset,
  isRunningScenario,
}) => {
  const isLiveBedrock = health?.bedrock?.mode === 'LIVE_AWS_BEDROCK';

  return (
    <header className="top-bar">
      <div className="logo-group">
        <div className="logo-icon">
          <Shield size={20} />
        </div>
        <div className="brand-text">
          <h1>
            FlowGuard
            <span className="brand-tag">Alexa+ Agent</span>
          </h1>
        </div>
      </div>

      <div className="system-status-pills">
        {/* Reasoning Mode Pill */}
        <div className="status-pill" title={`Region: ${health?.bedrock?.region || 'us-east-1'}, Model: ${health?.bedrock?.modelId || 'Claude 3.5'}`}>
          <div className={`status-indicator-dot ${isLiveBedrock ? 'dot-blue' : 'dot-amber'}`} />
          <span>
            {isLiveBedrock ? 'Live AWS Bedrock' : 'AWS Bedrock (Deterministic Fallback)'}
          </span>
        </div>

        {/* MCP Server Spec Pill */}
        <div className="status-pill" title="Protocol version 2025-11-25 over Streamable HTTP (SSE)">
          <div className="status-indicator-dot dot-green" />
          <span>MCP Server (2025-11-25)</span>
        </div>

        {/* Explicit Hardware Simulation Label */}
        <div className="status-pill" title="Hardware is explicitly simulated in application code for development and testing">
          <span style={{ color: 'var(--text-muted)' }}>Hardware:</span>
          <span style={{ color: 'var(--accent-focus)' }}>Simulated Ring & Alexa</span>
        </div>
      </div>

      <div className="top-actions">
        {/* One-Click Demo 1 */}
        <button
          className="btn btn-primary btn-sm"
          onClick={() => onRunScenario('delivery_happy_path')}
          disabled={isRunningScenario}
          title="Run 45-min focus + Ring Amazon delivery + Bedrock arbitration + auto-deflection + duplicate prevention"
        >
          <Play size={14} />
          <span>Demo 1: Delivery Deflection</span>
        </button>

        {/* One-Click Demo 2 */}
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => onRunScenario('approval_denied_flow')}
          disabled={isRunningScenario}
          title="Run scenario where policy denies outdoor speaker and requires approval"
        >
          <AlertTriangle size={14} color="#f59e0b" />
          <span>Demo 2: Policy Denial</span>
        </button>

        {/* One-Click Demo 3 */}
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => onRunScenario('privacy_attack_mitigated')}
          disabled={isRunningScenario}
          title="Simulate visitor attempting to extract private focus objective"
        >
          <EyeOff size={14} color="#a855f7" />
          <span>Demo 3: Privacy Shield</span>
        </button>

        {/* Reset */}
        <button
          className="btn btn-secondary btn-sm"
          onClick={onReset}
          disabled={isRunningScenario}
          title="Reset session state, cache, and reminders"
        >
          <RotateCcw size={14} />
          <span>Reset</span>
        </button>
      </div>
    </header>
  );
};
