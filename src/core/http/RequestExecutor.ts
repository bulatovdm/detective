import type { PreparedRequest } from './RequestBuilder.js';
import type { HttpResponse } from '../adapter/types.js';

export async function executeRequest(
  request: PreparedRequest,
  maxBodyLength: number,
  signal?: AbortSignal,
): Promise<HttpResponse> {
  const response = await fetch(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    redirect: 'follow',
    signal,
  });

  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  let body = await response.text();
  if (body.length > maxBodyLength) {
    body = body.slice(0, maxBodyLength) + `\n... [truncated at ${maxBodyLength} chars]`;
  }

  return {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
    body,
  };
}
