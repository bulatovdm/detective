import { appendFileSync, openSync, closeSync } from 'node:fs';
import { resolve } from 'node:path';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

const LEVEL_LABELS: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
};

const LEVEL_BY_NAME: Record<string, LogLevel> = {
  debug: LogLevel.DEBUG,
  info: LogLevel.INFO,
  warn: LogLevel.WARN,
  warning: LogLevel.WARN,
  error: LogLevel.ERROR,
};

function parseLevel(value: string | undefined, fallback: LogLevel): LogLevel {
  if (!value) return fallback;
  const lower = value.toLowerCase();
  return LEVEL_BY_NAME[lower] ?? fallback;
}

function openLogFile(path: string | undefined): number | null {
  if (!path) return null;
  try {
    const fd = openSync(resolve(path), 'a');
    const banner = `\n[${new Date().toISOString()}] [INFO] [Logger] === Detective log opened (pid ${process.pid}) ===\n`;
    appendFileSync(fd, banner);
    return fd;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[Logger] Failed to open log file '${path}': ${message}\n`);
    return null;
  }
}

const globalLevel = parseLevel(process.env['DETECTIVE_LOG_LEVEL'], LogLevel.INFO);
const logFileFd = openLogFile(process.env['DETECTIVE_LOG_FILE']);

if (logFileFd !== null) {
  const closeFd = () => {
    try { closeSync(logFileFd); } catch { /* ignore */ }
  };
  process.on('exit', closeFd);
}

export class Logger {
  constructor(
    private readonly prefix: string,
    private level: LogLevel = globalLevel,
  ) {}

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  debug(message: string, data?: unknown): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: unknown): void {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, data?: unknown): void {
    this.log(LogLevel.ERROR, message, data);
  }

  private log(level: LogLevel, message: string, data?: unknown): void {
    if (level < this.level) return;

    const timestamp = new Date().toISOString();
    const label = LEVEL_LABELS[level];
    const base = `[${timestamp}] [${label}] [${this.prefix}] ${message}`;
    const line = data !== undefined ? `${base} ${safeStringify(data)}\n` : `${base}\n`;

    process.stderr.write(line);

    if (logFileFd !== null) {
      try {
        appendFileSync(logFileFd, line);
      } catch {
        /* ignore — never let logging break the server */
      }
    }
  }
}

function safeStringify(data: unknown): string {
  try {
    return JSON.stringify(data);
  } catch {
    return String(data);
  }
}
