import React, { useState, useEffect } from 'react';
import { Target, Clock, ShieldCheck, CheckSquare, Square, VolumeX, Eye } from 'lucide-react';
import { FocusSession } from '../api.js';

interface FocusWorkspaceProps {
  activeSession: FocusSession | null;
  onSetFocus: (data: {
    objective: string;
    durationMinutes: number;
    interruptionPolicy: string;
    allowedResponses: string[];
    autoDeflectDeliveries: boolean;
    privacyMode: boolean;
  }) => Promise<void>;
  onEndFocus: () => Promise<void>;
  isLoading: boolean;
}

export const FocusWorkspace: React.FC<FocusWorkspaceProps> = ({
  activeSession,
  onSetFocus,
  onEndFocus,
  isLoading,
}) => {
  const [objective, setObjective] = useState('Executive Board Financial Modeling & Strategy');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [interruptionPolicy, setInterruptionPolicy] = useState('urgent_only');
  const [allowedResponses, setAllowedResponses] = useState<string[]>([
    'ring_quick_reply',
    'silent_queue',
  ]);
  const [autoDeflectDeliveries, setAutoDeflectDeliveries] = useState(true);
  const [privacyMode, setPrivacyMode] = useState(true);

  // Sync state if session exists
  useEffect(() => {
    if (activeSession) {
      setObjective(activeSession.objective);
      setDurationMinutes(activeSession.durationMinutes);
      setInterruptionPolicy(activeSession.interruptionPolicy);
      setAllowedResponses(activeSession.allowedResponses);
      setAutoDeflectDeliveries(activeSession.autoDeflectDeliveries);
      setPrivacyMode(activeSession.privacyMode);
    }
  }, [activeSession]);

  // Timer countdown calculation
  const [timeLeft, setTimeLeft] = useState<{ minutes: number; seconds: number; isExpired: boolean }>({
    minutes: 45,
    seconds: 0,
    isExpired: false,
  });

  useEffect(() => {
    if (!activeSession || !activeSession.isActive) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const end = new Date(activeSession.endTime).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft({ minutes: 0, seconds: 0, isExpired: true });
      } else {
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setTimeLeft({ minutes: mins, seconds: secs, isExpired: false });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeSession]);

  const toggleResponse = (action: string) => {
    if (allowedResponses.includes(action)) {
      if (allowedResponses.length > 1) {
        setAllowedResponses(allowedResponses.filter((a) => a !== action));
      }
    } else {
      setAllowedResponses([...allowedResponses, action]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSetFocus({
      objective,
      durationMinutes,
      interruptionPolicy,
      allowedResponses,
      autoDeflectDeliveries,
      privacyMode,
    });
  };

  return (
    <div className="surface-card">
      <div className="surface-card-header">
        <div className="card-title">
          <Target size={16} color="var(--accent-focus)" />
          <span>Focus Workspace</span>
        </div>
        {activeSession?.isActive ? (
          <span className="badge badge-amber">SESSION ACTIVE</span>
        ) : (
          <span className="badge badge-neutral">STANDBY</span>
        )}
      </div>

      {/* Timer Hero if Active */}
      {activeSession?.isActive && (
        <div className="timer-hero">
          <div className="timer-digits tabular-nums">
            {String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}
          </div>
          <div className="timer-subtext">
            Scheduled until {new Date(activeSession.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Objective Input */}
        <div className="form-group">
          <label className="form-label" htmlFor="focus-objective">
            Focus Objective
          </label>
          <input
            id="focus-objective"
            type="text"
            className="form-input"
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            placeholder="e.g., Designing Core Database Architecture"
            required
          />
        </div>

        {/* Duration selector */}
        <div className="form-group">
          <label className="form-label" htmlFor="duration-select">
            Session Duration
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
            {[25, 45, 60, 90].map((d) => (
              <button
                key={d}
                type="button"
                className={`btn btn-sm ${durationMinutes === d ? 'btn-accent-amber' : 'btn-secondary'}`}
                onClick={() => setDurationMinutes(d)}
              >
                {d}m
              </button>
            ))}
          </div>
        </div>

        {/* Interruption Policy */}
        <div className="form-group">
          <label className="form-label" htmlFor="policy-select">
            Interruption Tolerance Policy
          </label>
          <select
            id="policy-select"
            className="form-select"
            value={interruptionPolicy}
            onChange={(e) => setInterruptionPolicy(e.target.value)}
          >
            <option value="urgent_only">Urgent Only (Recommended: Auto-deflect standard events)</option>
            <option value="emergency_only">Emergency Only (Maximum strictness: Smoke/Medical only)</option>
            <option value="allow_family">Allow Family (Breakthrough for verified family members)</option>
            <option value="lenient">Lenient (Permit standard visitors with screening)</option>
          </select>
        </div>

        {/* Allowed Response Channels */}
        <div className="form-group">
          <label className="form-label">Permitted Deflection Actions</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {[
              { id: 'ring_quick_reply', label: 'Ring Doorbell Quick Reply', desc: 'Simulated outdoor speaker audio' },
              { id: 'silent_queue', label: 'Silent Post-Focus Queue', desc: 'Held in digest without pinging user' },
              { id: 'alexa_spoken_response', label: 'Alexa Echo Announcement', desc: 'Indoor TTS for permitted breakthroughs' },
              { id: 'emergency_breakthrough', label: 'Emergency Breakthrough', desc: 'Authorized for smoke/fire/medical' },
            ].map((action) => {
              const isChecked = allowedResponses.includes(action.id);
              return (
                <div
                  key={action.id}
                  onClick={() => toggleResponse(action.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: isChecked ? 'var(--bg-surface-elevated)' : 'transparent',
                    border: '1px solid',
                    borderColor: isChecked ? 'var(--border-focus)' : 'var(--border-muted)',
                    cursor: 'pointer',
                  }}
                >
                  {isChecked ? (
                    <CheckSquare size={16} color="var(--accent-ai-light)" />
                  ) : (
                    <Square size={16} color="var(--text-muted)" />
                  )}
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600 }}>{action.label}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{action.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Safe Preauthorizations */}
        <div className="toggle-row">
          <div>
            <div className="toggle-label">Auto-Deflect Deliveries</div>
            <div className="toggle-desc">Permit Ring drop-off reply without asking</div>
          </div>
          <input
            type="checkbox"
            checked={autoDeflectDeliveries}
            onChange={(e) => setAutoDeflectDeliveries(e.target.checked)}
            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
          />
        </div>

        <div className="toggle-row">
          <div>
            <div className="toggle-label">Privacy Guardrail</div>
            <div className="toggle-desc">Redact objective details from visitor audio</div>
          </div>
          <input
            type="checkbox"
            checked={privacyMode}
            onChange={(e) => setPrivacyMode(e.target.checked)}
            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
          />
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
          <button
            type="submit"
            className="btn btn-accent-amber"
            style={{ flex: 1 }}
            disabled={isLoading}
          >
            <ShieldCheck size={16} />
            <span>{activeSession?.isActive ? 'Update Policy' : 'Activate Deep Work'}</span>
          </button>

          {activeSession?.isActive && (
            <button
              type="button"
              className="btn btn-danger"
              onClick={onEndFocus}
              disabled={isLoading}
              title="End active session and view post-focus summary"
            >
              End Focus
            </button>
          )}
        </div>
      </form>
    </div>
  );
};
