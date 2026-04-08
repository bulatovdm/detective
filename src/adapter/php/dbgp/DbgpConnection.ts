import { createServer, type Server, type Socket } from 'node:net';
import { EventEmitter } from 'node:events';
import { Logger } from '../../../core/util/Logger.js';
import {
  parseInitPacket,
  parseResponse,
} from './DbgpResponseParser.js';
import type { DbgpInitPacket, DbgpResponse } from './DbgpProtocol.js';

interface DbgpConnectionEvents {
  init: [DbgpInitPacket];
  response: [DbgpResponse];
  error: [Error];
  close: [];
}

export class DbgpConnection extends EventEmitter<DbgpConnectionEvents> {
  private server: Server | null = null;
  private socket: Socket | null = null;
  private buffer = '';
  private readonly logger = new Logger('DbgpConnection');
  private pendingCallbacks: Array<{
    resolve: (response: DbgpResponse) => void;
    reject: (error: Error) => void;
  }> = [];
  private accepting = false;

  async listen(host: string, port: number): Promise<void> {
    try {
      await this.tryListen(host, port);
    } catch (err) {
      if (this.isAddressInUse(err)) {
        this.logger.warn(`Port ${port} in use, retrying after cleanup`);
        if (this.server) {
          this.server.close();
          this.server = null;
        }
        await this.delay(500);
        await this.tryListen(host, port);
      } else {
        throw err;
      }
    }
  }

  startAccepting(): void {
    this.accepting = true;
  }

  async waitForConnection(timeoutMs: number): Promise<DbgpInitPacket> {
    this.accepting = true;

    return new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        this.removeListener('init', onInit);
        this.removeListener('error', onError);
      };

      const onInit = (initPacket: DbgpInitPacket) => {
        cleanup();
        resolve(initPacket);
      };

      const onError = (err: Error) => {
        cleanup();
        reject(err);
      };

      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`No Xdebug connection within ${timeoutMs}ms`));
      }, timeoutMs);

      this.once('init', onInit);
      this.once('error', onError);
    });
  }

  async sendCommand(command: string): Promise<DbgpResponse> {
    if (!this.socket) {
      throw new Error('No active DBGp connection');
    }

    return new Promise((resolve, reject) => {
      const entry = { resolve, reject };
      this.pendingCallbacks.push(entry);

      const data = `${command}\0`;
      this.socket!.write(data, (err) => {
        if (err) {
          const idx = this.pendingCallbacks.indexOf(entry);
          if (idx !== -1) this.pendingCallbacks.splice(idx, 1);
          reject(err);
        }
      });
    });
  }

  async close(): Promise<void> {
    this.rejectPending(new Error('Connection closed'));

    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }

    if (this.server) {
      return new Promise((resolve) => {
        this.server!.close(() => {
          this.server = null;
          resolve();
        });
      });
    }
  }

  private rejectPending(error: Error): void {
    const callbacks = this.pendingCallbacks.splice(0);
    for (const cb of callbacks) {
      cb.reject(error);
    }
  }

  get isConnected(): boolean {
    return this.socket !== null && !this.socket.destroyed;
  }

  private async tryListen(host: string, port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = createServer((socket) => this.handleConnection(socket));

      this.server.on('error', (err) => {
        reject(err);
      });

      this.server.listen(port, host, () => {
        this.logger.info(`Listening on ${host}:${port}`);
        resolve();
      });
    });
  }

  private handleConnection(socket: Socket): void {
    if (!this.accepting || this.socket) {
      socket.destroy();
      return;
    }

    this.accepting = false;
    this.logger.info('Xdebug connected');
    this.socket = socket;
    this.buffer = '';

    socket.on('data', (data) => this.handleData(data));
    socket.on('error', (err) => this.emit('error', err));
    socket.on('close', () => {
      this.socket = null;
      this.emit('close');
    });
  }

  private handleData(data: Buffer): void {
    this.buffer += data.toString('utf-8');
    this.processBuffer();
  }

  private processBuffer(): void {
    while (this.buffer.length > 0) {
      const nullIndex = this.buffer.indexOf('\0');
      if (nullIndex === -1) break;

      const lengthStr = this.buffer.slice(0, nullIndex);
      const length = parseInt(lengthStr, 10);

      if (isNaN(length)) {
        const xmlEnd = this.buffer.indexOf('\0', nullIndex + 1);
        if (xmlEnd === -1) break;

        const xml = this.buffer.slice(0, xmlEnd);
        this.buffer = this.buffer.slice(xmlEnd + 1);
        this.handleXml(xml);
        continue;
      }

      const xmlStart = nullIndex + 1;
      const xmlEnd = xmlStart + length;

      if (this.buffer.length < xmlEnd + 1) break;

      const xml = this.buffer.slice(xmlStart, xmlEnd);
      this.buffer = this.buffer.slice(xmlEnd + 1);

      this.handleXml(xml);
    }
  }

  private handleXml(xml: string): void {
    try {
      if (xml.includes('<init ')) {
        const initPacket = parseInitPacket(xml);
        this.emit('init', initPacket);
      } else {
        const response = parseResponse(xml);
        const pending = this.pendingCallbacks.shift();
        if (pending) {
          pending.resolve(response);
        } else {
          this.emit('response', response);
        }
      }
    } catch (err) {
      this.logger.error('Failed to parse XML', { xml, error: String(err) });
      this.emit('error', err instanceof Error ? err : new Error(String(err)));
    }
  }

  private isAddressInUse(err: unknown): boolean {
    return (err as NodeJS.ErrnoException).code === 'EADDRINUSE';
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
