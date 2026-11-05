import { afterEach, describe, expect, it, vi } from 'vitest';
import { PhpAdapter } from '../../../src/adapter/php/PhpAdapter.js';
import { PhpDebugSession } from '../../../src/adapter/php/PhpDebugSession.js';
import { parseConfig } from '../../../src/core/config/ConfigLoader.js';
import { extractPhpConfig } from '../../../src/adapter/php/config/PhpAdapterConfig.js';

vi.mock('../../../src/adapter/php/PhpDebugSession.js', () => ({
  PhpDebugSession: vi.fn(),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

describe('PhpAdapter authentication', () => {
  it('finishes login before listening and sends the authenticated target request after listening', async () => {
    const events: string[] = [];
    const session = {
      listen: vi.fn(async () => { events.push('listen'); }),
      startAccepting: vi.fn(),
      waitForConnectionAndConfigure: vi.fn(async () => {}),
      runWithBreakpoints: vi.fn(async () => ({ hits: [], errors: [], meta: {} })),
      detach: vi.fn(async () => {}),
      close: vi.fn(async () => {}),
    };
    vi.mocked(PhpDebugSession).mockImplementation(() => session as unknown as PhpDebugSession);
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: { headers: Record<string, string> }) => {
      if (url.endsWith('/login')) {
        events.push('login');
        expect(session.listen).not.toHaveBeenCalled();
        return { status: 200, headers: { getSetCookie: () => ['session=probe; Path=/'] } };
      }
      events.push('target');
      expect(init.headers.Cookie).toContain('session=probe');
      expect(init.headers.Cookie).toContain('XDEBUG_SESSION=detective');
      return { status: 200, statusText: 'OK', headers: new Headers(), text: async () => '{}' };
    }));
    const adapter = new PhpAdapter();
    await adapter.initialize(extractPhpConfig(parseConfig({
      app: { url: 'https://example.test' },
      auth: { type: 'form', url: '/login', credentials: { user: 'probe' } },
    }), process.cwd()));
    await adapter.executeDebugSession({
      trigger: { type: 'http', url: '/target' },
      breakpoints: [{ type: 'exception', exception: '*' }],
    });
    expect(events).toEqual(['login', 'listen', 'target']);
    await adapter.shutdown();
  });

  it('does not open the debugger listener when login fails', async () => {
    const session = { listen: vi.fn(), close: vi.fn(async () => {}) };
    vi.mocked(PhpDebugSession).mockImplementation(() => session as unknown as PhpDebugSession);
    vi.stubGlobal('fetch', vi.fn(async () => ({ status: 401 })));
    const adapter = new PhpAdapter();
    await adapter.initialize(extractPhpConfig(parseConfig({
      app: { url: 'https://example.test' },
      auth: { type: 'form', url: '/login', credentials: { user: 'probe' } },
    }), process.cwd()));
    await expect(adapter.executeDebugSession({
      trigger: { type: 'http', url: '/target' }, breakpoints: [],
    })).rejects.toThrow('failed with status 401');
    expect(session.listen).not.toHaveBeenCalled();
    expect(session.close).toHaveBeenCalled();
  });
});
