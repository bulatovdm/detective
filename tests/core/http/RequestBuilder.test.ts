import { describe, it, expect } from 'vitest';
import { buildRequest } from '../../../src/core/http/RequestBuilder.js';

describe('buildRequest', () => {
  it('appends XDEBUG_SESSION_START query parameter and Cookie', () => {
    const result = buildRequest(
      { type: 'http', url: '/api/foo', method: 'GET' },
      'http://app.test',
      'IDE',
    );

    expect(result.url).toBe('http://app.test/api/foo?XDEBUG_SESSION_START=IDE');
    expect(result.headers['Cookie']).toBe('XDEBUG_SESSION=IDE');
    expect(result.body).toBeUndefined();
  });

  it('keeps a string body untouched', () => {
    const result = buildRequest(
      {
        type: 'http',
        url: '/api/foo',
        method: 'PUT',
        body: '{"deleted":false}',
        headers: { 'content-type': 'application/json' },
      },
      'http://app.test',
      'IDE',
    );

    expect(result.body).toBe('{"deleted":false}');
  });

  it('serializes an object body and adds Content-Type when none is provided', () => {
    const result = buildRequest(
      {
        type: 'http',
        url: '/api/foo',
        method: 'POST',
        body: { deleted: false },
      },
      'http://app.test',
      'IDE',
    );

    expect(result.body).toBe('{"deleted":false}');
    expect(result.headers['Content-Type']).toBe('application/json');
  });

  it('does not duplicate Content-Type when caller already provided it in any case', () => {
    const result = buildRequest(
      {
        type: 'http',
        url: '/api/foo',
        method: 'POST',
        body: { deleted: false },
        headers: { 'content-type': 'application/json' },
      },
      'http://app.test',
      'IDE',
    );

    const headerKeys = Object.keys(result.headers).filter(
      key => key.toLowerCase() === 'content-type',
    );

    expect(headerKeys).toHaveLength(1);
    expect(result.headers[headerKeys[0]!]).toBe('application/json');
  });

  it('does not duplicate Cookie when caller passes one in different case', () => {
    const result = buildRequest(
      {
        type: 'http',
        url: '/api/foo',
        method: 'GET',
        headers: { cookie: 'session=abc' },
      },
      'http://app.test',
      'IDE',
    );

    const cookieKeys = Object.keys(result.headers).filter(
      key => key.toLowerCase() === 'cookie',
    );

    expect(cookieKeys).toHaveLength(1);
    expect(result.headers[cookieKeys[0]!]).toBe('session=abc');
  });

  it('preserves the caller-supplied Content-Type value when an object body is given', () => {
    const result = buildRequest(
      {
        type: 'http',
        url: '/api/foo',
        method: 'POST',
        body: { foo: 'bar' },
        headers: { 'Content-Type': 'application/vnd.api+json' },
      },
      'http://app.test',
      'IDE',
    );

    const headerKeys = Object.keys(result.headers).filter(
      key => key.toLowerCase() === 'content-type',
    );

    expect(headerKeys).toHaveLength(1);
    expect(result.headers[headerKeys[0]!]).toBe('application/vnd.api+json');
  });
});
