import { describe, it, expect, afterEach } from 'vitest';
import { createConnection, type Socket } from 'node:net';
import { AddressInfo } from 'node:net';
import { DbgpConnection } from '../../../../src/adapter/php/dbgp/DbgpConnection.js';

const HOST = '127.0.0.1';

async function bindConnection(): Promise<{ connection: DbgpConnection; port: number }> {
  const connection = new DbgpConnection();
  connection.on('error', () => {});
  await connection.listen(HOST, 0);
  const server = (connection as unknown as { server: { address(): AddressInfo } }).server;
  const port = server.address().port;
  return { connection, port };
}

function dialAsXdebug(port: number): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: HOST, port });
    const onConnectError = (err: Error) => reject(err);
    socket.on('error', () => {});
    socket.once('error', onConnectError);
    socket.once('connect', () => {
      socket.removeListener('error', onConnectError);
      resolve(socket);
    });
  });
}

function buildInitPacket(): Buffer {
  const xml = `<?xml version="1.0" encoding="iso-8859-1"?>` +
    `<init xmlns="urn:debugger_protocol_v1" fileuri="file:///tmp/test.php" idekey="IDE"` +
    ` language="PHP" protocol_version="1.0" appid="1" engine_version="3.0.0"><engine>Xdebug</engine></init>`;
  return Buffer.from(`${xml.length}\0${xml}\0`, 'utf-8');
}

describe('DbgpConnection', () => {
  let connection: DbgpConnection | null = null;
  let peer: Socket | null = null;

  afterEach(async () => {
    if (peer && !peer.destroyed) peer.destroy();
    peer = null;
    if (connection) {
      await connection.close().catch(() => {});
      connection = null;
    }
  });

  it('rejects pending sendCommand when socket closes before response', async () => {
    const bound = await bindConnection();
    connection = bound.connection;

    const initPromise = connection.waitForConnection(2000);
    peer = await dialAsXdebug(bound.port);
    peer.write(buildInitPacket());
    await initPromise;

    const pending = connection.sendCommand('stop -i 1');

    await new Promise<void>((resolve) => {
      peer!.end(() => resolve());
    });

    await expect(pending).rejects.toThrow(/Socket closed before response/);
  });

  it('close() completes even when a command was sent right before peer disconnect', async () => {
    const bound = await bindConnection();
    connection = bound.connection;

    const initPromise = connection.waitForConnection(2000);
    peer = await dialAsXdebug(bound.port);
    peer.write(buildInitPacket());
    await initPromise;

    const pending = connection.sendCommand('stop -i 1');
    pending.catch(() => {});

    peer.destroy();
    await new Promise((resolve) => setTimeout(resolve, 20));

    await expect(
      Promise.race([
        connection.close(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('close() hung')), 1000)),
      ]),
    ).resolves.toBeUndefined();
  });

  it('sendCommand throws when there is no active connection', async () => {
    connection = new DbgpConnection();
    await expect(connection.sendCommand('run -i 1')).rejects.toThrow(/No active DBGp connection/);
  });

  it('rejects subsequent inbound connections while one is active', async () => {
    const bound = await bindConnection();
    connection = bound.connection;

    const initPromise = connection.waitForConnection(2000);
    peer = await dialAsXdebug(bound.port);
    peer.write(buildInitPacket());
    await initPromise;

    const secondPeer = await dialAsXdebug(bound.port);
    secondPeer.on('error', () => {});

    await new Promise<void>((resolve) => {
      secondPeer.once('close', () => resolve());
    });

    expect(secondPeer.destroyed).toBe(true);
  });
});
