import React from 'react';
import { Inbox, CheckCircle2, Package, AlertTriangle, Users, HelpCircle, Check } from 'lucide-react';
import { SilentReminder } from '../api.js';

interface PostFocusQueueProps {
  reminders: SilentReminder[];
  onAcknowledge: (id: string) => Promise<void>;
}

export const PostFocusQueue: React.FC<PostFocusQueueProps> = ({ reminders, onAcknowledge }) => {
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'delivery':
        return <Package size={14} color="var(--accent-deflect)" />;
      case 'emergency':
        return <AlertTriangle size={14} color="var(--accent-emergency)" />;
      case 'family_member':
        return <Users size={14} color="var(--accent-ai-light)" />;
      default:
        return <HelpCircle size={14} color="var(--text-muted)" />;
    }
  };

  return (
    <div className="surface-card">
      <div className="surface-card-header">
        <div className="card-title">
          <Inbox size={16} color="var(--accent-deflect)" />
          <span>Post-Focus Queue & Debrief</span>
        </div>
        <span className={`badge ${reminders.length > 0 ? 'badge-amber' : 'badge-emerald'}`}>
          {reminders.length} PENDING
        </span>
      </div>

      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
        Held silently during deep work to avoid context switching. Review and dismiss when ready:
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '360px', overflowY: 'auto' }}>
        {reminders.length === 0 ? (
          <div
            style={{
              padding: '24px 16px',
              textAlign: 'center',
              background: 'var(--bg-surface-elevated)',
              borderRadius: 'var(--radius-sm)',
              border: '1px dashed var(--border-muted)',
              color: 'var(--text-muted)',
              fontSize: '0.78rem',
            }}
          >
            <CheckCircle2 size={24} style={{ margin: '0 auto 6px', color: 'var(--accent-deflect)' }} />
            <div>Zero Pending Interruptions</div>
            <div style={{ fontSize: '0.7rem', marginTop: '2px' }}>Your post-focus queue is clear!</div>
          </div>
        ) : (
          reminders.map((r) => {
            const time = new Date(r.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return (
              <div
                key={r.id}
                style={{
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flex: 1 }}>
                  <div style={{ marginTop: '2px' }}>{getCategoryIcon(r.category)}</div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="badge badge-neutral" style={{ fontSize: '0.65rem' }}>
                        {r.category.toUpperCase()}
                      </span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {time}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                      {r.headline}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                      {r.detail}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => onAcknowledge(r.id)}
                  title="Mark as reviewed and dismiss from post-focus queue"
                  style={{ padding: '4px 8px', fontSize: '0.7rem' }}
                >
                  <Check size={12} />
                  <span>Ack</span>
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
