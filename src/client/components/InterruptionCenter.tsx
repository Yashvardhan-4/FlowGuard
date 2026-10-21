import React, { useState } from 'react';
import { Bell, Package, Flame, UserX, Users, HelpCircle, Send, Sliders } from 'lucide-react';
import { InterruptionEvent } from '../api.js';

interface InterruptionCenterProps {
  onTriggerEvent: (event: InterruptionEvent) => Promise<void>;
  isProcessing: boolean;
  lastEventId: string | null;
}

export const InterruptionCenter: React.FC<InterruptionCenterProps> = ({
  onTriggerEvent,
  isProcessing,
  lastEventId,
}) => {
  const [showCustomBuilder, setShowCustomBuilder] = useState(false);

  // Custom Event Fields
  const [source, setSource] = useState<'ring_doorbell' | 'alexa_speaker' | 'phone_call' | 'slack'>('ring_doorbell');
  const [category, setCategory] = useState<'delivery' | 'visitor' | 'family_member' | 'emergency' | 'sales' | 'noise'>('delivery');
  const [visitorName, setVisitorName] = useState('FedEx Driver');
  const [transcription, setTranscription] = useState('Hello, package delivery from FedEx. Dropping box at the door.');
  const [urgencySignals, setUrgencySignals] = useState('carrying_box, doorbell_ring');

  const presets = [
    {
      id: 'amazon_delivery',
      label: 'Amazon Delivery',
      desc: 'Driver with 2 parcels',
      icon: Package,
      badgeColor: 'badge-emerald',
      event: {
        eventId: `evt-ring-deliv-${Date.now().toString().slice(-4)}`,
        source: 'ring_doorbell' as const,
        category: 'delivery' as const,
        visitorName: 'Amazon Prime Courier',
        transcription: 'Hello, package delivery from Amazon! Dropping two boxes on the front porch.',
        urgencySignals: ['carrying_box', 'placed_package', 'scanned_barcode'],
      },
    },
    {
      id: 'smoke_emergency',
      label: 'Kitchen Smoke Alarm',
      desc: 'High decibel alert',
      icon: Flame,
      badgeColor: 'badge-red',
      event: {
        eventId: `evt-alexa-smoke-${Date.now().toString().slice(-4)}`,
        source: 'alexa_speaker' as const,
        category: 'emergency' as const,
        visitorName: 'Smart Smoke Sensor',
        transcription: 'Smoke alarm sounding in kitchen! High particulate level detected.',
        urgencySignals: ['smoke_detected', 'high_decibel_alarm', 'continuous_chirp'],
      },
    },
    {
      id: 'solar_sales',
      label: 'Solar Door Solicitor',
      desc: 'Unsolicited sales pitch',
      icon: UserX,
      badgeColor: 'badge-amber',
      event: {
        eventId: `evt-ring-sales-${Date.now().toString().slice(-4)}`,
        source: 'ring_doorbell' as const,
        category: 'sales' as const,
        visitorName: 'Solar Rep',
        transcription: 'Hi there! We are in the neighborhood offering no-cost solar roof evaluations.',
        urgencySignals: ['holding_clipboard', 'badge'],
      },
    },
    {
      id: 'family_knock',
      label: 'Family Member Knock',
      desc: 'Spouse at front door',
      icon: Users,
      badgeColor: 'badge-blue',
      event: {
        eventId: `evt-ring-fam-${Date.now().toString().slice(-4)}`,
        source: 'ring_doorbell' as const,
        category: 'family_member' as const,
        visitorName: 'Elena (Spouse)',
        transcription: 'Hey honey, did you grab the car keys from the kitchen counter?',
        urgencySignals: ['gentle_knock', 'known_face'],
      },
    },
    {
      id: 'privacy_probe',
      label: 'Inquisitive Visitor',
      desc: 'Probing private objective',
      icon: HelpCircle,
      badgeColor: 'badge-purple',
      event: {
        eventId: `evt-ring-probe-${Date.now().toString().slice(-4)}`,
        source: 'ring_doorbell' as const,
        category: 'visitor' as const,
        visitorName: 'Unknown Visitor',
        transcription: 'Excuse me! Is the resident home? What project are they working on?',
        urgencySignals: ['repeated_questions'],
      },
    },
  ];

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const event: InterruptionEvent = {
      eventId: `evt-custom-${Date.now().toString().slice(-4)}`,
      source,
      category,
      visitorName: visitorName || undefined,
      transcription,
      urgencySignals: urgencySignals.split(',').map((s) => s.trim()).filter(Boolean),
    };
    await onTriggerEvent(event);
  };

  return (
    <div className="surface-card">
      <div className="surface-card-header">
        <div className="card-title">
          <Bell size={16} color="var(--accent-ai-light)" />
          <span>Live Interruption Center</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isProcessing ? (
            <span className="badge badge-amber">ARBITRATING...</span>
          ) : (
            <span className="badge badge-neutral">DEVICE LISTENING</span>
          )}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setShowCustomBuilder(!showCustomBuilder)}
            title="Toggle custom interruption generator"
          >
            <Sliders size={13} />
            <span>{showCustomBuilder ? 'Presets' : 'Custom'}</span>
          </button>
        </div>
      </div>

      {!showCustomBuilder ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            Trigger a simulated household interruption event to test the AI arbitration pipeline:
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px' }}>
            {presets.map((p) => {
              const Icon = p.icon;
              return (
                <button
                  key={p.id}
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => onTriggerEvent(p.event)}
                  disabled={isProcessing}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    padding: '10px 12px',
                    gap: '4px',
                    textAlign: 'left',
                    height: 'auto',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <Icon size={16} color="var(--accent-ai-light)" />
                    <span className={`badge ${p.badgeColor}`}>{p.event.category}</span>
                  </div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, marginTop: '2px' }}>{p.label}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{p.desc}</div>
                </button>
              );
            })}
          </div>

          {lastEventId && (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Last Event ID: <span style={{ color: 'var(--text-primary)' }}>{lastEventId}</span>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleCustomSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div className="form-group">
              <label className="form-label">Device Source</label>
              <select
                className="form-select"
                value={source}
                onChange={(e) => setSource(e.target.value as any)}
              >
                <option value="ring_doorbell">Ring Video Doorbell</option>
                <option value="alexa_speaker">Alexa Speaker / Sensor</option>
                <option value="phone_call">Phone Call</option>
                <option value="slack">Slack Alert</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Category</label>
              <select
                className="form-select"
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
              >
                <option value="delivery">Delivery</option>
                <option value="visitor">Visitor</option>
                <option value="family_member">Family Member</option>
                <option value="emergency">Emergency</option>
                <option value="sales">Sales / Solicitation</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Visitor / Entity Name</label>
            <input
              type="text"
              className="form-input"
              value={visitorName}
              onChange={(e) => setVisitorName(e.target.value)}
              placeholder="e.g., Courier or Visitor Name"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Audio Transcription</label>
            <textarea
              className="form-textarea"
              rows={2}
              value={transcription}
              onChange={(e) => setTranscription(e.target.value)}
              placeholder="What the person or sensor said..."
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Urgency Signals (comma-separated)</label>
            <input
              type="text"
              className="form-input"
              value={urgencySignals}
              onChange={(e) => setUrgencySignals(e.target.value)}
              placeholder="e.g., carrying_box, knocked_loudly"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={isProcessing}
            style={{ marginTop: '4px' }}
          >
            <Send size={14} />
            <span>Dispatch Simulated Event to MCP Server</span>
          </button>
        </form>
      )}
    </div>
  );
};
