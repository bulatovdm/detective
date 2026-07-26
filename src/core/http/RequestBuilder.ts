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

  const headers = mergeHeaders(
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

export function mergeHeaders(
  base: Record<string, string>,
  extra: Record<string, string> | undefined,
): Record<string, string> {
  const headers = mergeHeadersCaseInsensitive(base, extra);

  const baseCookieKey = findHeaderKeyCaseInsensitive(base, 'Cookie');
  const extraCookieKey = findHeaderKeyCaseInsensitive(extra ?? {}, 'Cookie');

  if (baseCookieKey === undefined || extraCookieKey === undefined) {
    return headers;
  }

  const cookieKey = findHeaderKeyCaseInsensitive(headers, 'Cookie') as string;

  headers[cookieKey] = mergeCookies(
    base[baseCookieKey] as string,
    (extra as Record<string, string>)[extraCookieKey],
  );

  return headers;
}

function mergeCookies(base: string, extra: string | undefined): string {
  if (extra === undefined || extra.trim() === '') {
    return base;
  }

  const names = new Set(
    parseCookieNames(extra),
  );

  const kept = base
    .split(';')
    .map((pair) => pair.trim())
    .filter((pair) => pair !== '' && !names.has(cookieName(pair)));

  return [...kept, extra.trim()].join('; ');
}

function parseCookieNames(cookie: string): string[] {
  return cookie
    .split(';')
    .map((pair) => cookieName(pair.trim()))
    .filter((name) => name !== '');
}

function cookieName(pair: string): string {
  const separator = pair.indexOf('=');

  return (separator === -1 ? pair : pair.slice(0, separator)).trim();
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
