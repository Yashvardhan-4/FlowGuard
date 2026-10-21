import {
  FocusState,
  ArbitrationAction,
  TargetDevice,
  AllowedResponseAction,
} from '../types.js';
import { Logger } from '../logger.js';

const log = new Logger('PolicyEngine');

export interface PolicyValidationResult {
  isAuthorized: boolean;
  finalAction: ArbitrationAction;
  targetDevice: TargetDevice;
  explanation: string;
  downgraded: boolean;
  requiresExternalMessage: boolean;
}

export class PolicyEngine {
  /**
   * Deterministically validates Bedrock's proposed action against user focus policy.
   * Enforces that the LLM cannot bypass authorization or execute forbidden actions.
   */
  validateAction(
    proposedAction: ArbitrationAction,
    targetDevice: TargetDevice,
    urgencyScore: number,
    requiresUserApproval: boolean,
    userApprovalGranted: boolean | undefined,
    focusState: FocusState | null,
    category: string
  ): PolicyValidationResult {
    // If no focus state is active, safe fallback
    if (!focusState) {
      log.info('No active focus state found; applying default non-intrusive policy');
      return {
        isAuthorized: true,
        finalAction: proposedAction,
        targetDevice,
        explanation: 'No active focus session; standard policy applied.',
        downgraded: false,
        requiresExternalMessage: targetDevice === 'ring_doorbell' && proposedAction !== 'IGNORE',
      };
    }

    const allowed = new Set<AllowedResponseAction>(focusState.allowedResponses);

    // Rule 1: Emergency Breakthrough
    if (proposedAction === 'ALLOW_BREAKTHROUGH') {
      if (allowed.has('emergency_breakthrough') || urgencyScore >= 9) {
        return {
          isAuthorized: true,
          finalAction: 'ALLOW_BREAKTHROUGH',
          targetDevice: 'alexa_speaker',
          explanation: 'Emergency breakthrough authorized by policy (urgency score high).',
          downgraded: false,
          requiresExternalMessage: false,
        };
      } else {
        log.warn('LLM proposed ALLOW_BREAKTHROUGH but policy does not authorize breakthroughs! Downgrading.');
        return {
          isAuthorized: false,
          finalAction: 'SILENT_QUEUE',
          targetDevice: 'none',
          explanation: 'Emergency breakthrough rejected: not enabled in focus state allowed responses. Downgraded to silent queue.',
          downgraded: true,
          requiresExternalMessage: false,
        };
      }
    }

    // Rule 2: Delivery Deflection
    if (category === 'delivery') {
      if (focusState.autoDeflectDeliveries && allowed.has('ring_quick_reply')) {
        return {
          isAuthorized: true,
          finalAction: 'DEFLECT_RING_PRESET',
          targetDevice: 'ring_doorbell',
          explanation: 'Delivery deflection pre-authorized by autoDeflectDeliveries policy.',
          downgraded: false,
          requiresExternalMessage: true,
        };
      }
    }

    // Rule 3: External messaging & Spoken Deflection
    if (proposedAction === 'RING_SPOKEN_DEFLECTION' || proposedAction === 'DEFLECT_RING_PRESET') {
      if (!allowed.has('ring_quick_reply')) {
        log.warn('Ring deflection proposed but ring_quick_reply is not in allowedResponses! Downgrading to silent queue.');
        return {
          isAuthorized: false,
          finalAction: 'SILENT_QUEUE',
          targetDevice: 'none',
          explanation: 'Ring deflection not in user allowed responses; downgraded to silent queue.',
          downgraded: true,
          requiresExternalMessage: false,
        };
      }

      // External transmission check: If approval was required and not granted
      if (requiresUserApproval && !userApprovalGranted) {
        log.warn('Proposed action required user approval, but user approval was not granted. Downgrading to silent queue.');
        return {
          isAuthorized: false,
          finalAction: 'SILENT_QUEUE',
          targetDevice: 'none',
          explanation: 'Action requires explicit approval which was not granted. Downgraded to silent queue.',
          downgraded: true,
          requiresExternalMessage: false,
        };
      }

      return {
        isAuthorized: true,
        finalAction: proposedAction,
        targetDevice: 'ring_doorbell',
        explanation: 'Ring deflection authorized under active focus policy.',
        downgraded: false,
        requiresExternalMessage: true,
      };
    }

    // Rule 4: Silent Queue
    if (proposedAction === 'SILENT_QUEUE') {
      return {
        isAuthorized: true,
        finalAction: 'SILENT_QUEUE',
        targetDevice: 'none',
        explanation: 'Silent queue notification authorized.',
        downgraded: false,
        requiresExternalMessage: false,
      };
    }

    // Rule 5: Ignore
    return {
      isAuthorized: true,
      finalAction: 'IGNORE',
      targetDevice: 'none',
      explanation: 'Interruption ignored per policy.',
      downgraded: false,
      requiresExternalMessage: false,
    };
  }
}

export const policyEngine = new PolicyEngine();
