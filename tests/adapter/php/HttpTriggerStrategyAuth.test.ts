import { describe, it, expect, vi } from 'vitest';
import { mergeHeaders } from '../../../src/core/http/RequestBuilder.js';

describe('mergeHeaders with auth headers', () => {
  it('keeps both the auth cookie and a caller cookie', () => {
    const merged = mergeHeaders(
      { Cookie: 'session=from-auth' },
      { Cookie: 'extra=1' },
    );

    expect(merged.Cookie).toContain('session=from-auth');
    expect(merged.Cookie).toContain('extra=1');
  });

  it('lets the caller override the auth cookie of the same name', () => {
    const merged = mergeHeaders(
      { Cookie: 'session=from-auth' },
      { Cookie: 'session=from-caller' },
    );

    expect(merged.Cookie).toBe('session=from-caller');
  });

  it('keeps auth headers that the caller did not touch', () => {
    const merged = mergeHeaders(
      { 'X-Auth-Token': 'secret' },
      { 'Content-Type': 'application/json' },
    );

    expect(merged['X-Auth-Token']).toBe('secret');
    expect(merged['Content-Type']).toBe('application/json');
  });
});
