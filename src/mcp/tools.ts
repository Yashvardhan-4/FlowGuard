import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { focusStateManager } from '../state/focusState.js';
import { bedrockArbitrator } from '../bedrock/arbitrator.js';
import { policyEngine } from '../safety/policyEngine.js';
import { privacyGuard } from '../safety/privacyGuard.js';
import { deduplicationTracker } from '../safety/deduplication.js';
import {
  ringSimulator,
  alexaSimulator,
  silentQueueSimulator,
} from '../hardware/simulatedDevices.js';
import {
  InterruptionPolicyLevelSchema,
  AllowedResponseActionSchema,
  InterruptionSourceSchema,
  InterruptionCategorySchema,
  ArbitrationActionSchema,
  TargetDeviceSchema,
  DeflectionExecutionResult,
} from '../types.js';
import { Logger } from '../logger.js';

const log = new Logger('MCPTools');

export function registerFlowGuardTools(server: McpServer): void {
  // Tool 1: set_focus_state
  server.tool(
    'set_focus_state',
    "Store the user's focus objective, duration, interruption policy, and permitted responses for deep work.",
    {
      objective: z.string().min(1).describe("The user's primary deep-work focus objective (e.g. 'Drafting Q3 Financial Deck')"),
      durationMinutes: z.number().int().positive().default(60).describe('Duration of deep work session in minutes'),
      interruptionPolicy: InterruptionPolicyLevelSchema.default('urgent_only').describe('Interruption tolerance: emergency_only, urgent_only, allow_family, lenient'),
      allowedResponses: z.array(AllowedResponseActionSchema).min(1).default(['ring_quick_reply', 'silent_queue']).describe('Permitted deflection actions (ring_quick_reply, silent_queue, alexa_spoken_response, etc.)'),
      autoDeflectDeliveries: z.boolean().default(true).describe('Automatically deflect package deliveries using Ring quick reply drop-off instructions'),
      vipContacts: z.array(z.string()).default([]).describe('Contacts permitted to bypass filters'),
      privacyMode: z.boolean().default(true).describe('Prevent any leakage of focus objective to callers/visitors'),
    },
    async (args) => {
      log.info('Executing set_focus_state tool', { objective: args.objective, policy: args.interruptionPolicy });
      const session = focusStateManager.setFocus(args);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                status: 'SUCCESS',
                message: 'Deep work focus state activated.',
                session: {
                  sessionId: session.sessionId,
                  objective: session.objective,
                  startTime: session.startTime,
                  endTime: session.endTime,
                  durationMinutes: session.durationMinutes,
                  interruptionPolicy: session.interruptionPolicy,
                  allowedResponses: session.allowedResponses,
                  autoDeflectDeliveries: session.autoDeflectDeliveries,
                  privacyMode: session.privacyMode,
                },
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // Tool 2: arbitrate_interruption
  server.tool(
    'arbitrate_interruption',
    'Evaluate a structured interruption event against the active focus state using Bedrock to propose an action, urgency score, and explanation.',
    {
      eventId: z.string().min(1).describe('Unique interruption event identifier for deduplication'),
      source: InterruptionSourceSchema.describe('Interruption source (ring_doorbell, alexa_speaker, phone_call, slack)'),
      category: InterruptionCategorySchema.describe('Classified interruption category (delivery, visitor, family_member, emergency, sales, noise)'),
      visitorName: z.string().optional().describe('Name of visitor or courier, if known'),
      transcription: z.string().default('').describe('Audio transcription from Ring doorbell or Alexa speaker'),
      urgencySignals: z.array(z.string()).default([]).describe('Signals indicating urgency (e.g. knocked_loudly, smoke_detected, carrying_box)'),
    },
    async (args) => {
      log.info('Executing arbitrate_interruption tool', { eventId: args.eventId, category: args.category });

      // Check deduplication
      if (deduplicationTracker.isDuplicate(args.eventId)) {
        const cached = deduplicationTracker.getCachedResult(args.eventId);
        if (cached) {
          log.info('Returning cached arbitration for duplicate event', { eventId: args.eventId });
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    status: 'DUPLICATE_EVENT_DETECTED',
                    eventId: args.eventId,
                    cachedExecution: cached,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }
      }

      const activeFocus = focusStateManager.getActiveFocus();
      const proposal = await bedrockArbitrator.arbitrate(
        {
          eventId: args.eventId,
          source: args.source,
          category: args.category,
          visitorName: args.visitorName,
          transcription: args.transcription,
          urgencySignals: args.urgencySignals,
          timestamp: new Date().toISOString(),
        },
        activeFocus
      );

      focusStateManager.addAuditLog('ARBITRATION', args.eventId, {
        proposalAction: proposal.action,
        urgencyScore: proposal.urgencyScore,
        requiresUserApproval: proposal.requiresUserApproval,
        modelUsed: proposal.modelUsed,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(proposal, null, 2),
          },
        ],
      };
    }
  );

  // Tool 3: execute_deflection
  server.tool(
    'execute_deflection',
    'Validate proposed action against deterministic policy, require approval where necessary, execute simulated hardware deflection, and record the result.',
    {
      eventId: z.string().min(1).describe('Event ID to execute deflection for'),
      action: ArbitrationActionSchema.describe('Action to execute'),
      targetDevice: TargetDeviceSchema.describe('Target device (ring_doorbell, alexa_speaker, user_phone, none)'),
      spokenResponseToVisitor: z.string().optional().describe('Spoken response for outdoor visitor'),
      internalReason: z.string().default('').describe('Reasoning for deflection'),
      urgencyScore: z.number().default(5).describe('Urgency score (1-10)'),
      requiresUserApproval: z.boolean().default(false).describe('Whether user approval is strictly required'),
      userApprovalGranted: z.boolean().optional().describe('Whether explicit user approval was granted'),
      category: InterruptionCategorySchema.default('delivery').describe('Category for policy context'),
    },
    async (args) => {
      log.info('Executing execute_deflection tool', { eventId: args.eventId, action: args.action });

      // Deduplication check
      if (deduplicationTracker.isDuplicate(args.eventId)) {
        const cached = deduplicationTracker.getCachedResult(args.eventId);
        if (cached) {
          log.info('Duplicate deflection execution blocked', { eventId: args.eventId });
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    eventId: args.eventId,
                    status: 'DUPLICATE_IGNORED',
                    actionTaken: cached.actionTaken,
                    explanation: 'Duplicate event already executed. Redundant execution prevented.',
                    simulatedHardware: cached.simulatedHardware,
                    timestamp: new Date().toISOString(),
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }
      }

      const activeFocus = focusStateManager.getActiveFocus();

      // Step 1: Policy validation (Deterministic application code enforcement)
      const policyCheck = policyEngine.validateAction(
        args.action,
        args.targetDevice,
        args.urgencyScore,
        args.requiresUserApproval,
        args.userApprovalGranted,
        activeFocus,
        args.category
      );

      // Step 2: Privacy audit and sanitization
      const privacyCheck = privacyGuard.auditVisitorResponse(
        args.spokenResponseToVisitor,
        activeFocus?.objective || '',
        args.category,
        activeFocus?.privacyMode ?? true
      );

      const finalVisitorText = privacyCheck.sanitizedResponse;
      const privacySanitized = !privacyCheck.isSafe;

      // Step 3: Hardware execution on simulated devices
      const simulatedHardware: DeflectionExecutionResult['simulatedHardware'] = {};
      let executionStatus: DeflectionExecutionResult['status'] = 'EXECUTED';

      if (!policyCheck.isAuthorized && policyCheck.downgraded) {
        executionStatus = 'REJECTED_UNAUTHORIZED';
      }

      const finalAction = policyCheck.finalAction;

      switch (finalAction) {
        case 'DEFLECT_RING_PRESET':
        case 'RING_SPOKEN_DEFLECTION': {
          const spoken = finalVisitorText || 'Please leave the package by the door. Thank you!';
          const ringResult = ringSimulator.playQuickReply(spoken);
          ringSimulator.muteChime(activeFocus?.durationMinutes || 60);

          simulatedHardware.ringDispatched = ringResult;
          simulatedHardware.alexaSpeaker = {
            chimeMuted: true,
            simulated: true,
          };

          // Always add silent reminder for post-focus review
          const reminder = silentQueueSimulator.enqueueSilentReminder(
            args.eventId,
            args.category,
            `Ring Delivery Deflected: "${spoken}"`,
            args.internalReason || 'Delivery auto-deflected during deep work.',
            args.urgencyScore
          );
          simulatedHardware.silentQueue = {
            reminderId: reminder.id,
            headline: reminder.headline,
            queuedAt: reminder.receivedAt,
          };
          break;
        }

        case 'SILENT_QUEUE': {
          executionStatus = policyCheck.downgraded ? 'REJECTED_UNAUTHORIZED' : 'QUEUED_SILENTLY';
          const reminder = silentQueueSimulator.enqueueSilentReminder(
            args.eventId,
            args.category,
            `Queued Notification (${args.category})`,
            args.internalReason || 'Interruption held silently for post-focus review.',
            args.urgencyScore
          );
          simulatedHardware.silentQueue = {
            reminderId: reminder.id,
            headline: reminder.headline,
            queuedAt: reminder.receivedAt,
          };
          break;
        }

        case 'ALLOW_BREAKTHROUGH': {
          const announceText = args.internalReason || 'Emergency notification requires your attention.';
          const alexaResult = alexaSimulator.announce(announceText, 'Office');
          simulatedHardware.alexaSpeaker = {
            announcedText: alexaResult.announcedText,
            chimeMuted: false,
            simulated: true,
          };
          break;
        }

        case 'IGNORE':
        default: {
          executionStatus = 'EXECUTED';
          break;
        }
      }

      const auditEntry = focusStateManager.addAuditLog('DEFLECTION_EXECUTED', args.eventId, {
        finalAction,
        executionStatus,
        privacySanitized,
        policyExplanation: policyCheck.explanation,
        simulatedHardware,
      });

      const result: DeflectionExecutionResult = {
        eventId: args.eventId,
        status: executionStatus,
        actionTaken: finalAction,
        simulatedHardware,
        userSilentReminder: simulatedHardware.silentQueue?.headline,
        auditLogId: auditEntry.id,
        timestamp: new Date().toISOString(),
        explanation: policyCheck.explanation,
        privacySanitized,
      };

      // Record in deduplication tracker
      deduplicationTracker.recordExecution(args.eventId, result);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  // Helper Tool 4: get_focus_session_summary
  server.tool(
    'get_focus_session_summary',
    'Retrieve active focus session details, pending silent post-focus reminders, and recent audit logs.',
    {},
    async () => {
      const active = focusStateManager.getActiveFocus();
      const reminders = focusStateManager.getPendingReminders();
      const logs = focusStateManager.getAuditLogs().slice(-10);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                activeFocusSession: active,
                pendingPostFocusReminders: reminders,
                recentAuditLogs: logs,
                hardwareState: {
                  ringChimeMuted: ringSimulator.isChimeMuted(),
                  simulatedRingActive: true,
                  simulatedAlexaActive: true,
                },
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
