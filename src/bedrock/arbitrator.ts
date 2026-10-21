import { ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { bedrockClientFactory } from './client.js';
import { config } from '../config.js';
import {
  FocusState,
  InterruptionEvent,
  ArbitrationProposal,
  ArbitrationAction,
  TargetDevice,
} from '../types.js';
import { privacyGuard } from '../safety/privacyGuard.js';
import { Logger } from '../logger.js';

const log = new Logger('BedrockArbitrator');

interface RawModelArbitrationOutput {
  action: ArbitrationAction;
  targetDevice: TargetDevice;
  spokenResponseToVisitor?: string;
  internalReason: string;
  urgencyScore: number;
  requiresUserApproval: boolean;
}

export class BedrockArbitrator {
  /**
   * Arbitrates an incoming interruption against the active focus state using Bedrock.
   * If live Bedrock invocation fails or is unconfigured, seamlessly falls back to
   * the deterministic offline arbitrator.
   */
  async arbitrate(
    interruption: InterruptionEvent,
    focusState: FocusState | null
  ): Promise<ArbitrationProposal> {
    const activeObjective = focusState?.objective || 'General Deep Work Session';
    const privacyMode = focusState?.privacyMode ?? true;

    // Check if live Bedrock client is available
    if (bedrockClientFactory.isLiveAvailable()) {
      try {
        const proposal = await this.invokeBedrock(interruption, focusState);
        return this.sanitizeAndFinalize(proposal, activeObjective, interruption.category, privacyMode);
      } catch (err) {
        log.warn('Bedrock invocation failed; falling back to deterministic local arbitrator', {
          eventId: interruption.eventId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Deterministic offline arbitrator fallback
    const fallbackProposal = this.deterministicArbitration(interruption, focusState);
    return this.sanitizeAndFinalize(
      fallbackProposal,
      activeObjective,
      interruption.category,
      privacyMode
    );
  }

  private async invokeBedrock(
    interruption: InterruptionEvent,
    focusState: FocusState | null
  ): Promise<ArbitrationProposal> {
    const client = bedrockClientFactory.getClient();
    if (!client) {
      throw new Error('Bedrock client unavailable');
    }

    const systemPrompt = `You are FlowGuard, an Alexa+ deep-work interruption arbitration agent.
Your mission is to protect the user's deep work flow while gracefully deflecting non-urgent interruptions.

CRITICAL SAFETY & PRIVACY DIRECTIVES:
1. NEVER disclose the user's focus objective, project name, calendar schedule, or private details to the visitor or doorbell speaker.
2. Visitor-facing spoken responses must be strictly neutral, brief, and courteous (e.g., "Please leave the package by the door. Thank you!").
3. For deliveries during focus, default to DEFLECT_RING_PRESET with a friendly drop-off instruction.
4. For urgent emergencies (smoke, medical, break-in), propose ALLOW_BREAKTHROUGH with urgencyScore >= 9.
5. For sales/solicitation, deflect firmly or ignore.
6. Return ONLY valid JSON adhering to the specified schema.`;

    const userPrompt = `Evaluate this interruption against the user's active focus session:

ACTIVE FOCUS SESSION:
${JSON.stringify(
  focusState
    ? {
        objective: focusState.objective,
        policy: focusState.interruptionPolicy,
        allowedResponses: focusState.allowedResponses,
        autoDeflectDeliveries: focusState.autoDeflectDeliveries,
        vipContacts: focusState.vipContacts,
        privacyMode: focusState.privacyMode,
      }
    : { status: 'NO_ACTIVE_FOCUS_SESSION' },
  null,
  2
)}

INTERRUPTION EVENT:
${JSON.stringify(interruption, null, 2)}

Respond with a JSON object matching this TypeScript structure:
{
  "action": "DEFLECT_RING_PRESET" | "RING_SPOKEN_DEFLECTION" | "SILENT_QUEUE" | "ALLOW_BREAKTHROUGH" | "IGNORE",
  "targetDevice": "ring_doorbell" | "alexa_speaker" | "user_phone" | "none",
  "spokenResponseToVisitor": string or null,
  "internalReason": string,
  "urgencyScore": number (1 to 10),
  "requiresUserApproval": boolean
}`;

    const command = new ConverseCommand({
      modelId: config.bedrockModelId,
      system: [{ text: systemPrompt }],
      messages: [{ role: 'user', content: [{ text: userPrompt }] }],
      inferenceConfig: {
        maxTokens: 800,
        temperature: 0.1,
      },
    });

    const response = await client.send(command);
    const textOutput = response.output?.message?.content?.[0]?.text;

    if (!textOutput) {
      throw new Error('Empty response from AWS Bedrock Converse API');
    }

    const parsed = this.parseJsonFromResponse(textOutput);
    return {
      eventId: interruption.eventId,
      action: parsed.action,
      targetDevice: parsed.targetDevice,
      spokenResponseToVisitor: parsed.spokenResponseToVisitor || undefined,
      internalReason: parsed.internalReason,
      urgencyScore: parsed.urgencyScore,
      requiresUserApproval: parsed.requiresUserApproval,
      privacyAuditPassed: true,
      modelUsed: `bedrock:${config.bedrockModelId}`,
      arbitratedAt: new Date().toISOString(),
    };
  }

  /**
   * High-fidelity deterministic arbitrator used when Bedrock is offline or in mock mode.
   */
  deterministicArbitration(
    interruption: InterruptionEvent,
    focusState: FocusState | null
  ): ArbitrationProposal {
    const category = interruption.category;
    const signals = interruption.urgencySignals.map((s) => s.toLowerCase());

    // Emergency scenario
    const isEmergency =
      category === 'emergency' ||
      signals.some((s) => s.includes('smoke') || s.includes('fire') || s.includes('alarm') || s.includes('medical'));

    if (isEmergency) {
      return {
        eventId: interruption.eventId,
        action: 'ALLOW_BREAKTHROUGH',
        targetDevice: 'alexa_speaker',
        spokenResponseToVisitor: undefined,
        internalReason: 'Critical urgency signals detected. Breakthrough permitted.',
        urgencyScore: 10,
        requiresUserApproval: false,
        privacyAuditPassed: true,
        modelUsed: 'deterministic-fallback:v1',
        arbitratedAt: new Date().toISOString(),
      };
    }

    // Delivery scenario
    if (category === 'delivery') {
      const autoDeflect = focusState?.autoDeflectDeliveries ?? true;
      return {
        eventId: interruption.eventId,
        action: autoDeflect ? 'DEFLECT_RING_PRESET' : 'SILENT_QUEUE',
        targetDevice: autoDeflect ? 'ring_doorbell' : 'none',
        spokenResponseToVisitor: 'Please leave the package by the door. Thank you!',
        internalReason: 'Courier delivery identified. Pre-authorized drop-off deflection applied.',
        urgencyScore: 2,
        requiresUserApproval: false,
        privacyAuditPassed: true,
        modelUsed: 'deterministic-fallback:v1',
        arbitratedAt: new Date().toISOString(),
      };
    }

    // Sales / Solicitation scenario
    if (category === 'sales') {
      return {
        eventId: interruption.eventId,
        action: 'DEFLECT_RING_PRESET',
        targetDevice: 'ring_doorbell',
        spokenResponseToVisitor: 'We are not interested at this time. Thank you.',
        internalReason: 'Solicitation detected. Quick non-intrusive deflection applied.',
        urgencyScore: 1,
        requiresUserApproval: false,
        privacyAuditPassed: true,
        modelUsed: 'deterministic-fallback:v1',
        arbitratedAt: new Date().toISOString(),
      };
    }

    // Family member scenario
    if (category === 'family_member') {
      const allowsFamily = focusState?.interruptionPolicy === 'allow_family' || focusState?.interruptionPolicy === 'lenient';
      return {
        eventId: interruption.eventId,
        action: allowsFamily ? 'ALLOW_BREAKTHROUGH' : 'SILENT_QUEUE',
        targetDevice: allowsFamily ? 'alexa_speaker' : 'none',
        spokenResponseToVisitor: allowsFamily ? undefined : 'The resident is in deep work and will get back to you shortly.',
        internalReason: allowsFamily
          ? 'Family member permitted under current interruption policy.'
          : 'Family member queued silently under urgent_only focus policy.',
        urgencyScore: 4,
        requiresUserApproval: false,
        privacyAuditPassed: true,
        modelUsed: 'deterministic-fallback:v1',
        arbitratedAt: new Date().toISOString(),
      };
    }

    // General visitor / Unknown
    return {
      eventId: interruption.eventId,
      action: 'SILENT_QUEUE',
      targetDevice: 'none',
      spokenResponseToVisitor: 'The resident is currently unavailable. Please leave a message or contact them directly.',
      internalReason: 'Standard visitor queued silently during active deep work.',
      urgencyScore: 3,
      requiresUserApproval: false,
      privacyAuditPassed: true,
      modelUsed: 'deterministic-fallback:v1',
      arbitratedAt: new Date().toISOString(),
    };
  }

  private parseJsonFromResponse(rawText: string): RawModelArbitrationOutput {
    let clean = rawText.trim();
    // Strip markdown code fences if present
    if (clean.startsWith('```')) {
      clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    }

    try {
      const parsed = JSON.parse(clean);
      return {
        action: parsed.action || 'SILENT_QUEUE',
        targetDevice: parsed.targetDevice || 'none',
        spokenResponseToVisitor: parsed.spokenResponseToVisitor || undefined,
        internalReason: parsed.internalReason || 'Arbitrated by FlowGuard',
        urgencyScore: typeof parsed.urgencyScore === 'number' ? parsed.urgencyScore : 5,
        requiresUserApproval: Boolean(parsed.requiresUserApproval),
      };
    } catch {
      log.error('Failed to parse Bedrock response as JSON; using fallback', { rawText });
      return {
        action: 'SILENT_QUEUE',
        targetDevice: 'none',
        internalReason: 'Model response was unparseable; defaulted to silent queue for safety',
        urgencyScore: 5,
        requiresUserApproval: false,
      };
    }
  }

  private sanitizeAndFinalize(
    proposal: ArbitrationProposal,
    objective: string,
    category: string,
    privacyMode: boolean
  ): ArbitrationProposal {
    const audit = privacyGuard.auditVisitorResponse(
      proposal.spokenResponseToVisitor,
      objective,
      category,
      privacyMode
    );

    return {
      ...proposal,
      spokenResponseToVisitor: audit.sanitizedResponse,
      privacyAuditPassed: audit.isSafe,
    };
  }
}

export const bedrockArbitrator = new BedrockArbitrator();
