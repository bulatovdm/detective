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

  const headers = mergeHeadersCaseInsensitive(
    { 'Cookie': `XDEBUG_SESSION=${ideKey}` },
    trigger.headers,
  );

  let body: string | undefined;
  if (trigger.body !== undefined) {
    if (typeof trigger.body === 'string') {
      body = trigger.body;
    } else {
      body = JSON.stringify(trigger.body);
      if (!hasHeaderCaseInsensitive(headers, 'Content-Type')) {
        headers['Content-Type'] = 'application/json';
      }
    }
  }

  return {
    url: url.toString(),
    method: trigger.method,
    headers,
    body,
  };
}

function mergeHeadersCaseInsensitive(
  base: Record<string, string>,
  extra: Record<string, string> | undefined,
): Record<string, string> {
  const result: Record<string, string> = { ...base };

  if (!extra) {
    return result;
  }

  for (const [key, value] of Object.entries(extra)) {
    const existingKey = findHeaderKeyCaseInsensitive(result, key);
    if (existingKey !== undefined) {
      result[existingKey] = value;
    } else {
      result[key] = value;
    }
  }

  return result;
}

function hasHeaderCaseInsensitive(
  headers: Record<string, string>,
  name: string,
): boolean {
  return findHeaderKeyCaseInsensitive(headers, name) !== undefined;
}

function findHeaderKeyCaseInsensitive(
  headers: Record<string, string>,
  name: string,
): string | undefined {
  const lower = name.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === lower) {
      return key;
    }
  }
  return undefined;
}
