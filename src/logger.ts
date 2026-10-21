import { config } from './config.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_SEVERITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function formatLog(level: LogLevel, component: string, message: string, meta?: Record<string, unknown>): string {
  const payload = {
    timestamp: new Date().toISOString(),
    level: level.toUpperCase(),
    component,
    message,
    ...(meta ? sanitizeMeta(meta) : {}),
  };
  return JSON.stringify(payload);
}

function sanitizeMeta(meta: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes('secret') ||
      lowerKey.includes('key') ||
      lowerKey.includes('token') ||
      lowerKey.includes('password')
    ) {
      sanitized[key] = '[REDACTED]';
    } else if (value instanceof Error) {
      sanitized[key] = {
        name: value.name,
        message: value.message,
        stack: value.stack,
      };
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export class Logger {
  private component: string;

  constructor(component: string) {
    this.component = component;
  }

  private shouldLog(level: LogLevel): boolean {
    const currentSeverity = LEVEL_SEVERITY[config.logLevel] || 20;
    return LEVEL_SEVERITY[level] >= currentSeverity;
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('debug')) {
      console.debug(formatLog('debug', this.component, message, meta));
    }
  }

  info(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('info')) {
      console.info(formatLog('info', this.component, message, meta));
    }
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('warn')) {
      console.warn(formatLog('warn', this.component, message, meta));
    }
  }

  error(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('error')) {
      console.error(formatLog('error', this.component, message, meta));
    }
  }
}

export const logger = new Logger('FlowGuard');
