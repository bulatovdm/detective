import type { RequestTrigger } from '../adapter/types.js';

export interface PreparedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

export function buildRequest(
  trigger: RequestTrigger,
  appUrl: string,
  ideKey: string,
): PreparedRequest {
  const url = new URL(trigger.url, appUrl);
  url.searchParams.set('XDEBUG_SESSION_START', ideKey);

  const headers: Record<string, string> = {
    'Cookie': `XDEBUG_SESSION=${ideKey}`,
    ...trigger.headers,
  };

  let body: string | undefined;
  if (trigger.body !== undefined) {
    if (typeof trigger.body === 'string') {
      body = trigger.body;
    } else {
      body = JSON.stringify(trigger.body);
      headers['Content-Type'] ??= 'application/json';
    }
  }

  return {
    url: url.toString(),
    method: trigger.method,
    headers,
    body,
  };
}
