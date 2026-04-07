export interface SessionLogEntry {
  offsetMs: number;
  message: string;
}

export class SessionLog {
  private readonly startTime = Date.now();
  private readonly entries: SessionLogEntry[] = [];

  add(message: string): void {
    this.entries.push({
      offsetMs: Date.now() - this.startTime,
      message,
    });
  }

  getEntries(): SessionLogEntry[] {
    return [...this.entries];
  }

  format(): string {
    return this.entries
      .map((e) => `[${e.offsetMs}ms] ${e.message}`)
      .join('\n');
  }
}
