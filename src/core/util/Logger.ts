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

export class Logger {
  constructor(
    private readonly prefix: string,
    private level: LogLevel = LogLevel.INFO,
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
    const line = `[${timestamp}] [${label}] [${this.prefix}] ${message}`;

    if (data !== undefined) {
      process.stderr.write(`${line} ${JSON.stringify(data)}\n`);
    } else {
      process.stderr.write(`${line}\n`);
    }
  }
}
