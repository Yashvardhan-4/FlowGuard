import { Logger } from '../logger.js';
import { focusStateManager } from '../state/focusState.js';
import { InterruptionCategory, SilentReminder } from '../types.js';

const log = new Logger('SimulatedHardware');

export interface SimulatedRingDispatch {
  quickReplyText: string;
  deliveredAt: string;
  simulated: true;
}

export interface SimulatedAlexaAnnouncement {
  announcedText: string;
  room: string;
  chimeMuted: boolean;
  simulated: true;
}

export class RingDeviceSimulator {
  private chimeMuted: boolean = false;
  private unmutedAt: number = 0;

  playQuickReply(audioText: string): SimulatedRingDispatch {
    const timestamp = new Date().toISOString();
    log.info('[SIMULATED RING DOORBELL] Audio dispatched to outdoor speaker', {
      speakerAudio: audioText,
      device: 'Ring Video Doorbell Pro (Simulated)',
      status: 'TRANSMITTED',
    });

    return {
      quickReplyText: audioText,
      deliveredAt: timestamp,
      simulated: true,
    };
  }

  muteChime(durationMinutes: number): void {
    this.chimeMuted = true;
    this.unmutedAt = Date.now() + durationMinutes * 60 * 1000;
    log.info('[SIMULATED RING CHIME] Indoor chime muted to protect deep work flow', {
      chimeMuted: true,
      durationMinutes,
    });
  }

  isChimeMuted(): boolean {
    if (this.chimeMuted && Date.now() > this.unmutedAt) {
      this.chimeMuted = false;
    }
    return this.chimeMuted;
  }
}

export class AlexaSpeakerSimulator {
  announce(text: string, room: string = 'Office'): SimulatedAlexaAnnouncement {
    const timestamp = new Date().toISOString();
    log.info('[SIMULATED ALEXA ECHO] Spoken announcement in room', {
      room,
      spokenText: text,
      device: 'Echo Dot (Simulated)',
      timestamp,
    });

    return {
      announcedText: text,
      room,
      chimeMuted: false,
      simulated: true,
    };
  }
}

export class SilentNotificationQueueSimulator {
  enqueueSilentReminder(
    eventId: string,
    category: InterruptionCategory,
    headline: string,
    detail: string,
    urgencyScore: number
  ): SilentReminder {
    const reminder = focusStateManager.addSilentReminder({
      eventId,
      category,
      headline,
      detail,
      urgencyScore,
    });

    log.info('[SIMULATED SILENT QUEUE] Notification queued silently for post-focus review', {
      reminderId: reminder.id,
      headline,
      urgencyScore,
    });

    return reminder;
  }
}

export const ringSimulator = new RingDeviceSimulator();
export const alexaSimulator = new AlexaSpeakerSimulator();
export const silentQueueSimulator = new SilentNotificationQueueSimulator();
