import { afterEach, expect, it, vi } from 'vitest';
import { PhpDebugSession } from '../../../src/adapter/php/PhpDebugSession.js';
import { DbgpConnection } from '../../../src/adapter/php/dbgp/DbgpConnection.js';
import { parseResponse } from '../../../src/adapter/php/dbgp/DbgpResponseParser.js';
import { PathMapper } from '../../../src/core/path/PathMapper.js';
import { SessionLog } from '../../../src/core/session/SessionLog.js';

afterEach(() => vi.restoreAllMocks());

it('does not send stop after detaching from Xdebug while the socket still appears connected', async () => {
  vi.spyOn(DbgpConnection.prototype, 'isConnected', 'get').mockReturnValue(true);
  const send = vi.spyOn(DbgpConnection.prototype, 'sendCommand').mockResolvedValue(
    parseResponse('<response command="detach" transaction_id="1" status="stopping"/>'),
  );
  const close = vi.spyOn(DbgpConnection.prototype, 'close').mockResolvedValue();
  const session = new PhpDebugSession(new PathMapper({}, process.cwd()), '127.0.0.1', 0, new SessionLog());
  await session.detach();
  await session.close();
  expect(send.mock.calls.map(([command]) => command)).toEqual(['detach -i 1']);
  expect(close).toHaveBeenCalledOnce();
});
