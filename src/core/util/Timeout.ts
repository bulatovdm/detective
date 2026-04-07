export class TimeoutError extends Error {
  constructor(timeoutMs: number, stage?: string) {
    const stageInfo = stage ? ` during: ${stage}` : '';
    super(`Operation timed out after ${timeoutMs}ms${stageInfo}`);
    this.name = 'TimeoutError';
  }
}

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;

    const settle = () => {
      if (settled) return false;
      settled = true;
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
      return true;
    };

    const onAbort = () => {
      if (settle()) reject(signal!.reason ?? new Error('Aborted'));
    };

    const timer = setTimeout(() => {
      if (settle()) reject(new TimeoutError(timeoutMs));
    }, timeoutMs);

    if (signal) {
      signal.addEventListener('abort', onAbort);
    }

    promise.then(
      (value) => { if (settle()) resolve(value); },
      (error) => { if (settle()) reject(error); },
    );
  });
}
