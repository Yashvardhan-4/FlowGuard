import { z } from 'zod';

export const InterruptionPolicyLevelSchema = z.enum([
  'emergency_only',
  'urgent_only',
  'allow_family',
  'lenient',
]);
export type InterruptionPolicyLevel = z.infer<typeof InterruptionPolicyLevelSchema>;

export const AllowedResponseActionSchema = z.enum([
  'ring_quick_reply',
  'silent_queue',
  'alexa_spoken_response',
  'emergency_breakthrough',
  'auto_text',
]);
export type AllowedResponseAction = z.infer<typeof AllowedResponseActionSchema>;

export const SetFocusStateInputSchema = z.object({
  objective: z.string().min(1, 'Objective must not be empty'),
  durationMinutes: z.number().int().positive().default(60),
  interruptionPolicy: InterruptionPolicyLevelSchema.default('urgent_only'),
  allowedResponses: z
    .array(AllowedResponseActionSchema)
    .min(1, 'At least one allowed response action required')
    .default(['ring_quick_reply', 'silent_queue']),
  autoDeflectDeliveries: z.boolean().default(true),
  vipContacts: z.array(z.string()).default([]),
  privacyMode: z.boolean().default(true),
});
export type SetFocusStateInput = z.infer<typeof SetFocusStateInputSchema>;

export interface FocusState {
  sessionId: string;
  objective: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  interruptionPolicy: InterruptionPolicyLevel;
  allowedResponses: AllowedResponseAction[];
  autoDeflectDeliveries: boolean;
  vipContacts: string[];
  privacyMode: boolean;
  isActive: boolean;
  createdAt: string;
}

export const InterruptionSourceSchema = z.enum([
  'ring_doorbell',
  'alexa_speaker',
  'phone_call',
  'slack',
]);
export type InterruptionSource = z.infer<typeof InterruptionSourceSchema>;

export const InterruptionCategorySchema = z.enum([
  'delivery',
  'visitor',
  'family_member',
  'emergency',
  'sales',
  'noise',
]);
export type InterruptionCategory = z.infer<typeof InterruptionCategorySchema>;

export const InterruptionEventSchema = z.object({
  eventId: z.string().min(1, 'eventId is required for idempotency tracking'),
  source: InterruptionSourceSchema,
  category: InterruptionCategorySchema,
  visitorName: z.string().optional(),
  transcription: z.string().default(''),
  urgencySignals: z.array(z.string()).default([]),
  timestamp: z.string().default(() => new Date().toISOString()),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type InterruptionEvent = z.infer<typeof InterruptionEventSchema>;

export const ArbitrationActionSchema = z.enum([
  'DEFLECT_RING_PRESET',
  'RING_SPOKEN_DEFLECTION',
  'SILENT_QUEUE',
  'ALLOW_BREAKTHROUGH',
  'IGNORE',
]);
export type ArbitrationAction = z.infer<typeof ArbitrationActionSchema>;

export const TargetDeviceSchema = z.enum([
  'ring_doorbell',
  'alexa_speaker',
  'user_phone',
  'none',
]);
export type TargetDevice = z.infer<typeof TargetDeviceSchema>;

export const ArbitrateInterruptionInputSchema = z.object({
  interruption: InterruptionEventSchema,
});
export type ArbitrateInterruptionInput = z.infer<typeof ArbitrateInterruptionInputSchema>;

export interface ArbitrationProposal {
  eventId: string;
  action: ArbitrationAction;
  targetDevice: TargetDevice;
  spokenResponseToVisitor?: string;
  internalReason: string;
  urgencyScore: number;
  requiresUserApproval: boolean;
  privacyAuditPassed: boolean;
  modelUsed: string;
  arbitratedAt: string;
}

export const ExecuteDeflectionInputSchema = z.object({
  eventId: z.string().min(1, 'eventId is required'),
  proposedAction: z.object({
    action: ArbitrationActionSchema,
    targetDevice: TargetDeviceSchema,
    spokenResponseToVisitor: z.string().optional(),
    internalReason: z.string().default(''),
    urgencyScore: z.number().min(0).max(10).default(5),
    requiresUserApproval: z.boolean().default(false),
  }),
  userApprovalGranted: z.boolean().optional(),
  overrideReason: z.string().optional(),
});
export type ExecuteDeflectionInput = z.infer<typeof ExecuteDeflectionInputSchema>;

export type DeflectionStatus =
  | 'EXECUTED'
  | 'REJECTED_UNAUTHORIZED'
  | 'QUEUED_SILENTLY'
  | 'FALLBACK_TRIGGERED'
  | 'DUPLICATE_IGNORED';

export interface DeflectionExecutionResult {
  eventId: string;
  status: DeflectionStatus;
  actionTaken: ArbitrationAction;
  simulatedHardware: {
    ringDispatched?: {
      quickReplyText: string;
      deliveredAt: string;
      simulated: true;
    };
    alexaSpeaker?: {
      chimeMuted: boolean;
      announcedText?: string;
      simulated: true;
    };
    silentQueue?: {
      reminderId: string;
      headline: string;
      queuedAt: string;
    };
  };
  userSilentReminder?: string;
  auditLogId: string;
  timestamp: string;
  explanation: string;
  privacySanitized: boolean;
}

export interface SilentReminder {
  id: string;
  eventId: string;
  category: InterruptionCategory;
  headline: string;
  detail: string;
  urgencyScore: number;
  receivedAt: string;
  reviewed: boolean;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  eventId: string;
  eventType: 'FOCUS_SET' | 'ARBITRATION' | 'DEFLECTION_EXECUTED' | 'SECURITY_BLOCKED' | 'DUPLICATE_REJECTED';
  details: Record<string, unknown>;
}
